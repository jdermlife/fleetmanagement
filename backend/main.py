import os
import json
import asyncio

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import text

from app.database import Base, SessionLocal, engine
from app.fastapi_rate_limit import RATE_LIMIT_ENABLED, RateLimitMiddleware
from app.models.loan_application import LoanApplication  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.ai_governance import AIRequest, AIResponse, AIFeedback  # noqa: F401
from app.models.document import Document, DocumentVersion, DocumentTag, DocumentSignature  # noqa: F401
from app.models.notification import (
    Notification,
    NotificationDeadLetter,
    NotificationDeliveryAttempt,
    NotificationPreference,
    NotificationTemplate,
)  # noqa: F401
from app.models.users import User, AuthSession, MfaBackupCode  # noqa: F401
from app.models.roles import Role, Permission  # noqa: F401
from app.routes.drivers import router as driver_router
from app.routes.ai import router as ai_router
from app.routes.workflow import router as workflow_router
from app.routes.documents import router as documents_router
from app.routes.audit_logs import router as audit_logs_router
from app.routes.notifications import router as notifications_router
from app.routes.security import router as security_router, admin_router as security_admin_router
from app.observability import setup_observability
from app.services.audit_log_service import create_immutable_audit_constraints, write_audit_log
from app.services.notification_service import dispatch_queued_notifications
from app.services.security_bootstrap import seed_roles_and_permissions
from security.auth import TokenError, decode_token

from app.routes.lease import router as lease_router
from app.routes.database import router as database_router
from app.routes.loan_routes import router as loan_router

environment = os.getenv("ENVIRONMENT", "development").lower()
is_production = environment == "production"
api_docs_enabled = os.getenv("ENABLE_API_DOCS", "false" if is_production else "true").lower() == "true"

app = FastAPI(
    docs_url="/docs" if api_docs_enabled else None,
    redoc_url="/redoc" if api_docs_enabled else None,
    openapi_url="/openapi.json" if api_docs_enabled else None,
)
setup_observability(app)

auto_run_schema_migrations = os.getenv("AUTO_RUN_SCHEMA_MIGRATIONS", "false").lower() == "true"
notification_dispatcher_enabled = os.getenv("NOTIFICATION_DISPATCHER_ENABLED", "true").lower() == "true"
notification_dispatch_interval_seconds = int(os.getenv("NOTIFICATION_DISPATCH_INTERVAL_SECONDS", "30"))
notification_dispatch_batch_size = int(os.getenv("NOTIFICATION_DISPATCH_BATCH_SIZE", "100"))
notification_dispatcher_task: asyncio.Task | None = None

default_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://fleetmanagement-flame.vercel.app",
]

configured_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]

origin_regex = os.getenv("FRONTEND_ORIGIN_REGEX", "").strip()

if is_production:
    if os.getenv("ENFORCE_AUTH", "true").lower() != "true":
        raise RuntimeError("ENFORCE_AUTH must be true in production")
    if not (os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET")):
        raise RuntimeError("SECRET_KEY or JWT_SECRET must be configured in production")
    if not configured_origins:
        raise RuntimeError("FRONTEND_ORIGINS must be configured in production")
    if os.getenv("RATE_LIMIT_BACKEND", "memory").lower() != "redis":
        raise RuntimeError("RATE_LIMIT_BACKEND must be redis in production")

origins = list(dict.fromkeys([*default_origins, *configured_origins]))

cors_kwargs = {
    "allow_origins": origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if origin_regex:
    cors_kwargs["allow_origin_regex"] = origin_regex

app.add_middleware(CORSMiddleware, **cors_kwargs)

if RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Content-Security-Policy", "default-src 'self'")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
    if request.url.scheme == "https" or forwarded_proto.lower() == "https":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

    return response


def _infer_table_and_record(path: str) -> tuple[str, str | None]:
    segments = [segment for segment in path.strip("/").split("/") if segment]
    if not segments:
        return "root", None

    if len(segments) >= 2 and segments[0] == "workflows":
        table_name = segments[1]
    elif len(segments) >= 3 and segments[0] == "documents" and segments[1] == "entity":
        table_name = segments[2]
    else:
        table_name = segments[0]

    record_id = next((segment for segment in segments if segment.isdigit()), None)
    return table_name, record_id


def _extract_user_id_from_bearer(auth_header: str | None) -> int | None:
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return None

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None

    try:
        payload = decode_token(token)
        return int(payload.sub)
    except (TokenError, RuntimeError, ValueError):
        return None


@app.middleware("http")
async def immutable_audit_log_middleware(request: Request, call_next):
    method = request.method.upper()
    path = request.url.path

    old_value = None
    raw_body = b""
    if method in {"POST", "PUT", "PATCH", "DELETE"}:
        raw_body = await request.body()
        if raw_body:
            try:
                old_value = json.loads(raw_body.decode("utf-8"))
            except Exception:
                old_value = raw_body.decode("utf-8", errors="ignore")

        # Rehydrate request body for downstream handlers after it is read once.
        async def receive():
            return {"type": "http.request", "body": raw_body, "more_body": False}

        request = Request(request.scope, receive)

    response = await call_next(request)

    response_payload = {"status_code": response.status_code}
    response_body = b""
    if hasattr(response, "body_iterator"):
        chunks = [chunk async for chunk in response.body_iterator]
        response_body = b"".join(chunks)
        if response_body:
            try:
                response_payload = json.loads(response_body.decode("utf-8"))
            except Exception:
                response_payload = {
                    "status_code": response.status_code,
                    "body": response_body.decode("utf-8", errors="ignore"),
                }

        response = Response(
            content=response_body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

    table_name, record_id = _infer_table_and_record(path)
    user_id = _extract_user_id_from_bearer(request.headers.get("Authorization"))
    ip_address = (request.headers.get("X-Forwarded-For") or request.client.host if request.client else None)
    device = request.headers.get("User-Agent")

    db = SessionLocal()
    try:
        write_audit_log(
            db,
            user_id=user_id,
            action=f"{method} {path}",
            table_name=table_name,
            record_id=record_id,
            old_value=old_value,
            new_value=response_payload,
            ip_address=ip_address,
            device=device,
        )
    except Exception:
        # Audit failure should not break API availability.
        pass
    finally:
        db.close()

    return response

app.include_router(driver_router)
app.include_router(ai_router)
app.include_router(lease_router)
app.include_router(database_router)
app.include_router(workflow_router)
app.include_router(documents_router)
app.include_router(audit_logs_router)
app.include_router(notifications_router)
app.include_router(security_router, prefix="/api")
app.include_router(security_admin_router, prefix="/api")


app.include_router(
    loan_router,
    prefix="/api",
    tags=["Loan Origination"],
)


@app.on_event("startup")
def ensure_loan_application_schema() -> None:
    if not auto_run_schema_migrations:
        return

    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                ALTER TABLE loan_applications
                ADD COLUMN IF NOT EXISTS product_type VARCHAR;
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE loan_applications
                ADD COLUMN IF NOT EXISTS requirements JSONB;
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE loan_applications
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE loan_applications
                SET created_at = NOW()
                WHERE created_at IS NULL;
                """
            )
        )
        
        # Create workflow history table
        from app.workflow import create_workflow_tables
        create_workflow_tables(connection)

        # Enforce append-only (immutable) behavior for audit_logs.
        create_immutable_audit_constraints(connection)

        # Keep notification schema forward-compatible in existing environments.
        connection.execute(
            text(
                """
                ALTER TABLE notifications
                ADD COLUMN IF NOT EXISTS attempts_count INTEGER DEFAULT 0;
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE notifications
                ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 5;
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE notifications
                ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ DEFAULT NOW();
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE notifications
                ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;
                """
            )
        )
        connection.execute(
            text(
                """
                ALTER TABLE notifications
                ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT;
                """
            )
        )

    session = SessionLocal()
    try:
        seed_roles_and_permissions(session)
    except Exception:
        session.rollback()
    finally:
        session.close()


@app.on_event("startup")
def ensure_workflow_history_table() -> None:
    from app.workflow import create_workflow_tables

    with engine.begin() as connection:
        create_workflow_tables(connection)


async def _notification_dispatcher_loop() -> None:
    while True:
        db = SessionLocal()
        try:
            dispatch_queued_notifications(db, limit=notification_dispatch_batch_size)
        except Exception:
            pass
        finally:
            db.close()

        await asyncio.sleep(notification_dispatch_interval_seconds)


@app.on_event("startup")
async def start_notification_dispatcher() -> None:
    global notification_dispatcher_task
    if notification_dispatcher_enabled and notification_dispatcher_task is None:
        notification_dispatcher_task = asyncio.create_task(_notification_dispatcher_loop())


@app.on_event("shutdown")
async def stop_notification_dispatcher() -> None:
    global notification_dispatcher_task
    if notification_dispatcher_task:
        notification_dispatcher_task.cancel()
        try:
            await notification_dispatcher_task
        except asyncio.CancelledError:
            pass
        notification_dispatcher_task = None



@app.get("/")
def home():
    return {
        "message": "QT Fleet API Running"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


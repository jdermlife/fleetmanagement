"""Create FastAPI security tables and seed default RBAC data."""

from app.database import Base, SessionLocal, engine
from app.models.roles import Permission, Role  # noqa: F401
from app.models.users import AuthSession, MfaBackupCode, User  # noqa: F401
from app.services.security_bootstrap import seed_roles_and_permissions


def migrate() -> None:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_roles_and_permissions(db)
        print("Security migration completed")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()

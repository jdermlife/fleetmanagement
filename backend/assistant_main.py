from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.cors import get_allowed_frontend_origins, get_frontend_origin_regex
from app.fastapi_rate_limit import RATE_LIMIT_ENABLED, RateLimitMiddleware
from app.routes.page_assistant import router as page_assistant_router


app = FastAPI(
    title="FILSCORE Local Assistant Fallback",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_frontend_origins(),
    allow_origin_regex=get_frontend_origin_regex(),
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

if RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)

app.include_router(page_assistant_router)


@app.get("/health")
def health():
    return {"status": "healthy", "service": "local-assistant-fallback"}

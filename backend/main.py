import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.drivers import router as driver_router
from app.routes.ai import router as ai_router


from app.routes.lease import router as lease_router
from app.routes.database import router as database_router
from app.routes.loan_routes import router as loan_router




app = FastAPI()

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

origins = list(dict.fromkeys([*default_origins, *configured_origins]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(driver_router)
app.include_router(ai_router)
app.include_router(lease_router)
app.include_router(database_router)


app.include_router(
    loan_router,
    prefix="/api",
    tags=["Loan Origination"]
)



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



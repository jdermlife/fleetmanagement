from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.drivers import router as driver_router
from app.routes.ai import router as ai_router


from app.routes.lease import router as lease_router
from app.routes.database import router as database_router



app = FastAPI()

origins = [
    "http://localhost:5173",
    "https://fleetmanagement-flame.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(driver_router)
app.include_router(ai_router)
app.include_router(lease_router)
app.include_router(database_router)




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



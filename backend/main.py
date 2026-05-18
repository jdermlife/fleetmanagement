from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.drivers import router as driver_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(driver_router)

@app.get("/")
def home():
    return {
        "message": "QT Fleet API Running"
    }
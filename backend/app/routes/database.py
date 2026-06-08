from fastapi import APIRouter

router = APIRouter()

@router.get("/database/status")
def database_status():

    return {
        "engine": "SQLite",
        "database": "fms.db",
        "host": "BestBank Server",
        "port": 0,
        "source": "Fleet Management Database"
    }
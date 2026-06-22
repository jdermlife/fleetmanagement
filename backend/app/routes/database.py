from fastapi import APIRouter, Depends

from app.fastapi_auth import require_roles

router = APIRouter()

@router.get("/database/status", dependencies=[Depends(require_roles("Admin", "Manager"))])
def database_status():

    return {
        "engine": "SQLite",
        "database": "fms.db",
        "host": "BestBank Server",
        "port": 0,
        "source": "Fleet Management Database"
    }
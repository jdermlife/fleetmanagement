from fastapi import APIRouter

router = APIRouter()

@router.get("/lease-scorecards")
def get_lease_scorecards():
    return []

@router.post("/lease-scorecards")
def create_lease_scorecard(payload: dict):
    return payload
from fastapi import APIRouter
from data.levels_data import LAWS

router = APIRouter()


@router.get("/laws")
def get_laws():
    """Return all Boolean law reference cards."""
    return LAWS

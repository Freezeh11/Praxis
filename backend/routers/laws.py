from fastapi import APIRouter
from repositories.content_repository import list_laws

router = APIRouter()


@router.get("/laws")
def get_laws():
    """Return all Boolean law reference cards."""
    return list_laws()

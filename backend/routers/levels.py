from fastapi import APIRouter, HTTPException
from repositories.content_repository import get_level, list_level_summaries

router = APIRouter()


@router.get("/levels")
def get_levels():
    """Return all level metadata (without puzzle detail for the level select screen)."""
    return list_level_summaries()


@router.get("/levels/{level_id}")
def get_level(level_id: int):
    """Return a single level with full puzzle data."""
    level = get_level(level_id)
    if not level:
        raise HTTPException(status_code=404, detail=f"Level {level_id} not found")
    return level

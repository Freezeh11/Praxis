from fastapi import APIRouter, HTTPException
from data.levels_data import LEVELS

router = APIRouter()


@router.get("/levels")
def get_levels():
    """Return all level metadata (without puzzle detail for the level select screen)."""
    return [
        {
            "id": lv["id"],
            "name": lv["name"],
            "desc": lv["desc"],
            "varCount": lv["varCount"],
            "puzzleCount": len(lv["puzzles"]),
        }
        for lv in LEVELS
    ]


@router.get("/levels/{level_id}")
def get_level(level_id: int):
    """Return a single level with full puzzle data."""
    level = next((lv for lv in LEVELS if lv["id"] == level_id), None)
    if not level:
        raise HTTPException(status_code=404, detail=f"Level {level_id} not found")
    return level

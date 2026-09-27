"""``GET /api/progress`` and ``POST /api/progress/save`` — thin transport only.

Authenticates, maps the body to service arguments; imported by ``main.py`` only.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from api.schemas.progress import SaveProgressRequest
from core.responses import Envelope, success
from core.security import get_current_user
from services import progress_service

router = APIRouter()


@router.get("/progress", response_model=Envelope)
async def get_progress(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Full progress snapshot for the authenticated user."""
    return success(progress_service.load_progress(user["id"]))


@router.post("/progress/save", response_model=Envelope)
async def save_progress(
    req: SaveProgressRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Save/update the progress snapshot for the authenticated user."""
    progress = req.progress
    progress_service.save_progress(
        user_id=user["id"],
        points=progress.points,
        streak=progress.streak,
        best_streak=progress.bestStreak,
        stage_progress=progress.stageProgress,
        stage_scores=progress.stageScores,
    )
    return success({"status": "ok"})

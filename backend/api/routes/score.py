"""``POST /api/score`` — validate, score, optionally persist in the background.

Thin transport over ``services/scoring_service.py``; imported by ``main.py`` only.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends

from api.schemas.score import ScoreRequest, ScoreResponse
from core.responses import Envelope, success
from core.security import optional_user
from services import progress_service, scoring_service

router = APIRouter()


@router.post("/score", response_model=Envelope)
async def compute_score(
    req: ScoreRequest,
    background_tasks: BackgroundTasks,
    user: dict[str, Any] | None = Depends(optional_user),
) -> dict[str, Any]:
    """Score a completed puzzle; authenticated users get it saved in the background."""
    outcome = scoring_service.compute_score(
        level_id=req.levelId,
        stage_idx=req.stageIdx,
        steps_used=req.stepsUsed,
        laws_used=req.lawsUsed,
        hints_used=req.hintsUsed,
        guides_used=req.guidesUsed,
        optimal_steps=req.optimalSteps,
    )

    # Persistence is best-effort and must never delay or fail the response.
    if user:
        background_tasks.add_task(progress_service.persist_score, user["id"], outcome)

    payload = ScoreResponse(
        efficiency=outcome.efficiency,
        targetLaw=outcome.target_law,
        hintIndependence=outcome.hint_independence,
        total=outcome.total,
        earnedPoints=outcome.earned_points,
        breakdown=outcome.breakdown,
    )
    return success(payload.model_dump())

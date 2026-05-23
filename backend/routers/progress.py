from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth_middleware import get_current_user
from supabase_client import supabase

router = APIRouter()


class ProgressData(BaseModel):
    points: int = 0
    streak: int = 0
    bestStreak: int = 0
    stageProgress: dict = {}    # { "1": [0, 1, 2] }
    stageScores: dict = {}      # { "1:0": 87.5 }


class SaveProgressRequest(BaseModel):
    progress: ProgressData


@router.get("/progress")
async def get_progress(user: dict = Depends(get_current_user)):
    """Load full progress for the authenticated user."""
    user_id = user["id"]

    # Fetch user_progress
    result = supabase.table("user_progress").select("*").eq("user_id", user_id).execute()
    user_prog = result.data[0] if result.data else None

    # Fetch stage_progress
    stages_result = supabase.table("stage_progress").select("*").eq("user_id", user_id).execute()
    stages = stages_result.data or []

    # Build the progress object matching frontend format
    stage_progress = {}
    stage_scores = {}

    for sp in stages:
        level_key = str(sp["level_id"])
        if sp.get("completed"):
            if level_key not in stage_progress:
                stage_progress[level_key] = []
            if sp["stage_idx"] not in stage_progress[level_key]:
                stage_progress[level_key].append(sp["stage_idx"])

        if sp.get("best_score") and sp["best_score"] > 0:
            score_key = f"{sp['level_id']}:{sp['stage_idx']}"
            stage_scores[score_key] = sp["best_score"]

    return {
        "points": user_prog["points"] if user_prog else 0,
        "streak": user_prog["streak"] if user_prog else 0,
        "bestStreak": user_prog["best_streak"] if user_prog else 0,
        "stageProgress": stage_progress,
        "stageScores": stage_scores,
    }


@router.post("/progress/save")
async def save_progress(req: SaveProgressRequest, user: dict = Depends(get_current_user)):
    """Save/update progress snapshot for the authenticated user."""
    user_id = user["id"]
    p = req.progress

    # Upsert user_progress
    supabase.table("user_progress").upsert({
        "user_id": user_id,
        "points": p.points,
        "streak": p.streak,
        "best_streak": p.bestStreak,
    }).execute()

    # Upsert each stage_progress entry
    for level_key, completed_stages in p.stageProgress.items():
        level_id = int(level_key)
        for stage_idx in completed_stages:
            score_key = f"{level_id}:{stage_idx}"
            best_score = p.stageScores.get(score_key, 0)

            supabase.table("stage_progress").upsert({
                "user_id": user_id,
                "level_id": level_id,
                "stage_idx": stage_idx,
                "best_score": best_score,
                "completed": True,
            }).execute()

    return {"status": "ok"}

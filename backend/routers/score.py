from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from data.levels_data import LEVELS
from auth_middleware import optional_user

router = APIRouter()


class ScoreRequest(BaseModel):
    levelId: int
    stageIdx: int
    stepsUsed: int
    lawsUsed: List[str]   # list of law IDs applied (may have duplicates)
    hintsUsed: int        # number of hints/guides consumed


class ScoreResponse(BaseModel):
    efficiency: float        # 0–40
    targetLaw: float         # 0–30
    hintIndependence: float  # 0–30
    total: float             # 0–100
    earnedPoints: int        # bonus points awarded on top of base 10
    breakdown: dict


def save_score_to_db(user, req: ScoreRequest, efficiency, target_law, hint_independence, total, earned_points):
    try:
        from supabase_client import supabase

        # Save to score_history
        supabase.table("score_history").insert({
            "user_id": user["id"],
            "level_id": req.levelId,
            "stage_idx": req.stageIdx,
            "steps_used": req.stepsUsed,
            "laws_used": req.lawsUsed,
            "hints_used": req.hintsUsed,
            "efficiency": efficiency,
            "target_law": target_law,
            "hint_independence": hint_independence,
            "total": total,
            "earned_points": earned_points,
        }).execute()

        # Update best score in stage_progress
        existing = supabase.table("stage_progress").select("best_score").eq(
            "user_id", user["id"]
        ).eq("level_id", req.levelId).eq("stage_idx", req.stageIdx).execute()

        current_best = existing.data[0]["best_score"] if existing.data else 0

        if total > current_best:
            supabase.table("stage_progress").upsert({
                "user_id": user["id"],
                "level_id": req.levelId,
                "stage_idx": req.stageIdx,
                "best_score": total,
                "completed": True,
            }).on_conflict("user_id,level_id,stage_idx").execute()
    except Exception as e:
        # Don't fail the score computation if DB save fails
        print(f"Warning: Failed to save score to database: {e}")


@router.post("/score", response_model=ScoreResponse)
async def compute_score(req: ScoreRequest, background_tasks: BackgroundTasks, user: Optional[dict] = Depends(optional_user)):
    """Compute the three-metric score for a completed puzzle. Optionally saves to DB if authenticated."""
    level = next((lv for lv in LEVELS if lv["id"] == req.levelId), None)
    if not level:
        raise HTTPException(status_code=404, detail=f"Level {req.levelId} not found")
    if req.stageIdx >= len(level["puzzles"]):
        raise HTTPException(status_code=404, detail=f"Stage {req.stageIdx} not found")

    puzzle = level["puzzles"][req.stageIdx]
    optimal = puzzle.get("optimalSteps", req.stepsUsed)
    target_laws = set(puzzle.get("targetLaws", []))
    laws_used = set(req.lawsUsed)

    # ── 1. Efficiency (40%) ─────────────────────────────────────────────────
    # Perfect = at or below optimal steps. Each extra step costs 10 pts.
    if req.stepsUsed <= optimal:
        efficiency = 40.0
    else:
        over = req.stepsUsed - optimal
        efficiency = max(0.0, 40.0 - over * 10.0)

    # ── 2. Target Law Usage (30%) ───────────────────────────────────────────
    # All target laws must appear at least once. Partial credit per law used.
    if not target_laws:
        target_law = 30.0   # no target laws defined → full marks
    else:
        matched = len(target_laws & laws_used)
        target_law = round((matched / len(target_laws)) * 30.0, 1)

    # ── 3. Hint Independence (30%) ──────────────────────────────────────────
    # 0 hints = 30 pts. Each hint/guide used costs 10 pts. Minimum 0.
    hint_independence = max(0.0, 30.0 - req.hintsUsed * 10.0)

    total = round(efficiency + target_law + hint_independence, 1)

    # Bonus points on top of the base 10 (score of 100 = +5 bonus, 0 = +0)
    earned_points = round((total / 100) * 5)

    # ── Save to database if user is authenticated ───────────────────────────
    if user:
        background_tasks.add_task(
            save_score_to_db,
            user, req, efficiency, target_law, hint_independence, total, earned_points
        )

    return ScoreResponse(
        efficiency=efficiency,
        targetLaw=target_law,
        hintIndependence=hint_independence,
        total=total,
        earnedPoints=earned_points,
        breakdown={
            "stepsUsed": req.stepsUsed,
            "optimalSteps": optimal,
            "targetLawsRequired": list(target_laws),
            "targetLawsUsed": list(target_laws & laws_used),
            "hintsUsed": req.hintsUsed,
        },
    )

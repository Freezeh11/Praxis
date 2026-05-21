from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from data.levels_data import LEVELS

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


@router.post("/score", response_model=ScoreResponse)
def compute_score(req: ScoreRequest):
    """Compute the three-metric score for a completed puzzle."""
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

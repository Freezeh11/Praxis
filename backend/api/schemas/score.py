"""Scoring transport models — field names are a frozen frontend contract.

Imported by ``api/routes/score.py`` only.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ScoreRequest(BaseModel):
    levelId: int
    stageIdx: int
    stepsUsed: int
    lawsUsed: list[str]  # list of law IDs applied (may have duplicates)
    hintsUsed: int  # number of hints consumed
    guidesUsed: int | None = 0
    optimalSteps: int | None = None


class ScoreResponse(BaseModel):
    efficiency: float  # 0–40
    targetLaw: float  # 0–30
    hintIndependence: float  # 0–30
    total: float  # 0–100
    earnedPoints: int  # bonus points awarded on top of base 10
    breakdown: dict[str, Any]

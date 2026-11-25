"""Scoring transport models — field names are a frozen frontend contract.

Values are bounded before they reach the scoring service: the client computes a
score locally, so the transport is the only place a forged or negative payload
can be stopped. Limits are generous enough for every published puzzle.

Imported by ``api/routes/score.py`` only.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

# Published puzzles top out at four variables and twelve stages; these caps are
# an order of magnitude above that so they never reject legitimate play.
MAX_LEVEL_ID = 99
MAX_STAGE_IDX = 99
MAX_LAW_ID_LENGTH = 40
MAX_LAWS_PER_STEP = 200


class ScoreRequest(BaseModel):
    levelId: int = Field(ge=0, le=MAX_LEVEL_ID)
    stageIdx: int = Field(ge=0, le=MAX_STAGE_IDX)
    # Zero steps cannot honestly claim an efficiency score, so 1 is the floor.
    stepsUsed: int = Field(ge=1, le=999)
    lawsUsed: list[str] = Field(default_factory=list, max_length=MAX_LAWS_PER_STEP)
    hintsUsed: int = Field(ge=0, le=99)
    guidesUsed: int | None = Field(default=0, ge=0, le=99)
    optimalSteps: int | None = Field(default=None, ge=1, le=999)

    @field_validator("lawsUsed")
    @classmethod
    def _bounded_law_ids(cls, laws: list[str]) -> list[str]:
        for law in laws:
            if not isinstance(law, str) or len(law) > MAX_LAW_ID_LENGTH:
                raise ValueError("law id must be a short string")
        return laws


class ScoreResponse(BaseModel):
    efficiency: float  # 0–40
    targetLaw: float  # 0–30
    hintIndependence: float  # 0–30
    total: float  # 0–100
    earnedPoints: int  # bonus points awarded on top of base 10
    breakdown: dict[str, Any]

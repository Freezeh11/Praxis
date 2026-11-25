"""Progress transport models — field names are a frozen frontend contract.

The client owns its progress snapshot, so these bounds exist to stop a corrupted
or hostile payload from writing absurd values into PostgreSQL (negative points,
stage indexes a level does not have, scores above 100). Shape is otherwise
untouched so the stored payload stays byte-compatible with the frontend.

Imported by ``api/routes/progress.py`` only.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator

LEVEL_KEY = re.compile(r"^\d{1,2}$")
SCORE_KEY = re.compile(r"^\d{1,2}:\d{1,2}$")

MAX_POINTS = 10_000_000
MAX_STAGES_PER_LEVEL = 64
MAX_SCORE_ENTRIES = 4096


class ProgressData(BaseModel):
    points: int = Field(default=0, ge=0, le=MAX_POINTS)
    stageProgress: dict[str, list[int]] = Field(default_factory=dict)
    # Numeric as sent: the ``int | float`` union keeps whole scores as ints so the
    # value written to Supabase is byte-identical to the request.
    stageScores: dict[str, int | float] = Field(default_factory=dict)

    @field_validator("stageProgress")
    @classmethod
    def _bounded_stage_progress(cls, progress: dict[str, list[int]]) -> dict[str, list[int]]:
        if len(progress) > 100:
            raise ValueError("too many levels")
        for key, stages in progress.items():
            if not LEVEL_KEY.match(key):
                raise ValueError("level key must be a small non-negative integer")
            if len(stages) > MAX_STAGES_PER_LEVEL:
                raise ValueError("too many stages for one level")
            if len(set(stages)) != len(stages):
                raise ValueError("duplicate stage index")
            for stage in stages:
                if not isinstance(stage, int) or stage < 0 or stage > 99:
                    raise ValueError("stage index must be between 0 and 99")
        return progress

    @field_validator("stageScores")
    @classmethod
    def _bounded_stage_scores(cls, scores: dict[str, int | float]) -> dict[str, int | float]:
        if len(scores) > MAX_SCORE_ENTRIES:
            raise ValueError("too many score entries")
        for key, value in scores.items():
            if not SCORE_KEY.match(key):
                raise ValueError("score key must look like <level>:<stage>")
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError("score must be numeric")
            if value < 0 or value > 100:
                raise ValueError("score must be between 0 and 100")
        return scores


class SaveProgressRequest(BaseModel):
    progress: ProgressData

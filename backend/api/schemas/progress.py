"""Progress transport models — field names are a frozen frontend contract.

Imported by ``api/routes/progress.py`` only.
"""

from __future__ import annotations

from pydantic import BaseModel


class ProgressData(BaseModel):
    points: int = 0
    streak: int = 0
    bestStreak: int = 0
    stageProgress: dict[str, list[int]] = {}  # { "1": [0, 1, 2] }
    # Numeric as sent: the ``int | float`` union keeps whole scores as ints so the
    # value written to Supabase is byte-identical to the request.
    stageScores: dict[str, int | float] = {}  # { "1:0": 87.5 }


class SaveProgressRequest(BaseModel):
    progress: ProgressData

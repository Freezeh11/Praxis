"""All Supabase access for user_progress / stage_progress / score_history.

Imported by ``services/progress_service.py`` only.
"""

from __future__ import annotations

from typing import Any

import httpx

from core.errors import UpstreamError
from supabase_client import supabase

USER_PROGRESS_TABLE = "user_progress"
STAGE_PROGRESS_TABLE = "stage_progress"
SCORE_HISTORY_TABLE = "score_history"
STAGE_CONFLICT_COLUMNS = "user_id,level_id,stage_idx"


def _execute(builder: Any) -> Any:
    """Run a query, translating transport failures into an upstream error."""
    try:
        return builder.execute()
    except httpx.HTTPError as exc:
        raise UpstreamError("Progress storage is unavailable", detail=str(exc)) from exc


def get_user_progress_row(user_id: str) -> dict[str, Any] | None:
    """The single ``user_progress`` row for a user, or ``None``."""
    result = _execute(
        supabase.table(USER_PROGRESS_TABLE).select("*").eq("user_id", user_id)
    )
    return result.data[0] if result.data else None


def list_stage_progress_rows(user_id: str) -> list[dict[str, Any]]:
    """Every ``stage_progress`` row for a user."""
    result = _execute(
        supabase.table(STAGE_PROGRESS_TABLE).select("*").eq("user_id", user_id)
    )
    return result.data or []


def get_best_score(user_id: str, level_id: int, stage_idx: int) -> int | float:
    """The stored best score for one stage, ``0`` when the row does not exist."""
    result = _execute(
        supabase.table(STAGE_PROGRESS_TABLE)
        .select("best_score")
        .eq("user_id", user_id)
        .eq("level_id", level_id)
        .eq("stage_idx", stage_idx)
    )
    return result.data[0]["best_score"] if result.data else 0


def insert_score_history(record: dict[str, Any]) -> None:
    """Append one completed attempt to ``score_history``."""
    _execute(supabase.table(SCORE_HISTORY_TABLE).insert(record))


def upsert_stage_progress(record: dict[str, Any]) -> None:
    """Insert-or-update one stage row, keyed on (user, level, stage)."""
    _execute(
        supabase.table(STAGE_PROGRESS_TABLE)
        .upsert(record)
        .on_conflict(STAGE_CONFLICT_COLUMNS)
    )


def upsert_user_progress(record: dict[str, Any]) -> None:
    """Insert-or-update the user's aggregate totals row."""
    _execute(supabase.table(USER_PROGRESS_TABLE).upsert(record))

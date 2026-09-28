"""Progress logic: merge stored rows, persist snapshots, record finished scores.

Imported by ``api/routes/progress.py`` and ``api/routes/score.py``.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from core.logging import get_logger
from repositories import progress_repository
from services.scoring_service import ScoreOutcome

logger = get_logger(__name__)


def load_progress(user_id: str) -> dict[str, Any]:
    """Full progress payload for a user: totals plus per-stage maps."""
    user_progress = progress_repository.get_user_progress_row(user_id)
    stages = progress_repository.list_stage_progress_rows(user_id)
    return build_progress(user_progress, stages)


def build_progress(
    user_progress: Mapping[str, Any] | None,
    stages: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Merge stored rows into ``{points, streak, bestStreak, stage*, …}``."""
    stage_progress: dict[str, list[int]] = {}
    stage_scores: dict[str, float] = {}

    for stage in stages:
        level_key = str(stage["level_id"])
        if stage.get("completed"):
            if level_key not in stage_progress:
                stage_progress[level_key] = []
            if stage["stage_idx"] not in stage_progress[level_key]:
                stage_progress[level_key].append(stage["stage_idx"])

        if stage.get("best_score") and stage["best_score"] > 0:
            stage_scores[f"{stage['level_id']}:{stage['stage_idx']}"] = stage["best_score"]

    return {
        "points": user_progress["points"] if user_progress else 0,
        "streak": user_progress["streak"] if user_progress else 0,
        "bestStreak": user_progress["best_streak"] if user_progress else 0,
        "stageProgress": stage_progress,
        "stageScores": stage_scores,
    }


def save_progress(
    *,
    user_id: str,
    points: int,
    streak: int,
    best_streak: int,
    stage_progress: Mapping[str, Sequence[int]],
    stage_scores: Mapping[str, int | float],
) -> None:
    """Write the client's snapshot: one totals row plus one row per stage."""
    progress_repository.upsert_user_progress(
        {
            "user_id": user_id,
            "points": points,
            "streak": streak,
            "best_streak": best_streak,
        }
    )

    for level_key, completed_stages in stage_progress.items():
        level_id = int(level_key)
        for stage_idx in completed_stages:
            best_score = stage_scores.get(f"{level_id}:{stage_idx}", 0)
            progress_repository.upsert_stage_progress(
                {
                    "user_id": user_id,
                    "level_id": level_id,
                    "stage_idx": stage_idx,
                    "best_score": best_score,
                    "completed": True,
                }
            )


def persist_score(user_id: str, outcome: ScoreOutcome) -> None:
    """Background task: log an attempt and raise the stage's best score.

    Runs after the response has been sent, so a storage failure is logged and
    swallowed rather than surfaced to the player.
    """
    try:
        progress_repository.insert_score_history(
            {
                "user_id": user_id,
                "level_id": outcome.level_id,
                "stage_idx": outcome.stage_idx,
                "steps_used": outcome.steps_used,
                "laws_used": list(outcome.laws_used),
                "hints_used": outcome.assistance_used,
                "efficiency": outcome.efficiency,
                "target_law": outcome.target_law,
                "hint_independence": outcome.hint_independence,
                "total": outcome.total,
                "earned_points": outcome.earned_points,
            }
        )

        current_best = progress_repository.get_best_score(
            user_id, outcome.level_id, outcome.stage_idx
        )
        if outcome.total > current_best:
            progress_repository.upsert_stage_progress(
                {
                    "user_id": user_id,
                    "level_id": outcome.level_id,
                    "stage_idx": outcome.stage_idx,
                    "best_score": outcome.total,
                    "completed": True,
                }
            )
    except Exception:  # noqa: BLE001 - persistence must never break scoring
        logger.exception(
            "failed to save score to database",
            extra={"fields": {"user_id": user_id, "level_id": outcome.level_id}},
        )

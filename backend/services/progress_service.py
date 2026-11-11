"""Progress logic: merge stored rows, persist snapshots, record finished scores.

Imported by ``api/routes/progress.py`` and ``api/routes/score.py``.
"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping, Sequence
from typing import Any

from core.logging import get_logger
from repositories import progress_repository
from services.scoring_service import ScoreOutcome

logger = get_logger(__name__)


async def load_progress(user_id: str) -> dict[str, Any]:
    """Full progress payload for a user: totals plus per-stage maps.

    The two reads are independent, and the repository is synchronous httpx.
    Running them in worker threads overlaps their round trips instead of paying
    two sequential WAN latencies inside the event loop.
    """
    user_progress, stages = await asyncio.gather(
        asyncio.to_thread(progress_repository.get_user_progress_row, user_id),
        asyncio.to_thread(progress_repository.list_stage_progress_rows, user_id),
    )
    return build_progress(user_progress, stages)


def build_progress(
    user_progress: Mapping[str, Any] | None,
    stages: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Merge stored rows into ``{points, stageProgress, stageScores}``."""
    # Indices are collected as sets: the rows arrive in whatever order storage
    # returns them (and the saves that created them may run in parallel), while
    # the API payload has always been ascending. Sorting here keeps the response
    # deterministic without making the writes sequential again.
    stage_progress: dict[str, set[int]] = {}
    stage_scores: dict[str, float] = {}

    for stage in stages:
        level_key = str(stage["level_id"])
        if stage.get("completed"):
            stage_progress.setdefault(level_key, set()).add(stage["stage_idx"])

        if stage.get("best_score") and stage["best_score"] > 0:
            stage_scores[f"{stage['level_id']}:{stage['stage_idx']}"] = stage["best_score"]

    return {
        "points": user_progress["points"] if user_progress else 0,
        "stageProgress": {key: sorted(indices) for key, indices in stage_progress.items()},
        "stageScores": stage_scores,
    }


async def save_progress(
    *,
    user_id: str,
    points: int,
    stage_progress: Mapping[str, Sequence[int]],
    stage_scores: Mapping[str, int | float],
) -> None:
    """Write the client's snapshot: one totals row plus one row per stage.

    Offline play means the browser owns the snapshot, so totals are stored as
    sent (bounded by the schema). Stage rows are merged, never overwritten: a
    later sync with a stale or forged best score can lower neither a stored best
    nor un-complete a stage. Finishing a stage still goes through /api/score,
    which computes the score server-side.
    """
    # Totals and the stored stage rows are independent reads/writes, so both go
    # out together; the per-stage upserts below run as one gathered batch.
    _, stored_rows = await asyncio.gather(
        asyncio.to_thread(
            progress_repository.upsert_user_progress,
            {
                "user_id": user_id,
                "points": points,
            },
        ),
        asyncio.to_thread(progress_repository.list_stage_progress_rows, user_id),
    )
    stored = {(row["level_id"], row["stage_idx"]): row for row in stored_rows}

    writes = []
    for level_key, completed_stages in stage_progress.items():
        level_id = int(level_key)
        for stage_idx in completed_stages:
            incoming = stage_scores.get(f"{level_id}:{stage_idx}", 0) or 0
            previous = stored.get((level_id, stage_idx), {})
            best_score = max(float(previous.get("best_score") or 0), float(incoming))
            writes.append(
                {
                    "user_id": user_id,
                    "level_id": level_id,
                    "stage_idx": stage_idx,
                    "best_score": best_score,
                    "completed": True,
                }
            )

    # 20 stages used to mean 20 sequential round trips. One gathered batch keeps
    # the same per-row payload and conflict handling.
    await asyncio.gather(
        *(
            asyncio.to_thread(progress_repository.upsert_stage_progress, record)
            for record in writes
        )
    )


async def persist_score(user_id: str, outcome: ScoreOutcome) -> None:
    """Background task: log an attempt and raise the stage's best score.

    Runs after the response has been sent, so a storage failure is logged and
    swallowed rather than surfaced to the player.
    """
    try:
        record = {
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
        # The history insert and the best-score read are independent.
        _, current_best = await asyncio.gather(
            asyncio.to_thread(progress_repository.insert_score_history, record),
            asyncio.to_thread(
                progress_repository.get_best_score,
                user_id,
                outcome.level_id,
                outcome.stage_idx,
            ),
        )
        if outcome.total > current_best:
            await asyncio.to_thread(
                progress_repository.upsert_stage_progress,
                {
                    "user_id": user_id,
                    "level_id": outcome.level_id,
                    "stage_idx": outcome.stage_idx,
                    "best_score": outcome.total,
                    "completed": True,
                },
            )
    except Exception:  # noqa: BLE001 - persistence must never break scoring
        logger.exception(
            "failed to save score to database",
            extra={"fields": {"user_id": user_id, "level_id": outcome.level_id}},
        )

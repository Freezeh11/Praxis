"""Level and law content plus the not-found semantics of the content API.

Imported by ``api/routes/*`` and ``services/scoring_service.py``.
"""

from __future__ import annotations

from typing import Any

from core.errors import NotFoundError
from repositories import content_repository


def list_level_summaries() -> list[dict[str, Any]]:
    """Level metadata without puzzle detail (``GET /api/levels``)."""
    return content_repository.list_level_summaries()


def list_laws() -> list[dict[str, Any]]:
    """All Boolean law reference cards (``GET /api/laws``)."""
    return content_repository.list_laws()


def get_level(level_id: int) -> dict[str, Any]:
    """A level with full puzzle data, or :class:`NotFoundError`."""
    level = content_repository.get_level(level_id)
    if not level:
        raise NotFoundError(f"Level {level_id} not found")
    return level


def get_puzzle(level_id: int, stage_idx: int) -> dict[str, Any]:
    """One puzzle of a level, or :class:`NotFoundError` for an unknown stage.

    Out-of-range stages are rejected exactly as before; a negative index keeps
    resolving Python-style (``-1`` is the last stage), which is the behaviour the
    original inline lookup had.
    """
    puzzles = get_level(level_id)["puzzles"]
    if stage_idx >= len(puzzles):
        raise NotFoundError(f"Stage {stage_idx} not found")
    return puzzles[stage_idx]

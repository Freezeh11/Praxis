"""Read-only access to the shared game content.

Laws and levels are static, hand-authored content that the frontend also bundles
straight from ``<repo>/content/*.json``. Keeping one JSON copy means a new level
or law is a one-file change and the API can never drift from the UI.

This module is the only place in the backend that knows where the content lives
or how it is shaped on disk.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

# backend/repositories/content_repository.py -> <repo>/content
CONTENT_DIR = Path(__file__).resolve().parents[2] / "content"


def _load(filename: str) -> list[dict[str, Any]]:
    path = CONTENT_DIR / filename
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError as exc:  # pragma: no cover - deployment guard
        raise RuntimeError(
            f"Game content is missing: {path}. The content/ directory must be "
            "shipped alongside the backend."
        ) from exc


@lru_cache(maxsize=None)
def list_laws() -> list[dict[str, Any]]:
    """All law reference cards, in authoring order."""
    return _load("laws.json")


@lru_cache(maxsize=None)
def list_levels() -> list[dict[str, Any]]:
    """All levels with their full puzzle data."""
    return _load("levels.json")


def list_level_summaries() -> list[dict[str, Any]]:
    """Level metadata without puzzle detail — the shape of GET /api/levels."""
    return [
        {
            "id": level["id"],
            "name": level["name"],
            "desc": level["desc"],
            "varCount": level["varCount"],
            "puzzleCount": len(level["puzzles"]),
        }
        for level in list_levels()
    ]


def get_level(level_id: int) -> dict[str, Any] | None:
    """A single level with full puzzle data, or None when the id is unknown."""
    return next((level for level in list_levels() if level["id"] == level_id), None)

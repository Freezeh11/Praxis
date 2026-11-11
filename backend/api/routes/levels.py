"""``GET /api/levels`` and ``/api/levels/{id}`` — thin transport only.

Delegates to ``services/content_service.py``; imported by ``main.py`` only.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from core.responses import Envelope, success
from services import content_service

router = APIRouter()


@router.get("/levels", response_model=Envelope)
def read_levels() -> dict[str, Any]:
    """Level metadata for the level-select screen (no puzzle detail)."""
    return success(content_service.list_level_summaries())


@router.get("/levels/{level_id}", response_model=Envelope)
def read_level(level_id: int) -> dict[str, Any]:
    """A single level with full puzzle data; 404 envelope when unknown."""
    return success(content_service.get_level(level_id))

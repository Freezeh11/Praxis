"""``GET /api/laws`` — thin transport over ``services/content_service.py``.

Imported by ``main.py`` only.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from core.responses import Envelope, success
from services import content_service

router = APIRouter()


@router.get("/laws", response_model=Envelope)
def read_laws() -> dict[str, Any]:
    """All Boolean law reference cards, in authoring order."""
    return success(content_service.list_laws())

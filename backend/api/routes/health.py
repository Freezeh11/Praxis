"""The ``/`` health probe — plain JSON, deliberately outside the envelope.

Render reads this body verbatim; imported by ``main.py`` only.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def read_health() -> dict[str, Any]:
    """Liveness probe: plain payload, no envelope."""
    return {"message": "Praxis API is running", "docs": "/docs"}

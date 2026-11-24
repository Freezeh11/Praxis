"""Feedback storage - one insert, no reads.

Imported by services/feedback_service.py only. The table is write-only from the
application: messages are read by an operator in the Supabase dashboard, which
is why nothing here can list them.
"""

from __future__ import annotations

from typing import Any

import httpx

from core.errors import UpstreamError
from core.logging import get_logger, log_fields
from supabase_client import supabase

logger = get_logger(__name__)

FEEDBACK_TABLE = "feedback"


def insert_feedback(row: dict[str, Any]) -> None:
    """Store one submission; raise UpstreamError when storage fails."""
    try:
        supabase.table(FEEDBACK_TABLE).insert(row).execute()
    except httpx.HTTPError as exc:
        # Never log the row: it holds the learner's words and address.
        logger.warning(
            "feedback insert failed",
            extra=log_fields(error=type(exc).__name__, category=row.get("category")),
        )
        raise UpstreamError("Feedback storage is unavailable") from exc

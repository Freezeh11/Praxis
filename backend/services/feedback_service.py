"""Feedback submission rules - who we can reply to, and what we log.

Imported by api/routes/feedback.py only.
"""

from __future__ import annotations

from typing import Any

from core.errors import AppError, ErrorCode
from core.logging import get_logger, log_fields
from repositories import feedback_repository

logger = get_logger(__name__)

__all__ = ["submit_feedback"]


def submit_feedback(
    *,
    category: str,
    message: str,
    email: str | None,
    page: str | None,
    app_version: str | None,
    context: dict[str, Any] | None,
    user_agent: str | None,
    user: dict[str, Any] | None,
) -> None:
    """Store one report, stamped with the address that can answer it.

    A signed-in learner's account address wins over anything typed: it is the
    one we can actually reply to. A signed-out reporter has no account, so
    their own address is required - an unanswerable report is worse than a
    refused one, because the learner believes they were heard.
    """
    account_email = (user or {}).get("email")
    reply_to = account_email or email
    if not reply_to:
        raise AppError(
            "Add an email address so we can reply.",
            code=ErrorCode.VALIDATION,
            status=422,
        )

    row = {
        "user_id": (user or {}).get("id"),
        "email": reply_to,
        "category": category,
        "message": message,
        "page": page,
        "app_version": app_version,
        "context": context,
        "user_agent": user_agent,
    }
    feedback_repository.insert_feedback(row)

    logger.info(
        "feedback received",
        extra=log_fields(category=category, authenticated=bool(user), located=bool(context)),
    )

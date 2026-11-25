"""POST /api/feedback - the in-app contact form.

Thin transport over services/feedback_service.py; imported by main.py only.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from api.schemas.feedback import FeedbackRequest
from core.responses import Envelope, success
from core.security import optional_user
from services import feedback_service

router = APIRouter()

MAX_USER_AGENT = 400


@router.post("/feedback", response_model=Envelope, status_code=202)
async def submit_feedback(
    payload: FeedbackRequest,
    request: Request,
    user: dict[str, Any] | None = Depends(optional_user),
) -> dict[str, Any]:
    """Accept one report; the envelope carries only an acknowledgement."""
    feedback_service.submit_feedback(
        category=payload.category,
        message=payload.message,
        email=payload.email,
        page=payload.page,
        app_version=payload.appVersion,
        context=payload.context.model_dump(exclude_none=True) if payload.context else None,
        user_agent=(request.headers.get("user-agent") or "")[:MAX_USER_AGENT] or None,
        user=user,
    )
    return success({"status": "received"})

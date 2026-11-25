"""Feedback transport model - the only place a report is bounded.

Imported by api/routes/feedback.py only. Caps mirror the checks in
database/feedback.sql so a stored row can never violate the table.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

MIN_MESSAGE = 10
MAX_MESSAGE = 2000
MAX_EMAIL = 254
MAX_PAGE = 200
MAX_VERSION = 40
MAX_EXPRESSION = 200

FeedbackCategory = Literal["bug", "idea", "other"]


class FeedbackContext(BaseModel):
    """Optional puzzle coordinates, so a bug report arrives already located."""

    levelId: int | None = Field(default=None, ge=0, le=99)
    stageIdx: int | None = Field(default=None, ge=0, le=99)
    expression: str | None = Field(default=None, max_length=MAX_EXPRESSION)


class FeedbackRequest(BaseModel):
    """One contact-form submission."""

    category: FeedbackCategory = "other"
    message: str = Field(min_length=MIN_MESSAGE, max_length=MAX_MESSAGE)
    email: str | None = Field(default=None, max_length=MAX_EMAIL)
    page: str | None = Field(default=None, max_length=MAX_PAGE)
    appVersion: str | None = Field(default=None, max_length=MAX_VERSION)
    context: FeedbackContext | None = None

    @field_validator("message")
    @classmethod
    def _require_substance(cls, value: str) -> str:
        """Whitespace does not count towards the minimum."""
        text = value.strip()
        if len(text) < MIN_MESSAGE:
            raise ValueError(f"message must be at least {MIN_MESSAGE} characters")
        return text

    @field_validator("email")
    @classmethod
    def _normalise_email(cls, value: str | None) -> str | None:
        """Accept an empty field as absent; reject anything without one host."""
        if value is None:
            return None
        text = value.strip()
        if not text:
            return None
        local, _, domain = text.partition("@")
        if not local or "." not in domain or "@" in domain or len(text) > MAX_EMAIL:
            raise ValueError("email is not a usable address")
        return text.lower()

    @field_validator("page", "appVersion")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        """A blank diagnostic is stored as absent, not as an empty string."""
        if value is None:
            return None
        return value.strip() or None

"""Named application errors — the only failures the API reports to clients.

Carry code/message/detail/status; imported by ``main.py``, ``core/*``, ``services/*``.
"""

from __future__ import annotations

from typing import Any


class ErrorCode:
    """Stable machine-readable error codes shared with the frontend."""

    NOT_FOUND = "not_found"
    CONTENT_UNAVAILABLE = "content_unavailable"
    UPSTREAM = "upstream_error"
    UNAUTHORIZED = "unauthorized"
    VALIDATION = "validation_error"
    HTTP = "http_error"
    INTERNAL = "internal_error"


class AppError(Exception):
    """Base class for an expected, reportable failure.

    Subclasses override ``default_code`` / ``default_status`` /
    ``default_message``; instances may override any of them per raise site.
    """

    default_code: str = ErrorCode.INTERNAL
    default_status: int = 500
    default_message: str = "Unexpected error"

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        detail: Any = None,
        status: int | None = None,
    ) -> None:
        self.message = message or self.default_message
        self.code = code or self.default_code
        self.detail = detail
        self.status = status or self.default_status
        super().__init__(self.message)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"{type(self).__name__}(code={self.code!r}, status={self.status}, message={self.message!r})"


class NotFoundError(AppError):
    """A requested resource (level, stage, …) does not exist."""

    default_code = ErrorCode.NOT_FOUND
    default_status = 404
    default_message = "Resource not found"


class ContentUnavailableError(AppError):
    """Static game content is missing or unreadable — a deployment fault."""

    default_code = ErrorCode.CONTENT_UNAVAILABLE
    default_status = 503
    default_message = "Game content is unavailable"


class UpstreamError(AppError):
    """A dependency (Supabase REST/Auth) failed at the transport level."""

    default_code = ErrorCode.UPSTREAM
    default_status = 502
    default_message = "Upstream service is unavailable"


class UnauthorizedError(AppError):
    """The request carries no usable session."""

    default_code = ErrorCode.UNAUTHORIZED
    default_status = 401
    default_message = "Not authenticated"

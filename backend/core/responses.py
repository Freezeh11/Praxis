"""The one response envelope used by every ``/api/*`` route (``GET /`` stays plain).

Imported by ``api/routes/*`` and ``main.py`` only.
"""

from __future__ import annotations

from typing import Any

from fastapi.responses import JSONResponse
from pydantic import BaseModel

from core.errors import AppError, ErrorCode


class ErrorBody(BaseModel):
    """Machine code, user-safe message, developer-safe detail."""

    code: str
    message: str
    detail: Any | None = None


class Envelope(BaseModel):
    """The response shape every ``/api/*`` route declares."""

    success: bool
    data: Any | None = None
    error: ErrorBody | None = None


def success(data: Any) -> dict[str, Any]:
    """Wrap a successful payload."""
    return {"success": True, "data": data, "error": None}


def failure(code: str, message: str, detail: Any = None) -> dict[str, Any]:
    """Wrap a failure with an HTTP status chosen by the caller."""
    return {
        "success": False,
        "data": None,
        "error": {"code": code, "message": message, "detail": detail},
    }


def error_response(exc: AppError, headers: dict[str, str] | None = None) -> JSONResponse:
    """Render an :class:`AppError` as a failure envelope with its own status."""
    return JSONResponse(
        status_code=exc.status,
        content=failure(exc.code, exc.message, exc.detail),
        headers=headers,
    )


def internal_error_response() -> JSONResponse:
    """The generic 500 envelope — never leaks internals to the client."""
    return JSONResponse(
        status_code=500,
        content=failure(ErrorCode.INTERNAL, "Internal server error"),
    )

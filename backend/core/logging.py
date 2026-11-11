"""Structured single-line JSON logging plus the request-id context variable.

Imported by ``main.py``, ``core/middleware.py`` and ``services/*``.
"""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone

REQUEST_ID_DEFAULT = "-"

_request_id: ContextVar[str] = ContextVar("request_id", default=REQUEST_ID_DEFAULT)


def set_request_id(value: str):
    """Bind ``value`` to the current context; returns the reset token."""
    return _request_id.set(value)


def reset_request_id(token) -> None:
    """Undo a previous :func:`set_request_id`."""
    _request_id.reset(token)


def current_request_id() -> str:
    """The request id bound to the current context (``-`` outside a request)."""
    return _request_id.get()


class JsonFormatter(logging.Formatter):
    """Render each record as one JSON object on one line."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": current_request_id(),
        }
        payload.update(getattr(record, "fields", None) or {})
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


_configured = False


def configure_logging(level: int = logging.INFO) -> None:
    """Install the JSON formatter on the root logger (idempotent)."""
    global _configured
    if _configured:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    _configured = True


def get_logger(name: str) -> logging.Logger:
    """A module logger that emits through the JSON formatter."""
    return logging.getLogger(name)


def log_fields(**fields: object) -> dict[str, dict[str, object]]:
    """Build the ``extra=`` argument that merges structured fields into a line."""
    return {"fields": {key: value for key, value in fields.items() if value is not None}}

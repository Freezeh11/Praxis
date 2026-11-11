"""Request-id middleware: one JSON access-log line per HTTP request.

Echoes ``X-Request-ID`` and answers unhandled exceptions; imported by ``main.py``.
"""

from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from core.logging import get_logger, log_fields, reset_request_id, set_request_id
from core.responses import internal_error_response

REQUEST_ID_HEADER = "X-Request-ID"

logger = get_logger("praxis.request")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Correlate every log line of a request and record its outcome."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        request.state.request_id = request_id
        token = set_request_id(request_id)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:  # noqa: BLE001 - last line of defence
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            logger.exception(
                "unhandled exception",
                extra=log_fields(
                    request_id=request_id,
                    method=request.method,
                    path=request.url.path,
                    status=500,
                    duration_ms=duration_ms,
                ),
            )
            response = internal_error_response()
        else:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            logger.info(
                "request completed",
                extra=log_fields(
                    request_id=request_id,
                    method=request.method,
                    path=request.url.path,
                    status=response.status_code,
                    duration_ms=duration_ms,
                ),
            )
        finally:
            reset_request_id(token)

        response.headers[REQUEST_ID_HEADER] = request_id
        return response

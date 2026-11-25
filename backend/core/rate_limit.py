"""In-process request throttling and body-size limits.

The API is a single Uvicorn worker today, so a per-process token bucket is
enough to stop naive floods, credential stuffing and JSON bombs. It is a
best-effort control: behind multiple replicas each process keeps its own
buckets, and a restart resets them. Documented in docs/perf-security-report.md.

Imported by main.py; wiring only, no business logic.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from core.errors import ErrorCode
from core.responses import failure


def _env_int(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, default)))
    except (TypeError, ValueError):
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return max(0.001, float(os.getenv(name, default)))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Rule:
    """A token bucket: `capacity` requests per `window_s` seconds."""

    capacity: int
    window_s: float


def default_rules() -> tuple[Rule, Rule, Rule, Rule]:
    """(score, save, other api, everything else) — all env overridable."""
    return (
        Rule(_env_int("RATE_LIMIT_SCORE", 30), 60.0),
        Rule(_env_int("RATE_LIMIT_SAVE", 60), 60.0),
        Rule(_env_int("RATE_LIMIT_API", 240), 60.0),
        Rule(_env_int("RATE_LIMIT_GENERAL", 600), 60.0),
    )


@dataclass
class _Bucket:
    tokens: float
    updated: float = field(default_factory=time.monotonic)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding token buckets keyed by (client, route class).

    The client is the socket peer unless `TRUST_PROXY_HEADERS` is enabled, in
    which case the last `X-Forwarded-For` hop (the one appended by our own
    proxy) is used. Wildcard headers are never trusted as an auth signal, only
    as a coarse rate-limit key.
    """

    SENSITIVE_PATHS = {"/api/score": 0, "/api/progress/save": 1}

    def __init__(self, app, *, enabled: bool = True, trust_proxy: bool = False) -> None:
        super().__init__(app)
        self.enabled = enabled
        self.trust_proxy = trust_proxy
        self.score, self.save, self.api, self.general = default_rules()
        self.buckets: dict[tuple[str, int], _Bucket] = {}
        self._last_cleanup = time.monotonic()

    def _rule_for(self, path: str) -> tuple[Rule, int]:
        if path in self.SENSITIVE_PATHS:
            index = self.SENSITIVE_PATHS[path]
            return (self.score if index == 0 else self.save), index
        if path.startswith("/api/"):
            return self.api, 2
        return self.general, 3

    @staticmethod
    def _client(request: Request, trust_proxy: bool) -> str:
        """Identify the caller without letting it choose its own bucket.

        X-Forwarded-For is client-controlled unless a trusted proxy appends to
        it, so it is only consulted when TRUST_PROXY_HEADERS is on. The proxy
        appends the address it saw, which makes the LAST hop the trustworthy
        one (the first is whatever the caller typed).
        """
        if trust_proxy:
            forwarded = request.headers.get("x-forwarded-for", "")
            if forwarded:
                last = forwarded.split(",")[-1].strip()
                if last:
                    return last
        return request.client.host if request.client else "unknown"

    def _allow(self, key: tuple[str, int], rule: Rule) -> tuple[bool, float]:
        now = time.monotonic()
        bucket = self.buckets.get(key)
        refill = rule.capacity / rule.window_s
        if bucket is None:
            self.buckets[key] = _Bucket(float(rule.capacity))
            bucket = self.buckets[key]
        else:
            elapsed = now - bucket.updated
            bucket.tokens = min(float(rule.capacity), bucket.tokens + elapsed * refill)
            bucket.updated = now

        if bucket.tokens >= 1.0:
            bucket.tokens -= 1.0
            return True, 0.0

        retry_after = max(1.0, (1.0 - bucket.tokens) / refill)
        return False, retry_after

    def _cleanup(self, now: float) -> None:
        """Drop buckets idle for a full window so memory cannot grow forever."""
        if now - self._last_cleanup < 60.0:
            return
        self._last_cleanup = now
        stale = [key for key, bucket in self.buckets.items() if now - bucket.updated > 600.0]
        for key in stale:
            self.buckets.pop(key, None)
        # Hard ceiling: a spoofed-key flood must not grow the map without bound.
        if len(self.buckets) > 10_000:
            for key in sorted(self.buckets, key=lambda k: self.buckets[k].updated)[:2_000]:
                self.buckets.pop(key, None)

    async def dispatch(self, request: Request, call_next):
        if not self.enabled or request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        if path in ("/docs", "/redoc", "/openapi.json"):
            return await call_next(request)

        rule, index = self._rule_for(path)
        client = self._client(request, self.trust_proxy)
        allowed, retry_after = self._allow((client, index), rule)
        self._cleanup(time.monotonic())

        if not allowed:
            response = JSONResponse(
                status_code=429,
                content=failure(
                    ErrorCode.RATE_LIMITED,
                    "Too many requests. Please slow down and try again shortly.",
                ),
                headers={
                    "Retry-After": str(int(retry_after) + 1),
                    "Cache-Control": "no-store",
                },
            )
            return response

        return await call_next(request)


class BodySizeLimitMiddleware:
    """Refuses oversized request bodies, including chunked ones.

    This sits at the raw ASGI layer: a declared Content-Length over the cap is
    rejected up front, and a chunked upload is read (at most cap + 1 bytes) and
    rejected as soon as it crosses the cap. Accepted bodies are replayed to the
    app byte-for-byte.
    """

    def __init__(self, app, *, max_bytes: int = 256 * 1024) -> None:
        self.app = app
        self.max_bytes = max(1024, max_bytes)

    @staticmethod
    async def _reject(scope, receive, send, status_code: int, message: str) -> None:
        response = JSONResponse(
            status_code=status_code,
            content=failure(
                ErrorCode.PAYLOAD_TOO_LARGE if status_code == 413 else ErrorCode.VALIDATION,
                message,
            ),
            headers={"Cache-Control": "no-store"},
        )
        await response(scope, receive, send)

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers", [])
        }
        declared = headers.get("content-length")
        if declared is not None:
            try:
                if int(declared) > self.max_bytes:
                    await self._reject(scope, receive, send, 413, "Request body is too large.")
                    return
            except ValueError:
                await self._reject(scope, receive, send, 400, "Invalid Content-Length header.")
                return

        # Drain (bounded) and replay. Raising mid-stream would be caught by
        # Starlette error middleware, which sends a 500 before re-raising.
        chunks = []
        received = 0
        complete = False
        while not complete:
            message = await receive()
            if message["type"] == "http.disconnect":
                break
            if message["type"] != "http.request":
                continue
            chunk = message.get("body", b"")
            received += len(chunk)
            if received > self.max_bytes:
                await self._reject(scope, receive, send, 413, "Request body is too large.")
                return
            chunks.append(chunk)
            complete = not message.get("more_body", False)

        body = b"".join(chunks)
        replayed = False

        async def replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)

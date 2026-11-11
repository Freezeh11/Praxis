"""Defence-in-depth response headers for every API response.

The frontend ships its own CSP meta tag, but a meta tag cannot cover JSON
responses and cannot express frame-ancestors at all. This middleware adds the
header-only pieces plus the cheap, universal hardening headers.

Imported by main.py; wiring only, no business logic.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# The API only ever returns JSON, so the cheapest safe policy is one that can
# load no subresource at all. It also neutralises an injected HTML error page.
API_CSP = "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

# Swagger UI / ReDoc genuinely need scripts and styles, so the strict API CSP is
# skipped there. The generic headers below still apply to every path.
_DOC_PATHS = ("/docs", "/redoc", "/openapi.json")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Stamps hardening headers on responses, including the error envelopes."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        headers = response.headers

        # Never let a browser re-sniff a JSON body as HTML/script.
        headers.setdefault("X-Content-Type-Options", "nosniff")
        # The API is not embeddable. (CSP frame-ancestors is the modern
        # equivalent; both are sent for older browsers.)
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")

        # HSTS only over TLS: browsers ignore it on plain HTTP, and sending it
        # from http://localhost would pin the developer's browser.
        forwarded = request.headers.get("x-forwarded-proto", request.url.scheme)
        if forwarded.split(",")[0].strip().lower() == "https":
            headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")

        # Public content is identical for every caller and changes only with a
        # deploy, so let the browser reuse it briefly while revalidating in the
        # background. Everything else may carry user data and must not be cached.
        path = request.url.path
        if path.startswith("/api/"):
            public = request.method == "GET" and path.startswith(("/api/levels", "/api/laws"))
            headers.setdefault(
                "Cache-Control",
                "public, max-age=300, stale-while-revalidate=86400" if public else "no-store",
            )

        if not request.url.path.startswith(_DOC_PATHS):
            headers.setdefault("Content-Security-Policy", API_CSP)

        return response

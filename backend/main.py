"""Application assembly for the Praxis API — wiring only, no business logic.

Started by ``uvicorn main:app`` from ``backend/``.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.gzip import GZipMiddleware

from api.routes import health, laws, levels, progress, score
from config.settings import settings
from core.errors import AppError, ErrorCode
from core.logging import configure_logging, get_logger, log_fields
from core.middleware import RequestContextMiddleware
from core.rate_limit import BodySizeLimitMiddleware, RateLimitMiddleware
from core.responses import error_response, failure
from core.security_headers import SecurityHeadersMiddleware
from supabase_client import supabase

configure_logging()
logger = get_logger("praxis.api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Close pooled Supabase connections when the server stops."""
    try:
        yield
    finally:
        await supabase.aclose()


# Interactive docs stay available while developing; a production deployment can
# switch them off with ENVIRONMENT=production.
app = FastAPI(
    title="Praxis API",
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
    lifespan=lifespan,
)

# Added inner-first. SecurityHeadersMiddleware is added last so it is the
# outermost layer: every response - including CORS preflights and the 500
# envelope produced by RequestContextMiddleware - leaves with the hardening
# headers. CORS still wraps the request middleware, so its headers reach that
# envelope too.
app.add_middleware(RequestContextMiddleware)
# JSON envelopes are repetitive; gzip cuts progress payloads by roughly two
# thirds for a few milliseconds of CPU. Below 1 KB the header costs more than it
# saves, so smaller bodies pass through untouched.
app.add_middleware(GZipMiddleware, minimum_size=1000)
if settings.allowed_hosts != ["*"]:
    from starlette.middleware.trustedhost import TrustedHostMiddleware

    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_body_bytes)
app.add_middleware(
    RateLimitMiddleware,
    enabled=settings.rate_limit_enabled,
    trust_proxy=settings.trust_proxy,
)
# CORS is added after the limiters so it wraps them: a 413 from the body cap and
# a 429 from the rate limiter must still carry Access-Control-Allow-Origin, or
# the browser reports an opaque network error and the SPA cannot read
# Retry-After. It still sits inside SecurityHeadersMiddleware.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    # Explicit lists instead of "*": the API only serves these methods, and the
    # browser only ever sends these request headers (see services/apiClient.js).
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Authorization", "Content-Type"],
    expose_headers=["X-Request-ID", "Retry-After"],
    max_age=600,
)
app.add_middleware(SecurityHeadersMiddleware)


@app.exception_handler(AppError)
async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    """Every named application failure, with its own status code."""
    if exc.status >= 500:
        logger.error(
            "application error",
            extra=log_fields(code=exc.code, status=exc.status, path=request.url.path),
        )
    return error_response(exc)


@app.exception_handler(StarletteHTTPException)
async def handle_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Framework-raised HTTP errors (unknown route, wrong method, …)."""
    return JSONResponse(
        status_code=exc.status_code,
        content=failure(ErrorCode.HTTP, str(exc.detail), None),
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Malformed request bodies stay 422, now inside the envelope.

    Only the field location, the message and the rule name are returned. Raw
    input values and the validator context are dropped: echoing them back turns
    a validation error into a reflection surface and can leak submitted secrets.
    """
    safe_errors = [
        {"loc": list(error.get("loc", ())), "msg": error.get("msg", ""), "type": error.get("type", "")}
        for error in exc.errors()[:20]
    ]
    return JSONResponse(
        status_code=422,
        content=failure(ErrorCode.VALIDATION, "Request validation failed", safe_errors),
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    """Fallback for anything raised outside the request middleware."""
    logger.exception(
        "unhandled exception",
        extra=log_fields(method=request.method, path=request.url.path, status=500),
    )
    return error_response(AppError())


app.include_router(health.router)  # "/" — plain payload, no /api prefix
app.include_router(levels.router, prefix="/api")
app.include_router(laws.router, prefix="/api")
app.include_router(score.router, prefix="/api")
app.include_router(progress.router, prefix="/api")

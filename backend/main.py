"""Application assembly for the Praxis API — wiring only, no business logic.

Started by ``uvicorn main:app`` from ``backend/``.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from api.routes import health, laws, levels, progress, score
from config.settings import settings
from core.errors import AppError, ErrorCode
from core.logging import configure_logging, get_logger, log_fields
from core.middleware import RequestContextMiddleware
from core.responses import error_response, failure

configure_logging()
logger = get_logger("praxis.api")

app = FastAPI(title="Praxis API", version="1.0.0")

# Added inner-first: CORS must stay outermost so its headers land on every
# response, including the 500 envelope produced by the middleware below.
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    """Malformed request bodies stay 422, now inside the envelope."""
    return JSONResponse(
        status_code=422,
        content=failure(ErrorCode.VALIDATION, "Request validation failed", jsonable_encoder(exc.errors())),
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

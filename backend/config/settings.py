"""Environment-backed configuration: CORS origins and Supabase credentials.

Fails fast naming the missing variable; imported by ``main.py``/``supabase_client.py``.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# backend/config/settings.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parents[1]

# Load backend/.env explicitly first so the app works from any working
# directory, then fall back to python-dotenv's own cwd-relative search (the
# original behaviour). Existing environment variables always win.
load_dotenv(BACKEND_DIR / ".env", override=False)
load_dotenv(override=False)

# Origins the Vite dev server and the local preview build are served from.
# Used only when CORS_ALLOW_ORIGINS is unset, i.e. for local development.
DEFAULT_CORS_ORIGINS: tuple[str, ...] = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001",
)


def parse_origins(raw: str | None) -> list[str]:
    """Split a comma-separated origin list, dropping blanks and trailing slashes."""
    if not raw:
        return []
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


def require_env(name: str) -> str:
    """Return an environment variable or fail fast, naming the missing one."""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            "Set it in backend/.env (local) or in the deployment environment."
        )
    return value


class Settings:
    """Immutable snapshot of the process configuration."""

    def __init__(
        self,
        *,
        supabase_url: str,
        supabase_service_key: str,
        frontend_url: str | None,
        cors_allow_origins: str | None = None,
        allowed_hosts: str | None = None,
        environment: str | None = None,
        rate_limit_enabled: str | None = None,
        max_body_bytes: str | None = None,
    ) -> None:
        self.supabase_url = supabase_url
        self.supabase_service_key = supabase_service_key
        self.frontend_url = frontend_url
        self.environment = (environment or os.getenv("ENVIRONMENT") or "development").strip().lower()
        self.is_production = self.environment == "production"
        self.cors_origins = build_cors_origins(
            frontend_url,
            parse_origins(cors_allow_origins),
            include_dev_defaults=not self.is_production,
        )
        # Only trust X-Forwarded-For when the deployment actually sits behind a
        # proxy that overwrites/appends it (Render, Fly, a load balancer). Off by
        # default: otherwise any client can pick its own rate-limit bucket.
        self.trust_proxy = (os.getenv("TRUST_PROXY_HEADERS") or "0").strip().lower() in {"1", "true", "yes", "on"}
        self.allowed_hosts = parse_origins(allowed_hosts) or ["*"]
        self.rate_limit_enabled = (rate_limit_enabled or os.getenv("RATE_LIMIT_ENABLED") or "1").strip().lower() not in {
            "0",
            "false",
            "no",
            "off",
        }
        try:
            self.max_body_bytes = max(1024, int(max_body_bytes or os.getenv("MAX_BODY_BYTES") or 262144))
        except (TypeError, ValueError):
            self.max_body_bytes = 262144

    @classmethod
    def from_env(cls) -> "Settings":
        """Build settings from the environment, raising on the first gap."""
        return cls(
            supabase_url=require_env("SUPABASE_URL"),
            supabase_service_key=require_env("SUPABASE_SERVICE_KEY"),
            frontend_url=os.getenv("FRONTEND_URL"),
            cors_allow_origins=os.getenv("CORS_ALLOW_ORIGINS"),
        )


def build_cors_origins(
    frontend_url: str | None,
    explicit: list[str] | None = None,
    *,
    include_dev_defaults: bool = True,
) -> list[str]:
    """Build the CORS allowlist: explicit env list first, dev defaults otherwise.

    CORS_ALLOW_ORIGINS is the deployment's source of truth. FRONTEND_URL is
    appended as a fallback so an existing deployment that only sets that
    variable keeps working, and the deployed origin is never locked out.
    """
    origins = list(explicit) if explicit else (list(DEFAULT_CORS_ORIGINS) if include_dev_defaults else [])
    if frontend_url:
        normalized = frontend_url.strip().rstrip("/")
        if normalized:
            origins.append(normalized)
    # De-duplicate, preserving order (allow_origins must not repeat entries).
    return list(dict.fromkeys(origins))


# Import-time singleton: a missing credential crashes the boot, as before.
settings = Settings.from_env()

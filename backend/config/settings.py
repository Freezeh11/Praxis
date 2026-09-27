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
DEFAULT_CORS_ORIGINS: tuple[str, ...] = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001",
)


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
    ) -> None:
        self.supabase_url = supabase_url
        self.supabase_service_key = supabase_service_key
        self.frontend_url = frontend_url
        self.cors_origins = build_cors_origins(frontend_url)

    @classmethod
    def from_env(cls) -> "Settings":
        """Build settings from the environment, raising on the first gap."""
        return cls(
            supabase_url=require_env("SUPABASE_URL"),
            supabase_service_key=require_env("SUPABASE_SERVICE_KEY"),
            frontend_url=os.getenv("FRONTEND_URL"),
        )


def build_cors_origins(frontend_url: str | None) -> list[str]:
    """The dev origins plus the deployed frontend, de-duplicated, in order."""
    origins = list(DEFAULT_CORS_ORIGINS)
    if frontend_url and frontend_url not in origins:
        origins.append(frontend_url)
    return origins


# Import-time singleton: a missing credential crashes the boot, as before.
settings = Settings.from_env()

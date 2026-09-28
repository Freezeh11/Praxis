"""Auth dependencies ``get_current_user`` / ``optional_user`` (was auth_middleware).

Same 401 semantics as before; imported by ``api/routes/*`` only.
"""

from __future__ import annotations

from typing import Any

import httpx
from fastapi import Request

from core.errors import UpstreamError, UnauthorizedError
from supabase_client import supabase


async def get_current_user(request: Request) -> dict[str, Any]:
    """Return the Supabase user for the request's bearer token, or raise 401."""
    auth_header = request.headers.get("authorization", "")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError("Not authenticated")

    token = auth_header.split(" ")[1]

    try:
        user_data = await supabase.get_user(token)
    except httpx.HTTPError as exc:
        raise UpstreamError("Authentication service is unavailable", detail=str(exc)) from exc

    if not user_data:
        raise UnauthorizedError("Invalid session")

    # user_data contains id, email, user_metadata etc. — return it whole.
    return user_data


async def optional_user(request: Request) -> dict[str, Any] | None:
    """Like :func:`get_current_user`, but ``None`` when unauthenticated."""
    try:
        return await get_current_user(request)
    except UnauthorizedError:
        return None

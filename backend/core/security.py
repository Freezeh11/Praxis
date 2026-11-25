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
    auth_header = request.headers.get("authorization", "").strip()
    scheme, _, credentials = auth_header.partition(" ")
    token = credentials.strip()

    # "Bearer " with no token used to slip through startswith() and crash the
    # header builder, leaking httpx's text into a 502. Reject it as anonymous.
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError("Not authenticated")

    try:
        user_data = await supabase.get_user(token)
    except httpx.HTTPError as exc:
        # Never surface upstream text: it can contain the submitted credential.
        raise UpstreamError("Authentication service is unavailable") from exc

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

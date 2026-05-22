"""
JWT verification middleware for FastAPI.
Verifies tokens issued by the Better Auth server using the session cookie or Authorization header.
Falls back to session verification via the auth server's /api/auth/get-session endpoint.
"""

import os
import httpx
from fastapi import Request, HTTPException, Depends
from functools import lru_cache

AUTH_SERVER_URL = os.getenv("AUTH_SERVER_URL", "http://localhost:3001")


async def get_current_user(request: Request) -> dict:
    """
    Dependency that extracts the authenticated user from the request.
    
    Strategy:
    1. Forward the session cookie to the auth server's get-session endpoint
    2. The auth server validates the session and returns the user data
    3. If no valid session, raise 401
    """
    # Get cookies from the request to forward to auth server
    cookies = request.headers.get("cookie", "")
    
    if not cookies:
        # Also check Authorization header
        auth_header = request.headers.get("authorization", "")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        async with httpx.AsyncClient() as client:
            # Forward the session cookie to the auth server
            headers = {}
            if cookies:
                headers["cookie"] = cookies
            
            auth_header = request.headers.get("authorization", "")
            if auth_header:
                headers["authorization"] = auth_header
            
            response = await client.get(
                f"{AUTH_SERVER_URL}/api/auth/get-session",
                headers=headers,
                timeout=5.0,
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            data = response.json()
            
            if not data or not data.get("user"):
                raise HTTPException(status_code=401, detail="No active session")
            
            return data["user"]
    
    except httpx.RequestError:
        raise HTTPException(
            status_code=503, 
            detail="Auth server unavailable"
        )


async def optional_user(request: Request) -> dict | None:
    """
    Optional version of get_current_user.
    Returns None if not authenticated instead of raising 401.
    """
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

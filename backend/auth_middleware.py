"""
JWT verification middleware for FastAPI.
Verifies tokens issued by Supabase Auth using the Authorization header.
"""

from fastapi import Request, HTTPException
from supabase_client import supabase

async def get_current_user(request: Request) -> dict:
    """
    Dependency that extracts the authenticated user from the request.
    
    Strategy:
    1. Extract Bearer token from the Authorization header.
    2. Validate token against Supabase.
    3. If no valid session, raise 401.
    """
    auth_header = request.headers.get("authorization", "")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    token = auth_header.split(" ")[1]
    
    user_data = await supabase.get_user(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid session")
        
    # user_data contains id, email, user_metadata etc.
    # We return the whole dictionary.
    return user_data


async def optional_user(request: Request) -> dict | None:
    """
    Optional version of get_current_user.
    Returns None if not authenticated instead of raising 401.
    """
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

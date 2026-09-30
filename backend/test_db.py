import asyncio
import httpx
from supabase_client import supabase

async def test():
    test_user_id = "00000000-0000-0000-0000-000000000000"
    
    try:
        print("Testing user_progress upsert...")
        supabase.table("user_progress").upsert({
            "user_id": test_user_id,
            "points": 100,
            "streak": 5,
            "best_streak": 10,
        }).execute()
        print("user_progress upsert OK")
    except httpx.HTTPStatusError as e:
        print(f"Error in user_progress: {e.response.text}")

    try:
        print("Testing stage_progress upsert...")
        supabase.table("stage_progress").upsert({
            "user_id": test_user_id,
            "level_id": 1,
            "stage_idx": 0,
            "best_score": 100,
            "completed": True,
        }).on_conflict("user_id,level_id,stage_idx").execute()
        print("stage_progress upsert OK")
    except httpx.HTTPStatusError as e:
        print(f"Error in stage_progress: {e.response.text}")

asyncio.run(test())

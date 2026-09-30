import httpx
import os

SUPABASE_URL = "https://grcxoitaitydjjlfyoes.supabase.co"
SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3hvaXRhaXR5ZGpqbGZ5b2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTk0NTEsImV4cCI6MjA5NTE5NTQ1MX0.PvDtnmdN9vV4G6Q7dN86ocyTex1seRI-750wkXTPhiQ"

def test_user_flow():
    # 1. Login to get JWT
    print("Logging in as test user...")
    login_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "email": "test@test.com",
        "password": "password123"
    }
    res = httpx.post(login_url, headers=headers, json=data)
    
    if res.status_code != 200:
        # Register instead
        print("Login failed, trying to register...")
        reg_url = f"{SUPABASE_URL}/auth/v1/signup"
        res = httpx.post(reg_url, headers=headers, json=data)
        if res.status_code != 200:
            print("Register failed:", res.text)
            return

    token = res.json()["access_token"]
    print("Got JWT Token:", token[:20], "...")

    # 2. Call backend save progress
    print("Calling backend to save progress...")
    backend_url = "https://praxis-backend-2w1i.onrender.com/api/progress/save"
    save_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "progress": {
            "points": 70,
            "streak": 7,
            "bestStreak": 7,
            "stageProgress": {
                "1": [0, 1]
            },
            "stageScores": {
                "1:0": 100,
                "1:1": 95
            }
        }
    }
    res = httpx.post(backend_url, headers=save_headers, json=payload)
    print("Save Status Code:", res.status_code)
    print("Save Response:", res.text)

test_user_flow()

import os
import httpx

SUPABASE_URL = "https://grcxoitaitydjjlfyoes.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyY3hvaXRhaXR5ZGpqbGZ5b2VzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTYxOTQ1MSwiZXhwIjoyMDk1MTk1NDUxfQ.JdG4LL50hXppjXiXsAH7SbF7TLh5O9HBKvtpe-dyMeY"

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=representation"
}

data = {
    "user_id": "00000000-0000-0000-0000-000000000000",
    "points": 100,
    "streak": 5,
    "best_streak": 10,
}

url = f"{SUPABASE_URL}/rest/v1/user_progress"

print("Sending POST request to:", url)
response = httpx.post(url, headers=headers, json=data)

print(f"Status Code: {response.status_code}")
print(f"Response Body: {response.text}")

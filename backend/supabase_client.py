import os
import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables. "
        "Check backend/.env file."
    )

class SupabaseRESTClient:
    """
    A lightweight wrapper around the Supabase REST API using httpx.
    This avoids needing the official 'supabase' Python package, which
    can have complex compilation dependencies (like pyiceberg/C++ Build Tools).
    """
    def __init__(self, url: str, key: str):
        self.base_url = f"{url.rstrip('/')}/rest/v1"
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    class QueryBuilder:
        def __init__(self, client, table: str):
            self.client = client
            self.table = table
            self.filters = {}
            self.select_fields = "*"
            self.action = "select"
            self.data = None
        
        def select(self, fields: str = "*"):
            self.action = "select"
            self.select_fields = fields
            return self
            
        def eq(self, column: str, value: any):
            self.filters[column] = f"eq.{value}"
            return self
            
        def insert(self, data: dict):
            self.action = "insert"
            self.data = data
            return self
            
        def upsert(self, data: dict):
            self.action = "upsert"
            self.data = data
            return self

        def execute(self):
            url = f"{self.client.base_url}/{self.table}"
            with httpx.Client() as c:
                if self.action == "select":
                    params = {"select": self.select_fields, **self.filters}
                    response = c.get(url, headers=self.client.headers, params=params)
                elif self.action == "insert":
                    response = c.post(url, headers=self.client.headers, json=self.data)
                elif self.action == "upsert":
                    headers = {**self.client.headers, "Prefer": "resolution=merge-duplicates,return=representation"}
                    response = c.post(url, headers=headers, json=self.data)
                    
                response.raise_for_status()
                return type('Response', (), {'data': response.json() if response.content else []})()

    def table(self, table_name: str):
        return self.QueryBuilder(self, table_name)

    async def get_user(self, jwt_token: str) -> dict | None:
        """Fetch the authenticated user from Supabase using their JWT."""
        url = f"{SUPABASE_URL.rstrip('/')}/auth/v1/user"
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {jwt_token}"
        }
        async with httpx.AsyncClient() as c:
            response = await c.get(url, headers=headers, timeout=5.0)
            if response.status_code != 200:
                return None
            return response.json()

# Expose a singleton instance that mimics the official client interface
supabase = SupabaseRESTClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

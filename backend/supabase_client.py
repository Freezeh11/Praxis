"""Thin Supabase REST/Auth shim over httpx (no pyiceberg/build toolchain needed).

Imported by ``repositories/progress_repository.py`` and ``core/security.py``.
"""

from __future__ import annotations

from typing import Any

import httpx

from config.settings import settings


class SupabaseRESTClient:
    """A lightweight wrapper around the Supabase REST API using httpx.

    This avoids the official 'supabase' Python package, which can pull complex
    compilation dependencies (pyiceberg / C++ build tools).
    """

    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.base_url = f"{self.url}/rest/v1"
        self.key = key
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    class QueryBuilder:
        """Chainable PostgREST query: ``select``/``insert``/``upsert`` + filters."""

        def __init__(self, client: SupabaseRESTClient, table: str) -> None:
            self.client = client
            self.table = table
            self.filters: dict[str, Any] = {}
            self.select_fields = "*"
            self.action = "select"
            self.data: dict[str, Any] | None = None

        def select(self, fields: str = "*") -> QueryBuilder:
            self.action = "select"
            self.select_fields = fields
            return self

        def eq(self, column: str, value: Any) -> QueryBuilder:
            self.filters[column] = f"eq.{value}"
            return self

        def insert(self, data: dict[str, Any]) -> QueryBuilder:
            self.action = "insert"
            self.data = data
            return self

        def upsert(self, data: dict[str, Any]) -> QueryBuilder:
            self.action = "upsert"
            self.data = data
            return self

        def on_conflict(self, columns: str) -> QueryBuilder:
            self.filters["on_conflict"] = columns
            return self

        def execute(self) -> Any:
            url = f"{self.client.base_url}/{self.table}"
            with httpx.Client() as c:
                if self.action == "select":
                    params = {"select": self.select_fields, **self.filters}
                    response = c.get(url, headers=self.client.headers, params=params)
                elif self.action == "insert":
                    response = c.post(url, headers=self.client.headers, json=self.data)
                elif self.action == "upsert":
                    headers = {**self.client.headers, "Prefer": "resolution=merge-duplicates,return=representation"}
                    params = {"on_conflict": self.filters.get("on_conflict")} if "on_conflict" in self.filters else {}
                    response = c.post(url, headers=headers, params=params, json=self.data)
                    
                response.raise_for_status()
                return type('Response', (), {'data': response.json() if response.content else []})()

    def table(self, table_name: str) -> QueryBuilder:
        """Start a query against one table."""
        return self.QueryBuilder(self, table_name)

    async def get_user(self, jwt_token: str) -> dict[str, Any] | None:
        """Fetch the authenticated user from Supabase using their JWT."""
        url = f"{self.url}/auth/v1/user"
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {jwt_token}"
        }
        async with httpx.AsyncClient() as c:
            response = await c.get(url, headers=headers, timeout=5.0)
            if response.status_code != 200:
                return None
            return response.json()


# Expose a singleton instance that mimics the official client interface
supabase = SupabaseRESTClient(settings.supabase_url, settings.supabase_service_key)

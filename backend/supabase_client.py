"""Thin Supabase REST/Auth shim over httpx (no pyiceberg/build toolchain needed).

Imported by ``repositories/progress_repository.py`` and ``core/security.py``.
"""

from __future__ import annotations

from typing import Any

import httpx

from config.settings import settings

# One pooled client per process. Creating a client per query paid a fresh
# TCP+TLS handshake on every PostgREST call; httpx.Client is thread-safe, so a
# shared instance also lets the service layer run independent queries in
# parallel threads without opening new connections.
_SYNC_TIMEOUT = httpx.Timeout(10.0)
_ASYNC_TIMEOUT = httpx.Timeout(5.0)
_LIMITS = httpx.Limits(max_connections=20, max_keepalive_connections=10)


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
        self._sync_client: httpx.Client | None = None
        self._async_client: httpx.AsyncClient | None = None

    def _sync(self) -> httpx.Client:
        """The shared REST client, created on first use.

        Lazy creation keeps module import side-effect free (tests import this
        module without a Supabase instance) while still reusing connections.
        """
        if self._sync_client is None:
            self._sync_client = httpx.Client(timeout=_SYNC_TIMEOUT, limits=_LIMITS)
        return self._sync_client

    def _async(self) -> httpx.AsyncClient:
        if self._async_client is None:
            self._async_client = httpx.AsyncClient(timeout=_ASYNC_TIMEOUT, limits=_LIMITS)
        return self._async_client

    async def aclose(self) -> None:
        """Release pooled connections on application shutdown."""
        if self._async_client is not None:
            await self._async_client.aclose()
            self._async_client = None
        if self._sync_client is not None:
            self._sync_client.close()
            self._sync_client = None

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
            c = self.client._sync()
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
        response = await self._async().get(url, headers=headers)
        if response.status_code != 200:
            return None
        return response.json()


# Expose a singleton instance that mimics the official client interface
supabase = SupabaseRESTClient(settings.supabase_url, settings.supabase_service_key)

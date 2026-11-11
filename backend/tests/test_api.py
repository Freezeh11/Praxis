"""Real FastAPI routes/services with isolated Auth and repository doubles.

No real credentials or PostgreSQL writes. Transport bounds and the security
middleware are exercised here because they are the API's public contract.
"""
import asyncio
import os
import unittest
from copy import deepcopy
from unittest.mock import AsyncMock, patch

import httpx

os.environ["SUPABASE_URL"] = "https://praxis-test.invalid"
os.environ["SUPABASE_SERVICE_KEY"] = "isolated-test-key"

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from main import app
from config.settings import Settings
from core.errors import UpstreamError
from core.rate_limit import BodySizeLimitMiddleware, RateLimitMiddleware, Rule
from repositories import progress_repository as repo
from supabase_client import supabase


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.totals, self.stages, self.history = {}, {}, []

        def user(token):
            return {"id": token} if token in ("learner-a", "learner-b") else None

        def stage(record):
            self.stages[(record["user_id"], record["level_id"], record["stage_idx"])] = deepcopy(record)

        replacements = {
            "get_user_progress_row": lambda uid: self.totals.get(uid),
            "list_stage_progress_rows": lambda uid: [r for k, r in self.stages.items() if k[0] == uid],
            "upsert_user_progress": lambda r: self.totals.update({r["user_id"]: deepcopy(r)}),
            "upsert_stage_progress": stage,
            "insert_score_history": lambda r: self.history.append(deepcopy(r)),
            "get_best_score": lambda uid, lid, idx: self.stages.get((uid, lid, idx), {}).get("best_score", 0),
        }
        for name, replacement in replacements.items():
            patcher = patch.object(repo, name, replacement)
            patcher.start()
            self.addCleanup(patcher.stop)
        auth = patch.object(supabase, "get_user", AsyncMock(side_effect=user))
        auth.start()
        self.addCleanup(auth.stop)
        guard = patch.object(supabase, "table", side_effect=AssertionError("Real storage forbidden in API test"))
        guard.start()
        self.addCleanup(guard.stop)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def headers(self, user="learner-a"):
        return {"Authorization": f"Bearer {user}"}

    def score(self, **overrides):
        payload = dict(levelId=1, stageIdx=0, stepsUsed=1, lawsUsed=["absorption"], hintsUsed=0, guidesUsed=0, optimalSteps=1)
        return {**payload, **overrides}

    def test_public_content_and_error_envelopes(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        levels = self.client.get("/api/levels").json()["data"]
        self.assertEqual([x["puzzleCount"] for x in levels], [4, 12, 12, 12])
        self.assertEqual(len(self.client.get("/api/laws").json()["data"]), 9)
        for route in ("/api/levels/999", "/api/missing"):
            response = self.client.get(route)
            self.assertEqual(response.status_code, 404)
            self.assertFalse(response.json()["success"])
            self.assertIn("x-request-id", response.headers)

    def test_authentication_is_required_for_progress(self):
        for headers in ({}, self.headers("invalid")):
            self.assertEqual(self.client.get("/api/progress", headers=headers).status_code, 401)
            self.assertEqual(self.client.post("/api/progress/save", headers=headers, json={"progress": {}}).status_code, 401)

    def test_progress_roundtrip_and_user_isolation(self):
        progress = {"points": 25, "stageProgress": {"0": [0, 1, 2, 3], "1": [0]}, "stageScores": {"1:0": 90}}
        response = self.client.post("/api/progress/save", headers=self.headers(), json={"progress": progress})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/progress", headers=self.headers()).json()["data"], progress)
        other = self.client.get("/api/progress", headers=self.headers("learner-b")).json()["data"]
        self.assertEqual(other["points"], 0)
        self.assertEqual(other["stageProgress"], {})

    def test_forged_optimal_steps_cannot_raise_a_score(self):
        honest = self.client.post("/api/score", headers=self.headers(), json=self.score(stepsUsed=4)).json()["data"]
        forged = self.score(stepsUsed=4, optimalSteps=1)
        faked = self.client.post("/api/score", headers=self.headers(), json=forged).json()["data"]
        self.assertEqual(faked["total"], honest["total"])
        self.assertLess(faked["total"], 100)
        self.assertEqual(faked["breakdown"]["optimalSteps"], honest["breakdown"]["optimalSteps"])

    def test_stale_progress_save_cannot_lower_a_best_score(self):
        first = {"points": 10, "stageProgress": {"1": [0]}, "stageScores": {"1:0": 90}}
        stale = {"points": 0, "stageProgress": {"1": [0]}, "stageScores": {"1:0": 20}}
        self.client.post("/api/progress/save", headers=self.headers(), json={"progress": first})
        self.client.post("/api/progress/save", headers=self.headers(), json={"progress": stale})
        stored = self.client.get("/api/progress", headers=self.headers()).json()["data"]
        self.assertEqual(stored["stageScores"]["1:0"], 90)

    def test_blank_bearer_is_anonymous_and_leaks_no_upstream_text(self):
        for header in ("Bearer ", "Bearer    ", "Basic abc"):
            with self.subTest(header=header):
                response = self.client.get("/api/progress", headers={"Authorization": header})
                self.assertEqual(response.status_code, 401)
                self.assertNotIn("Illegal header", response.text)

    def test_score_persistence_and_best_score(self):
        response = self.client.post("/api/score", headers=self.headers(), json=self.score())
        self.assertEqual(response.json()["data"]["total"], 100)
        self.assertEqual(len(self.history), 1)
        lower = self.score()
        lower["hintsUsed"] = 1
        response = self.client.post("/api/score", headers=self.headers(), json=lower)
        self.assertEqual(response.json()["data"]["earnedPoints"], 5)
        self.assertEqual(self.stages[("learner-a", 1, 0)]["best_score"], 100)
        self.assertEqual(len(self.history), 2)

    def test_anonymous_scoring_does_not_persist(self):
        self.assertEqual(self.client.post("/api/score", json=self.score()).status_code, 200)
        self.assertEqual(self.history, [])

    def test_score_persistence_failure_does_not_crash_response(self):
        with patch.object(repo, "insert_score_history", side_effect=RuntimeError("simulated storage outage")):
            self.assertEqual(self.client.post("/api/score", headers=self.headers(), json=self.score()).status_code, 200)

    def test_malformed_requests_and_unknown_puzzles(self):
        self.assertEqual(self.client.post("/api/score", json={}).status_code, 422)
        payload = self.score()
        payload["stageIdx"] = 99
        self.assertEqual(self.client.post("/api/score", json=payload).status_code, 404)

    def test_negative_and_zero_step_scores_are_rejected(self):
        payload = self.score()
        payload["stageIdx"] = -1
        payload["stepsUsed"] = -1
        self.assertEqual(self.client.post("/api/score", json=payload).status_code, 422)

        zero = self.score()
        zero["stepsUsed"] = 0
        self.assertEqual(self.client.post("/api/score", json=zero).status_code, 422)

    def test_invalid_progress_values_are_rejected(self):
        bad_payloads = (
            {"points": -5},
            {"stageProgress": {"99": [-1]}},
            {"stageProgress": {"x": [0]}},
            {"stageProgress": {"1": [0, 0]}},
            {"stageScores": {"99:-1": 999}},
            {"stageScores": {"1:0": 120}},
            {"stageProgress": {"1": [100]}},
        )
        for bad in bad_payloads:
            with self.subTest(payload=bad):
                response = self.client.post("/api/progress/save", headers=self.headers(), json={"progress": bad})
                self.assertEqual(response.status_code, 422)

    def test_validation_errors_do_not_reflect_input(self):
        response = self.client.post("/api/score", json=self.score(stepsUsed=-3))
        self.assertEqual(response.status_code, 422)
        detail = response.json()["error"]["detail"]
        self.assertTrue(detail)
        for item in detail:
            self.assertEqual(set(item), {"loc", "msg", "type"})
        self.assertNotIn('"input"', response.text)
        self.assertNotIn("-3", response.text)


class SecurityTests(unittest.TestCase):
    """Hardening added in round 9: envelope-level limits and headers."""

    def setUp(self):
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_oversized_body_is_rejected_before_parsing(self):
        payload = {"progress": {"points": 1, "stageScores": {}}}
        payload["progress"]["padding"] = "x" * 300_000
        response = self.client.post("/api/progress/save", json=payload)
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["error"]["code"], "payload_too_large")

    def test_https_responses_get_hsts_and_api_cache_policy(self):
        secure = self.client.get("/api/levels", headers={"X-Forwarded-Proto": "https"})
        self.assertEqual(secure.status_code, 200)
        self.assertIn("max-age=63072000", secure.headers["strict-transport-security"])
        # Shared, non-personal content may be reused briefly by the browser.
        self.assertIn("max-age=300", secure.headers["cache-control"])
        self.assertEqual(secure.headers["x-content-type-options"], "nosniff")
        self.assertEqual(secure.headers["x-permitted-cross-domain-policies"], "none")
        # Authenticated payloads never enter a shared cache.
        private = self.client.get("/api/progress")
        self.assertEqual(private.headers["cache-control"], "no-store")
        plain = self.client.get("/api/levels")
        self.assertNotIn("strict-transport-security", plain.headers)

    def test_score_bucket_returns_429_with_retry_after(self):
        os.environ["RATE_LIMIT_SCORE"] = "2"
        try:
            small = FastAPI()

            @small.get("/api/score")
            def _score():
                return {"success": True}

            limited = TestClient(RateLimitMiddleware(small))
        finally:
            os.environ.pop("RATE_LIMIT_SCORE", None)
        self.assertEqual(limited.get("/api/score").status_code, 200)
        self.assertEqual(limited.get("/api/score").status_code, 200)
        blocked = limited.get("/api/score")
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.json()["error"]["code"], "rate_limited")
        self.assertGreaterEqual(int(blocked.headers["retry-after"]), 1)
        self.assertEqual(blocked.headers["cache-control"], "no-store")

    def test_chunked_body_is_aborted_at_the_cap(self):
        small = FastAPI()

        @small.post("/api/progress/save")
        async def _save(request: Request):
            await request.body()
            return {"success": True}

        limited = TestClient(BodySizeLimitMiddleware(small, max_bytes=1024))

        def chunks():
            for _ in range(4):
                yield b"x" * 512

        response = limited.post("/api/progress/save", content=chunks())
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["error"]["code"], "payload_too_large")

    def test_spoofed_forwarded_for_cannot_pick_its_own_bucket(self):
        def build(**kwargs):
            small = FastAPI()

            @small.get("/api/score")
            def _score():
                return {"success": True}

            gate = RateLimitMiddleware(small, **kwargs)
            gate.score = Rule(2, 60.0)
            return TestClient(gate)

        self.assertEqual(build().get("/api/score", headers={"X-Forwarded-For": "1.1.1.1"}).status_code, 200)
        self.assertEqual(build().get("/api/score", headers={"X-Forwarded-For": "2.2.2.2"}).status_code, 200)
        # Different spoofed first hops, same socket peer: one shared bucket.
        untrusted = build()
        untrusted.get("/api/score", headers={"X-Forwarded-For": "3.3.3.3"})
        untrusted.get("/api/score", headers={"X-Forwarded-For": "4.4.4.4"})
        self.assertEqual(untrusted.get("/api/score", headers={"X-Forwarded-For": "5.5.5.5"}).status_code, 429)

        trusted = build(trust_proxy=True)
        trusted.get("/api/score", headers={"X-Forwarded-For": "6.6.6.6, 9.9.9.9"})
        trusted.get("/api/score", headers={"X-Forwarded-For": "7.7.7.7, 9.9.9.9"})
        self.assertEqual(
            trusted.get("/api/score", headers={"X-Forwarded-For": "8.8.8.8, 9.9.9.9"}).status_code, 429
        )

    def test_upstream_failure_never_leaks_storage_details(self):
        secret = "https://project-ref.supabase.co/rest/v1/user_progress?user_id=eq.learner-a"
        headers = {"Authorization": "Bearer learner-a"}
        auth = patch.object(supabase, "get_user", AsyncMock(return_value={"id": "learner-a"}))
        auth.start()
        self.addCleanup(auth.stop)
        class _Builder:
            def select(self, *_args, **_kwargs):
                return self

            def eq(self, *_args, **_kwargs):
                return self

            def execute(self):
                raise httpx.ConnectError(secret)

        with patch.object(supabase, "table", return_value=_Builder()):
            response = self.client.get("/api/progress", headers=headers)
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["error"]["code"], "upstream_error")
        self.assertIsNone(response.json()["error"]["detail"])
        self.assertNotIn("supabase.co", response.text)
        self.assertNotIn("learner-a", response.text)

    def test_cors_wraps_the_limiters(self):
        # Starlette keeps the most recently added middleware outermost; CORS has
        # to sit outside the body cap and the rate limiter, or their 413/429
        # responses reach the browser without Access-Control-Allow-Origin.
        from starlette.middleware.cors import CORSMiddleware

        names = [entry.cls.__name__ for entry in app.user_middleware]
        cors = names.index(CORSMiddleware.__name__)
        self.assertLess(cors, names.index(BodySizeLimitMiddleware.__name__))
        self.assertLess(cors, names.index(RateLimitMiddleware.__name__))
        self.assertGreater(cors, 0)  # SecurityHeadersMiddleware stays outermost

    def test_auth_outage_is_upstream_not_unauthorized(self):
        class _Response:
            def __init__(self, status):
                self.status_code = status

            def json(self):
                return {}

        class _Client:
            def __init__(self, status):
                self.status = status

            async def get(self, *_args, **_kwargs):
                return _Response(self.status)

        for status in (429, 500, 503):
            with patch.object(supabase, "_async", return_value=_Client(status)):
                with self.assertRaises(UpstreamError):
                    asyncio.run(supabase.get_user("token"))
        # A rejected token is still an ordinary "no user", not an outage.
        with patch.object(supabase, "_async", return_value=_Client(401)):
            self.assertIsNone(asyncio.run(supabase.get_user("token")))

    def test_allowed_hosts_read_from_environment(self):
        os.environ["ALLOWED_HOSTS"] = "praxis-backend-5302.onrender.com,localhost"
        try:
            parsed = Settings.from_env().allowed_hosts
        finally:
            os.environ.pop("ALLOWED_HOSTS", None)
        self.assertEqual(parsed, ["praxis-backend-5302.onrender.com", "localhost"])

    def test_body_limit_reports_invalid_content_length(self):
        small = FastAPI()

        @small.post("/api/progress/save")
        def _save():
            return {"success": True}

        limited = TestClient(BodySizeLimitMiddleware(small, max_bytes=1024))
        response = limited.post(
            "/api/progress/save",
            content=b"{}",
            headers={"Content-Length": "not-a-number"},
        )
        self.assertEqual(response.status_code, 400)



if __name__ == "__main__":
    unittest.main()

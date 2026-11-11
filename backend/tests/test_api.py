"""Real FastAPI routes/services with isolated Auth and repository doubles.

No real credentials or PostgreSQL writes. Expected failures document existing
input-integrity gaps rather than treating those gaps as correct behavior.
"""
import os
import unittest
from copy import deepcopy
from unittest.mock import AsyncMock, patch

os.environ["SUPABASE_URL"] = "https://praxis-test.invalid"
os.environ["SUPABASE_SERVICE_KEY"] = "isolated-test-key"

from fastapi.testclient import TestClient
from main import app
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
        self.assertEqual(len(self.client.get("/api/laws").json()["data"]), 10)
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
        progress = {"points": 25, "streak": 2, "bestStreak": 3, "stageProgress": {"0": [0, 1, 2, 3], "1": [0]}, "stageScores": {"1:0": 90}}
        response = self.client.post("/api/progress/save", headers=self.headers(), json={"progress": progress})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/progress", headers=self.headers()).json()["data"], progress)
        other = self.client.get("/api/progress", headers=self.headers("learner-b")).json()["data"]
        self.assertEqual(other["points"], 0)
        self.assertEqual(other["stageProgress"], {})

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

    @unittest.expectedFailure
    def test_known_gap_negative_score_inputs_should_be_rejected(self):
        payload = self.score()
        payload["stageIdx"] = -1
        payload["stepsUsed"] = -1
        self.assertEqual(self.client.post("/api/score", json=payload).status_code, 422)

    @unittest.expectedFailure
    def test_known_gap_invalid_progress_values_should_be_rejected(self):
        response = self.client.post("/api/progress/save", headers=self.headers(), json={"progress": {"points": -5, "stageProgress": {"99": [-1]}, "stageScores": {"99:-1": 999}}})
        self.assertEqual(response.status_code, 422)

    @unittest.expectedFailure
    def test_known_gap_zero_step_claim_should_not_receive_perfect_score(self):
        payload = self.score()
        payload["stepsUsed"] = 0
        response = self.client.post("/api/score", json=payload)
        self.assertNotEqual(response.json().get("data", {}).get("total"), 100)


if __name__ == "__main__":
    unittest.main()

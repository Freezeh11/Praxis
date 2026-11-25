"""Feedback endpoint - bounds, the reply-address rule and failure envelopes."""

from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, patch

os.environ.setdefault("SUPABASE_URL", "https://praxis-test.invalid")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "isolated-test-key")

from fastapi.testclient import TestClient  # noqa: E402

from core.errors import UpstreamError  # noqa: E402
from main import app  # noqa: E402
from repositories import feedback_repository  # noqa: E402
from supabase_client import supabase  # noqa: E402

ACCOUNT_EMAIL = "learner@example.com"


def get_user(token):
    """Only one token is real; anything else fails like Supabase does."""
    if token != "learner-a":
        raise RuntimeError("invalid token")
    return {"id": "user-a", "email": ACCOUNT_EMAIL}


class FeedbackApiTest(unittest.TestCase):
    """The form is the only way a learner can reach the maintainer."""

    def setUp(self) -> None:
        self.rows: list[dict] = []
        patch.object(feedback_repository, "insert_feedback", self.rows.append).start()
        self.addCleanup(patch.stopall)
        patch.object(supabase, "get_user", AsyncMock(side_effect=get_user)).start()
        patch.object(
            supabase,
            "table",
            side_effect=AssertionError("Real storage forbidden in API test"),
        ).start()
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def headers(self, user: str = "learner-a") -> dict[str, str]:
        return {"Authorization": f"Bearer {user}"}

    def report(self, **overrides):
        payload = {
            "category": "bug",
            "message": "The last step of stage 2 dropped my expression.",
            "page": "/level/1/stage/2",
            "appVersion": "1.0.0",
        }
        return {**payload, **overrides}

    def test_signed_in_report_is_stamped_with_the_account_address(self):
        response = self.client.post(
            "/api/feedback", headers=self.headers(), json=self.report()
        )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["data"], {"status": "received"})
        self.assertEqual(len(self.rows), 1)
        row = self.rows[0]
        self.assertEqual(row["user_id"], "user-a")
        self.assertEqual(row["email"], ACCOUNT_EMAIL)
        self.assertEqual(row["category"], "bug")

    def test_signed_out_report_must_carry_an_address(self):
        response = self.client.post("/api/feedback", json=self.report())
        self.assertEqual(response.status_code, 422)
        self.assertFalse(response.json()["success"])
        self.assertEqual(response.json()["error"]["code"], "validation_error")
        self.assertEqual(self.rows, [])

    def test_signed_out_report_with_an_address_is_accepted(self):
        response = self.client.post(
            "/api/feedback", json=self.report(email="  Outside@Example.com ")
        )
        self.assertEqual(response.status_code, 202)
        row = self.rows[0]
        self.assertIsNone(row["user_id"])
        self.assertEqual(row["email"], "outside@example.com")

    def test_account_address_wins_over_a_typed_one(self):
        response = self.client.post(
            "/api/feedback",
            headers=self.headers(),
            json=self.report(email="other@example.com"),
        )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(self.rows[0]["email"], ACCOUNT_EMAIL)

    def test_message_is_trimmed_and_must_have_substance(self):
        accepted = self.client.post(
            "/api/feedback",
            headers=self.headers(),
            json=self.report(message="   a real bug happened here   "),
        )
        self.assertEqual(accepted.status_code, 202)
        self.assertEqual(self.rows[0]["message"], "a real bug happened here")

        for message in ("   too short  ", "x" * 2001):
            with self.subTest(message=message[:12]):
                refused = self.client.post(
                    "/api/feedback",
                    headers=self.headers(),
                    json=self.report(message=message),
                )
                self.assertEqual(refused.status_code, 422)
        self.assertEqual(len(self.rows), 1)

    def test_unknown_category_and_bad_email_are_refused(self):
        for overrides in ({"category": "praise"}, {"email": "no-at-sign"}):
            with self.subTest(**overrides):
                response = self.client.post(
                    "/api/feedback", json=self.report(**overrides)
                )
                self.assertEqual(response.status_code, 422)
        self.assertEqual(self.rows, [])

    def test_puzzle_coordinates_and_user_agent_are_stored(self):
        response = self.client.post(
            "/api/feedback",
            headers={**self.headers(), "user-agent": "PraxisTest/1.0"},
            json=self.report(context={"levelId": 2, "stageIdx": 3}),
        )
        self.assertEqual(response.status_code, 202)
        row = self.rows[0]
        self.assertEqual(row["context"], {"levelId": 2, "stageIdx": 3})
        self.assertEqual(row["user_agent"], "PraxisTest/1.0")

    def test_storage_failure_is_reported_without_leaking_the_message(self):
        def explode(row):
            raise UpstreamError("Feedback storage is unavailable")

        patch.object(feedback_repository, "insert_feedback", explode).start()
        response = self.client.post(
            "/api/feedback", headers=self.headers(), json=self.report()
        )
        self.assertEqual(response.status_code, 502)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["error"]["code"], "upstream_error")
        self.assertNotIn("dropped my expression", response.text)
        self.assertNotIn(ACCOUNT_EMAIL, response.text)

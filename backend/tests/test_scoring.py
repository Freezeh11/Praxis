"""Reward parity regression: scoring is pure and needs no Supabase connection."""
import unittest

from services.scoring_service import compute_score


class RewardParityTests(unittest.TestCase):
    def test_stage_11_benchmark_does_not_follow_steps_used(self):
        for override in (None, 5):
            for steps, efficiency in ((4, 40), (5, 40), (6, 30)):
                with self.subTest(override=override, steps=steps):
                    result = compute_score(
                        level_id=1, stage_idx=10, steps_used=steps,
                        laws_used=["demorgan-and", "complement", "annulment"],
                        hints_used=0, guides_used=0, optimal_steps=override,
                    )
                    self.assertEqual(result.breakdown["optimalSteps"], 5)
                    self.assertEqual(result.efficiency, efficiency)

    def test_half_bonus_boundaries_match_browser(self):
        for steps, laws, hints, total, bonus in [
            (1, ["absorption"], 1, 90, 5),
            (3, [], 0, 50, 3),
            (5, [], 2, 10, 1),
            (1, ["absorption"], 0, 100, 5),
        ]:
            with self.subTest(total=total):
                result = compute_score(
                    level_id=1, stage_idx=0, steps_used=steps,
                    laws_used=laws, hints_used=hints, guides_used=0,
                    optimal_steps=1,
                )
                self.assertEqual(result.total, total)
                self.assertEqual(result.earned_points, bonus)


if __name__ == "__main__":
    unittest.main()

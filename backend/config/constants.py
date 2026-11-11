"""Scoring weights, penalties, bonuses and progression thresholds.

Shared with the UI contract; imported by ``services/*`` only.
"""

from __future__ import annotations

# ── Metric weights (they sum to MAX_SCORE) ──────────────────────────────────
EFFICIENCY_WEIGHT = 40.0  # steps taken vs optimal steps
TARGET_LAW_WEIGHT = 30.0  # share of the puzzle's target laws actually applied
HINT_INDEPENDENCE_WEIGHT = 30.0  # solved without hints/guides
MAX_SCORE = EFFICIENCY_WEIGHT + TARGET_LAW_WEIGHT + HINT_INDEPENDENCE_WEIGHT  # 100.0

# ── Penalties ───────────────────────────────────────────────────────────────
STEP_PENALTY = 10.0  # points lost per step over the optimal solution
ASSISTANCE_PENALTY = 10.0  # points lost per hint or guide consumed

# ── Bonus ───────────────────────────────────────────────────────────────────
MAX_BONUS_POINTS = 5  # awarded on top of the base 10 when the total is MAX_SCORE

# ── Rounding ────────────────────────────────────────────────────────────────
SCORE_ROUNDING_DP = 1  # decimals kept on every reported score component

# ── Progression contract (consumed by the frontend) ─────────────────────────
STAR_THRESHOLDS = (90.0, 75.0)  # 3 stars >= 90, 2 stars >= 75, 1 star below
UNLOCK_AVERAGE = 80.0  # average stage score needed to unlock the next level

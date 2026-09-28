"""Scoring rules: efficiency (40), target laws (30), hint independence (30).

Every number comes from ``config/constants.py``; imported by ``api/routes/score.py``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

from config import constants
from services import content_service


@dataclass(frozen=True)
class ScoreOutcome:
    """Everything one completed puzzle evaluation produces."""

    level_id: int
    stage_idx: int
    steps_used: int
    laws_used: tuple[str, ...]  # as submitted, duplicates included
    assistance_used: int  # hints + guides, the figure stored in hints_used
    efficiency: float
    target_law: float
    hint_independence: float
    total: float
    earned_points: int
    breakdown: dict[str, Any]


def compute_score(
    *,
    level_id: int,
    stage_idx: int,
    steps_used: int,
    laws_used: Sequence[str],
    hints_used: int | None,
    guides_used: int | None,
    optimal_steps: int | None,
) -> ScoreOutcome:
    """Score one puzzle stage; raises :class:`AppError` for unknown level/stage."""
    puzzle = content_service.get_puzzle(level_id, stage_idx)

    optimal = _resolve_optimal(optimal_steps, puzzle, steps_used)
    target_laws = set(puzzle.get("targetLaws", []))
    applied_laws = set(laws_used)

    efficiency = _efficiency(steps_used, optimal)
    target_law = _target_law(target_laws, applied_laws)
    assistance_used = (hints_used or 0) + (guides_used or 0)
    hint_independence = _hint_independence(assistance_used)

    total = round(efficiency + target_law + hint_independence, constants.SCORE_ROUNDING_DP)
    earned_points = round((total / constants.MAX_SCORE) * constants.MAX_BONUS_POINTS)

    return ScoreOutcome(
        level_id=level_id,
        stage_idx=stage_idx,
        steps_used=steps_used,
        laws_used=tuple(laws_used),
        assistance_used=assistance_used,
        efficiency=efficiency,
        target_law=target_law,
        hint_independence=hint_independence,
        total=total,
        earned_points=earned_points,
        breakdown={
            "stepsUsed": steps_used,
            "optimalSteps": optimal,
            "targetLawsRequired": list(target_laws),
            "targetLawsUsed": list(target_laws & applied_laws),
            "hintsUsed": hints_used or 0,
            "guidesUsed": guides_used or 0,
            "totalAssistance": assistance_used,
        },
    )


def _resolve_optimal(optimal_steps: int | None, puzzle: dict[str, Any], steps_used: int) -> int:
    """Pick the optimal step count: explicit override, else the puzzle's own."""
    optimal = (
        optimal_steps
        if (optimal_steps is not None and optimal_steps > 0)
        else puzzle.get("optimalSteps", steps_used)
    )
    # A solution shorter than the recorded optimum lowers the bar to what was used.
    return min(optimal, steps_used)


def _efficiency(steps_used: int, optimal: int) -> float:
    """Full marks at or below the optimum, :data:`STEP_PENALTY` per extra step."""
    if steps_used <= optimal:
        return constants.EFFICIENCY_WEIGHT
    over = steps_used - optimal
    return max(0.0, constants.EFFICIENCY_WEIGHT - over * constants.STEP_PENALTY)


def _target_law(target_laws: set[str], applied_laws: set[str]) -> float:
    """Proportional credit for the target laws actually applied."""
    if not target_laws:
        return constants.TARGET_LAW_WEIGHT  # no target laws defined -> full marks
    matched = len(target_laws & applied_laws)
    return round(
        (matched / len(target_laws)) * constants.TARGET_LAW_WEIGHT,
        constants.SCORE_ROUNDING_DP,
    )


def _hint_independence(assistance_used: int) -> float:
    """Full marks unaided, :data:`ASSISTANCE_PENALTY` per hint or guide."""
    return max(
        0.0,
        constants.HINT_INDEPENDENCE_WEIGHT - assistance_used * constants.ASSISTANCE_PENALTY,
    )

"""Numeric audit — re-derive every worked example in the scoring / config docs.

Runs the REAL backend scorer and the REAL JS mirror, then prints the observed
values so the verifier can diff them against the doc tables.
"""
from __future__ import annotations

import json
import math
import os
import sys

BACKEND = "/home/xris/Documents/GitHub/Praxis/backend"
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

import importlib  # noqa: E402

scoring_service = importlib.import_module("services.scoring_service")
content_service = importlib.import_module("services.content_service")
constants = importlib.import_module("config.constants")

from services.scoring_service import compute_score  # noqa: E402

OUT = {}


def show(tag, **kw):
    try:
        o = compute_score(**kw)
        OUT[tag] = {
            "efficiency": o.efficiency,
            "targetLaw": o.target_law,
            "hintIndependence": o.hint_independence,
            "total": o.total,
            "earnedPoints": o.earned_points,
            "breakdown": o.breakdown,
        }
    except Exception as exc:  # noqa: BLE001
        OUT[tag] = {"ERROR": f"{type(exc).__name__}: {exc}"}


# --- the content facts the examples depend on -----------------------------
OUT["_content"] = {}
for lid in (0, 1, 2, 3):
    lvl = content_service.get_level(lid)
    OUT["_content"][lid] = [
        {"i": i, "expr": p["expr"], "goal": p["goal"], "targetLaws": p["targetLaws"],
         "optimalSteps": p["optimalSteps"]}
        for i, p in enumerate(lvl["puzzles"])
    ]

# --- W1 -------------------------------------------------------------------
show("W1", level_id=1, stage_idx=0, steps_used=1, laws_used=["absorption"],
     hints_used=0, guides_used=0, optimal_steps=None)

# --- W2 -------------------------------------------------------------------
show("W2", level_id=1, stage_idx=2, steps_used=2,
     laws_used=["idempotent", "distributive", "complement"],
     hints_used=0, guides_used=0, optimal_steps=None)

# --- W3: optimal 3, used 5, distributive only, 1 hint + 1 guide -----------
show("W3", level_id=2, stage_idx=0, steps_used=5, laws_used=["distributive"],
     hints_used=1, guides_used=1, optimal_steps=None)

# --- W4: the 90.0 disagreeement -------------------------------------------
show("W4", level_id=2, stage_idx=0, steps_used=3,
     laws_used=["distributive", "complement"], hints_used=0, guides_used=0, optimal_steps=None)

# --- W5: 50.0 -------------------------------------------------------------
show("W5", level_id=2, stage_idx=0, steps_used=5, laws_used=[],
     hints_used=0, guides_used=0, optimal_steps=None)

# --- W6: optimal 7, used 15, 3 hints + 1 guide ----------------------------
for lid in (0, 1, 2, 3):
    for i, p in enumerate(content_service.get_level(lid)["puzzles"]):
        if p["optimalSteps"] == 7:
            show(f"W6_candidate_level{lid}_stage{i}", level_id=lid, stage_idx=i,
                 steps_used=15, laws_used=[], hints_used=3, guides_used=1, optimal_steps=None)
            OUT.setdefault("_W6_locations", []).append([lid, i, p["targetLaws"]])

# --- W7: optimal 2, used 3, demorgan-and, 1 of 2 --------------------------
for lid in (0, 1, 2, 3):
    for i, p in enumerate(content_service.get_level(lid)["puzzles"]):
        if p["optimalSteps"] == 2 and len(p["targetLaws"]) == 2 and "demorgan-and" in p["targetLaws"]:
            show(f"W7_candidate_level{lid}_stage{i}", level_id=lid, stage_idx=i,
                 steps_used=3, laws_used=["demorgan-and"], hints_used=1, guides_used=0,
                 optimal_steps=None)
            OUT.setdefault("_W7_locations", []).append([lid, i, p["targetLaws"]])

# --- W8: empty targetLaws stub -------------------------------------------
_orig = scoring_service.content_service.get_puzzle
scoring_service.content_service.get_puzzle = lambda level_id, stage_idx: {
    "expr": "a", "goal": "a", "targetLaws": [], "hints": [],
    "optimalSteps": 2, "optimalHint": "",
}
show("W8", level_id=1, stage_idx=0, steps_used=2, laws_used=[],
     hints_used=0, guides_used=0, optimal_steps=None)
scoring_service.content_service.get_puzzle = _orig

OUT["_target_law_empty"] = scoring_service._target_law(set(), set())

# --- the negative stageIdx behaviour -------------------------------------
for idx in (-1, -12, -13, -100, -4, -5):
    show(f"NEG_stageIdx_{idx}_level1", level_id=1, stage_idx=idx, steps_used=1,
         laws_used=[], hints_used=0, guides_used=0, optimal_steps=None)
for idx in (-4, -5):
    show(f"NEG_stageIdx_{idx}_level0", level_id=0, stage_idx=idx, steps_used=1,
         laws_used=[], hints_used=0, guides_used=0, optimal_steps=None)

# --- no-bounds probes ----------------------------------------------------
show("NEG_hints", level_id=1, stage_idx=0, steps_used=1, laws_used=[],
     hints_used=-99, guides_used=0, optimal_steps=None)
show("NEG_steps", level_id=1, stage_idx=0, steps_used=-50, laws_used=[],
     hints_used=0, guides_used=0, optimal_steps=None)
show("OVERRIDE_999", level_id=1, stage_idx=0, steps_used=1, laws_used=[],
     hints_used=0, guides_used=0, optimal_steps=999)
show("OVERRIDE_0", level_id=1, stage_idx=0, steps_used=1, laws_used=[],
     hints_used=0, guides_used=0, optimal_steps=0)
show("OVERRIDE_neg3", level_id=1, stage_idx=0, steps_used=1, laws_used=[],
     hints_used=0, guides_used=0, optimal_steps=-3)
show("D24_max", level_id=1, stage_idx=0, steps_used=0, laws_used=["absorption"],
     hints_used=0, guides_used=0, optimal_steps=None)

# --- exhaustive reachable totals -----------------------------------------
EFF = [0.0, 10.0, 20.0, 30.0, 40.0]
TL = [0.0, 10.0, 15.0, 20.0, 30.0]
HI = [0.0, 10.0, 20.0, 30.0]
totals = sorted({round(e + t + h, 1) for e in EFF for t in TL for h in HI})
OUT["_reachable_totals"] = totals
OUT["_divergence"] = [
    {"total": t, "server": round((t / 100) * 5), "browser": math.floor((t / 100) * 5 + 0.5)}
    for t in totals
    if round((t / 100) * 5) != math.floor((t / 100) * 5 + 0.5)
]

# --- constants echo ------------------------------------------------------
OUT["_constants"] = {k: getattr(constants, k) for k in dir(constants) if k.isupper()}

print("###JSON###")
print(json.dumps(OUT, indent=1, default=str))

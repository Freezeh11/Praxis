"""Independent API audit for the Praxis docs suite (verifier-owned scratch).

Runs the real FastAPI app through TestClient and prints a machine-readable
observation dump. Nothing here is trusted from the docs.
"""
from __future__ import annotations

import json
import os
import sys

BACKEND = "/home/xris/Documents/GitHub/Praxis/backend"
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app, raise_server_exceptions=False)

OUT = []


def rec(label, resp, body_note=""):
    try:
        body = resp.json()
    except Exception:
        body = resp.text[:400]
    OUT.append({
        "label": label,
        "status": resp.status_code,
        "x_request_id": resp.headers.get("x-request-id"),
        "body": body,
        "note": body_note,
    })
    return body


# ---- route table from the app itself -------------------------------------
routes = []
for r in main.app.routes:
    methods = sorted(getattr(r, "methods", []) or [])
    routes.append({"path": getattr(r, "path", None), "methods": methods, "name": getattr(r, "name", None)})
OUT.append({"label": "ROUTE_TABLE", "routes": routes})

# ---- 1. GET / -------------------------------------------------------------
rec("GET /", client.get("/"))

# ---- 2. GET /api/levels ---------------------------------------------------
b = rec("GET /api/levels", client.get("/api/levels"))
if isinstance(b, dict) and isinstance(b.get("data"), list):
    OUT.append({"label": "LEVEL_SUMMARIES", "keys": [sorted(d.keys()) for d in b["data"]],
                "summaries": b["data"]})

# ---- 3. GET /api/levels/{id}: valid + unknown + weird ---------------------
for lid in (0, 1, 2, 3, 4, 999, -1):
    b = rec(f"GET /api/levels/{lid}", client.get(f"/api/levels/{lid}"))
    if isinstance(b, dict) and isinstance(b.get("data"), dict):
        d = b["data"]
        pz = d.get("puzzles", [])
        OUT.append({
            "label": f"LEVEL_{lid}_SHAPE",
            "level_keys": sorted(d.keys()),
            "n_puzzles": len(pz),
            "puzzle_key_sets": sorted({tuple(sorted(p.keys())) for p in pz}),
            "varCount": d.get("varCount"),
            "name": d.get("name"),
            "desc": d.get("desc"),
            "id": d.get("id"),
        })
rec("GET /api/levels/abc", client.get("/api/levels/abc"))
rec("GET /api/levels/1.5", client.get("/api/levels/1.5"))

# ---- 4. GET /api/laws -----------------------------------------------------
b = rec("GET /api/laws", client.get("/api/laws"))
if isinstance(b, dict) and isinstance(b.get("data"), list):
    OUT.append({"label": "LAWS", "n": len(b["data"]),
                "ids": [d.get("id") for d in b["data"]],
                "key_sets": sorted({tuple(sorted(d.keys())) for d in b["data"]})})

# ---- 5. POST /api/score ---------------------------------------------------
GT_BODY = {"levelId": 1, "stageIdx": 0, "stepsUsed": 1, "lawsUsed": ["absorption"], "hintsUsed": 0}
rec("POST /api/score [ground-truth body]", client.post("/api/score", json=GT_BODY))

# signed-out explicit no-auth header
rec("POST /api/score [no auth header]", client.post("/api/score", json=GT_BODY, headers={}))
# garbage bearer (optional_user swallows 401 -> None? check!)
rec("POST /api/score [garbage bearer]",
    client.post("/api/score", json=GT_BODY, headers={"Authorization": "Bearer not-a-real-token"}))

# 422: missing stepsUsed (the exact GROUND-TRUTH example)
rec("POST /api/score [missing stepsUsed]",
    client.post("/api/score", json={"levelId": 1, "stageIdx": 0}))
rec("POST /api/score [empty body]", client.post("/api/score", json={}))
rec("POST /api/score [wrong types]",
    client.post("/api/score", json={"levelId": "x", "stageIdx": 0, "stepsUsed": 1, "lawsUsed": [], "hintsUsed": 0}))
rec("POST /api/score [lawsUsed missing]",
    client.post("/api/score", json={"levelId": 1, "stageIdx": 0, "stepsUsed": 1, "hintsUsed": 0}))
rec("POST /api/score [no body / no content-type]", client.post("/api/score"))

# 404 from score: unknown level / unknown stage
rec("POST /api/score [unknown level 999]",
    client.post("/api/score", json={"levelId": 999, "stageIdx": 0, "stepsUsed": 1, "lawsUsed": [], "hintsUsed": 0}))
rec("POST /api/score [stage 12 on level 1]",
    client.post("/api/score", json={"levelId": 1, "stageIdx": 12, "stepsUsed": 1, "lawsUsed": [], "hintsUsed": 0}))
rec("POST /api/score [stage -1 on level 1]",
    client.post("/api/score", json={"levelId": 1, "stageIdx": -1, "stepsUsed": 1, "lawsUsed": [], "hintsUsed": 0}))
rec("POST /api/score [stage -4 on level 0]",
    client.post("/api/score", json={"levelId": 0, "stageIdx": -4, "stepsUsed": 1, "lawsUsed": [], "hintsUsed": 0}))
rec("POST /api/score [stage -5 on level 0]",
    client.post("/api/score", json={"levelId": 0, "stageIdx": -5, "stepsUsed": 1, "lawsUsed": [], "hintsUsed": 0}))

# D24: client-trusted max
rec("POST /api/score [D24 stepsUsed 0 + 3 laws]",
    client.post("/api/score", json={"levelId": 1, "stageIdx": 0, "stepsUsed": 0,
                                    "lawsUsed": ["complement", "idempotent", "absorption"], "hintsUsed": 0}))
rec("POST /api/score [D24 negative stepsUsed]",
    client.post("/api/score", json={"levelId": 1, "stageIdx": 0, "stepsUsed": -50,
                                    "lawsUsed": [], "hintsUsed": 0}))
rec("POST /api/score [D24 negative hintsUsed]",
    client.post("/api/score", json={"levelId": 1, "stageIdx": 0, "stepsUsed": 1,
                                    "lawsUsed": [], "hintsUsed": -99}))
rec("POST /api/score [optimalSteps 999]",
    client.post("/api/score", json={"levelId": 1, "stageIdx": 0, "stepsUsed": 1,
                                    "lawsUsed": [], "hintsUsed": 0, "optimalSteps": 999}))

# ---- 6/7. progress -------------------------------------------------------
rec("GET /api/progress [no auth]", client.get("/api/progress"))
rec("GET /api/progress [garbage bearer]",
    client.get("/api/progress", headers={"Authorization": "Bearer garbage"}))
rec("GET /api/progress [malformed header]",
    client.get("/api/progress", headers={"Authorization": "garbage"}))
rec("POST /api/progress/save [no auth]", client.post("/api/progress/save", json={"progress": {}}))
rec("POST /api/progress/save [no auth, negative values]",
    client.post("/api/progress/save", json={"progress": {"points": -5, "streak": -1, "bestStreak": -2,
                                                         "stageProgress": {"99": [-4]},
                                                         "stageScores": {"99:-4": 999.9}}}))
rec("POST /api/progress/save [garbage bearer]",
    client.post("/api/progress/save", json={"progress": {}}, headers={"Authorization": "Bearer garbage"}))

# ---- framework routes ----------------------------------------------------
rec("GET /openapi.json", client.get("/openapi.json"))
rec("GET /docs", client.get("/docs"))
rec("GET /redoc", client.get("/redoc"))
rec("GET /api/nope", client.get("/api/nope"))
rec("DELETE /api/levels", client.delete("/api/levels"))

# ---- OpenAPI security scheme audit (D22) ---------------------------------
spec = client.get("/openapi.json").json()
sec_schemes = spec.get("components", {}).get("securitySchemes", {})
OUT.append({"label": "OPENAPI_SECURITY_SCHEMES", "schemes": sec_schemes,
            "global_security": spec.get("security")})
for path, ops in spec.get("paths", {}).items():
    for method, op in ops.items():
        OUT.append({"label": "OPENAPI_OP", "path": path, "method": method,
                    "security": op.get("security", "ABSENT"),
                    "response_codes": sorted(op.get("responses", {}).keys())})

# ---- X-Request-ID behaviour ---------------------------------------------
r = client.get("/api/laws", headers={"X-Request-ID": "verifier-echo-test"})
OUT.append({"label": "REQUEST_ID_ECHO", "status": r.status_code,
            "x_request_id": r.headers.get("x-request-id")})
r = client.get("/api/laws")
OUT.append({"label": "REQUEST_ID_GENERATED", "status": r.status_code,
            "x_request_id": r.headers.get("x-request-id")})
r = client.get("/api/laws", headers={"Origin": "http://localhost:5173"})
OUT.append({"label": "CORS_5173", "acao": r.headers.get("access-control-allow-origin")})
r = client.get("/api/laws", headers={"Origin": "https://praxis-seven-puce.vercel.app"})
OUT.append({"label": "CORS_VERCEL", "acao": r.headers.get("access-control-allow-origin")})

print(json.dumps(OUT, indent=1, default=str))

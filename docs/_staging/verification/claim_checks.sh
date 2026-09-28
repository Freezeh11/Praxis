#!/usr/bin/env bash
# Curated claim checker — each row: ID | DOCREF | FILE | PATTERN | MODE
# MODE=line  -> FILE must contain PATTERN at the given line number
# MODE=any   -> FILE must contain PATTERN somewhere
# MODE=absent-> FILE must NOT contain PATTERN
cd /home/xris/Documents/GitHub/Praxis || exit 1
pass=0; fail=0
row() {
  local id="$1" doc="$2" file="$3" pat="$4" mode="$5" line="${6:-}"
  local ok=0
  if [[ ! -f "$file" ]]; then echo "MISSINGFILE|$id|$doc|$file"; fail=$((fail+1)); return; fi
  case "$mode" in
    line) if sed -n "${line}p" "$file" | grep -qF -- "$pat"; then ok=1; fi ;;
    any)  if grep -qF -- "$pat" "$file"; then ok=1; fi ;;
    absent) if ! grep -qF -- "$pat" "$file"; then ok=1; fi ;;
  esac
  if [[ $ok == 1 ]]; then pass=$((pass+1)); else fail=$((fail+1)); echo "WRONG|$id|$doc|$file:$line|want:$pat|got:$(sed -n "${line}p" "$file" 2>/dev/null | head -c 110)"; fi
}

# --- constants / scoring ---------------------------------------------------
row C01 "06-reference/scoring-and-rewards.md:34" backend/config/constants.py "EFFICIENCY_WEIGHT = 40.0" line 9
row C02 "06-reference/scoring-and-rewards.md:35" backend/config/constants.py "TARGET_LAW_WEIGHT = 30.0" line 10
row C03 "06-reference/scoring-and-rewards.md:36" backend/config/constants.py "HINT_INDEPENDENCE_WEIGHT = 30.0" line 11
row C04 "06-reference/scoring-and-rewards.md:37" backend/config/constants.py "MAX_SCORE = EFFICIENCY_WEIGHT" line 12
row C05 "06-reference/scoring-and-rewards.md:38" backend/config/constants.py "STEP_PENALTY = 10.0" line 15
row C06 "06-reference/scoring-and-rewards.md:39" backend/config/constants.py "ASSISTANCE_PENALTY = 10.0" line 16
row C07 "06-reference/scoring-and-rewards.md:40" backend/config/constants.py "MAX_BONUS_POINTS = 5" line 19
row C08 "06-reference/scoring-and-rewards.md:41" backend/config/constants.py "SCORE_ROUNDING_DP = 1" line 22
row C09 "06-reference/scoring-and-rewards.md:42" backend/config/constants.py "STAR_THRESHOLDS = (90.0, 75.0)" line 25
row C10 "06-reference/scoring-and-rewards.md:44" backend/config/constants.py "UNLOCK_AVERAGE = 80.0" line 26
row C11 "06-reference/scoring-and-rewards.md:34" frontend/src/config/gameRules.js "efficiency: 40," line 15
row C12 "06-reference/scoring-and-rewards.md:45" frontend/src/config/gameRules.js "STAGE_COMPLETION_XP = 10" line 32
row C13 "06-reference/scoring-and-rewards.md:46" frontend/src/config/gameRules.js "GUIDE_COST_POINTS = 20" line 35
row C14 "06-reference/scoring-and-rewards.md:47" frontend/src/config/gameRules.js "good: 80," line 53
row C15 "06-reference/scoring-and-rewards.md:43" frontend/src/config/gameRules.js "MAX_STARS_PER_STAGE = 3" line 46
row C16 "06-reference/scoring-and-rewards.md:44" frontend/src/config/gameRules.js "UNLOCK_AVERAGE_SCORE = 80" line 49
row C17 "06-reference/scoring-and-rewards.md:41" frontend/src/engine/scoring.js "const round1" line 22
row C18 "06-reference/scoring-and-rewards.md:55" backend/services/scoring_service.py "earned_points = round(" line 55
row C19 "06-reference/scoring-and-rewards.md:54" backend/services/scoring_service.py "total = round(efficiency" line 54
row C20 "06-reference/scoring-and-rewards.md:88" backend/services/scoring_service.py "return min(optimal, steps_used)" line 88
row C21 "06-reference/scoring-and-rewards.md:80" frontend/src/engine/scoring.js "const earnedPoints = Math.round(" line 80

# --- law definitions -------------------------------------------------------
row L01 "06-reference/boolean-laws.md:821" frontend/src/engine/laws/definitions.js "distributive-expand" line 44
row L02 "06-reference/boolean-laws.md:254" frontend/src/engine/laws/definitions.js "(A')' = A" line 51
row L03 "06-reference/boolean-laws.md:693" frontend/src/engine/laws/definitions.js "(A+B)' = A'B'" line 53
row L04 "06-reference/boolean-laws.md:654" frontend/src/engine/laws/definitions.js "(AB)' = A' + B'" line 52
row L05 "06-reference/boolean-laws.md:122" frontend/src/engine/laws/definitions.js "export const LAW_NAME_TO_ID" line 63
row L06 "06-reference/boolean-laws.md:880" frontend/src/engine/laws/definitions.js "export function defineLaw(name, form)" line 79
row L07 "06-reference/boolean-laws.md:881" frontend/src/engine/laws/definitions.js "LAW_DEFINITIONS = [" line 29
row L08 "06-reference/boolean-laws.md:822" frontend/src/engine/laws/helpers.js "findExpandablePair" any
row L09 "06-reference/boolean-laws.md:843" frontend/src/engine/laws/helpers.js "if (clauseNode.terms.length < 2) return null" line 148
row L10 "06-reference/boolean-laws.md:795" frontend/src/engine/laws/helpers.js "if (!sumContainsLit(clauseNode, litNode.v, !litNode.n)) return null" line 149
row L11 "06-reference/boolean-laws.md:38" frontend/src/engine/laws/scanHints.js "add('demorgan', [p])" line 38
row L12 "06-reference/boolean-laws.md:60" frontend/src/engine/laws/scanHints.js "if (n.child.type === 'not') add('double-neg', [p])" line 37

# --- API / backend ---------------------------------------------------------
row A01 "04-api/API-REFERENCE.md:147" backend/api/routes/health.py "Liveness probe: plain payload, no envelope." line 17
row A02 "04-api/API-REFERENCE.md:325" backend/main.py "allow_credentials=True," line 33
row A03 "04-api/API-REFERENCE.md:606" backend/repositories/content_repository.py "CONTENT_DIR = Path(__file__).resolve().parents[2]" line 16
row A04 "04-api/API-REFERENCE.md:410" backend/services/content_service.py "if stage_idx >= len(puzzles):" line 40
row A05 "04-api/API-REFERENCE.md:410" backend/services/content_service.py "raise NotFoundError(f\"Stage {stage_idx} not found\")" line 41
row A06 "04-api/API-REFERENCE.md:375" backend/core/errors.py "CONTENT_UNAVAILABLE = \"content_unavailable\"" line 15
row A07 "04-api/API-REFERENCE.md:1327" backend/api/routes/progress.py "return success({\"status\": \"ok\"})" line 41
row A08 "04-api/API-REFERENCE.md:941" backend/api/schemas/score.py "stageIdx: int" line 15
row A09 "04-api/API-REFERENCE.md:941" backend/api/schemas/score.py "hintsUsed: int" line 18
row A10 "04-api/API-REFERENCE.md:941" backend/api/schemas/score.py "guidesUsed: int | None = 0" line 19
row A11 "04-api/API-REFERENCE.md:941" backend/api/schemas/score.py "optimalSteps: int | None = None" line 20
row A12 "04-api/API-REFERENCE.md:153" backend/core/middleware.py "response.headers[REQUEST_ID_HEADER] = request_id" line 61
row A13 "04-api/API-REFERENCE.md:153" backend/core/middleware.py "REQUEST_ID_HEADER = \"X-Request-ID\"" line 18
row A14 "04-api/API-REFERENCE.md:276" backend/api/routes/score.py "background_tasks.add_task(progress_service.persist_score" line 39
row A15 "04-api/API-REFERENCE.md:276" backend/core/security.py "async def optional_user(request: Request)" line 38
row A16 "04-api/API-REFERENCE.md" backend/services/progress_service.py "\"hints_used\": outcome.assistance_used," line 101
row A17 "03-database/SCHEMA.md:378" backend/services/progress_service.py "progressSaveDebounceMs" absent

# --- database --------------------------------------------------------------
row D01 "03-database/SCHEMA.md" database/init.sql "CREATE TABLE IF NOT EXISTS user_progress" line 7
row D02 "03-database/SCHEMA.md" database/init.sql "CREATE TABLE IF NOT EXISTS stage_progress" line 16
row D03 "03-database/SCHEMA.md" database/init.sql "CREATE TABLE IF NOT EXISTS score_history" line 28
row D04 "03-database/SCHEMA.md:313" database/init.sql "Service role full access" any
row D05 "03-database/SCHEMA.md" database/init.sql "auth.uid()" absent
row D06 "03-database/SCHEMA.md" database/init.sql "user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE" any
row D07 "03-database/SCHEMA.md" database/init.sql "UNIQUE(user_id, level_id, stage_idx)" any
row D08 "03-database/SCHEMA.md:410" database/init.sql "npx auth migrate" line 4
row D09 "03-database/SCHEMA.md" database/init.sql "gen_random_uuid()" any
row D10 "03-database/SCHEMA.md" database/init.sql "idx_stage_progress_user" any
row D11 "03-database/SCHEMA.md" database/init.sql "idx_score_history_level" any

# --- devops / config -------------------------------------------------------
row V01 "08-devops/deployment.md:103" render.yaml "rootDir: backend" line 8
row V02 "08-devops/monitoring.md:84" render.yaml "healthCheckPath" absent
row V03 "08-devops/deployment.md" render.yaml "praxis-seven-puce.vercel.app" line 11
row V04 "08-devops/deployment.md" render.yaml "uvicorn main:app --host 0.0.0.0 --port \$PORT" line 7
row V05 "08-devops/configuration-guide.md" backend/config/settings.py "http://localhost:3001" line 26
row V06 "08-devops/configuration-guide.md" backend/config/settings.py "DEFAULT_CORS_ORIGINS: tuple[str, ...]" line 23
row V07 "08-devops/deployment.md" requirements.txt "-r backend/requirements.txt" any
row V08 "04-api/API-REFERENCE.md:57" frontend/vite.config.js "'/api': {" line 30
row V09 "07-explanation/known-limitations.md:397" backend/requirements.txt "python-dotenv" any

# --- frontend engine -------------------------------------------------------
row E01 "05-guides/tutorials/understanding-the-engine.md" frontend/src/engine/render.js "export function canonText(n)" line 28
row E02 "05-guides/tutorials/understanding-the-engine.md" frontend/src/engine/render.js "export function nodeText(n)" any
row E03 "05-guides/tutorials/understanding-the-engine.md" frontend/src/engine/index.js "export { nodeText, canonText } from './render.js'" line 33
row E04 "05-guides/tutorials/understanding-the-engine.md" frontend/src/state/useGameState.js "canonText(exprSnapshot) === goalCanonRef.current" line 56
row E05 "06-reference/boolean-laws.md:894" frontend/src/components/animations/index.js "" any
row E06 "06-reference/boolean-laws.md:892" frontend/src/state/hintText.js "" any
row E07 "07-explanation/why-this-architecture.md:64" frontend/src/pages/ProblemPage.jsx "" any
row E08 "03-database/SCHEMA.md:379" backend/api/routes/score.py "BackgroundTasks" line 10
row E09 "05-guides/how-to/add-a-new-problem.md:133" frontend/src/config/gameRules.js "levelId: 0," line 83
row E10 "10-project/file-map.md:682" frontend/src/engine/sandbox/pool.js "SANDBOX_POOL" any

# --- batch 2: glossary / error-codes / diagrams / file-map / project ---
row G01 "06-reference/error-codes.md:23" backend/core/errors.py "NOT_FOUND = \"not_found\"" line 14
row G02 "06-reference/error-codes.md:24" backend/core/errors.py "CONTENT_UNAVAILABLE" line 15
row G03 "06-reference/error-codes.md:25" backend/core/errors.py "UPSTREAM = \"upstream_error\"" line 16
row G04 "06-reference/error-codes.md:26" backend/core/errors.py "UNAUTHORIZED = \"unauthorized\"" line 17
row G05 "06-reference/error-codes.md:27" backend/core/errors.py "VALIDATION = \"validation_error\"" line 18
row G06 "06-reference/error-codes.md:28" backend/core/errors.py "HTTP = \"http_error\"" line 19
row G07 "06-reference/error-codes.md:29" backend/core/errors.py "INTERNAL = \"internal_error\"" line 20
row G08 "06-reference/error-codes.md:33" backend/core/errors.py "default_status: int = 500" line 31
row G09 "06-reference/error-codes.md" backend/core/errors.py "class ContentUnavailableError(AppError)" any
row G10 "06-reference/error-codes.md" backend/core/errors.py "class UpstreamError(AppError)" any
row G11 "06-reference/error-codes.md" backend/core/errors.py "class UnauthorizedError(AppError)" any
row G12 "04-api/API-REFERENCE.md:380" backend/core/responses.py "internal_error_response" line 55
row G13 "04-api/API-REFERENCE.md:375" backend/core/errors.py "content_unavailable" line 15
row G14 "10-project/glossary.md" frontend/src/engine/node.js "export const lit = (v, n = false)" any
row G15 "10-project/glossary.md" frontend/src/engine/node.js "export const neg = (child)" any
row G16 "10-project/file-map.md:300" frontend/src/App.jsx "/sandbox/play" any
row G17 "10-project/file-map.md:300" frontend/src/App.jsx "ProtectedRoute" any
row G18 "10-project/file-map.md:356" frontend/src/engine/solver.js "" any
row G19 "02-architecture/SAD.md:273" frontend/src/engine/scoring.js "from '../config/gameRules.js'" any
row G20 "02-architecture/SAD.md:273" frontend/src/engine/sandbox/input.js "from '../../config/gameRules.js'" line 36
row G21 "01-product/SRS.md:390" backend/config/settings.py "settings = Settings.from_env()" line 75
row G22 "01-product/SRS.md:390" backend/config/settings.py "def require_env(name: str) -> str:" line 30
row G23 "04-api/API-REFERENCE.md" frontend/src/services/apiClient.js "success" any
row G24 "08-devops/runbooks.md:573" database/init.sql "score_history" any
row G25 "01-product/SRS.md:497" frontend/src/engine/scoring.js "Math.round((total / 100)" line 80
row G26 "06-reference/config-reference.md:158" frontend/src/config/gameRules.js "lawAnimationMs: 1350," line 60
row G27 "06-reference/config-reference.md:159" frontend/src/config/gameRules.js "preLawHighlightMs: 1500," line 62
row G28 "06-reference/config-reference.md:163" frontend/src/config/gameRules.js "sandboxValidationDebounceMs: 300," line 70
row G29 "06-reference/config-reference.md" frontend/src/config/gameRules.js "maxVariables: 4," line 112
row G30 "09-diagrams/DIAGRAMS.md:245" frontend/src/engine/index.js "" any
row G31 "05-guides/how-to/add-a-new-law.md:202" frontend/src/engine/__tests__/laws.test.js "" any
row G32 "07-explanation/known-limitations.md:91" frontend/package.json "node --test src/engine/__tests__" any
row G33 "02-architecture/SDD.md:455" frontend/src/engine/__tests__/solver.test.js "" any
row G34 "03-database/ERD.md:165" frontend/src/config/gameRules.js "levelId: 0," line 83
row G35 "10-project/file-map.md:398" frontend/src/engine/scoring.js "export function estimateScore" any
row G36 "01-product/SRS.md:158" frontend/src/state/progressStore.js "export function setUser(nextUserId)" any
row G37 "01-product/SRS.md:158" frontend/src/state/progressStore.js "Math.max(local.bestStreak" line 103
row G38 "03-database/SCHEMA.md:101" frontend/src/state/progressStore.js "bestStreak: Math.max(p.bestStreak, p.streak + 1)," line 175
row G39 "06-reference/scoring-and-rewards.md:561" frontend/src/state/useGameState.js "STAGE_COMPLETION_XP" any
row G40 "06-reference/scoring-and-rewards.md:564" frontend/src/pages/ProblemPage.jsx "deductPoints" any
row G41 "06-reference/scoring-and-rewards.md:544" frontend/src/state/progressStore.js "Math.max(0, p.points - amount)" line 179
row G42 "04-api/API-REFERENCE.md:1192" frontend/src/state/progressStore.js "stageScores" any
row G43 "01-product/PRD.md:296" frontend/src/state/useGameState.js "" any
row G44 "09-diagrams/DIAGRAMS.md" backend/api/routes/levels.py "@router.get(\"/levels/{level_id}\", response_model=Envelope)" line 24
row G45 "04-api/API-REFERENCE.md:68" backend/api/routes/levels.py "Envelope" any
row G46 "07-explanation/design-decisions.md:682" .e2e/run-all-suites.sh "ALL DONE" any
row G47 "10-project/changelog.md:88" backend/config/constants.py "" any
row G48 "05-guides/how-to/run-locally-with-docker.md:33" render.yaml "env: python" line 4
row G49 "08-devops/installation-manual.md:203" database/init.sql "ROW LEVEL SECURITY" any
row G50 "08-devops/installation-manual.md:203" database/init.sql "Service role full access" any
row G51 "03-database/SCHEMA.md:46" database/init.sql "CREATE SCHEMA" absent
row G52 "06-reference/boolean-laws.md:732" content/laws.json "\"associative\"" any
row G53 "06-reference/boolean-laws.md:738" frontend/src/engine/laws/definitions.js "associative" absent
row G54 "04-api/API-REFERENCE.md:1453" content/levels.json "optimalHint" any
row G55 "05-guides/how-to/add-a-new-problem.md" content/levels.json "\"expr\"" any

echo "----"
echo "PASS=$pass FAIL=$fail"

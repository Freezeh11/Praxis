# Praxis — Glossary

**What this is:** the single authority for every domain and technical term used in the Praxis
documentation suite. One concept, one word, defined once.

**Who it's for:** a new teammate — including a student who has never read this repository — who
needs a word defined in plain language, then wants to see it used in *this* code and find the file
it lives in. If another document uses a term differently, that document is wrong and this one wins.

Every entry has the same four parts: the **term**, a **plain-language definition**, a **concrete
example from this repository**, and **where it lives** (with `file:line` evidence). The ten Boolean
laws themselves are catalogued in [boolean-laws.md](../06-reference/boolean-laws.md) — this page
defines the *vocabulary*, that page defines the *laws*.

---

## Contents

- [Canonical terminology — use this, not that](#canonical-terminology-use-this-not-that)
- [A. Boolean algebra vocabulary](#a-boolean-algebra-vocabulary)
  [literal](#literal) · [term](#term) · [clause](#clause) · [product](#product) · [sum](#sum) ·
  [SOP](#sop-sum-of-products) · [POS](#pos-product-of-sums) · [dual](#dual) ·
  [complement](#complement) · [AST / expression tree](#ast-and-expression-tree) ·
  [node path](#node-path)
- [B. Transformation vocabulary](#b-transformation-vocabulary)
  [normalize](#normalize) · [canonical form](#canonical-form) · [equivalence](#equivalence) ·
  [intermediate state](#intermediate-state) · [derivation step](#derivation-step) ·
  [step-locking](#step-locking) · [law id](#law-id) · [target law](#target-law) ·
  [distributive-expand](#distributive-expand) · [hint](#hint) · [guide](#guide)
- [C. Game and product vocabulary](#c-game-and-product-vocabulary)
  [level](#level) · [stage](#stage) · [tutorial](#tutorial) · [tutorial gate](#tutorial-gate) ·
  [orientation gate](#orientation-gate) · [sandbox](#sandbox) · [generator](#generator) ·
  [star rating](#star-rating) · [unlock threshold](#unlock-threshold) · [score weight](#score-weight) ·
  [earnedPoints](#earnedpoints) · [XP](#xp)
- [D. Architecture vocabulary](#d-architecture-vocabulary)
  [engine contract](#engine-contract) · [envelope](#envelope) · [RLS](#rls) ·
  [service_role](#service_role) · [anon key](#anon-key) · [bearer token / JWT](#bearer-token-jwt) ·
  [Better Auth](#better-auth)
- [E. Numbers, rounding and precision](#e-numbers-rounding-and-precision)
  [banker's rounding / half-to-even](#bankers-rounding-half-to-even)

---

## Canonical terminology: use this, not that

This table is the house style. Every document in `docs/` follows it. Where the left column is in
conflict with a UI string or a legacy document, the UI string is quoted as-is and the surrounding
prose uses the left column.

| Use | Do not use | Why |
|---|---|---|
| **literal** | variable, letter | The code's own word for a variable occurrence — `frontend/src/engine/node.js:4`. "Variable" is reserved for the abstract symbol; a literal is one *occurrence* of it. |
| **term** (in a sum) / **clause** (in a product) | factor group, chunk | A sum's children are `terms`, a product's children are `factors`/clauses — `frontend/src/engine/node.js:6-7`. |
| **product** / **sum** | AND-block, OR-block | Names the AST node type directly. |
| **SOP** / **POS** | sum-of-products form (when abbreviating) | Spelled out on first use in a document, then abbreviated. |
| **dual** | inverse form, mirror | The formal Boolean-algebra dual (AND↔OR, 0↔1). |
| **law id** (`absorption`, `demorgan-and`) | law name, spelled-out slug | The id is the join key between content, engine and storage — `content/laws.json` and `frontend/src/engine/laws/definitions.js`. |
| **step** / **derivation step** | move, action | `frontend/src/state/useGameState.js:425`. |
| **intermediate state** | mid-state | `frontend/src/state/useGameState.js:15-18`. |
| **AST** / **expression tree** | parse tree | `frontend/src/engine/node.js:1-13`. |
| **step-locking** | locking, freezing | `frontend/src/engine/sandbox/input.js:67`. |
| **engine contract** | API contract for algebra | `frontend/src/engine/index.js:8-13`. |
| **tutor** / **learner** | student, user (unless quoting UI text) | Product-facing term. |
| **40 / 30 / 30**, **90 / 75** stars, **80 %** unlock, **`earnedPoints`** | "scoring percentages", "star cutoffs" | Exact numbers, exact capitalisation. |

---

## A. Boolean algebra vocabulary

### literal

**Plain language.** One occurrence of one variable, possibly negated. `x` is a literal; so is `x'`.
It is the smallest thing a Boolean expression is built from.

**In Praxis.** The first puzzle's expression is `x + xy`, which contains three literals: `x` (first
term), `x` and `y` (second term, a product). The engine stores a literal as
`{ type:'lit', v:'x', n:false }`, where `n` is the *negated* flag.

**Lives in.** [`frontend/src/engine/node.js:4`](../../frontend/src/engine/node.js#L4) (the shape and
`lit()`), [`content/levels.json`](../../content/levels.json) (the `expr` strings).

---

### term

**Plain language.** In a **sum**, one of the things being OR-ed together. `x + xy` has two terms:
`x` and `xy`. A term is usually a product of literals.

**In Praxis.** The UI gives every SOP term a ⠿ grip handle: clicking the handle selects the whole
term (which is what Idempotent, Absorption and the sum laws operate on), while clicking a literal
inside it selects just that literal.

**Lives in.** [`frontend/src/engine/node.js:7`](../../frontend/src/engine/node.js#L7)
(`sum(...terms)`), [`frontend/src/components/ExpressionDisplay.jsx`](../../frontend/src/components/ExpressionDisplay.jsx)
(the grips).

---

### clause

**Plain language.** The **product-side counterpart of a term**: in a product of sums (POS), one of
the parenthesised sums being AND-ed together. `(x + y)(x + z)` has two clauses.

**In Praxis.** The law cards name it explicitly — the Idempotent Law description in
`content/laws.json` reads "Duplicate terms or **maxterm clauses** can be merged", covering
`x + x = x` (terms) and `x · x = x` (clauses) in one sentence. The engine's product-level law arm
handles the clause case.

**Lives in.** [`content/laws.json`](../../content/laws.json) (the `idempotent` card),
[`frontend/src/engine/laws/productLaws.js`](../../frontend/src/engine/laws/productLaws.js).

---

### product

**Plain language.** An AND of things. Written with `·` (or by juxtaposition).

**In Praxis.** The AST node `{ type:'prod', factors:[...] }`; `xy` in `x + xy` is a product of the
two literals `x` and `y`. Built with `prod(...)`.

**Lives in.** [`frontend/src/engine/node.js:6`](../../frontend/src/engine/node.js#L6).

---

### sum

**Plain language.** An OR of things. Written with `+`.

**In Praxis.** The AST node `{ type:'sum', terms:[...] }`; `x + xy` is a sum of two terms. Built
with `sum(...)`. The root of every SOP puzzle is a sum.

**Lives in.** [`frontend/src/engine/node.js:7`](../../frontend/src/engine/node.js#L7).

---

### SOP (sum-of-products)

**Plain language.** An expression shaped like "OR of ANDs": a sum whose terms are products, e.g.
`AB + AC`. This is the form most simplification puzzles start from.

**In Praxis.** Tutorial and Level 1–3 puzzles are authored in SOP, and the sum-level law arm
(`LAW_FORM.SUM`) is the one that handles them. The sandbox checks the root shape with `isSopRoot`.

**Lives in.** [`frontend/src/engine/laws/definitions.js:30-36`](../../frontend/src/engine/laws/definitions.js#L30-L36)
(`LAW_FORM.SUM` arms), [`frontend/src/engine/sandbox/expand.js:86`](../../frontend/src/engine/sandbox/expand.js#L86)
(`isSopRoot`).

---

### POS (product-of-sums)

**Plain language.** An expression shaped like "AND of ORs": a product whose factors are sums, e.g.
`(A+B)(A+C)`.

**In Praxis.** The product-level law arm (`LAW_FORM.PRODUCT`) is the POS variant of each law —
"A + AB = A" is the SOP statement of Absorption and "A(A+B) = A" is its POS dual. `isPosRoot`
recognises the shape, and the random generator deliberately produces both shapes.

**Lives in.** [`frontend/src/engine/laws/definitions.js:38-44`](../../frontend/src/engine/laws/definitions.js#L38-L44),
[`frontend/src/engine/laws/productLaws.js`](../../frontend/src/engine/laws/productLaws.js),
[`frontend/src/engine/sandbox/expand.js:87`](../../frontend/src/engine/sandbox/expand.js#L87) (`isPosRoot`).

---

### dual

**Plain language.** The Boolean dual of a statement is what you get by swapping AND↔OR and
swapping 0↔1. The dual of a true statement is also true — that is the Duality Principle.

**In Praxis.** Every law in the engine is authored twice, once per form, and the POS list is
literally labelled "the duals": `absorption` has the SOP formula `A + AB = A` and the POS dual
`A(A+B) = A`. One exception is documented in the code: **Identity Law is the one law whose display
name is identical in both forms** but whose formula differs (`A + 0 = A` vs `A · 1 = A`), which is
why the engine keys definitions by `form:name` rather than by name alone.

**Lives in.** [`frontend/src/engine/laws/definitions.js:38-48`](../../frontend/src/engine/laws/definitions.js#L38-L48)
and the comment at [`:46-48`](../../frontend/src/engine/laws/definitions.js#L46-L48).

---

### complement

**Plain language.** Two meanings, both used in this project:
1. **Negation** — the `'` operator: `x'` means "NOT x". The complement of a literal.
2. **The Complement Law** — `A + A' = 1` and `A · A' = 0`.

**In Praxis.** Meaning 1 is the `neg` node (`{ type:'not', child }`) or a literal with `n: true`,
rendered as an overline rather than an apostrophe. Meaning 2 is the law id `complement`, one of the
ten cards, and it is a **target law of real puzzles**. The full statement and truth table are in
[boolean-laws.md](../06-reference/boolean-laws.md).

**Lives in.** [`frontend/src/engine/node.js:4`](../../frontend/src/engine/node.js#L4),
[`content/laws.json`](../../content/laws.json) (the `complement` card), and
[boolean-laws.md](../06-reference/boolean-laws.md).

---

### AST and expression tree

**Plain language.** Abstract Syntax Tree — the tree-shaped data structure a parser produces from an
expression string. The root is the outermost operator; the leaves are literals and constants.

**In Praxis.** Parsing `x + xy` produces a `sum` node with two `term` children, the second of which
is a `prod` node with two `lit` children. Every node carries a stable monotonic `_id` so the UI can
track *the same node* across an edit and target it in an animation. This is the structure the law
engine walks; nothing in the app works on raw strings.

**Lives in.** [`frontend/src/engine/node.js:1-13`](../../frontend/src/engine/node.js#L1-L13),
[`frontend/src/engine/parser.js`](../../frontend/src/engine/parser.js).

---

### node path

**Plain language.** A string address that says which node in the tree you mean, so a law can report
*where* it applies instead of returning a whole new tree.

**In Praxis.** Paths are rooted at `'R'` and each segment indexes the next level down:
`'R'` is the root, `'R.1'` is the root's second term, `'R.1.0'` is that term's first child, and a
`not` node's single child is addressed as `.0`. So in `x + xy`, the `y` literal is at `R.1.1`. Hint
results are reported as `{ law, paths }`, e.g. `{ law: 'absorption', paths: ['R.1'] }`.

**Lives in.** [`frontend/src/engine/tree.js:4-8`](../../frontend/src/engine/tree.js#L4-L8) (the
convention) and [`frontend/src/engine/tree.js:14`](../../frontend/src/engine/tree.js#L14) (`getNode`).

---

## B. Transformation vocabulary

### normalize

**Plain language.** Rewrite an expression into the house shape without changing what it means —
flatten nested sums/products, order children consistently — so two expressions that "look different"
can be compared. Normalization never applies a Boolean law; it only rearranges.

**In Praxis.** The engine has **two** canonicalisations. `normalize` is the structural house shape.
`normalizeFlat` is the comparison form. A `normalize`d tree is what the law engine expects as input.

**Lives in.** [`frontend/src/engine/normalize.js:1-2`](../../frontend/src/engine/normalize.js#L1-L2),
exported through [`frontend/src/engine/index.js:34`](../../frontend/src/engine/index.js#L34).

---

### canonical form

**Plain language.** A single, order-independent text form of an expression, so `x + xy` and
`xy + x` produce the *same* string and a fast string comparison can stand in for a structural one.

**In Praxis.** `canonText()` sorts the children of sums and products before joining them, so
reordered-but-equivalent states compare equal. This is what lets the solver de-duplicate visited
states without a full equivalence check on every comparison.

**Lives in.** [`frontend/src/engine/render.js:6`](../../frontend/src/engine/render.js#L6) (the
doc comment) and [`frontend/src/engine/render.js:28`](../../frontend/src/engine/render.js#L28)
(`canonText`).

---

### equivalence

**Plain language.** Two expressions are equivalent when they produce the same output for **every**
possible assignment of their variables. This is the real test of whether a simplification step was
legal.

**In Praxis.** `isEquivalent` evaluates both trees over every assignment of the extracted variables
— a truth-table check, not a string comparison. The law-soundness property test uses exactly this
function to assert that every law, applied to randomly generated expressions, preserves semantics.

**Lives in.** [`frontend/src/engine/equivalence.js:45`](../../frontend/src/engine/equivalence.js#L45)
(`isEquivalent`), exercised by
[`frontend/src/engine/__tests__/law-soundness.property.test.js`](../../frontend/src/engine/__tests__/law-soundness.property.test.js).

---

### intermediate state

**Plain language.** Every expression the learner has stepped through on the way to the answer — the
whole derivation, not just the current line.

**In Praxis.** The puzzle state machine keeps an append-only `history` array of `{ expr, step }`
entries; the current expression is the last entry and the *intermediate states* are the earlier
ones. That array is what the step-history panel renders and what a saved solution is replayed
from, so a learner can click any past line to review why it was legal.

**Lives in.** [`frontend/src/state/useGameState.js:15-18`](../../frontend/src/state/useGameState.js#L15-L18),
rendered by [`frontend/src/components/puzzle/StepHistoryPanel.jsx`](../../frontend/src/components/puzzle/StepHistoryPanel.jsx).

---

### derivation step

**Plain language.** One committed transformation: "from this expression, by this law, to that
expression". A derivation is a list of these.

**In Praxis.** A step is the record `{ law: <law display name>, from: <before>, to: <after> }`,
created at the moment the animation finishes and the new expression becomes current. Note the field
holds the law **display name** (e.g. `'Absorption Law'`), not the law id — `lawIdOf()` maps it back
to the id for scoring.

**Lives in.** [`frontend/src/state/useGameState.js:425`](../../frontend/src/state/useGameState.js#L425)
(creation), [`frontend/src/engine/scoring.js:25`](../../frontend/src/engine/scoring.js#L25)
(`lawIdOf`).

---

### step-locking

**Plain language.** Once a step is committed, it is *history*: the learner cannot go back and edit
it. They may only add another step, undo, or reset the puzzle. It is what forces genuine reasoning
instead of guessing a final answer.

**In Praxis.** History is append-only — a new step is appended, `undoAction` removes the last one,
and there is no edit path for a committed entry. The sandbox relies on the same guarantee: it
verifies that every step of a proposed solution is a move the workspace itself would have offered
from the matching state, precisely so a sandbox puzzle replays through the UI's locked step set
("this is what step-locking relies on"). The one deliberate exception is drag-reordering terms
within a sum, which is not a law application.

**Lives in.** [`frontend/src/state/useGameState.js:15-18`](../../frontend/src/state/useGameState.js#L15-L18)
(the append-only history), [`frontend/src/state/useGameState.js:461`](../../frontend/src/state/useGameState.js#L461)
(`undoAction`), [`frontend/src/engine/sandbox/input.js:67`](../../frontend/src/engine/sandbox/input.js#L67)
and [`:165`](../../frontend/src/engine/sandbox/input.js#L165) (the reliance).

---

### law id

**Plain language.** The short machine name for a Boolean law — lowercase, hyphenated, never the
human-readable name.

**In Praxis.** The ten ids, in authoring order, are `complement`, `idempotent`, `absorption`,
`identity`, `annulment`, `distributive`, `double-neg`, `demorgan-and`, `demorgan-or`,
`associative`. A puzzle's `targetLaws` array contains these ids, the score request carries them in
`lawsUsed`, and `LAW_NAME_TO_ID` maps the engine's display names back onto them. **Ids are the join
key**: `content/laws.json`'s `id` and the engine's `id` must match, and there is an eleventh,
engine-internal id, [`distributive-expand`](#distributive-expand), that is deliberately *not* a card.

**Lives in.** [`content/laws.json`](../../content/laws.json) (the cards),
[`frontend/src/engine/laws/definitions.js:31-54`](../../frontend/src/engine/laws/definitions.js#L31-L54)
(the ids), and [boolean-laws.md](../06-reference/boolean-laws.md) for what each one means.

---

### target law

**Plain language.** A law the puzzle *wants* the learner to use. Using all of them earns the full
30-point target-law band; using half of them earns half.

**In Praxis.** Each puzzle in `content/levels.json` declares `targetLaws`, e.g. the first Tutorial
puzzle declares `["absorption"]`. The backend scores
`30 × |targetLaws ∩ lawsUsed| / |targetLaws|`, and — an easily-missed detail — **if a puzzle
declares no target laws, the band is full 30**.

**Lives in.** [`content/levels.json`](../../content/levels.json),
[`backend/services/scoring_service.py:99-107`](../../backend/services/scoring_service.py#L99-L107).

---

### distributive-expand

**Plain language.** An **engine-only** law id for the *reverse* direction of Distributive — expanding
`A(B + C)` into `AB + AC` instead of factoring `AB + AC` into `A(B + C)`. It is **not** one of the ten
reference cards a learner sees, and it is **disabled by default**.

**In Praxis.** Graded levels never offer it: `findOptimalPath`/`findSimplestForm` take
`allowExpand` (default `false`), and the sandbox turns it on because a learner-typed POS expression
often *needs* expanding to be simplifiable. Two test assertions pin both halves of that behaviour,
and it has no animation branch, so applying it shows no overlay rather than a wrong one. This is
the entry to read if you grep `content/laws.json` for `distributive-expand` and find nothing.

**Lives in.** [`frontend/src/engine/laws/definitions.js:44`](../../frontend/src/engine/laws/definitions.js#L44),
gated at [`frontend/src/engine/solver.js:172`](../../frontend/src/engine/solver.js#L172) and
[`:255`](../../frontend/src/engine/solver.js#L255), enabled in the sandbox at
[`frontend/src/engine/sandbox/input.js:196`](../../frontend/src/engine/sandbox/input.js#L196),
pinned by [`frontend/src/engine/__tests__/laws.test.js:106-109`](../../frontend/src/engine/__tests__/laws.test.js#L106-L109).
See also [boolean-laws.md](../06-reference/boolean-laws.md).

---

### hint

**Plain language.** A free nudge that tells the learner *where* to look — which element to select
and which law applies — without doing the step for them.

**In Praxis.** Pressing Hint runs the pure structural scanner over the whole expression and returns
the **left-most** applicable law with the node paths it applies to, then renders it as a sentence.
The counter `hintsUsed` goes up by one and costs 10 points of the hint-independence band. Puzzles
also carry two or three **authored** `hints` strings used before the engine has anything to say.

**Lives in.** [`frontend/src/engine/laws/scanHints.js:22`](../../frontend/src/engine/laws/scanHints.js#L22)
(the scanner), [`frontend/src/state/useGameState.js:501`](../../frontend/src/state/useGameState.js#L501)
(`requestHint`), [`frontend/src/state/hintText.js`](../../frontend/src/state/hintText.js) (the
wording), `hints[]` in [`content/levels.json`](../../content/levels.json).

---

### guide

**Plain language.** A stronger, **paid** aid: it highlights exactly which terms to click next
without spending a hint.

**In Praxis.** Activating the Guide pre-selects the terms the engine recommends (or tells the
learner which terms to click), plays a sound, and increments `guidesUsed`. It costs
**20 points** from the learner's wallet in a graded level — and the sandbox sets that cost to 0.
Do not confuse the two numbers: `GUIDE_COST_POINTS = 20` is a *point spend*; the separate
`ASSISTANCE_PENALTY = 10` is a *score deduction* that a guide also triggers.

**Lives in.** [`frontend/src/state/useGameState.js:560`](../../frontend/src/state/useGameState.js#L560)
(`activateGuide`), [`frontend/src/config/gameRules.js:35`](../../frontend/src/config/gameRules.js#L35)
(`GUIDE_COST_POINTS`), [`backend/config/constants.py:16`](../../backend/config/constants.py#L16)
(`ASSISTANCE_PENALTY`).

---

## C. Game and product vocabulary

### level

**Plain language.** A themed group of puzzles.

**In Praxis.** There are **four** levels, and their ids are **0-based**:

| `id` | `name` | `varCount` | Puzzles |
|---|---|---|---|
| `0` | Tutorial | 2 | 4 |
| `1` | Level 1 | 2 | 12 |
| `2` | Level 2 | 3 | 12 |
| `3` | Level 3 — Boss | 4 | 12 |

So `id: 0` is the Tutorial, not Level 1. The UI shows all four as cards, and `TUTORIAL.levelId = 0`
pins the same convention in code. Any storage row for the Tutorial has `level_id = 0`.

**Lives in.** [`content/levels.json`](../../content/levels.json),
[`frontend/src/config/gameRules.js:83`](../../frontend/src/config/gameRules.js#L83).

---

### stage

**Plain language.** One puzzle inside a level. "Level 2, stage 5" means the sixth puzzle of Level 2.

**In Praxis.** A stage is identified by the pair `(level_id, stage_idx)` where `stage_idx` is
**0-based** into the level's `puzzles` array, and that pair is the unique key of the
`stage_progress` table. Stage ids are used as route params (`/level/:levelId/stage/:stageIdx`) and
as the `stageScores` key `"<levelId>:<stageIdx>"` in the progress snapshot — e.g. `"1:0"`.

**Lives in.** [`database/init.sql:24`](../../database/init.sql#L24) (`UNIQUE(user_id, level_id, stage_idx)`),
[`frontend/src/App.jsx:42`](../../frontend/src/App.jsx#L42) (the route),
[`backend/api/schemas/progress.py:18`](../../backend/api/schemas/progress.py#L18) (the `"1:0"` key).

---

### tutorial

**Plain language.** The mandatory interactive walkthrough a new learner completes before the graded
levels or the sandbox open.

**In Praxis.** The tutorial is not a separate screen — it is **level 0**, played in the real
workspace with `?tutorial=true`, four stages deep, with a coach card, a spotlight and a welcome
modal. Its content (the welcome slides and the per-stage guided steps) is authored separately from
the graded puzzles, in its own file.

**Lives in.** [`frontend/src/content/tutorialContent.js`](../../frontend/src/content/tutorialContent.js),
[`frontend/src/components/InteractiveTutorial.jsx`](../../frontend/src/components/InteractiveTutorial.jsx),
[`frontend/src/config/gameRules.js:82-85`](../../frontend/src/config/gameRules.js#L82-L85).

---

### tutorial gate

**Plain language.** The rule that keeps a brand-new learner inside the tutorial until they finish
it, by redirecting them there from any gated route.

**In Praxis.** It wraps `/levels`, `/level/:levelId/stages`, `/level/:levelId/stage/:stageIdx`,
`/sandbox` and `/sandbox/play`, sending an ungated learner to
`/level/0/stage/0?tutorial=true`. Two behaviours are load-bearing: the tutorial route itself is
**exempt** (otherwise the redirect target would gate itself into a blank page), and the decision
waits for `progressHydrated` (otherwise a returning learner on a fresh device would be bounced to
the tutorial as if their progress were lost). Its own comment is explicit that this is **a UX gate,
not a security boundary** — it reads client-side progress.

**Lives in.** [`frontend/src/components/TutorialGate.jsx:1-32`](../../frontend/src/components/TutorialGate.jsx#L1-L32),
wired at [`frontend/src/App.jsx:40-53`](../../frontend/src/App.jsx#L40-L53).

---

### orientation gate

**Plain language.** The device-posture policy: a phone held in portrait is unusable until it is
rotated, a small tablet in portrait gets a dismissible nudge, and everything else is unaffected.

**In Praxis.** Three outcomes, all decided without User-Agent sniffing — touch capability comes
from `(pointer: coarse)`/`maxTouchPoints`, and the device class from the width of a touch device:
phone + portrait → the blocking, non-dismissible `RotateOverlay`; small tablet + portrait → the
advisory `RotateBanner`, with the app still fully usable; anything else → nothing rendered. It is
mounted globally, so it also covers the public routes.

**Lives in.** [`frontend/src/components/OrientationGate.jsx:1-10`](../../frontend/src/components/OrientationGate.jsx#L1-L10),
[`frontend/src/hooks/useDeviceTier.js`](../../frontend/src/hooks/useDeviceTier.js).

---

### sandbox

**Plain language.** Free-play mode: the learner types their own Boolean expression and simplifies
it in the same workspace as a graded level, with nothing scored or persisted.

**In Praxis.** Two screens. `/sandbox` takes the typed expression, gives a **live, debounced syntax
verdict**, and only then checks whether the expression is actually *solvable* by the engine before
handing it to `/sandbox/play`, which is the ordinary `ProblemPage` with no route params — the
absence of params is what puts it in sandbox mode. There is **no sandbox API endpoint**: validation,
generation and scoring all happen in the browser. The sandbox also enables the otherwise-gated
[`distributive-expand`](#distributive-expand) law and makes the [guide](#guide) free.

**Lives in.** [`frontend/src/pages/SandboxPage.jsx`](../../frontend/src/pages/SandboxPage.jsx),
[`frontend/src/components/puzzle/sandboxPuzzle.js`](../../frontend/src/components/puzzle/sandboxPuzzle.js),
[`frontend/src/engine/sandbox/`](../../frontend/src/engine/sandbox/).

---

### generator

**Plain language.** The randomiser that invents fresh practice puzzles on demand.

**In Praxis.** `generateRandomPuzzle` builds a candidate, then **verifies it with the solver before
returning it** — the goal must be a real terminal form and the declared optimal step count must
match a breadth-first search. It draws from a curated pool and from generated expressions, across
four difficulty presets, and respects the 2–3 variable scope for generated problems. Its search
budgets are measured, not guessed, and are documented with the worst case they were measured on.

**Lives in.** [`frontend/src/engine/sandbox/generator.js:1-11`](../../frontend/src/engine/sandbox/generator.js#L1-L11),
budgets at [`frontend/src/config/gameRules.js:173-181`](../../frontend/src/config/gameRules.js#L173-L181),
stress-tested by [`.e2e/generator-stress.mjs`](../../.e2e/generator-stress.mjs).

---

### star rating

**Plain language.** A 0–3 star grade for how well one stage was solved, shown on the stage grid.

**In Praxis.** Stars come from the stage's best score: **≥ 90 → 3 stars, ≥ 75 → 2 stars, ≥ 1 → 1
star**. A completed stage with no recorded score counts as one star. The maximum is 3 per stage, so
a level's maximum is `totalStages × 3`.

**Lives in.** [`frontend/src/config/gameRules.js:38-46`](../../frontend/src/config/gameRules.js#L38-L46),
[`frontend/src/state/progressStore.js:281-284`](../../frontend/src/state/progressStore.js#L281-L284)
(`starsForScore`), displayed by
[`frontend/src/components/ui/StarRating.jsx`](../../frontend/src/components/ui/StarRating.jsx).

---

### unlock threshold

**Plain language.** What you must do before the next level opens.

**In Praxis.** **Two** conditions, not one: the next level unlocks when **every stage of the current
level is done AND the average score is ≥ 80**. The score bar in the UI draws a notch at exactly 80 %
to show the gate. A stage grid marks the level as "mastered" on the same two conditions.

**Lives in.** [`frontend/src/config/gameRules.js:48-49`](../../frontend/src/config/gameRules.js#L48-L49)
(`UNLOCK_AVERAGE_SCORE`), [`frontend/src/state/progressStore.js:309`](../../frontend/src/state/progressStore.js#L309)
(`unlocked: allDone && avgScore >= UNLOCK_AVERAGE_SCORE`),
[`backend/config/constants.py:26`](../../backend/config/constants.py#L26) (`UNLOCK_AVERAGE`).

---

### score weight

**Plain language.** How many of the 100 possible points each of the three scored bands is worth.

**In Praxis.** **40** for efficiency (steps used vs optimal), **30** for target laws applied, and
**30** for hint independence (solving unaided). The three must sum to `MAX_SCORE = 100`. The
backend derives `MAX_SCORE` by adding the three constants rather than hardcoding 100, and the
frontend keeps a mirror in one object.

**Lives in.** [`backend/config/constants.py:9-12`](../../backend/config/constants.py#L9-L12),
[`frontend/src/config/gameRules.js:14-18`](../../frontend/src/config/gameRules.js#L14-L18)
(`SCORE_WEIGHTS`).

---

### earnedPoints

**Plain language.** The bonus points a good score pays, on **top of** the flat XP for finishing the
stage.

**In Praxis.** `earnedPoints = round((total / 100) × 5)` — so a perfect 100.0 pays **5** bonus
points, and anything under 10.0 pays 0. It is deliberately a *separate* field from the stage's base
10 XP, and it is persisted in the `score_history` row. Because the backend uses Python's `round()`,
the exact value can differ by 1 from the client's estimate — see
[banker's rounding](#bankers-rounding-half-to-even).

**Lives in.** [`backend/services/scoring_service.py:55`](../../backend/services/scoring_service.py#L55),
`earnedPoints` in [`backend/api/schemas/score.py:28`](../../backend/api/schemas/score.py#L28),
mirrored at [`frontend/src/engine/scoring.js:80`](../../frontend/src/engine/scoring.js#L80).

---

### XP

**Plain language.** Experience points — the currency the points chip shows.

**In Praxis.** Completing a stage pays a flat **10 XP** (`STAGE_COMPLETION_XP`), plus whatever
[`earnedPoints`](#earnedpoints) the score adds. The Guide is the sink: it costs 20 points. The
wallet itself lives in the client-side progress store and is synced to Supabase as
`user_progress.points`.

**Lives in.** [`frontend/src/config/gameRules.js:32`](../../frontend/src/config/gameRules.js#L32)
(`STAGE_COMPLETION_XP = 10`), [`frontend/src/state/progressStore.js`](../../frontend/src/state/progressStore.js)
(`addPoints` / `deductPoints`), [`database/init.sql:9`](../../database/init.sql#L9) (`points INTEGER`).

---

## D. Architecture vocabulary

### engine contract

**Plain language.** The architectural rule that **one** module owns the Boolean algebra, that it
stays pure, and that nobody else re-implements it.

**In Praxis.** `frontend/src/engine/` is framework-free, network-free and React-free, and is the
only Boolean-algebra implementation in the repository — the backend does not re-implement it, it
serves content and scores submitted numbers. Two consequences you can check: the backend has no
algebra code at all, and every app module that needs algebra imports the barrel `engine/index.js`
rather than a deep file. The engine's own doc comment states the layering rule and its single
permitted external import.

**Lives in.** [`frontend/src/engine/index.js:1-14`](../../frontend/src/engine/index.js#L1-L14)
(the stated contract), [`frontend/src/engine/scoring.js:2-12`](../../frontend/src/engine/scoring.js#L2-L12)
(the client/backend split), and [RULES.md](../rules/RULES.md) for the enforceable version.

---

### envelope

**Plain language.** The single wrapper shape every API response uses, so a client never has to guess
whether a call succeeded.

**In Praxis.** `{ success, data, error }`. On success, `data` holds the payload and `error` is
`null`; on failure, `data` is `null` and `error` is `{ code, message, detail }`. Every `/api/*` route
declares it as its `response_model`, and the client unwraps it in exactly one place. **One endpoint
is deliberately outside the envelope**: `GET /` returns a plain
`{"message": "Praxis API is running", "docs": "/docs"}` because Render's health check reads that
body verbatim.

**Lives in.** [`backend/core/responses.py:24-43`](../../backend/core/responses.py#L24-L43)
(`Envelope`, `success`, `failure`), unwrapped at
[`frontend/src/services/apiClient.js:33`](../../frontend/src/services/apiClient.js#L33), exception at
[`backend/api/routes/health.py:15-18`](../../backend/api/routes/health.py#L15-L18).

---

### RLS

**Plain language.** Row Level Security — a PostgreSQL feature where each table decides, per row,
which requests may see or change it.

**In Praxis.** RLS is **enabled on all three tables**, but the policies are the honest finding here:
each table has exactly one policy, literally named `"Service role full access"`, declared
`FOR ALL USING (true)` — i.e. **fully permissive for every role, including `anon`**. The policy is
*not* scoped to `service_role`, and there is **no `auth.uid() = user_id` predicate anywhere**. So
these are not per-user policies and must not be described as such. In practice the backend is what
enforces per-user isolation, by always filtering with `.eq("user_id", …)` and by checking the bearer
token before any query.

**Lives in.** [`database/init.sql:49-58`](../../database/init.sql#L49-L58) (enable + policies),
[`database/init.sql:54-55`](../../database/init.sql#L54-L55) (the comment that claims otherwise),
[`backend/repositories/progress_repository.py:32`](../../backend/repositories/progress_repository.py#L32)
(the per-user filter that actually protects the data).

---

### service_role

**Plain language.** Supabase's **server-side** key. It bypasses Row Level Security entirely and must
never reach a browser.

**In Praxis.** It is the key the backend uses: `SupabaseRESTClient` sends `apikey` and
`Authorization: Bearer <key>` with every PostgREST call, and `Settings.from_env()` **requires**
`SUPABASE_SERVICE_KEY` at import time — the app cannot even boot to serve `/api/levels` without it.
On Render it is declared `sync: false`, so its value is set in the dashboard and never enters git.
Documentation must show it only as a placeholder such as `<service-role-key>`.

**Lives in.** [`backend/config/settings.py:61`](../../backend/config/settings.py#L61) (required at
boot), [`backend/supabase_client.py:26-31`](../../backend/supabase_client.py#L26-L31) (the headers),
[`render.yaml:13-15`](../../render.yaml#L13-L15) (`sync: false`).

---

### anon key

**Plain language.** Supabase's **public** key, designed to be shipped in a browser bundle. It
identifies the project; it does not grant access on its own — RLS and Supabase Auth decide what the
holder may do.

**In Praxis.** The frontend authenticates with the publishable/anon key, read from a Vite env var
(`VITE_SUPABASE_PUBLISHABLE_KEY`) and passed to `createClient`. Because it is a *client* key it is
by design present in the built bundle, which is exactly why it must never be confused with the
[`service_role`](#service_role) key. A publishable key is not a secret, but **this suite never
reproduces the real value** — it is always shown as a placeholder.

**Lives in.** [`frontend/src/services/supabaseClient.js:6-10`](../../frontend/src/services/supabaseClient.js#L6-L10),
[`README.md:45-48`](../../README.md) (where the dashboard shows it as "anon / public").

---

### bearer token (JWT)

**Plain language.** The credential a signed-in learner sends with each API call, in the HTTP header
`Authorization: Bearer <token>`. The token is a JWT issued by Supabase Auth at sign-in.

**In Praxis.** The browser keeps the Supabase session and attaches the access token in exactly one
place, so no component ever handles a token. The backend reads the header, splits off the token, and
asks Supabase's `/auth/v1/user` who it belongs to. Two dependencies use that result: `get_current_user`
throws `UnauthorizedError` (401) when it is missing or invalid, and `optional_user` returns `None`
instead — which is what lets `POST /api/score` be scored while signed out. Either way **whole
`user_data` object is returned**, and routes take `user["id"]` from it.

**Lives in.** [`frontend/src/services/apiClient.js:26-31`](../../frontend/src/services/apiClient.js#L26-L31)
(attaching), [`backend/core/security.py:17-35`](../../backend/core/security.py#L17-L35) (verifying),
[`backend/supabase_client.py:87-98`](../../backend/supabase_client.py#L87-L98) (`get_user`).

---

### Better Auth

**Plain language.** A **third-party** authentication library — a completely different product from
Supabase Auth. **Praxis does not use it, and never has in the current codebase.** The name survives
only in comments and config left behind by an earlier plan.

**In Praxis.** If you grep for "Better Auth" you will find three dead remnants, and none of them is
live code: (1) `database/init.sql`'s header claims Better Auth tables are created by
`npx auth migrate` — **there is no such tooling in this repository**; (2) `frontend/vite.config.js`
still proxies `/api/auth` to a "Better Auth server" on port **3001** — there is no such service;
(3) two page comments and `VITE_AUTH_URL` in `frontend/.env.local` are equally vestigial. The real
auth stack is **Supabase Auth** via `@supabase/supabase-js`. A newcomer who greps the repo and finds
these will be misled unless they read this entry.

**Lives in.** [`database/init.sql:4`](../../database/init.sql#L4) (the false claim),
[`frontend/vite.config.js:24-28`](../../frontend/vite.config.js#L24-L28) (the dead proxy),
[`frontend/src/services/supabaseClient.js`](../../frontend/src/services/supabaseClient.js) (what is
actually used). See also the discrepancy register in
[known-limitations.md](../07-explanation/known-limitations.md).

---

## E. Numbers, rounding and precision

### banker's rounding (half-to-even)

**Plain language.** Two different rounding conventions that disagree on exact halves. Python's
built-in `round()` uses **banker's rounding**: a value exactly halfway between two representable
numbers goes to the **even** one (`round(0.5) → 0`, `round(1.5) → 2`, `round(2.5) → 2`). JavaScript's
`Math.round` is **half-up**: an exact half always goes **up** (`Math.round(0.5) → 1`,
`Math.round(2.5) → 3`).

**In Praxis.** The backend computes `earnedPoints = round((total / 100) * MAX_BONUS_POINTS)` with
Python's `round()`, while the frontend's offline estimate uses `Math.round(...)`. The two therefore
agree on almost every score but can disagree by **1 point** when the product lands exactly on
`.5` — and since the bonus range is only 0–5 points for non-negative inputs, that is a visible
difference in the points chip. This does not corrupt anything: the **backend is authoritative** and
its value is what gets persisted; the client figure is only an instant local estimate to render
before the server replies.

One check you can run: the assistant command `python3 -c "print(round(2.5))"` prints `2`, while
`node -e "console.log(Math.round(2.5))"` prints `3`.

**Lives in.** [`backend/services/scoring_service.py:55`](../../backend/services/scoring_service.py#L55)
(the authoritative `round`), [`frontend/src/engine/scoring.js:80`](../../frontend/src/engine/scoring.js#L80)
(`Math.round`, the local estimate), and the "backend is authoritative" note at
[`frontend/src/engine/scoring.js:4-7`](../../frontend/src/engine/scoring.js#L4-L7).

---

## See also

- [boolean-laws.md](../06-reference/boolean-laws.md) — the ten laws, their formulas, truth tables
  and the engine's implementation notes, including the internal `distributive-expand`.
- [file-map.md](file-map.md) — the file behind every "lives in" reference above.
- [RULES.md](../rules/RULES.md) — the rules these terms are used by, each with `file:line` evidence.
- [changelog.md](changelog.md) — what this suite documents and how it is kept current.

# Boolean laws — the complete reference

**What this is.** Every Boolean law Praxis can teach, with both of its forms (SOP and its POS
dual), the exact conditions under which the engine offers it, a worked example traced on real
authored puzzle content, and the mistakes learners actually make.

**Who it's for.** A new teammate, a tutor writing new content, or a learner who wants the full
picture. You do **not** need to read the engine source first — but every engine claim here carries
a `path/to/file.js:line` citation so you can check it.

> **Prime rule of this project:** the code is the truth. Where this document and the engine
> disagree, the engine wins — and the disagreement should be reported, not silently patched.

## Contents

1. [The vocabulary you need](#1-the-vocabulary-you-need)
2. [How the engine models a law](#2-how-the-engine-models-a-law)
3. [The card/engine mismatch — read this before adding a law](#3-the-cardengine-mismatch--read-this-before-adding-a-law)
4. [The four entry points that offer laws](#4-the-four-entry-points-that-offer-laws)
5. [The ten reference cards, law by law](#5-the-ten-reference-cards-law-by-law)
   - [5.1 `complement`](#51-complement--complement-law)
   - [5.2 `idempotent`](#52-idempotent--idempotent-law)
   - [5.3 `absorption`](#53-absorption--absorption-law)
   - [5.4 `identity`](#54-identity--identity-law)
   - [5.5 `annulment`](#55-annulment--annulment-law)
   - [5.6 `distributive`](#56-distributive--distributive-factor--distributive-pos)
   - [5.7 `double-neg`](#57-double-neg--double-negation)
   - [5.8 `demorgan-and`](#58-demorgan-and--de-morgans-andor)
   - [5.9 `demorgan-or`](#59-demorgan-or--de-morgans-orand)
   - [5.10 `associative`](#510-associative--associative-law-the-card-the-engine-does-not-implement)
6. [`distributive-expand` — the internal law that is not a card](#6-distributive-expand--the-internal-law-that-is-not-a-card)
7. [Law usage across the 40 authored puzzles](#7-law-usage-across-the-40-authored-puzzles)
8. [Where each law lives in the source](#8-where-each-law-lives-in-the-source)
9. [Known discrepancies](#9-known-discrepancies)

---

## 1. The vocabulary you need

| Term | Meaning | Example |
|---|---|---|
| **literal** | A single variable, complemented or not | `x`, `x'` |
| **product** | An AND of factors | `xy`, `x'y'z`, `x(x + y)` |
| **sum** | An OR of terms | `x + y`, `x'y + z` |
| **term** (in a sum) | One operand of an OR | `x'y` in `x'y + z` |
| **clause** (in a product) | One operand of an AND | `(x + y)` in `(x + y)(x + z)` |
| **SOP** | Sum-of-products shape; a `sum` node at the root | `x'y + xy` |
| **POS** | Product-of-sums shape; a `prod` node at the root | `(x + y)(x' + z)` |
| **dual** | The other form of the same law, with AND ↔ OR and 0 ↔ 1 swapped | `A + AB = A` ↔ `A(A + B) = A` |
| **literal-level selection** | The learner clicked literal nodes | `mode: 'literal'` |
| **term-level selection** | The learner clicked whole terms/clauses (the `⠿` handle) | `mode: 'term'` |

The AST node kinds these map to are defined in `frontend/src/engine/node.js:1-13`:
`lit`, `const`, `prod`, `sum`, `not`.

**Mode and form are different things.** `mode` (`LITERAL` or `TERM`) decides *which click gesture
opens the law panel*. `form` (`SUM`, `PRODUCT` or `NODE`) decides *which formula text is quoted and
which builder module owns the law*:

```js
// frontend/src/engine/laws/definitions.js:18-27
export const LAW_MODE = { LITERAL: 'literal', TERM: 'term' }
export const LAW_FORM = { SUM: 'sum', PRODUCT: 'product', NODE: 'node' }
```

## 2. How the engine models a law

A law has **one identity** (`frontend/src/engine/laws/definitions.js:1-16`) and is emitted as a
**plain object with an `apply()` closure** (`frontend/src/engine/laws/index.js:13-15`):

```js
{ id, name, formula, desc, apply(): AST, ...animation metadata }
```

| Field | Meaning | Joins to |
|---|---|---|
| `id` | reference-card law id | `content/laws.json` `id`, scoring `targetLaws` |
| `name` | display name the panel and step history show | `LAW_NAME_TO_ID` |
| `formula` | the formula text quoted on the law card | `content/laws.json` `formulas[]` (as text, not a key) |
| `desc` | the sentence under the formula, built per applied node | — |
| `apply()` | pure rewrite: `() => AST`, never mutates the input tree | — |
| `animPaths`, `survivorPath`, `factoredVar`, … | animation metadata the overlay reads | `components/animations/*` |

`apply()` purity is enforced by a test: `frontend/src/engine/__tests__/laws.test.js:132-138`
("applying a law never mutates the tree it was asked about").

Identity is looked up by **name + form**, because `Identity Law` legitimately has two different
formulas (`frontend/src/engine/laws/definitions.js:56-60`):

```js
// Keyed by name+form: `Identity Law` legitimately has a sum and a product
// statement, and the engine must return the one matching the node it found.
const BY_NAME_AND_FORM = new Map(
  LAW_DEFINITIONS.map((definition) => [`${definition.form}:${definition.name}`, definition])
)
```

A typo fails **loudly** rather than silently producing a law with no id
(`frontend/src/engine/laws/definitions.js:79-84`):

```js
export function defineLaw(name, form) {
  const definition = BY_NAME_AND_FORM.get(`${form}:${name}`)
  if (!definition) {
    throw new Error(`Unknown law: "${name}" (${form}) — add it to LAW_DEFINITIONS.`)
  }
  return { id: definition.id, name: definition.name, formula: definition.formula }
}
```

Verified — asking for a law that is not in the table throws (this is the real transcript; the
absolute module paths are elided, and Node prints the module URL plus the throwing source line with
the caret **before** the message):

```text
$ node --input-type=module -e "import('./src/engine/laws/definitions.js').then(m => m.defineLaw('Associative Law','node'))"
file://…/frontend/src/engine/laws/definitions.js:82
    throw new Error(`Unknown law: "${name}" (${form}) — add it to LAW_DEFINITIONS.`)
          ^

Error: Unknown law: "Associative Law" (node) — add it to LAW_DEFINITIONS.
    at Module.defineLaw (…/frontend/src/engine/laws/definitions.js:82:11)
    at …/frontend/[eval1]:1:56

Node.js v22.23.1
```

## 3. The card/engine mismatch — read this before adding a law

Two id sets exist and they are **not** the same set. This is the single most confusing thing about
the law model, and it is deliberate.

| | `content/laws.json` (reference cards) | `frontend/src/engine/laws/definitions.js` (engine) |
|---|---|---|
| count | **10** ids | **16 rows → 10 distinct ids** (16 distinct `name`+`form` keys; 15 distinct display names, because `Identity Law` is declared once for `sum` and once for `product`) |
| `id` order (authoring) | `complement, idempotent, absorption, identity, annulment, distributive, double-neg, demorgan-and, demorgan-or, associative` | `distributive, complement, identity, annulment, idempotent, absorption, distributive-expand, double-neg, demorgan-and, demorgan-or` |
| engine-only id | — | **`distributive-expand`** (in `LAW_DEFINITIONS`); the hint scanner additionally emits an un-suffixed `demorgan` token (`laws/scanHints.js:38`) that matches neither card id — it is resolved to display text by `state/hintText.js`, not by `LAW_NAME_TO_ID` |
| card-only id | **`associative`** | — |
| union | **11 ids** | |

Reproduce the table yourself:

```bash
cd frontend && node --input-type=module -e "
import fs from 'node:fs'
import { LAW_DEFINITIONS } from './src/engine/laws/definitions.js'
const cards = JSON.parse(fs.readFileSync('../content/laws.json','utf8')).map(c => c.id)
const engine = [...new Set(LAW_DEFINITIONS.map(d => d.id))]
console.log('cards  :', cards.length, cards.join(', '))
console.log('engine :', engine.length, engine.join(', '))
console.log('engine-only :', engine.filter(i => !cards.includes(i)))
console.log('card-only   :', cards.filter(i => !engine.includes(i)))
"
```

Output (verified):

```text
cards  : 10 complement, idempotent, absorption, identity, annulment, distributive, double-neg, demorgan-and, demorgan-or, associative
engine : 10 distributive, complement, identity, annulment, idempotent, absorption, distributive-expand, double-neg, demorgan-and, demorgan-or
engine-only : [ 'distributive-expand' ]
card-only   : [ 'associative' ]
```

> **Scope of those two lines:** they compare the **card ids** with the **`LAW_DEFINITIONS` ids**.
> There is a third non-card token outside both sets: the hint scanner emits an un-suffixed
> **`demorgan`** (`frontend/src/engine/laws/scanHints.js:38`) for every negated group, and it is
> neither `demorgan-and` nor `demorgan-or`. It never reaches scoring (scoring maps the *display name*
> recorded in a step, `engine/scoring.js:25-28`) and it is not in `LAW_NAME_TO_ID`
> (`lawIdOf('demorgan')` falls through to `'demorgan'`). The Hint bubble turns it into text through
> its own `case 'demorgan':` branch (`frontend/src/state/hintText.js:39-42`).
>
> Measured over the 40 authored start expressions, the hint scanner produces exactly four tokens:
> `absorption` (27 puzzles), `distributive` (22), `demorgan` (15), `idempotent` (2). Reproduce with
> the same loop as [§7](#7-law-usage-across-the-40-authored-puzzles), replacing the solver call with
> `scanHints(parseExpr(p.expr), 'R')`.

Why both directions exist:

- **`distributive-expand`** is a real, gated engine law used by the Sandbox (see
  [§6](#6-distributive-expand--the-internal-law-that-is-not-a-card)). It has no card because the
  reference drawer documents the ten laws the graded curriculum teaches.
- **`associative`** is a card the engine never emits (see
  [§5.10](#510-associative--associative-law-the-card-the-engine-does-not-implement)). Regrouping is
  structural in Praxis, not a derivation step. `docs/REFACTOR_REPORT.md:170` states the same thing:
  the drawer is a *reference* that documents laws the tool does not automate.

**The join key is the `id`.** Scoring maps the display name recorded in a step back to an id via
`LAW_NAME_TO_ID` (`frontend/src/engine/laws/definitions.js:62-65`) and compares it against the
puzzle's `targetLaws` (`frontend/src/engine/scoring.js:25-33`). A name that is missing from
`LAW_NAME_TO_ID` silently falls back to a lowercased name (`scoring.js:27`), which will never match
a `targetLaws` id — so a mistyped law name costs the learner the 30-point target-law band without
any error message.

## 4. The four entry points that offer laws

Everything the UI can ask lives behind `frontend/src/engine/laws/index.js:33-70`:

| Function | Selection shape | Laws it can return |
|---|---|---|
| `analyzeSelection(expr, sel[, options])` | **two** nodes (`sel.length === 2`) | SOP pair laws, POS pair laws (line 33) |
| `analyzeNot(expr, path)` | one `not` node | `double-neg`, `demorgan-and`, `demorgan-or` (line 60) |
| `analyzeSumConst(expr, constPath, constVal, sumPath)` | one `const` inside a `sum` | `identity` (sum), `annulment` (sum) (line 64) |
| `analyzeProductConst(expr, constPath, constVal, prodPath)` | one `const` inside a `prod` | `identity` (product), `annulment` (product) (line 68) |
| `scanHints(expr, path[, options])` | whole expression | every applicable simplification, as `{ law, paths }` (line 30) |

A selection element is `{ path, isTermSel }`. Paths are rooted at `'R'`; `'R.1'` is the second
term/factor of the root and `'R.1.0'` its first child (`frontend/src/engine/tree.js:1-12`).

Two structural rules decide which pair laws are even considered
(`frontend/src/engine/laws/index.js:43-55`):

- `findCommonSum` — both paths must share a **`sum`** ancestor; otherwise only the SOP group is
  searched.
- `findCommonProd` — both paths must share a **`prod`** ancestor; otherwise only the POS group is
  searched.

`options.allowExpand` is **off by default** and is the only option in the law layer
(`laws/index.js:34`). Graded levels call these functions with no options and are unaffected
(`laws/index.js:17-19`).

> ⚠️ **Unverified — could not confirm in code.** `scanHints`' two-path results are shape-agnostic
> `{ law, paths }`; the Guide reconstructs a selection from them with its own mapping and the
> property test hard-codes the same set at
> `frontend/src/engine/__tests__/law-soundness.property.test.js:112`. Nothing in the engine asserts
> that the two lists agree, so a new hintable law must be added in both places by hand.

---

## 5. The ten reference cards, law by law

Each entry gives: the law id, the engine's display names and formulas **per form**, the plain-language
statement, the mode that opens it, the source that implements it, a worked example traced on real
content, and the mistakes learners make.

Summary table first — the detailed sections follow in `content/laws.json` order.

| # | law id | SOP formula | POS dual | mode | SOP source | POS source |
|---|---|---|---|---|---|---|
| 1 | `complement` | `A + A' = 1` | `A · A' = 0` | literal | `sumLaws.js:99-121` | `productLaws.js:107-128` |
| 2 | `idempotent` | `A + A = A` | `A · A = A` | term | `sumLaws.js:188-204` | `productLaws.js:131-147` |
| 3 | `absorption` | `A + AB = A` | `A(A+B) = A` | term | `sumLaws.js:207-256` | `productLaws.js:150-187` |
| 4 | `identity` | `A + 0 = A` | `A · 1 = A` | term | `sumLaws.js:124-159` + `constLaws.js:22-42` | `constLaws.js:64-84` |
| 5 | `annulment` | `A + 1 = 1` | `A · 0 = 0` | term | `sumLaws.js:162-185` + `constLaws.js:43-56` | `productLaws.js:190-213` + `constLaws.js:85-98` |
| 6 | `distributive` | `AB + AC = A(B+C)` | `(A+B)(A+C) = A + BC` | literal | `sumLaws.js:38-96` | `productLaws.js:69-104` |
| 7 | `double-neg` | `(A')' = A` | (self-dual, `form: 'node'`) | term | `notLaws.js:27-42` | same |
| 8 | `demorgan-and` | `(AB)' = A' + B'` | (self-dual, `form: 'node'`) | term | `notLaws.js:44-72` | same |
| 9 | `demorgan-or` | `(A+B)' = A'B'` | (self-dual, `form: 'node'`) | term | `notLaws.js:74-102` | same |
| 10 | `associative` | *not implemented* — see §5.10 | *not implemented* | — | — | — |

---

### 5.1 `complement` — Complement Law

| | |
|---|---|
| law id | `complement` |
| display names | SOP: `Complement Law` · POS: `Complement Law (Product)` |
| formulas | SOP: `A + A' = 1` · POS: `A · A' = 0` (`definitions.js:32,40`) |
| mode | `literal` — the learner clicks the two literals |
| form | `sum` and `product` |
| card | `content/laws.json:2-10`, `formulas: ["A + A' = 1", "A · A' = 0"]`, "A variable OR its complement is 1; AND with its complement is 0." |
| source | SOP `frontend/src/engine/laws/sumLaws.js:98-121`; POS `frontend/src/engine/laws/productLaws.js:106-128`; hints `scanHints.js:55-57,100-102` |

**Plain language.** A literal and its own complement can never both be satisfied: OR them and the
result is always 1; AND them and the result is always 0.

**The exact condition.** The SOP builder fires only when *both selected nodes are literals* with the
same `v` and opposite `n`, **and both terms are bare literals** (`sumLaws.js:99-101`):

```js
if (n1.type === 'lit' && n2.type === 'lit' && n1.v === n2.v && n1.n !== n2.n) {
  if (t1.type === 'lit' && t2.type === 'lit') {
```

That second condition is the one learners trip over: `x'y + xy` contains a complementary pair, but
selecting the two whole terms offers **no** complement law. Verified:

```text
"x'y + xy" select whole terms:        []
"x'y + xy" select the two y literals: ["distributive"]
```

The learner must first factor the common literal out (Distributive), producing `y(x' + x)`, and only
then does the complement pair become two bare literals inside one clause.

**Worked example (SOP) — Tutorial stage 0.1**, `content/levels.json` puzzle
`x'y + z + xy → y + z`, authored `optimalSteps: 2`, `targetLaws: ["distributive","complement","identity"]`.
Real engine output, graded move set:

```text
step 1  Distributive (Factor)   x'y + z + xy        ->  y(x' + x) + z
step 2  Complement Law          y(x' + x) + z       ->  y1 + z
```

The law object the panel receives for step 2:

```json
{ "id": "complement", "name": "Complement Law", "formula": "A + A' = 1",
  "desc": "x' + x = 1", "animPaths": ["R.0.1.0", "R.0.1.1"], "resultConst": "1" }
```

**Worked example (POS) — Level 1 stage 3**, `(x' + y)(x + y)(x + y) → y`. After the dual
distributive factors `x` out, the clause `y + x'x` holds the complementary pair as bare literals:

```text
(x + y)(y + x'x)  --Complement Law (Product)-->  (x + y)(y + 0)
```

**Common learner errors**

1. **Selecting the terms instead of the literals.** The engine asks for a *literal-level* selection
   here (`mode: 'literal'`). Selecting whole terms yields a different law set — often `distributive`,
   because two products with a common literal are a factoring opportunity.
2. **Expecting `x' + x = 1` to fire mid-product without the factor.** `y(x' + x)` collapses at the
   clause; `yx' + yx` does not, until `y` is factored out.
3. **Confusing the two duals.** OR-with-complement is `1`; AND-with-complement is `0`. The panel
   shows the formula, but the step history keeps only the law *name*, so `Complement Law` and
   `Complement Law (Product)` are two different names that both map to the id `complement`
   (`definitions.js:32,40,63-65`).
4. **Reading `y1 + z` as an error.** The engine keeps the `1` explicit (`sumLaws.js:110-118`) so the
   next step is visibly Identity (`y · 1 = y`). It is a correct intermediate state, not a bug.

---

### 5.2 `idempotent` — Idempotent Law

| | |
|---|---|
| law id | `idempotent` |
| display names | SOP: `Idempotent Law` · POS: `Idempotent Law (Product)` |
| formulas | SOP: `A + A = A` · POS: `A · A = A` (`definitions.js:35,41`) |
| mode | `term` |
| form | `sum` and `product` |
| card | `content/laws.json:11-19`: "Duplicate terms or maxterm clauses can be merged." |
| source | SOP `sumLaws.js:187-204`; POS `productLaws.js:130-147`; hints `scanHints.js:52,97` |

**Plain language.** Saying the same thing twice changes nothing: `A + A = A` and `A · A = A`.

**The exact condition — and its sharp edge.** The test is `termsEq`, which compares **rendered
text**, not semantics (`frontend/src/engine/laws/helpers.js:21-24`):

```js
/** Structural equality by rendered text (order-sensitive). */
export function termsEq(a, b) {
  return nodeText(a) === nodeText(b)
}
```

So a reordered-but-equivalent duplicate is **not** merged. Verified:

```text
termsEq('x + y','y + x') = false
"(x + y)(x + y)" text-equal:                          ["idempotent","absorption","absorption"]
"(x + y)(y + x)" equivalent-but-reordered:            ["absorption","absorption"]
```

Both expressions denote the same function. The reordered one is still solvable — the semantic
absorption path catches it — but the *law the learner expected* is not offered.

**Worked example (SOP) — Tutorial stage 0.2**, `(x + y)' + x'y' → x'y'`, `targetLaws:
["demorgan-or","idempotent"]`, authored `optimalSteps: 1`. Real output:

```text
De Morgan's (OR→AND)   (x + y)' + x'y'   ->  x'y' + x'y'
Idempotent Law         x'y' + x'y'       ->  x'y'
```

**Worked example (POS) — Level 1 stage 3**, `(x' + y)(x + y)(x + y) → y`. The panel at the start
state offers both duals of this chain. Real output:

```text
state 0 (x' + y)(x + y)(x + y)  5 moves: Distributive (POS) | Idempotent Law (Product) | Absorption Law (Product) | Distr… | Distr…
Idempotent Law (Product)  (x' + y)(x + y)(x + y)  ->  (x' + y)(x + y)
```

**Common learner errors**

1. **Expecting `A + A` to merge when the two terms *look* different.** Text equality is
   order-sensitive by design (`helpers.js:21-22`). `(x + y)` and `(y + x)` are not duplicates to the
   engine; the product still simplifies, but through absorption.
2. **Merging terms that are merely equivalent.** `xy` and `yx` are the same product but different
   text (`render.js:16-18` renders in stored order) — the merge the learner has in mind is really the
   drag-reorder gesture, which records no step at all (`useGameState.js:523-558`).
3. **Applying it to a complement pair.** `A + A'` is *not* idempotent — the literals differ
   (`n` differs), so the law offered is `complement`, not `idempotent`.

---

### 5.3 `absorption` — Absorption Law

| | |
|---|---|
| law id | `absorption` |
| display names | SOP: `Absorption Law` · POS: `Absorption Law (Product)` |
| formulas | SOP: `A + AB = A` · POS: `A(A+B) = A` (`definitions.js:36,42`) |
| mode | `term` |
| form | `sum` and `product` |
| card | `content/laws.json:20-28`: "A shorter term or literal absorbs a longer clause containing it." |
| source | SOP `sumLaws.js:206-256`; POS `productLaws.js:149-187`; decision `helpers.js:73-99`; hints `scanHints.js:53-54,98-99` |

**Plain language.** If one side of an OR is already true whenever the other is, the more specific
side adds nothing: `A + AB = A`. The dual: if one factor is already true, adding a weaker clause in
parallel changes nothing: `A(A + B) = A`.

**This law is decided semantically, not syntactically — on purpose.** `absorbsInSum` is
(`frontend/src/engine/laws/helpers.js:73-78`):

```js
export function absorbsInSum(survivor, absorbed) {
  if (!survivor || !absorbed) return false
  if (survivor.type === 'lit' && termContainsLit(absorbed, survivor.v, survivor.n)) return true
  if (isLitProduct(survivor) && litsContained(survivor, absorbed)) return true
  return isEquivalent(prod(cloneN(survivor), cloneN(absorbed)), absorbed)
}
```

The first two tests are **fast accepts only**; the decision is the truth-table comparison
`isEquivalent` (`equivalence.js:45-57`). `helpers.js:26-34` explains why the syntactic shortcut is
not a decision procedure:

> It only looks at literal factors, so it reads `B'(A'C' + AC)` as the bare literal `B'` and
> `B + B + B'B'` as `B + B`. Using it as the absorption test produced invalid steps (the survivor
> was kept, but the deleted term was not implied by it).

That bug is now guarded by a property test that re-checks every offered law with `isEquivalent`
(`frontend/src/engine/__tests__/law-soundness.property.test.js:1-13, 218-230`).

**Worked example (SOP) — Tutorial stage 0.0**, `x + xy → x`, authored `optimalSteps: 1`,
`targetLaws: ["absorption"]`. Real output:

```text
Absorption Law   x + xy  ->  x
```

**Worked example (POS) — Level 1 stage 1**, `x(x + y) → x`, authored `optimalSteps: 1`. Real output:

```text
Absorption Law (Product)   x(x + y)  ->  x
```

**The semantic decision in action.** Because the decision is a truth table, absorption also fires
where the syntactic shape is not the textbook one. In the walkthrough expression `A(B + A')`,
expanding gives `AB + AA'`; `AA'` is equivalent to `0`, so `AB · AA' ≡ AA'` holds and the engine
offers absorption — collapsing the expression in one step to `AB`:

```text
AB + AA'  moves: absorption :: AB + AA' -> AB | distributive :: AB + AA' -> A(B + A') | complement :: AB + AA' -> AB + 0
```

**Common learner errors**

1. **Reading `A + AB` backwards.** The engine offers *both* directions when both hold: at `AB + AA'`
   the panel lists `absorption` (→ `AB`), `distributive` (→ back to `A(B + A')`) and `complement`
   (→ `AB + 0`). Reverting a step is legal; it just costs a step.
2. **Choosing the wrong survivor.** The engine removes the *second* selected node in the SOP builder
   (`sumLaws.js:224-229` removes `cs.ti2`) and emits a separate law for the reversed order
   (`sumLaws.js:232-256`). If the learner selects the long term first, the panel offers the
   reversed-order entry (the same law, emitted for the swapped selection) and the
   `survivorPath`/`absorbedPath` animation metadata point the other way.
3. **Assuming a nested common literal is enough.** `(x + y)z + (x + y)w` has an obvious common
   factor, but `getLits` only sees *literal* factors (`helpers.js:14-19`), so selecting the two terms
   offers nothing. Verified: `[]`.
4. **Trusting a shape rule over the truth table.** Any explanation of absorption as "drop the longer
   term" is wrong here; `helpers.js:56-72` documents the two sound fast paths and the semantic
   fallback.

---

### 5.4 `identity` — Identity Law

| | |
|---|---|
| law id | `identity` |
| display names | both forms: `Identity Law` — the **same name, two formulas** |
| formulas | SOP: `A + 0 = A` · POS: `A · 1 = A` (`definitions.js:33,48`) |
| mode | `term` |
| form | `sum` and `product` |
| card | `content/laws.json:29-37`: "OR with 0 or AND with 1 preserves the original expression." |
| source | SOP `sumLaws.js:123-159` and `constLaws.js:19-42`; POS `constLaws.js:61-84`; hints `scanHints.js:47,92,106-108` |

**Plain language.** `0` is the identity of OR and `1` is the identity of AND: adding `0` to a sum or
multiplying by `1` changes nothing.

**Two ways to trigger it.** This is the only law with a *single-node* path as well as a pairwise one:

- click the `0` (or `1`) alone → `analyzeSumConst` / `analyzeProductConst`
  (`frontend/src/engine/laws/constLaws.js:19,61`), routed by `useGameState.js:232-246`;
- click the term *and* the constant → the pairwise builder (`sumLaws.js:124-159`).

**Worked example (product form) — Tutorial stage 0.1**, continuing the chain above. Real output:

```text
state: y1 + z   --Identity Law-->   y + z
desc: "y · 1 = y — remove 1"     animPaths: ["R.0.1"]      activeText: "y"   constText: "1"
```

**Worked example (sum form).** The engine's own unit tests use the single-constant route
(`laws.test.js:89-101`): `analyzeSumConst(parseExpr('x + 0'), 'R.1', 0, 'R')` applies to `x`.

**Common learner errors**

1. **Looking for the wrong constant.** `A + 1` is annulment, not identity; `A · 0` is annulment. The
   hint text branches on exactly this (`state/hintText.js:61-66`).
2. **Expecting a visible "0" to survive.** The law *removes* the neutral element, so the expression
   gets shorter. `y1 + z` → `y + z` is the product-identity step, and the `1` disappears.
3. **Being surprised that one law has two formulas.** `Identity Law` is deliberately one display
   name keyed by `form` (`definitions.js:46-48`), so the panel quotes `A · 1 = A` in a product and
   `A + 0 = A` in a sum.

---

### 5.5 `annulment` — Annulment Law

| | |
|---|---|
| law id | `annulment` |
| display names | SOP: `Annulment Law` · POS: `Annulment Law (Product)` |
| formulas | SOP: `A + 1 = 1` · POS: `A · 0 = 0` (`definitions.js:34,43`) |
| mode | `term` |
| form | `sum` and `product` |
| card | `content/laws.json:38-46`: "OR with 1 is always 1; AND with 0 is always 0." |
| source | SOP `sumLaws.js:161-185` and `constLaws.js:43-56`; POS `productLaws.js:189-213` and `constLaws.js:85-98`; hints `scanHints.js:48,93,103-105` |

**Plain language.** A dominant constant swallows the whole operation: anything OR `1` is `1`, and
anything AND `0` is `0`.

**Worked example (SOP) — Level 1 stage 2**, `x'y + xy + xy → y`, `targetLaws:
["idempotent","distributive","complement"]`, authored `optimalSteps: 3`. Real move found in that
puzzle's state graph:

```text
state: y(1 + x)   --Annulment Law-->   y
desc: "A + 1 = 1 — anything OR 1 is 1"          dominantConst: "1"
```

**Worked example (POS) — Level 1 stage 3**, `(x' + y)(x + y)(x + y) → y`. Real move:

```text
state: y + x0   --Annulment Law (Product)-->   y
desc: "A · 0 = 0 — anything times 0 is 0"       dominantConst: "0"
```

**Common learner errors**

1. **Selecting the whole expression instead of the constant.** Both the single-constant route and
   the pairwise route exist; clicking the constant alone is the shortest gesture
   (`useGameState.js:232-246`).
2. **Expecting `A + 1` to reach the goal.** It collapses to `1` *locally*; if the `1` sits inside a
   product factor, the product does not vanish — `y(1 + x)` becomes `y`, not `1`
   (`productLaws.js:200-211` removes only the sibling factor).
3. **Mixing up the two duals.** `A · 1 = A` is identity; `A + 1 = 1` is annulment. The hint copy
   checks for the constant *and the parent* (`state/hintText.js:55-59`).

---

### 5.6 `distributive` — Distributive (Factor) & Distributive (POS)

| | |
|---|---|
| law id | `distributive` |
| display names | SOP: `Distributive (Factor)` · POS: `Distributive (POS)` |
| formulas | SOP: `AB + AC = A(B+C)` · POS: `(A+B)(A+C) = A + BC` (`definitions.js:31,39`) |
| mode | `literal` |
| form | `sum` and `product` |
| card | `content/laws.json:47-55`: `"AB + AC = A(B+C)"`, `"(A+B)(A+C) = A + BC"`, "Factor out common variables from terms or maxterm clauses." |
| source | SOP `sumLaws.js:38-96`; POS `productLaws.js:69-104`; hints `scanHints.js:58-76,109-126` |

**Plain language.** The reverse of expansion: when two terms share a literal, pull it out in front
of a bracket. In POS, when two clauses share a literal, pull it out and leave the leftovers
multiplied.

**The exact condition (both forms).** A **common literal must be a direct literal operand of both
sides** (`getLits` / `getSumLits`):

```js
// frontend/src/engine/laws/sumLaws.js:40-45 (abridged)
if (!bothTermSel && n1.type === 'lit' && n2.type === 'lit' && n1.v === n2.v && n1.n === n2.n) {
  if (termContainsLit(t1, n1.v, n1.n) && termContainsLit(t2, n2.v, n2.n)) {
    const r1 = removeLitFromNode(t1, n1.v, n1.n)
    const r2 = removeLitFromNode(t2, n2.v, n2.n)
    const isT1Bare = r1.type === 'const' && r1.val === 1
    const isT2Bare = r2.type === 'const' && r2.val === 1
    if (!isT1Bare && !isT2Bare) { … }
```

Two guards are worth knowing: the selection must be **literal-level** (`!bothTermSel`), and factoring
is **refused when removal would leave the bare constant `1`** — because `x + xy` factored as `x(1 + y)`
is not a simplification. The hint scanner mirrors that guard exactly (`scanHints.js:117-122`).

**Worked example (SOP) — Tutorial stage 0.1**, `x'y + z + xy → y + z`:

```text
Distributive (Factor)   x'y + z + xy   ->   y(x' + x) + z
desc: "Factor out y → y(x' + x) + z"
```

The engine also handles the *nested* case where the sum being factored sits inside a product, and
builds the animation text with the surrounding factors (`sumLaws.js:50-70`).

**Worked example (POS) — Level 1 stage 3**, `(x' + y)(x + y)(x + y) → y`:

```text
Distributive (POS)   (x' + y)(x + y)(x + y)   ->   (x + y)(y + x'x)
desc: "Factor out y → y + (x)(x')"
```

**Common learner errors**

1. **Trying to factor a nested literal.** `(x + y)z + (x + y)w` offers nothing at term level
   (verified: `[]`) because the shared factor is a `sum` node, not a literal
   (`helpers.js:14-19`).
2. **Selecting whole terms.** `mode: 'literal'` means the handle drag-reorder gesture does not open
   this law; the learner clicks the two *literals*.
3. **Expecting the "1" case to be offered.** `x + xy` cannot be factored by this law — the removal
   guard rejects it (`sumLaws.js:44-47`) and the correct move is `absorption`.
4. **Forgetting the dual exists.** POS factoring `(A+B)(A+C) = A + BC` is a different law object
   (`productLaws.js:82-101`) with a different display name and its own hint path
   (`scanHints.js:109-126`).

---

### 5.7 `double-neg` — Double Negation

| | |
|---|---|
| law id | `double-neg` |
| display name | `Double Negation` |
| formula | `(A')' = A` (`definitions.js:51`) |
| mode | `term` |
| form | `node` — single-node law, self-dual |
| card | `content/laws.json:56-64`: "Negating a value twice returns the original." |
| source | `frontend/src/engine/laws/notLaws.js:27-42`; hint `scanHints.js:37` |

**Plain language.** Two negations cancel.

**The exact condition.** A selected `not` node whose child is *also* a `not` node
(`notLaws.js:22-28`):

```js
const node = getNode(expr, path)
if (!node || node.type !== 'not') return []
const child = node.child
if (child.type === 'not') { … }
```

**Worked example — Sandbox.** No authored puzzle reaches a double negation (see
[§7](#7-law-usage-across-the-40-authored-puzzles)), so the honest worked example is the sandbox
path, which is a real product surface. Typed input `((x + y)')'`:

```text
buildSandboxPuzzle("((x + y)')'")
  -> { expr: "(x + y)''", goal: "x + y", optimalSteps: 1, allowExpand: true,
       solutionPath: [{ law: "Double Negation", from: "(x + y)''", to: "x + y" }] }
```

and the law object itself:

```json
{ "id": "double-neg", "name": "Double Negation", "formula": "(A')' = A",
  "desc": "((x + y)')' = x + y", "animPaths": ["R"], "coreText": "x + y" }
```

**Common learner errors**

1. **Typing `x''` and expecting a step.** The parser folds a stacked prime on a *literal* at parse
   time (`parser.js:117-124`), so `(x')'` parses to the single literal `x` and the law never appears.
   Verified: `parseExpr("(x')'")` → nodeText `"x"`, AST type `lit`. Only a negated **group** keeps
   the outer `not` node: `((x + y)')'` → nodeText `"(x + y)''"`, AST type `not`.
2. **Reading the rendered `''` as a typo.** `nodeText` renders a `not` of a `not` of a sum as
   `(x + y)''` (`render.js:20-23`); the tokenizer accepts that back.
3. **Selecting inside the group instead.** Clicking a literal *inside* the negated group is a
   different selection and opens no law; the `not` container must be clicked
   (`useGameState.js:272-306`).

---

### 5.8 `demorgan-and` — De Morgan's (AND→OR)

| | |
|---|---|
| law id | `demorgan-and` |
| display name | `De Morgan's (AND→OR)` |
| formula | `(AB)' = A' + B'` (`definitions.js:52`) |
| mode | `term` |
| form | `node` |
| card | `content/laws.json:65-71`: "The complement of a product equals the sum of complements." |
| source | `frontend/src/engine/laws/notLaws.js:44-72`; hint `scanHints.js:38` — the emitted hint token is the shared un-suffixed `demorgan`, never the card id `demorgan-and` |

**Plain language.** To complement an AND, complement each factor and OR them.

**The exact condition.** A selected `not` node whose child is a `prod` (`notLaws.js:45`). The
rewrite complements **every** factor and ORs them, and it works for any arity — the module comment
says `(ABCD...)' = A' + B' + C' + D'...` (`notLaws.js:44`).

**Worked example — Level 1 stage 5**, `(xy')'(x' + y) → x' + y`. Real move:

```text
state: (xy')'(x' + y)   --De Morgan's (AND→OR)-->   (x' + y)(x' + y)
desc: "(xy')' = x' + y"
```

The panel also receives per-factor metadata used by the animation
(`notLaws.js:46-57`), e.g. `{ v: 'y', hadBar: true, willHaveBar: false }`.

**Common learner errors**

1. **Negating only one factor.** The law always complements all of them; there is no
   "partial De Morgan".
2. **Applying it to a sum.** `(A+B)'` is `demorgan-or` (`A'B'`), not this law — the two ids differ
   and so do the target-law credits.
3. **Forgetting that a compound factor stays grouped.** A factor that is itself a `sum` is negated
   as a whole (`notLaws.js:58-60` wraps it in a `not` node), not pushed inside.

---

### 5.9 `demorgan-or` — De Morgan's (OR→AND)

| | |
|---|---|
| law id | `demorgan-or` |
| display name | `De Morgan's (OR→AND)` |
| formula | `(A+B)' = A'B'` (`definitions.js:53`) |
| mode | `term` |
| form | `node` |
| card | `content/laws.json:72-80`: "The complement of a sum equals the product of complements." |
| source | `frontend/src/engine/laws/notLaws.js:74-102`; hint `scanHints.js:38` — the emitted hint token is the shared un-suffixed `demorgan`, never the card id `demorgan-or` |

**Plain language.** To complement an OR, complement each term and AND them.

**Worked example — Tutorial stage 0.2**, `(x + y)' + x'y' → x'y'`, `targetLaws:
["demorgan-or","idempotent"]`. Real output:

```text
state: (x + y)' + x'y'   --De Morgan's (OR→AND)-->   x'y' + x'y'
desc: "(x + y)' = x'y'"
```

**Common learner errors**

1. **Stopping after the law.** The result `x'y' + x'y'` still needs `idempotent` in this puzzle; the
   target laws are `["demorgan-or","idempotent"]` and both are expected.
2. **Using it for a negated product.** `(xy)'` is `demorgan-and`. The hint scanner reports both under
   the single id `demorgan` (`scanHints.js:38`), but the *law ids* are distinct
   (`definitions.js:52-53`) and scoring sees only the ids.
3. **Losing a factor's complement.** Every term's bar flips; for a `not` term the bar is removed
   rather than added (`notLaws.js:76-87`).

---

### 5.10 `associative` — Associative Law (the card the engine does not implement)

| | |
|---|---|
| law id | `associative` |
| display name | `Associative Law` |
| formulas on the card | `A+(B+C) = (A+B)+C`, `A(BC) = (AB)C` (`content/laws.json:80-88`) |
| mode | **none** |
| form | **none** |
| source | **no engine builder, no `LAW_DEFINITIONS` row, no hint** |

`associative` is a **reference card only**. Verified: the id appears nowhere in
`frontend/src/engine/**` (only in `content/laws.json`, `docs/REFACTOR_REPORT.md:170`, and the
proposal), and `defineLaw('Associative Law', …)` throws.

**Why it can work this way.** Regrouping is handled structurally, twice over:

1. **At parse time.** `parseExpr` runs `normalizeFlat`, which splices nested `sum`/`prod` children
   into their parent (`frontend/src/engine/normalize.js:47-68`). Regrouped input therefore produces
   an *identical* tree. Verified:

   ```text
   "x + (y + z)"  -> nodeText "x + y + z"  canon "x+y+z" root=sum children=3
   "(x + y) + z"  -> nodeText "x + y + z"  canon "x+y+z" root=sum children=3
   canon equal: true
   ```

2. **At play time.** The `⠿` handle drags terms/factors to reorder them
   (`useGameState.js:522-558`). That is a *structural edit*, not a step: it records no derivation
   entry, costs no scoring step, and is deliberately not a law.

**What a tutor must know.** A learner cannot earn target-law credit for `associative`, because no
step can ever carry that name; and no puzzle should list `associative` in `targetLaws`. The
associative freedom is real in the product, it is simply free.

**Common learner errors**

1. **Hunting for an Associative button.** There is none; the card explains a freedom the workspace
   gives for free.
2. **Believing brackets are lost.** The AST keeps the flat tuple order (`x + y + z`); the learner can
   drag any term anywhere at any time — this is the "step-locking" exception: reordering does not
   lock a step, applying a law does.

---

## 6. `distributive-expand` — the internal law that is not a card

| | |
|---|---|
| law id | `distributive-expand` |
| display name | `Distributive (Expand)` |
| formula | `A(B + C) = AB + AC` (`definitions.js:44`) |
| mode | `literal` · form | `product` |
| card | **none** — not in `content/laws.json` |
| source | `frontend/src/engine/laws/productLaws.js:19-49, 215-221`; detection `helpers.js:119-152`; hint `scanHints.js:77-81` |
| gate | `options.allowExpand`, off by default |

**What it does.** The expansion direction of the distributive law: pull a literal factor into a
sibling clause. It is the *productive* move that makes certain sandbox expressions solvable — above
all `A(B + A')`, which has no other first move (see the walkthrough tutorial).

**It is deliberately restricted.** `findExpandablePair` refuses the general case
(`frontend/src/engine/laws/helpers.js:144-150`):

```js
// Complement-guarded: for the productive direction we also need A' inside the
// clause. A general expansion (A(B+C) = AB + AC) is deliberately NOT offered:
// it turns A(B+C) from "already simplest" into "not simplifiable" and makes
// the solver search ~20x slower.
if (clauseNode.terms.length < 2) return null
if (!sumContainsLit(clauseNode, litNode.v, !litNode.n)) return null
```

So the law fires only on the shape **literal × clause-that-contains-its-complement** — `A(B + A')`,
not `A(B + C)`.

**Who can see it.** Only the sandbox. `allowExpand: true` is set in exactly one place — the puzzle
builder (`frontend/src/engine/sandbox/input.js:51,153,166,197`) — and is consumed by
`usePuzzleSession.js:84` (`const allowExpand = Boolean(puzzle && puzzle.allowExpand)`) and
`useGameState.js:14`. Graded levels never carry the flag.

Verified — same expression, same selection, different gate:

```text
graded  analyzeSelection(A(B + A'), [A, A']): []
sandbox analyzeSelection(A(B + A'), [A, A']): [distributive-expand :: "Distribute A over B + A' → AB + AA'"]
graded  scanHints(A(B + A'), 'R'):            []
sandbox scanHints(A(B + A'), 'R'):            [{"law":"distributive-expand","paths":["R.0","R.1"]}]
graded  getLegalTransitions(A(B + A')):        []
```

**No animation.** `animPaths` is deliberately empty and the code says why
(`productLaws.js:28-34`):

> AnimationOverlay has no 'distributive-expand' branch, and measurePaths/factoredVar belong to the
> *factoring* animation, which would misread this law. Empty animPaths keeps the generic path: the
> overlay renders only its empty container and the expression simply updates to the distributed form.

The animation registry confirms it: an unknown law id resolves to `null`
(`frontend/src/components/animations/index.js:6-8,30-33`).

**Why there is no card.** The ten cards document the graded curriculum. Expansion is a *sandbox-only
convenience* that exists to keep learner-typed input solvable, and it is complement-guarded so it can
never suggest an unhelpful expansion. Adding it to `content/laws.json` would advertise a law the
graded levels never offer.

**Common learner errors**

1. **Trying to expand in a graded puzzle.** The move is not in the panel; the puzzle is authored so
   that a simplification path exists without it.
2. **Typing `A(B + C)` into the Sandbox and expecting an expansion step.** The generator marks it
   "already simplified" — `buildSandboxPuzzle("x(y + z)")` returns `already-simplest`, because
   `findSimplestForm` sees a terminal state and refuses to ship a 0-step puzzle
   (`sandbox/input.js:157-159`).
3. **Expecting the expansion animation.** There is none; the expression just updates.

---

## 7. Law usage across the 40 authored puzzles

`content/levels.json` holds **4 levels with `[4, 12, 12, 12]` puzzles = 40 puzzles**. Running the
graded solver (`getLegalTransitions` with no options, exactly what `useGameState` does) over all 40:

| Check | Result |
|---|---|
| puzzles where the solver finds the authored goal | **40 / 40** |
| puzzles whose solver step count differs from the authored `optimalSteps` | **0** |

Which law names appear on the *shortest* path:

| display name | count |
|---|---|
| `Absorption Law` | 23 |
| `Distributive (Factor)` | 24 |
| `Absorption Law (Product)` | 23 |
| `Distributive (POS)` | 22 |
| `De Morgan's (AND→OR)` | 5 |
| `De Morgan's (OR→AND)` | 5 |
| `Complement Law` | 2 |
| `Complement Law (Product)` | 2 |
| `Idempotent Law`, `Idempotent Law (Product)`, `Identity Law`, `Annulment Law`, `Double Negation` | **0 on any shortest path** |

Reproduce it:

```bash
cd frontend && node --input-type=module -e "
import fs from 'node:fs'
import { parseExpr } from './src/engine/parser.js'
import { canonText } from './src/engine/render.js'
import { findOptimalPath } from './src/engine/solver.js'
const levels = JSON.parse(fs.readFileSync('../content/levels.json','utf8'))
const usage = {}
for (const lv of Object.values(levels)) for (const p of lv.puzzles) {
  const r = findOptimalPath(parseExpr(p.expr), canonText(parseExpr(p.goal)))
  for (const s of r.path) usage[s.law] = (usage[s.law] || 0) + 1
}
console.log(usage)
"
```

**Two consequences a tutor should know.**

1. **The solver prefers absorption, so it rarely walks the authored chain.** Tutorial stage 0.1 is
   authored as `distributive → complement → identity` with `targetLaws` naming all three, but the
   shortest path is `Distributive (Factor) → Absorption Law (Product)`, which credits only
   `distributive`. A learner who takes the shortest path scores full *efficiency* and partial
   *target-law* credit. This is a real product behaviour, not a bug in the solver: the target-law
   band rewards the authored route and the efficiency band rewards the short route.
2. **`double-neg` is not reachable in any authored puzzle**, and neither is a `not`-of-`not` shape
   anywhere in `content/` or in the curated sandbox pool (`sandbox/pool.js:11-40`). Only
   learner-typed sandbox input exercises it.

---

## 8. Where each law lives in the source

| Concern | File | Line |
|---|---|---|
| law identity table (name, formula, mode, form) | `frontend/src/engine/laws/definitions.js` | 29-54 |
| name+form lookup that throws on a typo | `frontend/src/engine/laws/definitions.js` | 79-84 |
| display name → law id (scoring join) | `frontend/src/engine/laws/definitions.js` | 62-65 |
| SOP pair builder (6 laws, display order) | `frontend/src/engine/laws/sumLaws.js` | 32-258 |
| POS pair builder (5 laws + gated expand) | `frontend/src/engine/laws/productLaws.js` | 63-223 |
| single-node NOT laws | `frontend/src/engine/laws/notLaws.js` | 21-104 |
| single-constant laws | `frontend/src/engine/laws/constLaws.js` | 19-99 |
| semantic absorption decisions | `frontend/src/engine/laws/helpers.js` | 73-99 |
| complement-guarded expansion detection | `frontend/src/engine/laws/helpers.js` | 119-152 |
| full-expression hint scan | `frontend/src/engine/laws/scanHints.js` | 22-134 |
| public law API + `allowExpand` | `frontend/src/engine/laws/index.js` | 33-70 |
| animation registry (law id → component) | `frontend/src/components/animations/index.js` | 19-33 |
| hint sentence per law id | `frontend/src/state/hintText.js` | 18-77 |
| step recording + `lawAnimationMs` delay | `frontend/src/state/useGameState.js` | 423-447 |

Run the engine on any law yourself:

```bash
cd frontend && node --input-type=module -e "
import { parseExpr } from './src/engine/parser.js'
import { analyzeSelection } from './src/engine/laws/index.js'
const t = parseExpr('x + xy')
const laws = analyzeSelection(t, [{path:'R.0',isTermSel:true},{path:'R.1',isTermSel:true}])
console.log(laws.map(l => [l.id, l.name, l.formula, l.desc, l.apply && require]))
" 2>/dev/null || cd frontend && node --input-type=module -e "
import { parseExpr } from './src/engine/parser.js'
import { nodeText, analyzeSelection } from './src/engine/index.js'
const t = parseExpr('x + xy')
for (const l of analyzeSelection(t, [{path:'R.0',isTermSel:true},{path:'R.1',isTermSel:true}])) {
  console.log(l.id, '|', l.name, '|', l.formula, '|', l.desc, '|', nodeText(l.apply()))
}
"
```

Expected output:

```text
absorption | Absorption Law | A + AB = A | x absorbs xy → x | x
```

---

## 9. Known discrepancies

| # | Claim elsewhere | What the code does | Where |
|---|---|---|---|
| **D11** | "the engine has 46 unit tests" (`docs/context.md`) | **76 tests, 76 pass** — measured, see the walkthrough tutorial | `frontend/package.json` `test` script; `npm test` output |
| **D12** | "a 2.5 s law animation" (`docs/context.md`) | `TIMING.lawAnimationMs = 1350`; the step is recorded after that delay | `frontend/src/config/gameRules.js` `TIMING`; applied at `state/useGameState.js:447` |
| — | `content/laws.json` has an `associative` card | The engine never emits it; regrouping is structural | `docs/REFACTOR_REPORT.md:170`, [§5.10](#510-associative--associative-law-the-card-the-engine-does-not-implement) |
| — | an internal id `distributive-expand` appears in the engine | It is gated to the Sandbox and has no card | [§6](#6-distributive-expand--the-internal-law-that-is-not-a-card) |
| **D21** | client score estimate equals the server value | JS `Math.round` (half-up) vs Python `round` (half-to-even) can differ by **one bonus point** at totals ending in 5 | `frontend/src/engine/scoring.js:80` vs `backend/services/scoring_service.py:55` |

**Related reading.** The step-by-step walkthrough of a full derivation, including how the law panel
is populated, is in [understanding-the-engine.md](../05-guides/tutorials/understanding-the-engine.md).
To add an eleventh law, read
[add-a-new-law.md](../05-guides/how-to/add-a-new-law.md) and
[first-contribution.md](../05-guides/tutorials/first-contribution.md).

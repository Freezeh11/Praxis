"""
Praxis Level Data — Level 1 (Two-variable expressions)
Each puzzle has: expr (SOP string), goal (target expression), hints (list of strings)
Notation: Use ' for complement  e.g. x' = NOT x
"""

LAWS = [
    {
        "id": "complement",
        "name": "Complement Law",
        "formulas": ["A + A' = 1", "A · A' = 0"],
        "desc": "A variable OR its complement equals 1 (or ANDed equals 0).",
    },
    {
        "id": "idempotent",
        "name": "Idempotent Law",
        "formulas": ["A + A = A", "(A+B)(A+B) = A+B"],
        "desc": "Duplicate terms or clauses can be removed.",
    },
    {
        "id": "absorption",
        "name": "Absorption Law",
        "formulas": ["A + AB = A", "A(A+B) = A", "(A+B)(A+B+C) = A+B"],
        "desc": "A shorter term/clause absorbs a longer one containing it.",
    },
    {
        "id": "identity",
        "name": "Identity Law",
        "formulas": ["A + 0 = A", "A · 1 = A"],
        "desc": "OR with 0 or AND with 1 keeps the original.",
    },
    {
        "id": "annulment",
        "name": "Annulment Law",
        "formulas": ["A + 1 = 1", "A · 0 = 0"],
        "desc": "OR with 1 is 1; AND with 0 is 0.",
    },
    {
        "id": "distributive",
        "name": "Distributive Law",
        "formulas": ["AB + AC = A(B+C)", "(A+B)(A+C) = A + BC"],
        "desc": "Factor out common variables from terms or clauses.",
    },
    {
        "id": "double-neg",
        "name": "Double Negation",
        "formulas": ["(A')' = A"],
        "desc": "Negating a value twice returns the original.",
    },
    {
        "id": "demorgan-and",
        "name": "De Morgan's (AND)",
        "formulas": ["(AB)' = A' + B'"],
        "desc": "The complement of a product equals the sum of complements.",
    },
    {
        "id": "demorgan-or",
        "name": "De Morgan's (OR)",
        "formulas": ["(A+B)' = A'B'"],
        "desc": "The complement of a sum equals the product of complements.",
    },
    {
        "id": "associative",
        "name": "Associative Law",
        "formulas": ["A+(B+C) = (A+B)+C", "A(BC) = (AB)C"],
        "desc": "Terms can be regrouped freely.",
    },
]

LEVELS = [
    {
        "id": 1,
        "name": "Level 1",
        "desc": "Two-variable expressions",
        "varCount": 2,
        "puzzles": [
            # Stage 1 — Absorption (The Workaround)
            {
                "expr": "x + xy",
                "goal": "x",
                "targetLaws": ["absorption"],
                "hints": [
                    "x is shorter than xy.",
                    "x absorbs xy because xy contains x.",
                    "Absorption Law: A + AB = A — select x and xy to apply it.",
                ],
                "optimalSteps": 1,
                "optimalHint": "Did you take a longer route? The Absorption Law (A + AB = A) can solve this in a single step.",
            },
            # Stage 2 — Idempotent -> Distributive (Order of Operations)
            {
                "expr": "x'y + xy + xy",
                "goal": "y",
                "targetLaws": ["idempotent", "distributive", "complement"],
                "hints": [
                    "Two identical xy terms — remove the duplicate first.",
                    "Now x'y + xy — both terms share a common variable.",
                    "Factor out the common variable, then look for a pair that cancels to 1.",
                ],
                "optimalSteps": 4,
                "optimalHint": "If you took more steps, remember to remove duplicates (Idempotent) BEFORE factoring out common terms (Distributive) to avoid creating a massive equation.",
            },
            # Stage 3 — De Morgan's OR -> Idempotent (double-neg auto-handled)
            {
                "expr": "(x+y')' + x'y",
                "goal": "x'y",
                "targetLaws": ["demorgan-or"],
                "hints": [
                    "Click the (x+y')' group to apply De Morgan's Law.",
                    "After applying De Morgan's, the expression simplifies automatically. Look for identical terms.",
                    "Use Idempotent Law to remove the duplicate term.",
                ],
                "optimalSteps": 2,
                "optimalHint": "There is no workaround here! De Morgan's Law (OR→AND) breaks apart the negated group, then Idempotent removes the duplicate — just 2 steps.",
            },
            # Stage 4 — De Morgan's AND -> Absorption (The Detour)
            {
                "expr": "(xy)' + x'y",
                "goal": "x' + y'",
                "targetLaws": ["demorgan-and", "absorption"],
                "hints": [
                    "Click (xy)' — De Morgan's expands it to x' + y'.",
                    "Now scan the full expression for a shorter term that shares all its variables with a longer one.",
                    "After expanding, look for a shorter term that swallows a longer one containing it.",
                ],
                "optimalSteps": 2,
                "optimalHint": "After expanding with De Morgan's Law, look for the Absorption Law instead of blindly factoring. Factoring here is a detour!",
            },
            # Stage 5 — Distributive Trap (The Undo Dead End)
            {
                "expr": "x + x'y + xy",
                "goal": "x + y",
                "targetLaws": ["distributive", "complement"],
                "hints": [
                    "Look for two terms that share a common factor which would create a complementary pair (like x and x') inside the brackets.",
                    "Look at the last two terms: x'y + xy. They both share y.",
                    "Factor out y, turn x'+x into 1, and you're left with x + y·1 — then remove the 1.",
                ],
                "optimalSteps": 3,
                "optimalHint": "The optimal path is 3 steps: Distributive (factor y from x'y + xy), Complement (x' + x = 1), then Identity (y·1 = y). Don't try Absorption on x and xy — it leads to a dead end!",
            },
            # Stage 6 — De Morgan's -> Complement -> Annulment (The Nuke)
            {
                "expr": "(x'y)' + (xy')' + xy",
                "goal": "1",
                "targetLaws": ["demorgan-and", "complement", "annulment"],
                "hints": [
                    "Start by expanding the negated groups using De Morgan's Law.",
                    "After expanding, scan the entire expression for a variable paired with its complement.",
                    "When you find a complementary pair (A + A' = 1), use Annulment — 1 + anything = 1!",
                ],
                "optimalSteps": 4,
                "optimalHint": "The optimal path is 4 steps: De Morgan's on both groups, then Complement (x + x' = 1), then Annulment (1 + anything = 1).",
            },
            # Stage 7 — POS Dual Absorption (Product of Sums Intro)
            {
                "expr": "x(x + y)",
                "goal": "x",
                "targetLaws": ["absorption"],
                "hints": [
                    "This expression is in Product of Sums (POS) form — terms and clauses are multiplied together.",
                    "Look at the standalone variable x and the clause (x + y).",
                    "Dual Absorption Law: A(A + B) = A — select the variable and the clause to apply it.",
                ],
                "optimalSteps": 1,
                "optimalHint": "In Product of Sums, a standalone literal absorbs any larger clause containing it — A(A + B) = A in a single step!",
            },
            # Stage 8 — POS Deduplication & Distributive
            {
                "expr": "(x + y)(x + y)(x + y')",
                "goal": "x",
                "targetLaws": ["distributive-pos", "complement", "absorption"],
                "hints": [
                    "Two of the clauses share a common variable x with opposite y complements.",
                    "Apply Distributive Law (POS): (A+B)(A+C) = A + BC by selecting x in both clauses.",
                    "Turn y·y' into 0 using Complement Law, then use Absorption.",
                ],
                "optimalSteps": 3,
                "optimalHint": "Factoring x yields (x + y)(x + yy') → (x + y)(x + 0) → x in 3 optimal steps.",
            },
            # Stage 9 — POS Distributive Core
            {
                "expr": "(x + y)(x + y')",
                "goal": "x",
                "targetLaws": ["distributive-pos", "complement", "identity"],
                "hints": [
                    "Both clauses share the common literal x.",
                    "Apply Distributive Law (POS): (A+B)(A+C) = A + BC by selecting x in both clauses.",
                    "Simplify the resulting product y·y' to 0, then remove 0 using Identity Law.",
                ],
                "optimalSteps": 3,
                "optimalHint": "Dual Distributive produces x + yy', then Complement and Identity complete the reduction to x.",
            },
            # Stage 10 — Level 1 POS Boss (De Morgan OR to POS)
            {
                "expr": "(x'y')'(x + y)",
                "goal": "x + y",
                "targetLaws": ["demorgan-and", "idempotent"],
                "hints": [
                    "Start by expanding the negated group (x'y')' using De Morgan's Law.",
                    "After expanding, notice the two identical clauses in the product.",
                    "Use Idempotent Law on the duplicate clauses: (A+B)(A+B) = A+B.",
                ],
                "optimalSteps": 2,
                "optimalHint": "De Morgan's expands (x'y')' into (x + y), which duplicates the second clause — solved in 2 steps!",
            },
            # Stage 11 — POS Factoring with Complements
            {
                "expr": "(x' + y)(x' + y')",
                "goal": "x'",
                "targetLaws": ["distributive-pos", "complement", "identity"],
                "hints": [
                    "Both clauses share x'. Factor out x' using Distributive Law (POS).",
                    "Complement Law simplifies y·y' to 0.",
                    "Identity Law removes the 0 to leave x'.",
                ],
                "optimalSteps": 3,
                "optimalHint": "Dual Distributive produces x' + yy' → x' + 0 → x' in 3 optimal steps.",
            },
            # Stage 12 — Level 1 POS Grand Finale
            {
                "expr": "(x + y')(x + y)(x' + y)(x' + y')",
                "goal": "0",
                "targetLaws": ["distributive-pos", "complement", "identity"],
                "hints": [
                    "Group pairs of clauses sharing common variables: (x + y')(x + y) and (x' + y)(x' + y').",
                    "Factor x from the first pair and x' from the second pair.",
                    "After simplifying to x · x', Complement Law yields 0!",
                ],
                "optimalSteps": 6,
                "optimalHint": "Factoring both complementary pairs collapses the expression to x · x' = 0 in 6 steps.",
            },
        ],
    },
    {
        "id": 2,
        "name": "Level 2",
        "desc": "Three-variable expressions",
        "varCount": 3,
        "puzzles": [
            # Stage 1 — Double Absorption Chain
            {
                "expr": "xyz + xz + yz + y",
                "goal": "xz + y",
                "targetLaws": ["absorption"],
                "hints": [
                    "Look for shorter terms that contain the same literals as longer ones.",
                    "xz and xyz — all of xz's variables appear in xyz. What law applies?",
                    "After removing xyz, look at y and yz. The same law applies again.",
                ],
                "optimalSteps": 2,
                "optimalHint": "Both absorptions can be done in either order — just 2 steps. Watch out for factoring z from xz+yz first; it creates a dead end.",
            },
            # Stage 2 — Factor & Collapse (3-variable terms)
            {
                "expr": "x'yz + xyz + z",
                "goal": "z",
                "targetLaws": ["distributive", "complement", "absorption"],
                "hints": [
                    "The first two terms are 3-variable products — look for the common 2-variable factor between them.",
                    "Factor yz out of x'yz and xyz — you'll get a complementary pair inside the brackets: x' + x.",
                    "After the complement gives you yz, compare it with the standalone z. One of them absorbs the other.",
                ],
                "optimalSteps": 4,
                "optimalHint": "The optimal path is 4 steps: Distributive (factor yz from x'yz + xyz), Complement (x' + x = 1), Identity (yz · 1 = yz), then Absorption (z absorbs yz, since yz contains z).",
            },
            # Stage 3 — De Morgan Reveals 3-Var Absorption
            {
                "expr": "(x'z)' + xyz + y",
                "goal": "x + y + z'",
                "targetLaws": ["demorgan-and", "absorption"],
                "hints": [
                    "The negated group hides a simpler expression. Apply De Morgan's Law to reveal it.",
                    "After expanding, you'll have a standalone variable and a 3-variable product — check if one contains all the literals of the other.",
                    "A shorter term absorbs any longer term that contains all its literals — even a 3-variable one.",
                ],
                "optimalSteps": 2,
                "optimalHint": "De Morgan's reveals x, which instantly absorbs xyz (since xyz contains x) — just 2 steps. The 3-variable term gets eliminated in a single move!",
            },
            # Stage 4 — Nested Factoring
            {
                "expr": "xy'z + xyz",
                "goal": "xz",
                "targetLaws": ["distributive", "complement"],
                "hints": [
                    "Both terms share a common variable. Factor it out first.",
                    "After factoring, you'll have a smaller sub-expression inside. Can you factor that too?",
                    "The inner expression now has a complementary pair. Simplify it, then remove the 1.",
                ],
                "optimalSteps": 4,
                "optimalHint": "The optimal path factors twice — first x from the outer terms, then z from the inner sum — creating y'+y=1. Then Identity removes the 1.",
            },
            # Stage 5 — Double De Morgan (3-variable group) → Collapse
            {
                "expr": "(xy)' + (x'yz)' + z",
                "goal": "1",
                "targetLaws": ["demorgan-and", "complement", "annulment"],
                "hints": [
                    "Both negated groups can be expanded using De Morgan's Law — note that the second group has 3 variables.",
                    "After expanding both groups, scan the full expression for a variable paired with its complement.",
                    "Once you have a 1 in the sum, select it with any other term — Annulment collapses everything instantly.",
                ],
                "optimalSteps": 4,
                "optimalHint": "After two De Morgan's, you'll see x', y' (from the first group) and x, y', z' (from the 3-var group). Apply Complement on x'+x to get 1, then immediately Annul — 4 steps total.",
            },
            # Stage 6 — The Three-Law Chain
            {
                "expr": "x'y + xy + x'yz",
                "goal": "y",
                "targetLaws": ["distributive", "complement", "absorption"],
                "hints": [
                    "Two of the three terms share a common variable with opposite complements. Factor it out.",
                    "After simplifying inside the brackets, you'll have a standalone y — but the job isn't done yet.",
                    "Now check: does the shorter term appear (with the same sign) inside the longer term? Use Absorption.",
                ],
                "optimalSteps": 4,
                "optimalHint": "The optimal path: Distributive → Complement → Identity (creates y), then Absorption (y absorbs x'yz, since y appears inside x'yz). All 3 law types must be used.",
            },
            # Stage 7 — 3-Var POS Factoring
            {
                "expr": "(x + y + z)(x + y + z')",
                "goal": "x + y",
                "targetLaws": ["distributive-pos", "complement", "identity"],
                "hints": [
                    "Both 3-variable clauses share the common sub-clause x + y.",
                    "Select x in both clauses to apply Distributive Law (POS).",
                    "Continue factoring common literals until you isolate z·z' = 0.",
                ],
                "optimalSteps": 4,
                "optimalHint": "Factoring x and y isolates z·z' = 0, leaving x + y in 4 steps.",
            },
            # Stage 8 — 3-Var Multi-Clause Absorption
            {
                "expr": "(x + y)(x + y + z)(x' + z)",
                "goal": "(x + y)(x' + z)",
                "targetLaws": ["absorption"],
                "hints": [
                    "Compare the 2-variable clause (x + y) with the 3-variable clause (x + y + z).",
                    "All literals in (x + y) appear inside (x + y + z).",
                    "In POS, shorter clauses absorb longer clauses containing them.",
                ],
                "optimalSteps": 1,
                "optimalHint": "The 2-literal clause (x + y) directly absorbs (x + y + z) in a single step!",
            },
            # Stage 9 — Cascading POS Factoring
            {
                "expr": "(x + y)(x + y')(x + z)",
                "goal": "x",
                "targetLaws": ["distributive-pos", "complement", "absorption"],
                "hints": [
                    "Look at the first two clauses: (x + y) and (x + y'). They form a complementary pair.",
                    "Factor out x to get x + yy' → x + 0 = x.",
                    "Then the resulting x absorbs (x + z).",
                ],
                "optimalSteps": 3,
                "optimalHint": "Factoring the first two clauses collapses them to x, which then absorbs (x + z) in 3 total steps.",
            },
            # Stage 10 — Level 2 POS Boss (De Morgan + Dual Factoring)
            {
                "expr": "((x'y')' + z)(x + y + z')",
                "goal": "x + y",
                "targetLaws": ["demorgan-and", "distributive-pos", "complement", "identity"],
                "hints": [
                    "Expand the inner negated group (x'y')' using De Morgan's Law.",
                    "This reveals (x + y + z)(x + y + z').",
                    "Factor out x and y, then cancel the z·z' complementary pair.",
                ],
                "optimalSteps": 5,
                "optimalHint": "De Morgan's reveals the dual factoring structure, reducing to x + y in 5 steps.",
            },
            # Stage 11 — 3-Var Quad POS Factoring
            {
                "expr": "(x + y + z)(x + y + z')(x + y' + z)(x + y' + z')",
                "goal": "x",
                "targetLaws": ["distributive-pos", "complement", "identity"],
                "hints": [
                    "Pair the first two clauses (sharing x + y) and the last two clauses (sharing x + y').",
                    "Factor z and z' out to reduce both pairs to 2-variable clauses.",
                    "Factor x from the remaining pair (x + y)(x + y') to reach x.",
                ],
                "optimalSteps": 10,
                "optimalHint": "Quad POS factoring systematically cancels z first, then y, leaving the single variable x in 10 steps.",
            },
            # Stage 12 — Level 2 POS Grand Finale
            {
                "expr": "(x' + y' + z)(x' + y' + z')(x + y' + z)(x + y' + z')",
                "goal": "y'",
                "targetLaws": ["distributive-pos", "complement", "identity"],
                "hints": [
                    "All 4 clauses share the common literal y'.",
                    "Pair the first two clauses (sharing x') and the second two clauses (sharing x).",
                    "After eliminating z from both pairs, factor y' to cancel x' · x to 0.",
                ],
                "optimalSteps": 10,
                "optimalHint": "Dual factoring eliminates z from both pairs, then factoring y' yields y' + x'x = y' in 10 steps.",
            },
        ],
    },
    {
        "id": 3,
        "name": "Level 3 — Boss",
        "desc": "Four-variable challenge",
        "varCount": 4,
        "puzzles": [
            # Stage 1 — Multi-Variable Absorption
            {
                "expr": "wxyz + wxz + wyz + w",
                "goal": "wxz + w",
                "targetLaws": ["absorption"],
                "hints": [
                    "Scan for shorter terms that appear inside longer 4-variable terms.",
                    "The standalone term w absorbs any product containing w, such as wyz and wxyz.",
                    "After applying Absorption, verify which terms remain.",
                ],
                "optimalSteps": 2,
                "optimalHint": "The Absorption Law (A + AB = A) eliminates both 4-variable and 3-variable terms in just 2 quick steps!",
            },
            # Stage 2 — 4-Var Nested Factoring
            {
                "expr": "wxy'z + wxyz",
                "goal": "wxz",
                "targetLaws": ["distributive", "complement", "identity"],
                "hints": [
                    "Both 4-variable terms share three common variables: w, x, and z.",
                    "Factor out common variables until you isolate the complementary pair y' + y inside the parentheses.",
                    "Apply Complement Law (y' + y = 1), then remove the 1 with Identity Law.",
                ],
                "optimalSteps": 5,
                "optimalHint": "Factoring w, x, and z systematically isolates y' + y = 1, giving wxz in 5 steps.",
            },
            # Stage 3 — Dual 4-Var De Morgan + Absorption
            {
                "expr": "(w'x)' + (y'z)' + wxyz",
                "goal": "w + x' + y + z'",
                "targetLaws": ["demorgan-and", "absorption"],
                "hints": [
                    "Start by expanding the first negated group (w'x)' using De Morgan's Law.",
                    "The resulting terms reveal single variables that absorb the 4-variable product wxyz.",
                    "Expand the remaining negated group (y'z)' to complete the simplification.",
                ],
                "optimalSteps": 3,
                "optimalHint": "Expanding (w'x)' unlocks literals that absorb the 4-variable product in a single step!",
            },
            # Stage 4 — 4-Variable 3-Law Chain
            {
                "expr": "wx'y + wxy + wx'yz",
                "goal": "wy",
                "targetLaws": ["distributive", "complement", "absorption"],
                "hints": [
                    "Look at the first two terms: wx'y and wxy. They share the common factor wy.",
                    "Factor wy to create x' + x inside the parentheses, which cancels to 1.",
                    "After simplifying to wy, notice that wy appears inside the 4-variable term wx'yz. Use Absorption!",
                ],
                "optimalSteps": 4,
                "optimalHint": "Distributive → Complement creates wy, which then directly absorbs wx'yz — 4 steps total.",
            },
            # Stage 5 — 4-Var Double De Morgan → Annulment
            {
                "expr": "(wx)' + (w'xyz)' + z",
                "goal": "1",
                "targetLaws": ["demorgan-and", "complement", "annulment"],
                "hints": [
                    "Expand the 4-variable negated group (w'xyz)' using De Morgan's Law.",
                    "Scan the resulting expression for a complementary pair like z' and z.",
                    "Once z' + z = 1, use Annulment — 1 + anything = 1!",
                ],
                "optimalSteps": 3,
                "optimalHint": "Expanding the 4-var group reveals z', creating z'+z=1, which allows an instant Annulment collapse to 1.",
            },
            # Stage 6 — The Grand Boss (Quad Factoring Reduction)
            {
                "expr": "wx'y'z + wx'yz + wxy'z + wxyz",
                "goal": "wz",
                "targetLaws": ["distributive", "complement", "identity"],
                "hints": [
                    "All 4 terms are 4-variable minterms sharing w and z.",
                    "Group and factor the first two terms (sharing wx'z) and the last two terms (sharing wxz).",
                    "Continue simplifying the complementary pairs until only wz remains.",
                ],
                "optimalSteps": 14,
                "optimalHint": "Factoring pairs of minterms systematically eliminates y and then x, leaving the clean 2-variable core wz.",
            },
            # Stage 7 — 4-Var Absorption Chain (POS)
            {
                "expr": "(w + x)(w + x + y)(w + x + y + z)",
                "goal": "w + x",
                "targetLaws": ["absorption"],
                "hints": [
                    "Notice the cascading clause sizes: 2 literals, 3 literals, 4 literals.",
                    "The shortest clause (w + x) contains variables shared by all larger clauses.",
                    "Apply Absorption sequentially to eliminate the larger clauses.",
                ],
                "optimalSteps": 2,
                "optimalHint": "Absorption Law (POS) eliminates both the 4-variable and 3-variable clauses in just 2 steps!",
            },
            # Stage 8 — 4-Var POS Factoring
            {
                "expr": "(w + x + y + z)(w + x + y + z')",
                "goal": "w + x + y",
                "targetLaws": ["distributive-pos", "complement", "identity"],
                "hints": [
                    "Both 4-variable clauses share w, x, and y.",
                    "Factor out common variables step by step to isolate z and z'.",
                    "Cancel z·z' to 0 and remove 0 using Identity Law.",
                ],
                "optimalSteps": 5,
                "optimalHint": "Systematically factoring w, x, and y isolates z·z'=0, yielding w + x + y in 5 steps.",
            },
            # Stage 9 — 4-Var De Morgan to POS
            {
                "expr": "(w'x'y')'(w + x + y + z)",
                "goal": "w + x + y",
                "targetLaws": ["demorgan-and", "absorption"],
                "hints": [
                    "Apply De Morgan's Law to expand the 3-variable negated group (w'x'y')'.",
                    "The expanded clause (w + x + y) shares all its variables with (w + x + y + z).",
                    "Use Absorption to eliminate the longer clause.",
                ],
                "optimalSteps": 2,
                "optimalHint": "De Morgan's unlocks (w + x + y), which instantly absorbs the 4-variable clause in 2 steps.",
            },
            # Stage 10 — 4-Var Multi-Clause POS Factoring
            {
                "expr": "(w + x + y + z)(w + x + y + z')(w + x + y' + z)(w + x + y' + z')",
                "goal": "w + x",
                "targetLaws": ["distributive-pos", "complement", "identity"],
                "hints": [
                    "The 4-term maxterm reduction: 4 clauses of 4 variables each.",
                    "Pair and factor the first two clauses and the last two clauses.",
                    "Continue factoring the resulting 3-variable clauses to isolate and eliminate y and z.",
                ],
                "optimalSteps": 13,
                "optimalHint": "Dual factoring pairs of 4-variable maxterms systematically reduces down to the 2-variable core w + x.",
            },
            # Stage 11 — 4-Var 3-Tier POS Factoring
            {
                "expr": "(w + x + y)(w + x + y')(w + x' + z)(w + x' + z')",
                "goal": "w",
                "targetLaws": ["distributive-pos", "complement", "identity"],
                "hints": [
                    "Pair (w + x + y)(w + x + y') to eliminate y, and pair (w + x' + z)(w + x' + z') to eliminate z.",
                    "This simplifies the expression to (w + x)(w + x').",
                    "Factor w from the remaining pair to cancel x · x' = 0.",
                ],
                "optimalSteps": 10,
                "optimalHint": "Pairwise factoring resolves the 3-variable clauses to (w + x)(w + x'), which reduces directly to w in 10 steps.",
            },
            # Stage 12 — Grand POS Master Boss (De Morgan + Quad Reduction)
            {
                "expr": "((w'x')' + y + z)(w + x + y + z')(w + x + y' + z)(w + x + y' + z')",
                "goal": "w + x",
                "targetLaws": ["demorgan-and", "distributive-pos", "complement", "identity"],
                "hints": [
                    "The Grand Boss: Expand the negated group ((w'x')' + y + z) using De Morgan's Law to reveal (w + x + y + z).",
                    "Now you have 4 maxterms sharing w and x.",
                    "Pair and factor the clauses systematically to eliminate z and y.",
                ],
                "optimalSteps": 14,
                "optimalHint": "De Morgan's expands the first clause, unlocking a quad maxterm factoring chain that resolves cleanly to w + x in 14 steps.",
            },
        ],
    },
]

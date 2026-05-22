"""
Praxis Level Data — Level 1 (Two-variable expressions)
Each puzzle has: expr (SOP string), goal (target expression), hints (list of strings)
Notation: Use ' for complement  e.g. x' = NOT x
"""

LAWS = [
    {
        "id": "complement",
        "name": "Complement Law",
        "formulas": ["A + A' = 1"],
        "desc": "A variable OR its complement equals 1.",
    },
    {
        "id": "idempotent",
        "name": "Idempotent Law",
        "formulas": ["A + A = A"],
        "desc": "Duplicate terms can be removed.",
    },
    {
        "id": "absorption",
        "name": "Absorption Law",
        "formulas": ["A + AB = A"],
        "desc": "A shorter term absorbs a longer one containing it.",
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
        "desc": "OR with 1 is always 1.",
    },
    {
        "id": "distributive",
        "name": "Distributive (Factor)",
        "formulas": ["AB + AC = A(B+C)"],
        "desc": "Factor out common variables from terms.",
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
        ],
    },
    {
        "id": 3,
        "name": "Level 3 \u2014 Boss",
        "desc": "Four-variable challenge",
        "varCount": 4,
        "puzzles": [],  # Unlocked in future release
    },
]

"""
BooleanQuest Level Data — Level 1 (Two-variable expressions)
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
        "formulas": ["A + 0 = A", "A \u00b7 1 = A"],
        "desc": "OR with 0 or AND with 1 keeps the original.",
    },
    {
        "id": "annulment",
        "name": "Annulment Law",
        "formulas": ["A + 1 = 1", "A \u00b7 0 = 0"],
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
                "hints": [
                    "x is shorter than xy.",
                    "x absorbs xy because xy contains x.",
                    "Absorption Law: A + AB = A — select x and xy to show it.",
                ],
                "optimalSteps": 1,
                "optimalHint": "Did you take a longer route? The Absorption Law (A + AB = A) can solve this in a single step.",
            },
            # Stage 2 — Idempotent -> Distributive (Order of Operations)
            {
                "expr": "x'y + xy + xy",
                "goal": "y",
                "hints": [
                    "Two identical xy terms — remove the duplicate first (Idempotent).",
                    "Now x'y + xy — both share y.",
                    "Factor out y, then x' + x = 1 inside the brackets.",
                ],
                "optimalSteps": 4,
                "optimalHint": "If you took more steps, remember to remove duplicates (Idempotent) BEFORE factoring out common terms (Distributive) to avoid creating a massive equation.",
            },
            # Stage 3 — De Morgan's OR -> Double Negation (The Gate)
            {
                "expr": "(x+y')' + x'y",
                "goal": "x'y",
                "hints": [
                    "Click the (x+y')' group to apply De Morgan's Law.",
                    "The OR becomes AND, and each term gets negated: x'(y')'.",
                    "Use Double Negation on (y')' to get y, then remove duplicates.",
                ],
                "optimalSteps": 3,
                "optimalHint": "There is no workaround here! You must use De Morgan's Law to break apart the negated group.",
            },
            # Stage 4 — De Morgan's AND -> Absorption (The Detour)
            {
                "expr": "(xy)' + x'y",
                "goal": "x' + y'",
                "hints": [
                    "Click (xy)' — De Morgan's expands it to x' + y'.",
                    "Now x' + y' + x'y — x' absorbs x'y.",
                    "Result: x' + y'.",
                ],
                "optimalSteps": 2,
                "optimalHint": "After expanding with De Morgan's Law, look for the Absorption Law (x' + x'y = x') instead of blindly factoring. Factoring here is a detour!",
            },
            # Stage 5 — Distributive Trap (The Undo Dead End)
            {
                "expr": "x + x'y + xy",
                "goal": "x + y",
                "hints": [
                    "Do NOT absorb x and xy first! It leads to a dead end.",
                    "Look at the last two terms: x'y + xy. They both share y.",
                    "Factor out y, turn x'+x into 1, and you're left with x + y.",
                ],
                "optimalSteps": 4,
                "optimalHint": "If you got stuck on 'x + x\\'y', you fell for the trap! Always look ahead to see if factoring two adjacent terms creates a clean '1' (x + x') before absorbing.",
            },
            # Stage 6 — De Morgan's -> Annulment (The Nuke)
            {
                "expr": "(x'y)' + (xy')' + xy",
                "goal": "1",
                "hints": [
                    "Use De Morgan's on both negated groups.",
                    "Look for opposites! x + x' or y + y'.",
                    "When you find opposites, they become 1. And 1 + anything is 1 (Annulment).",
                ],
                "optimalSteps": 4,
                "optimalHint": "Once you expand the terms and find a Complement (x + x' = 1), you can instantly nuke the entire rest of the expression using the Annulment Law (1 + A = 1).",
            },
        ],
    },
    {
        "id": 2,
        "name": "Level 2",
        "desc": "Three-variable expressions",
        "varCount": 3,
        "puzzles": [],  # Unlocked in future release
    },
    {
        "id": 3,
        "name": "Level 3 \u2014 Boss",
        "desc": "Four-variable challenge",
        "varCount": 4,
        "puzzles": [],  # Unlocked in future release
    },
]

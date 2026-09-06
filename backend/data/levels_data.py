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
                "optimalHint": "Look for a shorter term that shares its variables with a longer term — Absorption can simplify this in a single move.",
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
                "optimalHint": "Try eliminating duplicate terms with Idempotent Law before factoring to keep your equation compact.",
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
                "optimalHint": "Breaking the negated group with De Morgan's Law first reveals identical terms that can be removed quickly.",
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
                "optimalHint": "After expanding with De Morgan's, check if Absorption can eliminate longer products before attempting to factor.",
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
                "optimalHint": "Look for common factors that leave complementary variables (like x + x' = 1) inside the parentheses.",
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
                "optimalHint": "Expanding negated groups first can reveal complementary pairs that trigger Annulment.",
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
                "optimalHint": "Scan for standalone or shorter terms — Absorption can eliminate multi-variable products without factoring.",
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
                "optimalSteps": 2,
                "optimalHint": "Check if a shorter variable can directly absorb longer multi-variable products that contain it.",
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
                "optimalHint": "De Morgan's Law reveals single literals that can immediately absorb longer products.",
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
                "optimalHint": "Focus on factoring out common variables that leave an opposing complementary pair (like y' + y = 1).",
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
                "optimalHint": "Expanding both groups exposes single variables that cancel to 1 with Complement Law.",
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
                "optimalHint": "Combine factoring to reduce the first two terms, then look for an Absorption with the remaining product.",
            },
        ],
    },
    {
        "id": 3,
        "name": "Level 3 — Boss",
        "desc": "Four-variable challenge",
        "varCount": 4,
        "puzzles": [
            # Stage 1 — The 4-Variable Absorption Web
            {
                "expr": "wxyz + wxz + wxy + wx",
                "goal": "wx",
                "targetLaws": ["absorption"],
                "hints": [
                    "Scan all 4 terms: which term is the shortest?",
                    "wx contains all the variables of wxy, wxz, and wxyz.",
                    "Use Absorption Law (A + AB = A) repeatedly to collapse all longer terms into wx.",
                ],
                "optimalSteps": 3,
                "optimalHint": "The 2-variable root term wx can absorb all longer products containing it.",
            },
            # Stage 2 — 4-Variable Factoring & Reduction
            {
                "expr": "w'xyz + wxyz + wx'y + wx'y'",
                "goal": "wx' + xyz",
                "targetLaws": ["distributive", "complement", "identity"],
                "hints": [
                    "Group terms in pairs: w'xyz with wxyz, and wx'y with wx'y'.",
                    "Factor xyz out of the first pair, and wx' out of the second pair.",
                    "Simplify the complementary brackets (w'+w=1 and y+y'=1) and remove the 1 factors.",
                ],
                "optimalSteps": 6,
                "optimalHint": "Pair terms sharing 3 common variables to cancel out complementary opposites.",
            },
            # Stage 3 — 4-Variable De Morgan Group Collapse
            {
                "expr": "(w+x+y+z)' + w'x'",
                "goal": "w'x'",
                "targetLaws": ["demorgan-or", "absorption"],
                "hints": [
                    "Click the large 4-variable (w+x+y+z)' group to apply De Morgan's Law.",
                    "After expanding to w'x'y'z', compare it with the shorter term w'x'.",
                    "Use Absorption Law to eliminate the 4-variable product.",
                ],
                "optimalSteps": 2,
                "optimalHint": "Expanding the 4-variable sum reveals an absorption opportunity with the 2-variable term.",
            },
            # Stage 4 — Symmetric Factoring Cascade
            {
                "expr": "w'xyz + w'xyz' + wxyz + wxyz'",
                "goal": "xy",
                "targetLaws": ["distributive", "complement", "identity"],
                "hints": [
                    "Factor w'xy from the first two terms (z+z'=1), and wxy from the second two terms (z+z'=1).",
                    "After removing the 1 factors, you will have w'xy + wxy.",
                    "Now factor xy from the remaining terms — you'll get w'+w=1, leaving just xy!",
                ],
                "optimalSteps": 8,
                "optimalHint": "Factor in symmetrical pairs to eliminate opposing literals (z and z') first.",
            },
            # Stage 5 — Dual Group Complement to Constant
            {
                "expr": "(wx)' + (w'+x')' + yz",
                "goal": "1",
                "targetLaws": ["demorgan-or", "complement", "annulment"],
                "hints": [
                    "Apply De Morgan's Law to (w'+x')' to reveal wx.",
                    "Now you have (wx)' and wx — a variable group paired with its exact complement!",
                    "Apply Complement Law to get 1, then use Annulment to collapse everything.",
                ],
                "optimalSteps": 3,
                "optimalHint": "De Morgan's can transform the second group into the exact complement of the first group.",
            },
            # Stage 6 — The Grand Master Boss Stage
            {
                "expr": "w'x'y'z + w'x'yz + wx'y'z + wx'yz + z",
                "goal": "z",
                "targetLaws": ["distributive", "complement", "identity", "absorption"],
                "hints": [
                    "Pair w'x'y'z with w'x'yz, and wx'y'z with wx'yz — factor out y/y' from each pair.",
                    "After simplifying, you'll have w'x'z + wx'z. Factor x'z to get (w'+w=1).",
                    "Finally, compare x'z with the standalone z — Absorption collapses the entire formula into z!",
                ],
                "optimalSteps": 8,
                "optimalHint": "Reduce 4-variable terms into 3-variable terms, then look for the ultimate absorption with z.",
            },
        ],
    },
]

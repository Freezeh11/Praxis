// Static bundled game data for instant 0ms loads
export const STATIC_LAWS = [
  {
    "id": "complement",
    "name": "Complement Law",
    "formulas": [
      "A + A' = 1",
      "A \u00b7 A' = 0"
    ],
    "desc": "A variable OR its complement is 1; AND with its complement is 0."
  },
  {
    "id": "idempotent",
    "name": "Idempotent Law",
    "formulas": [
      "A + A = A",
      "A \u00b7 A = A"
    ],
    "desc": "Duplicate terms or maxterm clauses can be merged."
  },
  {
    "id": "absorption",
    "name": "Absorption Law",
    "formulas": [
      "A + AB = A",
      "A(A+B) = A"
    ],
    "desc": "A shorter term or literal absorbs a longer clause containing it."
  },
  {
    "id": "identity",
    "name": "Identity Law",
    "formulas": [
      "A + 0 = A",
      "A \u00b7 1 = A"
    ],
    "desc": "OR with 0 or AND with 1 preserves the original expression."
  },
  {
    "id": "annulment",
    "name": "Annulment Law",
    "formulas": [
      "A + 1 = 1",
      "A \u00b7 0 = 0"
    ],
    "desc": "OR with 1 is always 1; AND with 0 is always 0."
  },
  {
    "id": "distributive",
    "name": "Distributive (Factoring & Dual)",
    "formulas": [
      "AB + AC = A(B+C)",
      "(A+B)(A+C) = A + BC"
    ],
    "desc": "Factor out common variables from terms or maxterm clauses."
  },
  {
    "id": "double-neg",
    "name": "Double Negation",
    "formulas": [
      "(A')' = A"
    ],
    "desc": "Negating a value twice returns the original."
  },
  {
    "id": "demorgan-and",
    "name": "De Morgan's (AND\u2192OR)",
    "formulas": [
      "(AB)' = A' + B'"
    ],
    "desc": "The complement of a product equals the sum of complements."
  },
  {
    "id": "demorgan-or",
    "name": "De Morgan's (OR\u2192AND)",
    "formulas": [
      "(A+B)' = A'B'"
    ],
    "desc": "The complement of a sum equals the product of complements."
  },
  {
    "id": "associative",
    "name": "Associative Law",
    "formulas": [
      "A+(B+C) = (A+B)+C",
      "A(BC) = (AB)C"
    ],
    "desc": "Terms or factors can be regrouped freely."
  }
];

export const STATIC_LEVELS = [
  {
    "id": 0,
    "name": "Tutorial",
    "desc": "Interactive Fundamentals & System Orientation",
    "varCount": 2,
    "puzzles": [
      {
        "expr": "x + xy",
        "goal": "x",
        "targetLaws": [
          "absorption"
        ],
        "hints": [
          "Select x and xy to reveal applicable laws.",
          "Absorption Law eliminates the redundant term."
        ],
        "optimalSteps": 1,
        "optimalHint": "Apply Absorption Law (A + AB = A) to simplify x + xy to x."
      },
      {
        "expr": "x'y + z + xy",
        "goal": "y + z",
        "targetLaws": [
          "distributive",
          "complement",
          "identity"
        ],
        "hints": [
          "Drag xy next to x'y to group common terms.",
          "Factor out y using Distributive Law.",
          "Simplify x' + x using Complement Law."
        ],
        "optimalSteps": 3,
        "optimalHint": "Reorder terms, factor common variable y, and apply Complement Law."
      },
      {
        "expr": "(x + y)' + x'y'",
        "goal": "x'y'",
        "targetLaws": [
          "demorgan-or",
          "idempotent"
        ],
        "hints": [
          "Click the (x + y)' group handle to expand with De Morgan's Law.",
          "Merge identical terms using Idempotent Law."
        ],
        "optimalSteps": 2,
        "optimalHint": "Apply De Morgan's Law to expand the negated sum, then merge duplicates."
      },
      {
        "expr": "x + x'y + xy",
        "goal": "x + y",
        "targetLaws": [
          "distributive",
          "complement",
          "identity"
        ],
        "hints": [
          "Spot which terms can be combined directly.",
          "Look for common variables: x'y and xy both share variable y!"
        ],
        "optimalSteps": 3,
        "optimalHint": "Factor y from x'y + xy, simplify x' + x with Complement Law, then eliminate 1 with Identity Law."
      }
    ]
  },
  {
    "id": 1,
    "name": "Level 1",
    "desc": "Two-variable expressions (SOP & POS Dual Pairs)",
    "varCount": 2,
    "puzzles": [
      {
        "expr": "x + xy",
        "goal": "x",
        "targetLaws": [
          "absorption"
        ],
        "hints": [
          "x is shorter than xy.",
          "x absorbs xy because xy contains x.",
          "Absorption Law: A + AB = A \u2014 select x and xy to apply it."
        ],
        "optimalSteps": 1,
        "optimalHint": "Did you take a longer route? The Absorption Law (A + AB = A) can solve this in a single step."
      },
      {
        "expr": "x(x + y)",
        "goal": "x",
        "targetLaws": [
          "absorption"
        ],
        "hints": [
          "Notice the standalone literal x multiplied by the clause (x + y).",
          "A standalone literal absorbs a longer sum clause containing it.",
          "Dual Absorption: A(A + B) = A \u2014 select x and (x + y) to apply it."
        ],
        "optimalSteps": 1,
        "optimalHint": "Dual Absorption (A(A + B) = A) simplifies maxterm clauses in 1 direct step."
      },
      {
        "expr": "x'y + xy + xy",
        "goal": "y",
        "targetLaws": [
          "idempotent",
          "distributive",
          "complement"
        ],
        "hints": [
          "Two identical xy terms \u2014 remove the duplicate first.",
          "Now x'y + xy \u2014 both terms share a common variable.",
          "Factor out the common variable, then look for a pair that cancels to 1."
        ],
        "optimalSteps": 3,
        "optimalHint": "Remove duplicates (Idempotent) BEFORE factoring out common terms (Distributive)."
      },
      {
        "expr": "(x' + y)(x + y)(x + y)",
        "goal": "y",
        "targetLaws": [
          "idempotent",
          "distributive",
          "complement"
        ],
        "hints": [
          "Two identical (x + y) clauses \u2014 merge the duplicate first.",
          "Now (x' + y)(x + y) \u2014 both clauses share variable y.",
          "Factor out y using Dual Distributive: (A+B)(A+C) = A + BC, then simplify x'x."
        ],
        "optimalSteps": 3,
        "optimalHint": "Merge identical clauses first (Dual Idempotent), then extract the common literal."
      },
      {
        "expr": "(x + y')' + x'y",
        "goal": "x'y",
        "targetLaws": [
          "demorgan-or",
          "idempotent"
        ],
        "hints": [
          "Click the (x + y')' group to apply De Morgan's Law.",
          "After applying De Morgan's, scan for identical terms.",
          "Use Idempotent Law to merge the duplicate terms."
        ],
        "optimalSteps": 2,
        "optimalHint": "De Morgan's (OR\u2192AND) expands the negated group, then Idempotent merges duplicates."
      },
      {
        "expr": "(xy')'(x' + y)",
        "goal": "x' + y",
        "targetLaws": [
          "demorgan-and",
          "idempotent"
        ],
        "hints": [
          "Click the (xy')' product group to apply De Morgan's Law.",
          "After expanding, look for identical sum clauses.",
          "Use Dual Idempotent to merge the duplicate clauses."
        ],
        "optimalSteps": 2,
        "optimalHint": "De Morgan's (AND\u2192OR) breaks the product, then Dual Idempotent simplifies the clauses."
      },
      {
        "expr": "(xy)' + x'y",
        "goal": "x' + y'",
        "targetLaws": [
          "demorgan-and",
          "absorption"
        ],
        "hints": [
          "Click (xy)' \u2014 De Morgan's expands it to x' + y'.",
          "Scan for a shorter term that shares its literal with a longer one.",
          "Look for a shorter term that absorbs a longer product containing it."
        ],
        "optimalSteps": 2,
        "optimalHint": "After De Morgan's expansion, look for Absorption instead of factoring."
      },
      {
        "expr": "(x + y)'(x' + y)",
        "goal": "x'y'",
        "targetLaws": [
          "demorgan-or",
          "absorption"
        ],
        "hints": [
          "Click (x + y)' to apply De Morgan's (OR\u2192AND).",
          "Notice the resulting product x'y' alongside clause (x' + y).",
          "Apply Dual Absorption to simplify."
        ],
        "optimalSteps": 2,
        "optimalHint": "Expand with De Morgan's, then use Dual Absorption to clear the larger clause."
      },
      {
        "expr": "x + x'y + xy",
        "goal": "x + y",
        "targetLaws": [
          "distributive",
          "complement"
        ],
        "hints": [
          "Look at the last two terms: x'y + xy. They both share y.",
          "Factor out y, turn x' + x into 1, and simplify x + y\u00b71.",
          "Remove the identity element 1 to finish."
        ],
        "optimalSteps": 3,
        "optimalHint": "Factor y from x'y + xy, cancel x' + x to 1, then apply Identity."
      },
      {
        "expr": "x(x' + y)(x + y)",
        "goal": "xy",
        "targetLaws": [
          "distributive",
          "complement"
        ],
        "hints": [
          "Look at the two sum clauses (x' + y)(x + y). Both share y.",
          "Apply Dual Distributive to factor out y: y + x'x.",
          "x'x collapses to 0 by Complement, leaving y + 0 = y."
        ],
        "optimalSteps": 3,
        "optimalHint": "Extract common y from both clauses, turn x'x into 0, and simplify with Identity."
      },
      {
        "expr": "(x'y)' + (xy')' + xy",
        "goal": "1",
        "targetLaws": [
          "demorgan-and",
          "complement",
          "annulment"
        ],
        "hints": [
          "Expand both negated groups using De Morgan's Law.",
          "Scan for complementary variable pairs like x + x'.",
          "Apply Complement to get 1, then Annulment (1 + anything = 1)."
        ],
        "optimalSteps": 4,
        "optimalHint": "De Morgan's on both groups, Complement to produce 1, then Annulment collapses everything."
      },
      {
        "expr": "(x' + y)'(x + y')'(x + y)",
        "goal": "0",
        "targetLaws": [
          "demorgan-or",
          "complement",
          "annulment"
        ],
        "hints": [
          "Expand the negated sum groups using De Morgan's (OR\u2192AND).",
          "Scan for complementary variable products like x \u00b7 x'.",
          "Apply Complement to produce 0, then Annulment (0 \u00b7 anything = 0)."
        ],
        "optimalSteps": 4,
        "optimalHint": "De Morgan's on negated sums, Complement produces 0, then Product Annulment collapses to 0."
      }
    ]
  },
  {
    "id": 2,
    "name": "Level 2",
    "desc": "Three-variable expressions (SOP & POS Dual Pairs)",
    "varCount": 3,
    "puzzles": [
      {
        "expr": "xy'z + xyz",
        "goal": "xz",
        "targetLaws": [
          "distributive",
          "complement",
          "identity"
        ],
        "hints": [
          "Both terms share common variables x and z.",
          "Factor out xz to isolate y' + y inside parentheses.",
          "Apply Complement Law (y' + y = 1), then remove 1 with Identity Law."
        ],
        "optimalSteps": 4,
        "optimalHint": "Factor x and z systematically to isolate y' + y = 1, giving xz in 4 steps."
      },
      {
        "expr": "(x + y' + z)(x + y + z)",
        "goal": "x + z",
        "targetLaws": [
          "distributive",
          "complement",
          "identity"
        ],
        "hints": [
          "Both sum clauses share literals x and z.",
          "Apply Dual Distributive to extract (x + z), leaving y'y inside.",
          "Apply Dual Complement (y' \u00b7 y = 0), then simplify (x + z + 0) with Identity."
        ],
        "optimalSteps": 4,
        "optimalHint": "Dual Distributive extracts x and z, y'y collapses to 0, leaving x + z in 4 steps."
      },
      {
        "expr": "xyz + xz + x'yz",
        "goal": "xz + yz",
        "targetLaws": [
          "absorption"
        ],
        "hints": [
          "Compare xz with xyz: xz appears entirely within xyz.",
          "Apply Absorption Law: xz absorbs xyz, leaving xz + x'yz.",
          "Next, factor z from both terms or observe how yz emerges."
        ],
        "optimalSteps": 4,
        "optimalHint": "xz absorbs xyz directly. Then simplify xz + x'yz to reach xz + yz."
      },
      {
        "expr": "(x + y + z)(x + z)(x' + y + z)",
        "goal": "(x + z)(y + z)",
        "targetLaws": [
          "absorption"
        ],
        "hints": [
          "Look at clause (x + z) and the longer clause (x + y + z).",
          "Dual Absorption: clause (x + z) absorbs (x + y + z).",
          "Simplify the remaining clauses to reach (x + z)(y + z)."
        ],
        "optimalSteps": 4,
        "optimalHint": "(x + z) absorbs (x + y + z) in 1 step, leaving the simplified dual form."
      },
      {
        "expr": "(x + y + z')' + x'y'z",
        "goal": "x'y'z",
        "targetLaws": [
          "demorgan-or",
          "idempotent"
        ],
        "hints": [
          "Click the 3-variable negated group (x + y + z')' to apply De Morgan's Law.",
          "The expansion produces x'y'z.",
          "Merge the identical x'y'z terms using Idempotent Law."
        ],
        "optimalSteps": 2,
        "optimalHint": "De Morgan's (OR\u2192AND) expands the negated group into x'y'z, then Idempotent merges duplicates."
      },
      {
        "expr": "(xyz')'(x' + y' + z)",
        "goal": "x' + y' + z",
        "targetLaws": [
          "demorgan-and",
          "idempotent"
        ],
        "hints": [
          "Click the 3-variable negated product (xyz')' to apply De Morgan's Law.",
          "The expansion produces the sum clause (x' + y' + z).",
          "Merge the duplicate sum clauses using Dual Idempotent Law."
        ],
        "optimalSteps": 2,
        "optimalHint": "De Morgan's (AND\u2192OR) expands to (x' + y' + z), then Dual Idempotent merges identical clauses."
      },
      {
        "expr": "x'y' + x'yz + x'yz'",
        "goal": "x'",
        "targetLaws": [
          "distributive",
          "complement",
          "absorption"
        ],
        "hints": [
          "The last two terms x'yz and x'yz' share common factor x'y.",
          "Factor x'y to create z + z' = 1, leaving x'y' + x'y.",
          "Factor x' from x'y' + x'y and cancel y' + y = 1 to isolate x'."
        ],
        "optimalSteps": 7,
        "optimalHint": "Factor pairs systematically to cancel z + z' and y' + y, reducing the entire expression to x'."
      },
      {
        "expr": "(x' + y')(x' + y + z)(x' + y + z')",
        "goal": "x'",
        "targetLaws": [
          "distributive",
          "complement",
          "absorption"
        ],
        "hints": [
          "The last two clauses share literals (x' + y).",
          "Dual Distributive factors out (x' + y), leaving zz' = 0 inside.",
          "Simplify to (x' + y')(x' + y) and apply Dual Distributive again to isolate x'."
        ],
        "optimalSteps": 7,
        "optimalHint": "Dual factor the clauses to collapse zz' = 0 and y'y = 0, reducing all clauses to x'."
      },
      {
        "expr": "(x + y)' + x'y'z",
        "goal": "x'y'",
        "targetLaws": [
          "demorgan-or",
          "absorption"
        ],
        "hints": [
          "Apply De Morgan's Law to (x + y)' to get x'y'.",
          "Notice that x'y' is shorter than x'y'z and contains its literals.",
          "Apply Absorption Law: x'y' absorbs x'y'z."
        ],
        "optimalSteps": 2,
        "optimalHint": "De Morgan's reveals x'y', which immediately absorbs the 3-variable term x'y'z in 2 steps."
      },
      {
        "expr": "(xy)'(x' + y' + z)",
        "goal": "x' + y'",
        "targetLaws": [
          "demorgan-and",
          "absorption"
        ],
        "hints": [
          "Apply De Morgan's Law to (xy)' to get (x' + y').",
          "Notice that (x' + y') is a sub-clause of (x' + y' + z).",
          "Apply Dual Absorption: (x' + y') absorbs the longer clause."
        ],
        "optimalSteps": 2,
        "optimalHint": "De Morgan's unlocks (x' + y'), which directly absorbs (x' + y' + z)."
      },
      {
        "expr": "x'y'z + x'yz + xy'z + xyz",
        "goal": "z",
        "targetLaws": [
          "distributive",
          "complement",
          "identity"
        ],
        "hints": [
          "All 4 terms share the variable z.",
          "Group and factor the first two terms (sharing x'z) and the last two terms (sharing xz).",
          "Cancel y' + y = 1 in both pairs, then factor z from the remaining terms."
        ],
        "optimalSteps": 11,
        "optimalHint": "Factor pairs systematically to eliminate y, then eliminate x, isolating z in 11 steps."
      },
      {
        "expr": "(x' + y' + z)(x' + y + z)(x + y' + z)(x + y + z)",
        "goal": "z",
        "targetLaws": [
          "distributive",
          "complement",
          "identity"
        ],
        "hints": [
          "All 4 maxterm clauses share the literal z.",
          "Pair and dual factor the first two clauses (sharing x' + z) and last two (sharing x + z).",
          "Cancel y'y = 0 in both pairs, then dual factor z from the remaining clauses."
        ],
        "optimalSteps": 10,
        "optimalHint": "Dual factor clauses to eliminate y and x, leaving only z."
      }
    ]
  },
  {
    "id": 3,
    "name": "Level 3 \u2014 Boss",
    "desc": "Four-variable challenge (SOP & POS Dual Pairs)",
    "varCount": 4,
    "puzzles": [
      {
        "expr": "wxyz + wxz + wyz + w",
        "goal": "wxz + w",
        "targetLaws": [
          "absorption"
        ],
        "hints": [
          "Scan for shorter terms that appear inside longer 4-variable terms.",
          "The standalone term w absorbs any product containing w, such as wyz and wxyz.",
          "After applying Absorption, verify which terms remain."
        ],
        "optimalSteps": 2,
        "optimalHint": "The Absorption Law (A + AB = A) eliminates both 4-variable and 3-variable terms in just 2 quick steps!"
      },
      {
        "expr": "(w + x + y + z)(w + x + z)(w + y + z)w",
        "goal": "(w + x + z)w",
        "targetLaws": [
          "absorption"
        ],
        "hints": [
          "Scan for standalone literals and shorter clauses multiplied together.",
          "The standalone literal w absorbs longer sum clauses containing w.",
          "w absorbs (w + x + y + z) and (w + y + z), leaving (w + x + z)w."
        ],
        "optimalSteps": 2,
        "optimalHint": "Dual Absorption eliminates longer clauses in 2 direct steps!"
      },
      {
        "expr": "wxy'z + wxyz",
        "goal": "wxz",
        "targetLaws": [
          "distributive",
          "complement",
          "identity"
        ],
        "hints": [
          "Both 4-variable terms share three common variables: w, x, and z.",
          "Factor out common variables until you isolate the complementary pair y' + y inside parentheses.",
          "Apply Complement Law (y' + y = 1), then remove 1 with Identity Law."
        ],
        "optimalSteps": 5,
        "optimalHint": "Factoring w, x, and z systematically isolates y' + y = 1, giving wxz in 5 steps."
      },
      {
        "expr": "(w + x + y' + z)(w + x + y + z)",
        "goal": "w + x + z",
        "targetLaws": [
          "distributive",
          "complement",
          "identity"
        ],
        "hints": [
          "Both clauses share three common literals: w, x, and z.",
          "Dual factor (w + x + z) out to leave y'y inside.",
          "Apply Dual Complement (y'y = 0), then simplify with Identity Law."
        ],
        "optimalSteps": 5,
        "optimalHint": "Dual factoring isolates y'y = 0, leaving w + x + z in 5 steps."
      },
      {
        "expr": "(w + x' + y + z')' + w'xy'z",
        "goal": "w'xy'z",
        "targetLaws": [
          "demorgan-or",
          "idempotent"
        ],
        "hints": [
          "Expand the 4-variable negated sum (w + x' + y + z')' using De Morgan's Law.",
          "The expansion produces w'xy'z.",
          "Merge the identical terms using Idempotent Law."
        ],
        "optimalSteps": 2,
        "optimalHint": "De Morgan's produces matching term w'xy'z, merged in 1 step by Idempotent."
      },
      {
        "expr": "(w'xy'z)'(w + x' + y + z')",
        "goal": "w + x' + y + z'",
        "targetLaws": [
          "demorgan-and",
          "idempotent"
        ],
        "hints": [
          "Expand the 4-variable negated product (w'xy'z)' using De Morgan's Law.",
          "The expansion produces clause (w + x' + y + z').",
          "Merge the duplicate sum clauses using Dual Idempotent Law."
        ],
        "optimalSteps": 2,
        "optimalHint": "De Morgan's expands to matching clause (w + x' + y + z'), merged by Dual Idempotent."
      },
      {
        "expr": "wx'y + wxy + wx'yz",
        "goal": "wy",
        "targetLaws": [
          "distributive",
          "complement",
          "absorption"
        ],
        "hints": [
          "Look at the first two terms: wx'y and wxy. They share the common factor wy.",
          "Factor wy to create x' + x inside parentheses, which cancels to 1.",
          "After simplifying to wy, notice that wy appears inside wx'yz. Use Absorption!"
        ],
        "optimalSteps": 4,
        "optimalHint": "Distributive \u2192 Complement creates wy, which then directly absorbs wx'yz \u2014 4 steps total."
      },
      {
        "expr": "(w + x' + y)(w + x + y)(w + x' + y + z)",
        "goal": "w + y",
        "targetLaws": [
          "distributive",
          "complement",
          "absorption"
        ],
        "hints": [
          "The first two clauses share literals (w + y).",
          "Dual factor to create x'x = 0, simplifying to clause (w + y).",
          "Clause (w + y) then absorbs the longer clause (w + x' + y + z)."
        ],
        "optimalSteps": 4,
        "optimalHint": "Dual Distributive \u2192 Dual Complement creates (w + y), which absorbs the 4-var clause."
      },
      {
        "expr": "(wx)' + (w'xyz)' + z",
        "goal": "1",
        "targetLaws": [
          "demorgan-and",
          "complement",
          "annulment"
        ],
        "hints": [
          "Expand the 4-variable negated group (w'xyz)' using De Morgan's Law.",
          "Scan the resulting expression for a complementary pair like z' and z.",
          "Once z' + z = 1, use Annulment \u2014 1 + anything = 1!"
        ],
        "optimalSteps": 3,
        "optimalHint": "Expanding the 4-var group reveals z', creating z'+z=1, which allows an instant Annulment collapse to 1."
      },
      {
        "expr": "(w + x)'(w' + x + y + z)'z",
        "goal": "0",
        "targetLaws": [
          "demorgan-or",
          "complement",
          "annulment"
        ],
        "hints": [
          "Expand the negated sum groups using De Morgan's (OR\u2192AND).",
          "Scan for complementary literal product pairs like z' \u00b7 z.",
          "Once z' \u00b7 z = 0, use Product Annulment \u2014 0 \u00b7 anything = 0!"
        ],
        "optimalSteps": 3,
        "optimalHint": "Expanding reveals z', creating z' \u00b7 z = 0, collapsing the entire product to 0."
      },
      {
        "expr": "wx'y'z + wx'yz + wxy'z + wxyz",
        "goal": "wz",
        "targetLaws": [
          "distributive",
          "complement",
          "identity"
        ],
        "hints": [
          "All 4 terms are 4-variable minterms sharing w and z.",
          "Group and factor the first two terms (sharing wx'z) and the last two terms (sharing wxz).",
          "Continue simplifying the complementary pairs until only wz remains."
        ],
        "optimalSteps": 14,
        "optimalHint": "Factoring pairs of minterms systematically eliminates y and then x, leaving the clean 2-variable core wz."
      },
      {
        "expr": "(w + x' + y' + z)(w + x' + y + z)(w + x + y' + z)(w + x + y + z)",
        "goal": "w + z",
        "targetLaws": [
          "distributive",
          "complement",
          "identity"
        ],
        "hints": [
          "All 4 maxterms share literals w and z.",
          "Pair and dual factor first two clauses (sharing w + x' + z) and last two (sharing w + x + z).",
          "Collapse y'y = 0 in both, then dual factor again to isolate w + z."
        ],
        "optimalSteps": 13,
        "optimalHint": "Dual factoring pairs systematically eliminates y and x, leaving w + z."
      }
    ]
  }
];

export const STATIC_LEVEL_SUMMARIES = STATIC_LEVELS.map(lv => ({
  id: lv.id,
  name: lv.name,
  desc: lv.desc,
  varCount: lv.varCount,
  puzzleCount: lv.puzzles.length,
}));

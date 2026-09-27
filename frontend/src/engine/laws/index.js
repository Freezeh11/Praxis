/**
 * Law engine — the public entry point.
 *
 * The engine answers "which laws apply here?" for three selection shapes and can
 * also scan an entire expression for suggestions:
 *
 *   analyzeSelection(expr, sel[, options])              two selected nodes
 *   analyzeNot(expr, path)                              one selected negation
 *   analyzeSumConst(expr, constPath, val, sumPath)      one selected constant in a sum
 *   analyzeProductConst(expr, constPath, val, prodPath) one selected constant in a product
 *   scanHints(expr, path[, options])                    every applicable simplification
 *
 * Every returned law is a plain object:
 *   { id, name, formula, desc, apply(): AST, ...animation metadata }
 * `apply()` never mutates the input tree. `id` joins to `content/laws.json`.
 *
 * `options.allowExpand` enables the sandbox-only Distributive (Expand) law;
 * graded levels call these functions with no options and are unaffected.
 *
 * Pure module: no React/DOM/network.
 */
import { findCommonProd, findCommonSum, getNode } from '../tree.js'
import { notLaws } from './notLaws.js'
import { productConstLaws, sumConstLaws } from './constLaws.js'
import { productLaws } from './productLaws.js'
import { sumLaws } from './sumLaws.js'
import { scanHints } from './scanHints.js'

export { getLits, isSubT, termsEq } from './helpers.js'
export { scanHints }
export { LAW_DEFINITIONS, LAW_MODE, LAW_FORM, LAW_NAME_TO_ID, defineLaw } from './definitions.js'

export function analyzeSelection(expr, sel, options = {}) {
  const { allowExpand = false } = options || {}
  if (!expr || sel.length !== 2) return []
  const p1 = sel[0].path
  const p2 = sel[1].path
  const bothTermSel = sel[0].isTermSel && sel[1].isTermSel
  const n1 = getNode(expr, p1)
  const n2 = getNode(expr, p2)
  if (!n1 || !n2) return []

  const cs = findCommonSum(expr, p1, p2)
  const cp = findCommonProd(expr, p1, p2)
  const laws = []

  // Sum-level (SOP) laws apply when both selections share a sum parent.
  if (cs && cs.sumNode?.terms?.[cs.ti1] && cs.sumNode?.terms?.[cs.ti2]) {
    laws.push(...sumLaws({ expr, cs, n1, n2, p1, p2, bothTermSel }))
  }

  // Product-level (POS) laws apply when both selections share a product parent.
  if (cp && cp.prodNode?.factors?.[cp.fi1] && cp.prodNode?.factors?.[cp.fi2]) {
    laws.push(...productLaws({ expr, cp, n1, n2, p1, p2, bothTermSel, allowExpand }))
  }

  return laws
}

export function analyzeNot(expr, path) {
  return notLaws(expr, path)
}

export function analyzeSumConst(expr, constPath, constVal, sumPath) {
  return sumConstLaws(expr, constPath, constVal, sumPath)
}

export function analyzeProductConst(expr, constPath, constVal, prodPath) {
  return productConstLaws(expr, constPath, constVal, prodPath)
}

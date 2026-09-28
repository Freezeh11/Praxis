/**
 * Boolean engine — public API.
 *
 * The whole game's algebra lives here as pure, framework-free modules: parsing,
 * rendering, normalization, structural edits, equivalence, law detection, the
 * solver that finds the optimal derivation, and the sandbox puzzle builders.
 *
 * Layering rule (enforced by review, not by the bundler): nothing in engine/ may
 * import from components/, screens/, state/, services/ or hooks/. The only
 * external imports are plain data/constants (config/gameRules.js).
 *
 * Consumers should import from this barrel, not from the deep modules, so the
 * internals stay free to move.
 */

/* AST construction, identity and traversal */
export { nextNodeId, lit, con, prod, sum, neg, cloneN, ensureNodeId } from './node.js'
export {
  getNode,
  setNode,
  findCommonSum,
  findCommonProd,
  removeLitFromNode,
  removeLitFromSumNode,
  termContainsLit,
  sumContainsLit,
  getSumLits,
  isSubSum,
} from './tree.js'

/* Text <-> AST */
export { parseExpr } from './parser.js'
export { nodeText, canonText } from './render.js'
export { normalize, normalizeFlat } from './normalize.js'
export { validateExpr } from './validate.js'

/* Semantics */
export { extractVariables, evalAST, isEquivalent } from './equivalence.js'

/* Law detection */
export {
  analyzeSelection,
  analyzeNot,
  analyzeSumConst,
  analyzeProductConst,
  scanHints,
  getLits,
  termsEq,
  isSubT,
  LAW_DEFINITIONS,
  LAW_MODE,
  LAW_FORM,
  LAW_NAME_TO_ID,
} from './laws/index.js'

/* Search */
export { getLegalTransitions, findOptimalPath, findSimplestForm } from './solver.js'

/* Scoring (client mirror of the backend scoring service) */
export {
  estimateScore,
  lawIdOf,
  lawsUsedFromSteps,
  effectiveOptimalSteps,
} from './scoring.js'

/* Sandbox: learner-authored expressions, generated puzzles, curated pool */
export {
  MAX_SANDBOX_VARS,
  validateSandboxInput,
  normalizeSandboxExpr,
  buildSandboxPuzzle,
} from './sandbox/input.js'
export {
  VAR_POOL,
  VAR_POOL_COMPLEX,
  DIFFICULTIES,
  normalizeDifficulty,
  makeRng,
  randomSeed,
  generateRandomPuzzle,
  generatePuzzlePair,
} from './sandbox/generator.js'
export { SANDBOX_POOL, randomPoolEquation } from './sandbox/pool.js'

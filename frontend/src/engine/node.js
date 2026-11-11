/**
 * Node primitives — the shape of a Boolean AST and how to build/copy one.
 *
 *   lit   { type:'lit',   v:'x', n:false }   literal (n = complemented)
 *   const { type:'const', val:0|1 }
 *   prod  { type:'prod',  factors:[...] }    AND
 *   sum   { type:'sum',   terms:[...] }      OR
 *   not   { type:'not',   child }            NOT
 *
 * Every node carries a stable `_id` (monotonic counter) so the UI can track the
 * same node across edits and target it in animations. Pure module: no
 * React/DOM/network.
 */

let _nodeSeq = 0

export const nextNodeId = () => ++_nodeSeq

export const lit = (v, n = false) => ({ _id: nextNodeId(), type: 'lit', v, n })
export const con = (val) => ({ _id: nextNodeId(), type: 'const', val: Number(val) })
export const prod = (...f) => ({ _id: nextNodeId(), type: 'prod', factors: f })
export const sum = (...t) => ({ _id: nextNodeId(), type: 'sum', terms: t })
export const neg = (child) => ({ _id: nextNodeId(), type: 'not', child })

/** Deep copy that preserves `_id`, so copied nodes stay recognisable to the UI. */
export function cloneN(n) {
  if (!n) return null
  const baseId = n._id || nextNodeId()
  if (n.type === 'lit') return { ...n, _id: baseId }
  if (n.type === 'const') return { ...n, _id: baseId }
  if (n.type === 'prod') return { type: 'prod', _id: baseId, factors: n.factors.map(cloneN) }
  if (n.type === 'sum') return { type: 'sum', _id: baseId, terms: n.terms.map(cloneN) }
  if (n.type === 'not') return { type: 'not', _id: baseId, child: cloneN(n.child) }
  return { ...n, _id: baseId }
}

/** Assigns ids to a tree that was built by hand (e.g. decoded from JSON). */
export function ensureNodeId(n) {
  if (!n) return n
  if (!n._id) n._id = nextNodeId()
  if (n.type === 'prod' && Array.isArray(n.factors)) {
    n.factors.forEach(ensureNodeId)
  } else if (n.type === 'sum' && Array.isArray(n.terms)) {
    n.terms.forEach(ensureNodeId)
  } else if (n.type === 'not' && n.child) {
    ensureNodeId(n.child)
  }
  return n
}

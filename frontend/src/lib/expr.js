/* ===== TREE NODE CONSTRUCTORS ===== */
export const lit = (v, n = false) => ({ type: 'lit', v, n })
export const con = (val) => ({ type: 'const', val })
export const prod = (...f) => ({ type: 'prod', factors: f })
export const sum = (...t) => ({ type: 'sum', terms: t })
export const neg = (child) => ({ type: 'not', child })

export function cloneN(n) {
  if (n.type === 'lit') return { ...n }
  if (n.type === 'const') return { ...n }
  if (n.type === 'prod') return { type: 'prod', factors: n.factors.map(cloneN) }
  if (n.type === 'sum') return { type: 'sum', terms: n.terms.map(cloneN) }
  if (n.type === 'not') return { type: 'not', child: cloneN(n.child) }
}

/* ===== PARSE SOP STRING → TREE ===== */
function splitTopLevel(str) {
  const parts = []; let depth = 0, cur = ''
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') depth++
    else if (str[i] === ')') depth--
    if (depth === 0 && str.slice(i, i + 3) === ' + ') { parts.push(cur); cur = ''; i += 2 }
    else cur += str[i]
  }
  parts.push(cur); return parts
}

function parseTerm(t) {
  if (t === '1') return con(1)
  if (t === '0') return con(0)
  // NOT-compound: (expr)'
  if (t.startsWith('(') && t.endsWith(")'")) return neg(parseExpr(t.slice(1, -2)))
  const ls = []
  for (let i = 0; i < t.length; i++) {
    const v = t[i]; if (v === ' ') continue
    const n = i + 1 < t.length && t[i + 1] === "'"
    ls.push(lit(v, n)); if (n) i++
  }
  return ls.length === 1 ? ls[0] : prod(...ls)
}

export function parseExpr(str) {
  const terms = splitTopLevel(str).map(parseTerm)
  return terms.length === 1 ? terms[0] : sum(...terms)
}

/* ===== TREE → TEXT (for step history & internal logic) ===== */
export function nodeText(n) {
  if (n.type === 'lit') return n.n ? n.v + "'" : n.v
  if (n.type === 'const') return '' + n.val
  if (n.type === 'prod')
    return n.factors.map(f => f.type === 'sum' ? '(' + nodeText(f) + ')' : nodeText(f)).join('')
  if (n.type === 'sum') return n.terms.map(nodeText).join(' + ')
  if (n.type === 'not') {
    const inner = nodeText(n.child)
    return (n.child.type === 'sum' || n.child.type === 'prod') ? '(' + inner + ")'" : inner + "'"
  }
}

/* Canonical text for order-independent comparison */
export function canonText(n) {
  if (n.type === 'lit') return n.n ? n.v + "'" : n.v
  if (n.type === 'const') return '' + n.val
  if (n.type === 'prod') {
    const lits = [], others = []
    n.factors.forEach(f => { if (f.type === 'lit') lits.push(f); else others.push(f) })
    lits.sort((a, b) => a.v.localeCompare(b.v) || (a.n ? 1 : 0) - (b.n ? 1 : 0))
    return lits.map(l => canonText(l)).join('') + others.map(f =>
      f.type === 'sum' ? '(' + canonText(f) + ')' : canonText(f)
    ).join('')
  }
  if (n.type === 'sum') {
    const ts = n.terms.map(canonText); ts.sort(); return ts.join('+')
  }
  if (n.type === 'not') return '(' + canonText(n.child) + ")'"
}

/* ===== NORMALIZE ===== */
export function normalize(n) {
  if (n.type === 'lit' || n.type === 'const') return n
  if (n.type === 'prod') {
    let fs = n.factors.map(normalize)
    let flat = []; fs.forEach(f => f.type === 'prod' ? flat.push(...f.factors) : flat.push(f))
    flat = flat.filter(f => !(f.type === 'const' && f.val === 1))
    if (flat.some(f => f.type === 'const' && f.val === 0)) return con(0)
    if (flat.length === 0) return con(1)
    if (flat.length === 1) return flat[0]
    return { type: 'prod', factors: flat }
  }
  if (n.type === 'sum') {
    let ts = n.terms.map(normalize)
    let flat = []; ts.forEach(t => t.type === 'sum' ? flat.push(...t.terms) : flat.push(t))
    flat = flat.filter(t => !(t.type === 'const' && t.val === 0))
    if (flat.some(t => t.type === 'const' && t.val === 1)) return con(1)
    if (flat.length === 0) return con(0)
    if (flat.length === 1) return flat[0]
    return { type: 'sum', terms: flat }
  }
  if (n.type === 'not') {
    const child = normalize(n.child)
    if (child.type === 'const') return con(1 - child.val)
    // Double negation: not(not(x)) = x
    if (child.type === 'not') return normalize(child.child)
    return { type: 'not', child }
  }
  return n
}

/* Structure-only normalize — flattens but does NOT apply identity/annulment */
export function normalizeFlat(n) {
  if (n.type === 'lit' || n.type === 'const') return n
  if (n.type === 'not') return { type: 'not', child: normalizeFlat(n.child) }
  if (n.type === 'prod') {
    let fs = n.factors.map(normalizeFlat)
    let flat = []; fs.forEach(f => f.type === 'prod' ? flat.push(...f.factors) : flat.push(f))
    if (flat.length === 0) return con(1)
    if (flat.length === 1) return flat[0]
    return { type: 'prod', factors: flat }
  }
  if (n.type === 'sum') {
    let ts = n.terms.map(normalizeFlat)
    let flat = []; ts.forEach(t => t.type === 'sum' ? flat.push(...t.terms) : flat.push(t))
    if (flat.length === 0) return con(0)
    if (flat.length === 1) return flat[0]
    return { type: 'sum', terms: flat }
  }
  return n
}

/* ===== TREE NAVIGATION ===== */
export function getNode(root, path) {
  if (path === 'R') return root
  const parts = path.slice(2).split('.').map(Number)
  let n = root
  for (const i of parts) {
    if (n.type === 'sum') n = n.terms[i]
    else if (n.type === 'prod') n = n.factors[i]
    else if (n.type === 'not') n = n.child
    else return null
    if (!n) return null
  }
  return n
}

export function setNode(root, path, newNode) {
  if (path === 'R') return newNode
  const parts = path.slice(2).split('.').map(Number)
  let n = root
  for (let i = 0; i < parts.length - 1; i++) {
    const idx = parts[i]
    if (n.type === 'sum') n = n.terms[idx]
    else if (n.type === 'prod') n = n.factors[idx]
    else if (n.type === 'not') n = n.child
  }
  const last = parts[parts.length - 1]
  if (n.type === 'sum') n.terms[last] = newNode
  else if (n.type === 'prod') n.factors[last] = newNode
  else if (n.type === 'not') n.child = newNode
  return root
}

export function findCommonSum(root, p1, p2) {
  const a = p1.split('.'), b = p2.split('.')
  let common = []
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) common.push(a[i]); else break
  }
  const cp = common.join('.')
  const node = getNode(root, cp)
  if (node && node.type === 'sum') return {
    sumPath: cp,
    sumNode: node,
    ti1: parseInt(a[common.length]),
    ti2: parseInt(b[common.length])
  }
  return null
}

export function removeLitFromNode(node, v, n) {
  if (node.type === 'lit' && node.v === v && node.n === n) return con(1)
  if (node.type === 'prod') {
    let removed = false
    const nf = []
    for (const f of node.factors) {
      if (!removed && f.type === 'lit' && f.v === v && f.n === n) { removed = true }
      else nf.push(cloneN(f))
    }
    if (nf.length === 0) return con(1)
    if (nf.length === 1) return nf[0]
    return { type: 'prod', factors: nf }
  }
  return cloneN(node)
}

export function termContainsLit(node, v, n) {
  if (node.type === 'lit') return node.v === v && node.n === n
  if (node.type === 'prod') return node.factors.some(f => f.type === 'lit' && f.v === v && f.n === n)
  return false
}

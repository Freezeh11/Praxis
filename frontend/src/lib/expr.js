/* ===== TREE NODE CONSTRUCTORS ===== */
export const lit = (v, n = false) => ({ type: 'lit', v, n })
export const con = (val) => ({ type: 'const', val: Number(val) })
export const prod = (...f) => ({ type: 'prod', factors: f })
export const sum = (...t) => ({ type: 'sum', terms: t })
export const neg = (child) => ({ type: 'not', child })

export function cloneN(n) {
  if (!n) return null
  if (n.type === 'lit') return { ...n }
  if (n.type === 'const') return { ...n }
  if (n.type === 'prod') return { type: 'prod', factors: n.factors.map(cloneN) }
  if (n.type === 'sum') return { type: 'sum', terms: n.terms.map(cloneN) }
  if (n.type === 'not') return { type: 'not', child: cloneN(n.child) }
  return { ...n }
}

/* ===== RECURSIVE DESCENT TOKENIZER & PARSER ===== */

/**
 * Tokenizes a Boolean expression string.
 * Supports:
 * - Literals (A-Z, a-z)
 * - Constants (0, 1)
 * - Operators (+, ·, *, &, |, ', !, ~)
 * - Parentheses (, )
 */
function tokenize(str) {
  const tokens = []
  let i = 0
  while (i < str.length) {
    const ch = str[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (ch === '0' || ch === '1') {
      tokens.push({ type: 'CONST', val: parseInt(ch, 10) })
      i++
    } else if (/[a-zA-Z]/.test(ch)) {
      tokens.push({ type: 'VAR', val: ch })
      i++
    } else if (ch === '+' || ch === '|') {
      tokens.push({ type: 'OR' })
      i++
    } else if (ch === '*' || ch === '·' || ch === '&') {
      tokens.push({ type: 'AND' })
      i++
    } else if (ch === "'" ) {
      tokens.push({ type: 'POST_NOT' })
      i++
    } else if (ch === '!' || ch === '~') {
      tokens.push({ type: 'PRE_NOT' })
      i++
    } else if (ch === '(') {
      tokens.push({ type: 'LPAREN' })
      i++
    } else if (ch === ')') {
      tokens.push({ type: 'RPAREN' })
      i++
    } else {
      i++
    }
  }
  return tokens
}

/**
 * Recursive Descent Parser
 * Grammar:
 * Expression  -> Term ( (OR | '+') Term )*
 * Term        -> Factor ( (AND | implicit_AND) Factor )*
 * Factor      -> PRE_NOT* Primary POST_NOT*
 * Primary     -> VAR | CONST | '(' Expression ')'
 */
class BooleanParser {
  constructor(tokens) {
    this.tokens = tokens
    this.pos = 0
  }

  peek() {
    return this.tokens[this.pos] || null
  }

  consume() {
    return this.tokens[this.pos++] || null
  }

  parse() {
    if (this.tokens.length === 0) return con(0)
    const result = this.parseExpression()
    return normalizeFlat(result)
  }

  parseExpression() {
    const terms = [this.parseTerm()]
    while (this.peek() && this.peek().type === 'OR') {
      this.consume() // eat '+' or '|'
      terms.push(this.parseTerm())
    }
    return terms.length === 1 ? terms[0] : sum(...terms)
  }

  parseTerm() {
    const factors = [this.parseFactor()]
    while (this.isStartOfFactor(this.peek())) {
      if (this.peek() && this.peek().type === 'AND') {
        this.consume() // explicit AND
      }
      factors.push(this.parseFactor())
    }
    return factors.length === 1 ? factors[0] : prod(...factors)
  }

  isStartOfFactor(token) {
    if (!token) return false
    return token.type === 'VAR' ||
           token.type === 'CONST' ||
           token.type === 'LPAREN' ||
           token.type === 'PRE_NOT' ||
           token.type === 'AND'
  }

  parseFactor() {
    let preNotCount = 0
    while (this.peek() && this.peek().type === 'PRE_NOT') {
      this.consume()
      preNotCount++
    }

    let node = this.parsePrimary()

    // Handle post-fix apostrophe complements: x', (A+B)'
    while (this.peek() && this.peek().type === 'POST_NOT') {
      this.consume()
      if (node.type === 'lit') {
        node = lit(node.v, !node.n)
      } else {
        node = neg(node)
      }
    }

    if (preNotCount % 2 === 1) {
      node = node.type === 'lit' ? lit(node.v, !node.n) : neg(node)
    }

    return node
  }

  parsePrimary() {
    const token = this.peek()
    if (!token) return con(0)

    if (token.type === 'VAR') {
      this.consume()
      return lit(token.val, false)
    }
    if (token.type === 'CONST') {
      this.consume()
      return con(token.val)
    }
    if (token.type === 'LPAREN') {
      this.consume() // eat '('
      const expr = this.parseExpression()
      if (this.peek() && this.peek().type === 'RPAREN') {
        this.consume() // eat ')'
      }
      return expr
    }

    this.consume()
    return con(0)
  }
}

export function parseExpr(str) {
  if (!str || typeof str !== 'string') return con(0)
  const tokens = tokenize(str.trim())
  const parser = new BooleanParser(tokens)
  return parser.parse()
}

/* ===== TREE → TEXT ===== */
export function nodeText(n) {
  if (!n) return ''
  if (n.type === 'lit') return n.n ? n.v + "'" : n.v
  if (n.type === 'const') return '' + n.val
  if (n.type === 'prod') {
    return n.factors.map(f => (f.type === 'sum' ? '(' + nodeText(f) + ')' : nodeText(f))).join('')
  }
  if (n.type === 'sum') return n.terms.map(nodeText).join(' + ')
  if (n.type === 'not') {
    const inner = nodeText(n.child)
    return (n.child.type === 'sum' || n.child.type === 'prod') ? '(' + inner + ")'" : inner + "'"
  }
  return ''
}

/* Canonical text for order-independent structural comparison */
export function canonText(n) {
  if (!n) return ''
  if (n.type === 'lit') return n.n ? n.v + "'" : n.v
  if (n.type === 'const') return '' + n.val
  if (n.type === 'prod') {
    const lits = [], others = []
    n.factors.forEach(f => { if (f.type === 'lit') lits.push(f); else others.push(f) })
    lits.sort((a, b) => a.v.localeCompare(b.v) || (a.n ? 1 : 0) - (b.n ? 1 : 0))
    const sortedOthers = others.map(canonText).sort()
    return lits.map(canonText).join('') + sortedOthers.map(t => '(' + t + ')').join('')
  }
  if (n.type === 'sum') {
    const ts = n.terms.map(canonText)
    ts.sort()
    return ts.join('+')
  }
  if (n.type === 'not') return '(' + canonText(n.child) + ")'"
  return ''
}

/* ===== NORMALIZE ===== */
export function normalize(n) {
  if (!n) return con(0)
  if (n.type === 'lit' || n.type === 'const') return n
  if (n.type === 'prod') {
    let fs = n.factors.map(normalize)
    let flat = []
    fs.forEach(f => f.type === 'prod' ? flat.push(...f.factors) : flat.push(f))
    flat = flat.filter(f => !(f.type === 'const' && f.val === 1))
    if (flat.some(f => f.type === 'const' && f.val === 0)) return con(0)
    if (flat.length === 0) return con(1)
    if (flat.length === 1) return flat[0]
    return { type: 'prod', factors: flat }
  }
  if (n.type === 'sum') {
    let ts = n.terms.map(normalize)
    let flat = []
    ts.forEach(t => t.type === 'sum' ? flat.push(...t.terms) : flat.push(t))
    flat = flat.filter(t => !(t.type === 'const' && t.val === 0))
    if (flat.some(t => t.type === 'const' && t.val === 1)) return con(1)
    if (flat.length === 0) return con(0)
    if (flat.length === 1) return flat[0]
    return { type: 'sum', terms: flat }
  }
  if (n.type === 'not') {
    const child = normalize(n.child)
    if (child.type === 'const') return con(1 - child.val)
    if (child.type === 'not') return normalize(child.child)
    return { type: 'not', child }
  }
  return n
}

export function normalizeFlat(n) {
  if (!n) return con(0)
  if (n.type === 'lit' || n.type === 'const') return n
  if (n.type === 'not') return { type: 'not', child: normalizeFlat(n.child) }
  if (n.type === 'prod') {
    let fs = n.factors.map(normalizeFlat)
    let flat = []
    fs.forEach(f => f.type === 'prod' ? flat.push(...f.factors) : flat.push(f))
    if (flat.length === 0) return con(1)
    if (flat.length === 1) return flat[0]
    return { type: 'prod', factors: flat }
  }
  if (n.type === 'sum') {
    let ts = n.terms.map(normalizeFlat)
    let flat = []
    ts.forEach(t => t.type === 'sum' ? flat.push(...t.terms) : flat.push(t))
    if (flat.length === 0) return con(0)
    if (flat.length === 1) return flat[0]
    return { type: 'sum', terms: flat }
  }
  return n
}

/* ===== TREE NAVIGATION & MANIPULATION ===== */
export function getNode(root, path) {
  if (!root) return null
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
  if (node && node.type === 'sum') {
    return {
      sumPath: cp,
      sumNode: node,
      ti1: parseInt(a[common.length], 10),
      ti2: parseInt(b[common.length], 10)
    }
  }
  return null
}

export function findCommonProd(root, p1, p2) {
  const a = p1.split('.'), b = p2.split('.')
  let common = []
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) common.push(a[i]); else break
  }
  const cp = common.join('.')
  const node = getNode(root, cp)
  if (node && node.type === 'prod') {
    return {
      prodPath: cp,
      prodNode: node,
      fi1: parseInt(a[common.length], 10),
      fi2: parseInt(b[common.length], 10)
    }
  }
  return null
}

export function removeLitFromNode(node, v, n) {
  if (node.type === 'lit' && node.v === v && node.n === n) return con(1)
  if (node.type === 'prod') {
    let removed = false
    const nf = []
    for (const f of node.factors) {
      if (!removed && f.type === 'lit' && f.v === v && f.n === n) {
        removed = true
      } else {
        nf.push(cloneN(f))
      }
    }
    if (nf.length === 0) return con(1)
    if (nf.length === 1) return nf[0]
    return { type: 'prod', factors: nf }
  }
  return cloneN(node)
}

export function removeLitFromClause(node, v, n) {
  if (!node) return con(0)
  if (node.type === 'lit' && node.v === v && node.n === n) return con(0)
  if (node.type === 'sum') {
    let removed = false
    const nt = []
    for (const t of node.terms) {
      if (!removed && t.type === 'lit' && t.v === v && t.n === n) {
        removed = true
      } else {
        nt.push(cloneN(t))
      }
    }
    if (nt.length === 0) return con(0)
    if (nt.length === 1) return nt[0]
    return { type: 'sum', terms: nt }
  }
  return cloneN(node)
}

export function termContainsLit(node, v, n) {
  if (node.type === 'lit') return node.v === v && node.n === n
  if (node.type === 'prod') return node.factors.some(f => f.type === 'lit' && f.v === v && f.n === n)
  return false
}

export function clauseContainsLit(node, v, n) {
  if (!node) return false
  if (node.type === 'lit') return node.v === v && node.n === n
  if (node.type === 'sum') return node.terms.some(t => t.type === 'lit' && t.v === v && t.n === n)
  return false
}

export function getClauseLits(node) {
  if (!node) return []
  if (node.type === 'lit') return [node]
  if (node.type === 'sum') return node.terms.filter(t => t.type === 'lit')
  return []
}

export function isClauseSub(shorter, longer) {
  const sLits = getClauseLits(shorter)
  const lLits = getClauseLits(longer)
  if (sLits.length === 0 || sLits.length >= lLits.length) return false
  return sLits.every(sl => lLits.some(ll => ll.v === sl.v && ll.n === sl.n))
}

/* ===== TRUTH TABLE & MATHEMATICAL EQUIVALENCE ===== */
export function extractVariables(node) {
  const vars = new Set()
  function walk(n) {
    if (!n) return
    if (n.type === 'lit') vars.add(n.v)
    if (n.type === 'prod') n.factors.forEach(walk)
    if (n.type === 'sum') n.terms.forEach(walk)
    if (n.type === 'not') walk(n.child)
  }
  walk(node)
  return Array.from(vars).sort()
}

export function evalAST(node, env) {
  if (!node) return 0
  if (node.type === 'const') return node.val
  if (node.type === 'lit') {
    const val = env[node.v] ?? 0
    return node.n ? (val ? 0 : 1) : val
  }
  if (node.type === 'not') {
    return evalAST(node.child, env) ? 0 : 1
  }
  if (node.type === 'prod') {
    return node.factors.every(f => evalAST(f, env) === 1) ? 1 : 0
  }
  if (node.type === 'sum') {
    return node.terms.some(t => evalAST(t, env) === 1) ? 1 : 0
  }
  return 0
}

export function isEquivalent(ast1, ast2) {
  const vars = Array.from(new Set([...extractVariables(ast1), ...extractVariables(ast2)]))
  const numStates = 1 << vars.length
  for (let i = 0; i < numStates; i++) {
    const env = {}
    for (let j = 0; j < vars.length; j++) {
      env[vars[j]] = (i >> j) & 1
    }
    if (evalAST(ast1, env) !== evalAST(ast2, env)) {
      return false
    }
  }
  return true
}


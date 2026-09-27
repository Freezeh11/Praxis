/**
 * Expression parser — text in, AST out.
 *
 * Grammar (SOP/POS, implicit AND allowed):
 *   Expression -> Term ( (OR | '+') Term )*
 *   Term       -> Factor ( (AND | implicit_AND) Factor )*
 *   Factor     -> PRE_NOT* Primary POST_NOT*
 *   Primary    -> VAR | CONST | '(' Expression ')'
 *
 * Accepted notation: '+' '|' '∨' for OR, '*' '·' '.' '&' for AND, "'" postfix
 * and '!' '~' '¬' prefix for NOT. Unknown characters are skipped.
 *
 * Pure module: no React/DOM/network.
 */
import { con, sum, prod, lit, neg, ensureNodeId } from './node.js'
import { normalizeFlat } from './normalize.js'

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
    } else if (ch === '+' || ch === '|' || ch === '∨') {
      tokens.push({ type: 'OR' })
      i++
    } else if (ch === '*' || ch === '·' || ch === '&' || ch === '.') {
      tokens.push({ type: 'AND' })
      i++
    } else if (ch === "'") {
      tokens.push({ type: 'POST_NOT' })
      i++
    } else if (ch === '!' || ch === '~' || ch === '¬') {
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

/** Parses a Boolean expression string. Empty/invalid input yields the constant 0. */
export function parseExpr(str) {
  if (!str || typeof str !== 'string') return con(0)
  const tokens = tokenize(str.trim())
  const parser = new BooleanParser(tokens)
  const tree = parser.parse()
  return ensureNodeId(tree)
}

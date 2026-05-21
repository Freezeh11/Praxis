/**
 * ExprText — renders a plain nodeText() string with proper overline bars
 * instead of apostrophes for negated literals.
 *
 * Rules:
 *   X'        →  overline on "X"
 *   (A+B)'    →  overline spanning "(A+B)" (parens kept, bar over all)
 *   X''       →  plain "X"  (double negation collapses)
 *   everything else → plain text
 */
export default function ExprText({ text, className = '' }) {
  if (!text) return null
  return <span className={className}>{renderTokens(tokenize(text))}</span>
}

function renderTokens(tokens) {
  return tokens.map((tok, i) => {
    if (tok.type === 'overline-lit') {
      // Single negated literal — text-decoration:overline tight against the letter
      return (
        <span key={i} style={{ textDecoration: 'overline' }}>
          {tok.value}
        </span>
      )
    }
    if (tok.type === 'overline-group') {
      // Negated group — border-top spans the whole group (higher than any inner bars)
      // Recursively tokenise inner content so nested primes also render as bars
      return (
        <span key={i} style={{
          borderTop: '1.8px solid currentColor',
          paddingTop: '4px',
          display: 'inline-block',
        }}>
          ({renderTokens(tokenize(tok.value))})
        </span>
      )
    }
    return <span key={i}>{tok.value}</span>
  })
}

/**
 * Tokenises a nodeText string into { type: 'plain'|'overline', value: string } tokens.
 *
 * Handles:
 *   X'        → overline "X"
 *   (…)'      → overline "(…)"   ← parens included so bar is clearly a group bar
 *   X''       → plain "X"        ← double negation
 *   rest      → plain text
 */
function tokenize(str) {
  const parts = []
  let i = 0

  const appendPlain = (ch) => {
    if (parts.length > 0 && parts[parts.length - 1].type === 'plain') {
      parts[parts.length - 1].value += ch
    } else {
      parts.push({ type: 'plain', value: ch })
    }
  }

  while (i < str.length) {
    // ── Grouped negation: (…)'  ──────────────────────────────────────────
    if (str[i] === '(') {
      const close = findClose(str, i)
      if (close !== -1 && str[close + 1] === "'") {
        const group = str.slice(i, close + 1) // includes ( and )
        const doubleNeg = str[close + 2] === "'"
        if (doubleNeg) {
          // (…)'' → double negation → render the inner content plain (no bar)
          // Recursively tokenise the inner content
          const inner = tokenize(str.slice(i + 1, close))
          inner.forEach(t => parts.push(t))
          i = close + 3
        } else {
          // (…)' → overline-group, store INNER content (no parens) — renderer adds them
          const inner = str.slice(i + 1, close)
          parts.push({ type: 'overline-group', value: inner })
          i = close + 2
        }
        continue
      }
    }

    // ── Single-letter negation: X'  ──────────────────────────────────────
    if (/[A-Za-z0-9]/.test(str[i]) && str[i + 1] === "'") {
      const doubleNeg = str[i + 2] === "'"
      if (doubleNeg) {
        // X'' → double negation → plain X
        appendPlain(str[i])
        i += 3
      } else {
        parts.push({ type: 'overline-lit', value: str[i] })
        i += 2
      }
      continue
    }

    // ── Anything else: plain character ───────────────────────────────────
    appendPlain(str[i])
    i++
  }

  return parts
}

/** Returns the index of the matching closing paren, or -1 */
function findClose(str, openIdx) {
  let depth = 0
  for (let k = openIdx; k < str.length; k++) {
    if (str[k] === '(') depth++
    else if (str[k] === ')') {
      depth--
      if (depth === 0) return k
    }
  }
  return -1
}

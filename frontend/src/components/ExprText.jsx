/**
 * ExprText — renders a plain nodeText() string with proper overline bars
 * instead of apostrophes for negated literals.
 *
 * Input:  "x'y + xy + (x + x')'"
 * Output: "x̄y + xy + (x + x̄)̄"  (using CSS text-decoration: overline)
 *
 * Parsing rules:
 *  - A single letter followed by ' → overlined letter
 *  - (…)' → overlined group
 *  - Everything else → plain text
 */
export default function ExprText({ text, className = '' }) {
  if (!text) return null
  const parts = tokenize(text)
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.type === 'overline-lit') {
          return <span key={i} style={{ textDecoration: 'overline' }}>{p.value}</span>
        }
        if (p.type === 'overline-group') {
          return <span key={i} style={{ textDecoration: 'overline' }}>{p.value}</span>
        }
        return <span key={i}>{p.value}</span>
      })}
    </span>
  )
}

/**
 * Tokenises a nodeText string into segments for rendering.
 * Handles:
 *   X'  → overline-lit  "X"
 *   (…)'→ overline-group "…"
 *   rest→ plain text
 */
function tokenize(str) {
  const parts = []
  let i = 0
  while (i < str.length) {
    // Try to match a grouped negation:  (…)'
    if (str[i] === '(') {
      const close = findClose(str, i)
      if (close !== -1 && str[close + 1] === "'") {
        // Everything inside the parens gets overlined
        parts.push({ type: 'overline-group', value: str.slice(i + 1, close) })
        i = close + 2
        continue
      }
    }

    // Try to match a single letter followed by '
    if (/[A-Za-z]/.test(str[i]) && str[i + 1] === "'") {
      parts.push({ type: 'overline-lit', value: str[i] })
      i += 2
      continue
    }

    // Plain character — append to last plain segment or create new one
    if (parts.length > 0 && parts[parts.length - 1].type === 'plain') {
      parts[parts.length - 1].value += str[i]
    } else {
      parts.push({ type: 'plain', value: str[i] })
    }
    i++
  }
  return parts
}

/** Find the matching closing paren, returns -1 if not found */
function findClose(str, openIdx) {
  let depth = 0
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === '(') depth++
    else if (str[i] === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

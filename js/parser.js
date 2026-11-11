// ─── Boolean Expression Parser ───────────────────────────────────────────────
// Notation: A-Z = variables, + = OR, * or implicit = AND, ' = NOT (postfix),
//           ! = NOT (prefix), 0/1 = constants, () = grouping

function tokenize(expr) {
  const tokens = [];
  const s = expr.replace(/\s+/g, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/[A-Za-z]/.test(c))      tokens.push({ type: 'VAR',    value: c.toUpperCase() });
    else if (c === '0')           tokens.push({ type: 'CONST',  value: 0 });
    else if (c === '1')           tokens.push({ type: 'CONST',  value: 1 });
    else if (c === '+')           tokens.push({ type: 'PLUS' });
    else if (c === '*' || c === '.') tokens.push({ type: 'STAR' });
    else if (c === '(')           tokens.push({ type: 'LPAREN' });
    else if (c === ')')           tokens.push({ type: 'RPAREN' });
    else if (c === "'")           tokens.push({ type: 'PRIME' });
    else if (c === '!')           tokens.push({ type: 'BANG' });
    else throw new Error(`Invalid character '${c}' at position ${i}`);
  }
  return tokens;
}

class BoolParser {
  constructor(tokens) { this.t = tokens; this.i = 0; }
  peek()    { return this.t[this.i] || null; }
  eat()     { return this.t[this.i++]; }
  isStart(tok) {
    if (!tok) return false;
    return ['VAR','CONST','LPAREN','BANG'].includes(tok.type);
  }
  parseExpr() {
    let n = this.parseTerm();
    while (this.peek()?.type === 'PLUS') { this.eat(); n = { type:'OR',  l:n, r:this.parseTerm() }; }
    return n;
  }
  parseTerm() {
    let n = this.parseFactor();
    while (this.peek() && (this.peek().type === 'STAR' || this.isStart(this.peek()))) {
      if (this.peek().type === 'STAR') this.eat();
      if (!this.isStart(this.peek())) break;
      n = { type:'AND', l:n, r:this.parseFactor() };
    }
    return n;
  }
  parseFactor() {
    if (this.peek()?.type === 'BANG') { this.eat(); return { type:'NOT', c:this.parseFactor() }; }
    let n = this.parseAtom();
    while (this.peek()?.type === 'PRIME') { this.eat(); n = { type:'NOT', c:n }; }
    return n;
  }
  parseAtom() {
    const t = this.peek();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.type === 'VAR')   { this.eat(); return { type:'VAR', v:t.value }; }
    if (t.type === 'CONST') { this.eat(); return { type:'CONST', v:t.value }; }
    if (t.type === 'LPAREN') {
      this.eat();
      const n = this.parseExpr();
      if (this.peek()?.type !== 'RPAREN') throw new Error('Missing closing )');
      this.eat();
      return n;
    }
    throw new Error(`Unexpected token: ${t.type}`);
  }
}

function parseExpr(str) {
  if (!str || !str.trim()) throw new Error('Empty expression');
  const tokens = tokenize(str.trim());
  const p = new BoolParser(tokens);
  const ast = p.parseExpr();
  if (p.i < p.t.length) throw new Error('Unexpected token after expression');
  return ast;
}

function evalAST(ast, env) {
  switch (ast.type) {
    case 'VAR':   return env[ast.v] ?? 0;
    case 'CONST': return ast.v;
    case 'NOT':   return evalAST(ast.c, env) ? 0 : 1;
    case 'AND':   return evalAST(ast.l, env) & evalAST(ast.r, env);
    case 'OR':    return evalAST(ast.l, env) | evalAST(ast.r, env);
  }
}

function collectVars(ast) {
  const s = new Set();
  function w(n) {
    if (n.type === 'VAR') s.add(n.v);
    else if (n.type === 'NOT') w(n.c);
    else if (n.type === 'AND' || n.type === 'OR') { w(n.l); w(n.r); }
  }
  w(ast); return [...s].sort();
}

function complexity(ast) {
  if (!ast) return 0;
  if (ast.type === 'VAR' || ast.type === 'CONST') return 1;
  if (ast.type === 'NOT') return 1 + complexity(ast.c);
  return 1 + complexity(ast.l) + complexity(ast.r);
}

function areEquivalent(a, b) {
  try {
    const a1 = parseExpr(a), a2 = parseExpr(b);
    const vars = [...new Set([...collectVars(a1), ...collectVars(a2)])].sort();
    if (vars.length > 6) return { ok: false, error: 'Too many variables' };
    for (let i = 0; i < (1 << vars.length); i++) {
      const env = {};
      vars.forEach((v, idx) => env[v] = (i >> idx) & 1);
      if (evalAST(a1, env) !== evalAST(a2, env)) return { ok: false };
    }
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

function getComplexity(exprStr) {
  try { return complexity(parseExpr(exprStr)); } catch { return Infinity; }
}

function isFullySimplified(exprStr, answStr) {
  return areEquivalent(exprStr, answStr).ok;
}

// ─── HTML Renderer ────────────────────────────────────────────────────────────
function renderHTML(exprStr) {
  try {
    const ast = parseExpr(exprStr);
    return astToHTML(ast, 0);
  } catch { return `<span class="expr-error">${escapeHTML(exprStr)}</span>`; }
}

function escapeHTML(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// prec: 0=top, 1=or, 2=and, 3=complement-inner
function astToHTML(n, prec) {
  switch (n.type) {
    case 'VAR':   return `<span class="ev">${n.v}</span>`;
    case 'CONST': return `<span class="ec">${n.v}</span>`;
    case 'NOT': {
      const inner = astToHTML(n.c, 3);
      return `<span class="en">${inner}</span>`;
    }
    case 'AND': {
      const L = astToHTML(n.l, 2), R = astToHTML(n.r, 2);
      let s = `${L}${R}`;
      if (prec >= 3) s = `(${s})`;
      return s;
    }
    case 'OR': {
      const L = astToHTML(n.l, 1), R = astToHTML(n.r, 1);
      let s = `${L}<span class="eo">+</span>${R}`;
      if (prec >= 2) s = `(${s})`;
      return s;
    }
  }
}

// moves.js — Pattern detection & transformation

// ── Structural helpers ────────────────────────────────────────────────────────
function astEq(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'VAR')   return a.v === b.v;
  if (a.type === 'CONST') return a.v === b.v;
  if (a.type === 'NOT')   return astEq(a.c, b.c);
  return astEq(a.l, b.l) && astEq(a.r, b.r);
}
function notOf(n)    { return { type:'NOT', c:n }; }
function andOf(l,r)  { return { type:'AND', l, r }; }
function orOf(l,r)   { return { type:'OR',  l, r }; }
function constN(v)   { return { type:'CONST', v }; }
function isOne(n)    { return n.type==='CONST' && n.v===1; }
function isZero(n)   { return n.type==='CONST' && n.v===0; }
function isCompl(a,b){ return (a.type==='NOT'&&astEq(a.c,b))||(b.type==='NOT'&&astEq(b.c,a)); }

function getFactors(n) {
  return n.type==='AND' ? [...getFactors(n.l),...getFactors(n.r)] : [n];
}
function getOrTerms(n) {
  return n.type==='OR' ? [...getOrTerms(n.l),...getOrTerms(n.r)] : [n];
}
function buildOr(terms) {
  return terms.reduce((a,t) => a ? orOf(a,t) : t, null);
}
function buildAnd(terms) {
  return terms.reduce((a,t) => a ? andOf(a,t) : t, null);
}

// ── Path utilities ────────────────────────────────────────────────────────────
function getAtPath(ast, path) {
  let n = ast;
  for (const d of path) n = n[d];
  return n;
}
function setAtPath(ast, path, val) {
  if (!path.length) return val;
  const [h,...rest] = path;
  return { ...ast, [h]: setAtPath(ast[h], rest, val) };
}

// ── Move detection ────────────────────────────────────────────────────────────
function findMoves(ast) {
  const moves = [];
  let uid = 0;
  const add = (path, law, label, result, extra={}) => {
    moves.push({ id:`m${uid++}`, path, law, label, result, ...extra });
  };

  function walk(node, path) {
    if (node.type === 'AND') {
      const {l,r} = node;
      if (isOne(r))             add(path,'identity','Identity Law', l);
      if (isOne(l))             add(path,'identity','Identity Law', r);
      if (isZero(l)||isZero(r)) add(path,'null',    'Null Law',     constN(0));
      if (astEq(l,r))           add(path,'idempotent','Idempotent Law', l);
      if (isCompl(l,r))         add(path,'complement','Complement Law', constN(0));

      // Distributive (expand): A(B+C) = AB+AC
      if (r.type === 'OR')
        add(path,'distributive','Distributive Law', orOf(andOf(l,r.l),andOf(l,r.r)));
      if (l.type === 'OR')
        add(path,'distributive','Distributive Law', orOf(andOf(l.l,r),andOf(l.r,r)));
    }

    if (node.type === 'OR') {
      const {l,r} = node;
      if (isZero(r))            add(path,'identity','Identity Law', l);
      if (isZero(l))            add(path,'identity','Identity Law', r);
      if (isOne(l)||isOne(r))   add(path,'null',    'Null Law',     constN(1));
      if (astEq(l,r))           add(path,'idempotent','Idempotent Law', l);
      if (isCompl(l,r))         add(path,'complement','Complement Law', constN(1));

      // Absorption & Factoring across all OR terms
      const terms = getOrTerms(node);
      const seen = new Set();

      for (let i=0; i<terms.length; i++) {
        for (let j=0; j<terms.length; j++) {
          if (i===j) continue;
          const fi = getFactors(terms[i]);
          const fj = getFactors(terms[j]);
          // Absorption: terms[i] factors ⊆ terms[j] factors → terms[j] absorbed by terms[i]
          if (fi.every(f => fj.some(g => astEq(f,g)))) {
            const key = `abs-${j}`;
            if (!seen.has(key)) {
              seen.add(key);
              const rem = terms.filter((_,k)=>k!==j);
              add(path,'absorption','Absorption Law', buildOr(rem));
            }
          }
        }
        // Factoring: find first pair sharing a common factor
        for (let j=i+1; j<terms.length; j++) {
          const fi = getFactors(terms[i]);
          const fj = getFactors(terms[j]);
          const common = fi.filter(f => fj.some(g => astEq(f,g)));
          if (common.length) {
            const fac = common[0];
            const restI = fi.filter(f=>!astEq(f,fac));
            const restJ = fj.filter(f=>!astEq(f,fac));
            const iL = restI.length ? buildAnd(restI) : constN(1);
            const iR = restJ.length ? buildAnd(restJ) : constN(1);
            const factored = andOf(fac, orOf(iL,iR));
            const others = terms.filter((_,k)=>k!==i&&k!==j);
            const result = others.length ? orOf(buildOr(others), factored) : factored;
            const key = `fac-${i}-${j}`;
            if (!seen.has(key)) {
              seen.add(key);
              add(path,'distributive','Distributive Law', result, {termI:i, termJ:j});
            }
            break;
          }
        }
      }
    }

    if (node.type === 'NOT') {
      const {c} = node;
      if (c.type==='NOT')
        add(path,'double_neg','Double Negation', c.c);
      if (c.type==='AND')
        add(path,'demorgan',"De Morgan's", orOf(notOf(c.l),notOf(c.r)));
      if (c.type==='OR')
        add(path,'demorgan', "De Morgan's", andOf(notOf(c.l),notOf(c.r)));
    }

    // Recurse
    if (node.c) walk(node.c, [...path,'c']);
    if (node.l) walk(node.l, [...path,'l']);
    if (node.r) walk(node.r, [...path,'r']);
  }

  walk(ast, []);
  return moves;
}

function applyMove(ast, move) {
  return setAtPath(ast, move.path, move.result);
}

// AST → canonical string (for display after transformation)
function astToStr(n) {
  if (!n) return '';
  if (n.type==='VAR')   return n.v;
  if (n.type==='CONST') return String(n.v);
  if (n.type==='NOT')   return `(${astToStr(n.c)})'`;
  if (n.type==='AND') {
    const L = n.l.type==='OR' ? `(${astToStr(n.l)})` : astToStr(n.l);
    const R = n.r.type==='OR' ? `(${astToStr(n.r)})` : astToStr(n.r);
    return L+R;
  }
  if (n.type==='OR')  return `${astToStr(n.l)}+${astToStr(n.r)}`;
  return '';
}

/* ===== TREE NODES ===== */
function lit(v,n=false){return{type:'lit',v,n}}
function con(val){return{type:'const',val}}
function prod(...f){return{type:'prod',factors:f}}
function sum(...t){return{type:'sum',terms:t}}
function neg(child){return{type:'not',child}}
function cloneN(n){
  if(n.type==='lit')return{...n};if(n.type==='const')return{...n};
  if(n.type==='prod')return{type:'prod',factors:n.factors.map(cloneN)};
  if(n.type==='sum')return{type:'sum',terms:n.terms.map(cloneN)};
  if(n.type==='not')return{type:'not',child:cloneN(n.child)};
}

/* ===== PARSE SOP STRING → TREE ===== */
function splitTopLevel(str){
  // Split on ' + ' but not inside parentheses
  const parts=[];let depth=0,cur='';
  for(let i=0;i<str.length;i++){
    if(str[i]==='(')depth++;
    else if(str[i]===')')depth--;
    if(depth===0&&str.slice(i,i+3)===' + '){parts.push(cur);cur='';i+=2;}
    else cur+=str[i];
  }
  parts.push(cur);return parts;
}
function parseTerm(t){
  if(t==='1')return con(1);if(t==='0')return con(0);
  // NOT-compound: (expr)'
  if(t.startsWith('(')&&t.endsWith(")'")){return neg(parseExpr(t.slice(1,-2)));}
  const ls=[];for(let i=0;i<t.length;i++){const v=t[i];if(v===' ')continue;const n=i+1<t.length&&t[i+1]==="'";ls.push(lit(v,n));if(n)i++;}
  return ls.length===1?ls[0]:prod(...ls);
}
function parseExpr(str){
  const terms=splitTopLevel(str).map(parseTerm);
  return terms.length===1?terms[0]:sum(...terms);
}

/* ===== TREE → TEXT ===== */
function nodeText(n){
  if(n.type==='lit')return n.n?n.v+'\u0305':n.v;
  if(n.type==='const')return ''+n.val;
  if(n.type==='prod')return n.factors.map(f=>f.type==='sum'?'('+nodeText(f)+')':nodeText(f)).join('');
  if(n.type==='sum')return n.terms.map(nodeText).join(' + ');
  if(n.type==='not'){const inner=nodeText(n.child);return(n.child.type==='sum'||n.child.type==='prod')?'('+inner+")'":inner+"'";}  
}

/* Canonical text: sorts literals in products and terms in sums for order-independent comparison */
function canonText(n){
  if(n.type==='lit')return n.n?n.v+"'":n.v;
  if(n.type==='const')return ''+n.val;
  if(n.type==='prod'){
    const lits=[],others=[];
    n.factors.forEach(f=>{if(f.type==='lit')lits.push(f);else others.push(f);});
    lits.sort((a,b)=>a.v.localeCompare(b.v)||(a.n?1:0)-(b.n?1:0));
    const litStr=lits.map(l=>canonText(l)).join('');
    const otherStr=others.map(f=>f.type==='sum'?'('+canonText(f)+')':canonText(f)).join('');
    return litStr+otherStr;
  }
  if(n.type==='sum'){
    const ts=n.terms.map(canonText);ts.sort();return ts.join('+');
  }
  if(n.type==='not')return '('+canonText(n.child)+")'";
}

/* ===== NORMALIZE ===== */
function normalize(n){
  if(n.type==='lit'||n.type==='const')return n;
  if(n.type==='prod'){
    let fs=n.factors.map(normalize);
    // flatten nested prods
    let flat=[];fs.forEach(f=>f.type==='prod'?flat.push(...f.factors):flat.push(f));
    flat=flat.filter(f=>!(f.type==='const'&&f.val===1));
    if(flat.some(f=>f.type==='const'&&f.val===0))return con(0);
    if(flat.length===0)return con(1);if(flat.length===1)return flat[0];
    return{type:'prod',factors:flat};
  }
  if(n.type==='sum'){
    let ts=n.terms.map(normalize);
    // flatten nested sums (mirrors how prod flattens nested prods)
    let flat=[];ts.forEach(t=>t.type==='sum'?flat.push(...t.terms):flat.push(t));
    flat=flat.filter(t=>!(t.type==='const'&&t.val===0));
    if(flat.some(t=>t.type==='const'&&t.val===1))return con(1);
    if(flat.length===0)return con(0);if(flat.length===1)return flat[0];
    return{type:'sum',terms:flat};
  }
  if(n.type==='not'){const child=normalize(n.child);if(child.type==='const')return con(1-child.val);return{type:'not',child};}
  return n;
}

/* Structure-only normalize: flattens nested sums/prods but does NOT auto-apply
   identity, annulment, or zero laws — used by Distributive so intermediate
   steps like y(x+1) are shown instead of being collapsed automatically. */
function normalizeFlat(n){
  if(n.type==='lit'||n.type==='const')return n;
  if(n.type==='not')return{type:'not',child:normalizeFlat(n.child)};
  if(n.type==='prod'){
    let fs=n.factors.map(normalizeFlat);
    let flat=[];fs.forEach(f=>f.type==='prod'?flat.push(...f.factors):flat.push(f));
    if(flat.length===0)return con(1);if(flat.length===1)return flat[0];
    return{type:'prod',factors:flat};
  }
  if(n.type==='sum'){
    let ts=n.terms.map(normalizeFlat);
    let flat=[];ts.forEach(t=>t.type==='sum'?flat.push(...t.terms):flat.push(t));
    if(flat.length===0)return con(0);if(flat.length===1)return flat[0];
    return{type:'sum',terms:flat};
  }
  return n;
}

/* ===== TREE NAVIGATION ===== */
function getNode(root,path){
  if(path==='R')return root;
  const parts=path.slice(2).split('.').map(Number);
  let n=root;
  for(const i of parts){
    if(n.type==='sum')n=n.terms[i];
    else if(n.type==='prod')n=n.factors[i];
    else if(n.type==='not')n=n.child; // child is always index 0 in path
    else return null;
    if(!n)return null;
  }
  return n;
}

/* Replace a node at path in a cloned tree */
function setNode(root,path,newNode){
  if(path==='R')return newNode;
  const parts=path.slice(2).split('.').map(Number);
  let n=root;
  for(let i=0;i<parts.length-1;i++){
    const idx=parts[i];
    if(n.type==='sum')n=n.terms[idx];
    else if(n.type==='prod')n=n.factors[idx];
    else if(n.type==='not')n=n.child;
  }
  const last=parts[parts.length-1];
  if(n.type==='sum')n.terms[last]=newNode;
  else if(n.type==='prod')n.factors[last]=newNode;
  else if(n.type==='not')n.child=newNode;
  return root;
}

function findCommonSum(root,p1,p2){
  const a=p1.split('.'),b=p2.split('.');
  let common=[];
  for(let i=0;i<Math.min(a.length,b.length);i++){if(a[i]===b[i])common.push(a[i]);else break;}
  const cp=common.join('.');
  const node=getNode(root,cp);
  if(node&&node.type==='sum')return{sumPath:cp,sumNode:node,ti1:parseInt(a[common.length]),ti2:parseInt(b[common.length])};
  return null;
}

function removeLitFromNode(node,v,n){
  if(node.type==='lit'&&node.v===v&&node.n===n)return con(1);
  if(node.type==='prod'){
    let removed=false;
    const nf=[];
    for(const f of node.factors){
      if(!removed&&f.type==='lit'&&f.v===v&&f.n===n){removed=true;}else nf.push(cloneN(f));
    }
    if(nf.length===0)return con(1);if(nf.length===1)return nf[0];
    return{type:'prod',factors:nf};
  }
  return cloneN(node);
}

function termContainsLit(node,v,n){
  if(node.type==='lit')return node.v===v&&node.n===n;
  if(node.type==='prod')return node.factors.some(f=>f.type==='lit'&&f.v===v&&f.n===n);
  return false;
}

/* ===== LAWS ===== */
const LAWS=[
  {id:'complement',name:'Complement Law',formulas:['A + A\u0305 = 1'],desc:'A variable OR its complement equals 1.'},
  {id:'idempotent',name:'Idempotent Law',formulas:['A + A = A'],desc:'Duplicate terms can be removed.'},
  {id:'absorption',name:'Absorption Law',formulas:['A + AB = A'],desc:'A shorter term absorbs a longer one containing it.'},
  {id:'identity',name:'Identity Law',formulas:['A + 0 = A','A \u00b7 1 = A'],desc:'OR with 0 or AND with 1 keeps the original.'},
  {id:'annulment',name:'Annulment Law',formulas:['A + 1 = 1','A \u00b7 0 = 0'],desc:'OR with 1 is always 1.'},
  {id:'distributive',name:'Distributive (Factor)',formulas:['AB + AC = A(B+C)'],desc:'Factor out common variables from terms.'},
  {id:'double-neg',name:'Double Negation',formulas:["(A')' = A"],desc:'Negating a value twice returns the original.'},
  {id:'demorgan-and',name:"De Morgan's (AND)",formulas:["(AB)' = A' + B'"],desc:'The complement of a product equals the sum of complements.'},
  {id:'demorgan-or',name:"De Morgan's (OR)",formulas:["(A+B)' = A'B'"],desc:'The complement of a sum equals the product of complements.'},
  {id:'associative',name:'Associative Law',formulas:['A+(B+C) = (A+B)+C','A(BC) = (AB)C'],desc:'Terms can be regrouped freely. Use drag-and-drop to reorder!'},
];

/* ===== LEVELS ===== */
const LEVELS=[
  {id:1,name:'Level 1',desc:'Two-variable expressions',varCount:2,puzzles:[
    // 1. Absorption
    {expr:'xy + y',goal:'y',hints:['y is shorter than xy.','y absorbs xy because xy contains y.','Absorption Law: A + AB = A — click y and x to show it.']},
    // 2. Idempotent → Distributive → Complement
    {expr:'xy + xy + x\'y',goal:'y',hints:['Two identical xy terms — remove the duplicate first (Idempotent).','Now xy + x\u0305y — both share y.','Factor out y, then x + x\u0305 = 1 inside the brackets.']},
    // 3. Distributive → Complement
    {expr:'xy + xy\'',goal:'x',hints:['Both terms share x.','Click y and y\u0305 — same variable, opposite signs.','Factor out x, then y + y\u0305 = 1, leaving x.']},
    // 4. De Morgan's → Idempotent
    {expr:"(xy)' + x' + y'",goal:"x' + y'",hints:["Click the (xy)' group to apply De Morgan's Law.","(xy)' expands to x\u0305 + y\u0305.","Now remove the duplicate x\u0305 and y\u0305 with Idempotent."]},
    // 5. Double Negation → Absorption → Complement
    {expr:"(x')' + xy + x'",goal:'1',hints:["Click (x\u0305)' — Double Negation turns it into x.","x absorbs xy (Absorption).","x + x\u0305 — Complement Law gives 1."]},
    // 6. De Morgan's → Absorption
    {expr:"(xy)' + x'y",goal:"x' + y'",hints:["Click (xy)' — De Morgan's expands it to x\u0305 + y\u0305.","Now x\u0305 + y\u0305 + x\u0305y — x\u0305 absorbs x\u0305y.","Result: x\u0305 + y\u0305."]},
  ]},
  {id:2,name:'Level 2',desc:'Three-variable expressions',varCount:3,puzzles:[
    // 1. Absorption
    {expr:'xz + xyz',goal:'xz',hints:['xz is shorter than xyz.','xz absorbs xyz since xz\u2019s literals are a subset of xyz\u2019s.','Absorption Law — click x from xz and x from xyz.']},
    // 2. Idempotent → Distributive → Complement
    {expr:'xyz + xyz + xy\'z',goal:'xz',hints:['Two xyz terms are identical — use Idempotent first.','After removing the duplicate: xyz + xy\u0305z.','Factor out xz, then y + y\u0305 = 1 inside.']},
    // 3. Distributive chain (4 terms → 1)
    {expr:'xyz + xy\'z + x\'yz + x\'y\'z',goal:'z',hints:['All four terms share z.','Pair xyz + xy\u0305z — they differ only in y — factor out xz.','Keep pairing until only z remains.']},
    // 4. Absorption → Distributive → Complement
    {expr:'xyz + xz + x\'z',goal:'z',hints:['xz absorbs xyz — use Absorption first.','Now xz + x\u0305z remain — factor out z.','Inside: x + x\u0305 = 1, so z\u00b71 = z.']},
    // 5. De Morgan's → Idempotent
    {expr:"(xy)' + (xy)' + z",goal:"x' + y' + z",hints:["Two identical (xy)' terms — click both and use Idempotent.","Now (xy)' + z — click (xy)' and apply De Morgan's.","(xy)' expands to x\u0305 + y\u0305, giving x\u0305 + y\u0305 + z."]},
    // 6. Double Negation → Absorption ×2
    {expr:"(z')' + xyz + xyz'",goal:'z',hints:["Click (z\u0305)' — Double Negation gives z.","z absorbs xyz (Absorption).","z absorbs xyz\u0305 too — z is left."]},
  ]},
  {id:3,name:'Level 3 — Boss',desc:'Four-variable challenge',varCount:4,puzzles:[
    // 1. Absorption
    {expr:'xyz + xyzw',goal:'xyz',hints:['xyz is shorter than xyzw.','xyz absorbs xyzw.','Absorption: click x from each term.']},
    // 2. Idempotent → Distributive → Complement
    {expr:'xyzw + xyzw + xyzw\'',goal:'xyz',hints:['Two xyzw terms — remove the duplicate (Idempotent).','xyzw + xyzw\u0305 — factor out xyz.','xyz(w + w\u0305) → Complement inside → xyz.']},
    // 3. Distributive chain (4 terms)
    {expr:'xyzw + xy\'zw + xyzw\' + xy\'zw\'',goal:'xz',hints:['Pair xyzw + xy\u0305zw — factor out xzw.','Then xyzw\u0305 + xy\u0305zw\u0305 — factor out xzw\u0305.','Finally xzw + xzw\u0305 — factor out xz, then w + w\u0305 = 1.']},
    // 4. De Morgan's → Idempotent → De Morgan's again
    {expr:"(xy)' + (xy)' + z'w'",goal:"x' + y' + z'w'",hints:["Click both (xy)' terms and use Idempotent to remove the duplicate.","Now click (xy)' and apply De Morgan's Law.","(xy)' = x\u0305 + y\u0305, giving x\u0305 + y\u0305 + z\u0305w\u0305."]},
    // 5. Idempotent → Double Negation → Absorption ×2
    {expr:"(x')' + (x')' + xyz + xyw",goal:'x',hints:["Two identical (x\u0305)' terms — use Idempotent to remove the duplicate.","Click (x\u0305)' — Double Negation gives x.","x absorbs xyz and x absorbs xyw — Absorption twice leaves x."]},
    // 6. Full mix: Idempotent → De Morgan's → Absorption → De Morgan's
    {expr:"(xy)' + (xy)' + (z + w)' + x'y'",goal:"x' + y' + z'w'",hints:["Start with Idempotent: two (xy)' terms.","Apply De Morgan's to (xy)' → x\u0305 + y\u0305.","x\u0305 absorbs x\u0305y\u0305 (Absorption), then De Morgan's on (z+w)' → z\u0305w\u0305."]},
  ]},
];



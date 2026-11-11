// ─── Game State ───────────────────────────────────────────────────────────────
const G = {
  problem: null,
  ast: null,
  history: [],
  moves: [],
  taps: 0,
  streak: 0,
  completed: {},
  tier: 1,
};
const $ = id => document.getElementById(id);

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildPath();
  
  $('btn-close-lesson').addEventListener('click', showHome);
  $('btn-undo').addEventListener('click', undo);
  $('btn-reset').addEventListener('click', () => loadProblem(G.problem));
  $('btn-hint').addEventListener('click', showHint);
  $('btn-modal-continue').addEventListener('click', () => { closeModal(); showHome(); });
  
  showHome();
});

// ─── Views ────────────────────────────────────────────────────────────────────
function showHome() {
  $('view-lesson').classList.remove('show');
  $('view-home').classList.add('show');
  buildPath(); // Refresh path to show new crowns/completion
}

function showLesson() {
  $('view-home').classList.remove('show');
  $('view-lesson').classList.add('show');
}

// ─── Path Building ────────────────────────────────────────────────────────────
function buildPath() {
  const container = $('path-container');
  container.innerHTML = '';

  TIER_INFO.forEach((tier, index) => {
    const section = document.createElement('div');
    section.className = 'path-section';
    
    // Tier Header
    const header = document.createElement('div');
    header.className = 'tier-header';
    header.style.backgroundColor = tier.color;
    header.textContent = `Unit ${tier.tier}: ${tier.name}`;
    section.appendChild(header);

    // Nodes for this tier
    const probs = getProblemsByTier(tier.tier);
    probs.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'node-row';
      
      const btn = document.createElement('button');
      btn.className = 'node-btn';
      
      // Determine state
      const isCompleted = !!G.completed[p.id];
      // A node is 'current' if it's the first uncompleted node we find
      // For simplicity in this demo, let's just make everything unlocked, but color completed ones
      
      if (isCompleted) {
        btn.style.backgroundColor = '#ffc800'; // Gold for complete
        btn.innerHTML = '⭐';
      } else {
        btn.style.backgroundColor = tier.color;
        btn.innerHTML = '⭐';
      }
      
      // Offset nodes slightly to create a zig-zag path effect
      const offset = (i % 2 === 0) ? -30 : 30;
      btn.style.transform = `translateX(${offset}px)`;
      // Reset transform on active so click animation works
      btn.onmousedown = () => { if(!btn.classList.contains('locked')) btn.style.transform = `translateX(${offset}px) translateY(6px)`; };
      btn.onmouseup = () => { if(!btn.classList.contains('locked')) btn.style.transform = `translateX(${offset}px)`; };
      btn.onmouseleave = () => { if(!btn.classList.contains('locked')) btn.style.transform = `translateX(${offset}px)`; };

      btn.onclick = () => {
        btn.style.transform = `translateX(${offset}px)`;
        loadProblem(p);
      };
      
      row.appendChild(btn);
      section.appendChild(row);
    });

    container.appendChild(section);
  });
}

// ─── Load Problem ─────────────────────────────────────────────────────────────
function loadProblem(problem) {
  G.problem = problem;
  G.ast     = parseExpr(problem.expr);
  G.history = [];
  G.taps    = 0;
  
  $('hint-area').innerHTML = '';
  $('btn-hint').disabled = false;
  $('btn-hint').textContent = '💡 Hint';
  $('law-toast').className = 'law-toast';
  $('stuck-msg').textContent = '';

  $('lesson-title').textContent = problem.title;
  $('lesson-scenario').textContent = problem.scenario || 'Simplify the logic circuit to proceed.';
  $('btn-undo').disabled = true;

  updateProgress();
  showLesson();
  render();
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  G.moves = findMoves(G.ast);
  const moveMap = {};
  G.moves.forEach(m => { moveMap[JSON.stringify(m.path)] = m; });

  function renderNode(node, path) {
    const move = moveMap[JSON.stringify(path)];
    const inner = renderContent(node, path);
    if (move) {
      return `<span class="expr-chip clickable law-${move.law}"
        data-mid="${move.id}" title="${move.label}"
        role="button" tabindex="0"
        onclick="handleMove(event,'${move.id}')"
        onkeydown="if(event.key==='Enter')handleMove(event,'${move.id}')"
        >${inner}</span>`;
    }
    return `<span class="expr-chip">${inner}</span>`;
  }

  function renderContent(node, path) {
    if (node.type === 'VAR')   return `<span class="ev">${node.v}</span>`;
    if (node.type === 'CONST') return `<span class="ec">${node.v}</span>`;
    if (node.type === 'NOT')   return `<span class="en">${renderNode(node.c, [...path,'c'])}</span>`;
    if (node.type === 'AND') {
      const L = renderNode(node.l, [...path,'l']);
      const R = renderNode(node.r, [...path,'r']);
      const needDot = node.l.type === 'CONST' || node.r.type === 'CONST';
      return needDot ? `${L}<span class="edot">·</span>${R}` : `${L}${R}`;
    }
    if (node.type === 'OR') {
      const L = renderNode(node.l, [...path,'l']);
      const R = renderNode(node.r, [...path,'r']);
      return `${L}<span class="eo">+</span>${R}`;
    }
    return '';
  }

  $('expr-live').innerHTML = renderNode(G.ast, []);

  const n = G.moves.length;
  $('moves-badge').textContent = n ? 'TAP A GLOWING PIECE!' : 'GREAT JOB!';
  $('moves-badge').className = 'moves-badge' + (n ? ' has-moves' : ' done');

  if (n === 0 && G.taps > 0) checkCompletion();
}

function updateProgress() {
  // Simple heuristic: progress is based on taps vs reference solution length
  const ref = G.problem.solution.length;
  let pct = 0;
  if (ref === 0) pct = 100;
  else {
    // Every valid tap moves us closer, but cap at 90% until fully solved
    pct = Math.min(90, (G.taps / ref) * 100);
  }
  
  // If fully simplified, it hits 100% in checkCompletion
  $('lesson-progress').style.width = `${pct}%`;
}

// ─── Handle Move ──────────────────────────────────────────────────────────────
function handleMove(event, moveId) {
  event.stopPropagation();
  const move = G.moves.find(m => m.id === moveId);
  if (!move) return;

  G.history.push(G.ast);
  G.ast = applyMove(G.ast, move);
  G.taps++;
  
  $('btn-undo').disabled = false;
  $('stuck-msg').textContent = '';

  showToast(move.label, move.law);
  updateProgress();
  render();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
const LAW_EMOJI = {
  identity:'🔵', null:'⚫', idempotent:'♾️', complement:'💥',
  double_neg:'↩️', absorption:'🌊', distributive:'✂️',
  demorgan:'⚡', consensus:'🎯'
};
function showToast(label, law) {
  const t = $('law-toast');
  t.textContent = `${LAW_EMOJI[law]||'✨'} ${label}`;
  t.className = 'law-toast show';
  clearTimeout(t._tmr);
  t._tmr = setTimeout(() => { t.className = 'law-toast'; }, 1800);
}

// ─── Undo ─────────────────────────────────────────────────────────────────────
function undo() {
  if (!G.history.length) return;
  G.ast = G.history.pop();
  G.taps = Math.max(0, G.taps - 1);
  $('btn-undo').disabled = G.history.length === 0;
  updateProgress();
  render();
}

// ─── Hint ─────────────────────────────────────────────────────────────────────
function showHint() {
  const hints = G.problem?.hints || [];
  const used  = $('hint-area').children.length;
  if (used >= hints.length) { $('btn-hint').disabled = true; return; }
  const el = document.createElement('div');
  el.className = 'hint-pill';
  el.textContent = hints[used];
  $('hint-area').appendChild(el);
  if (used + 1 >= hints.length) {
    $('btn-hint').disabled = true;
    $('btn-hint').textContent = '💡 No more hints';
  }
}

// ─── Completion ───────────────────────────────────────────────────────────────
function checkCompletion() {
  const p = G.problem;
  const current = astToStr(G.ast);
  if (!areEquivalent(current, p.answer).ok) {
    $('stuck-msg').textContent = "Looks like a dead end. Try Undo or Restart.";
    return;
  }
  
  $('lesson-progress').style.width = `100%`;
  
  G.streak++;
  $('home-streak').textContent = G.streak;
  
  const ref  = p.solution.length;
  const stars = G.taps <= ref ? 3 : G.taps <= ref + 2 ? 2 : 1;
  G.completed[p.id] = { taps: G.taps, stars };
  
  setTimeout(() => showModal(p, G.taps, ref, stars), 600); // Wait for progress bar animation
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function showModal(p, taps, ref, stars) {
  $('m-title').textContent = stars===3 ? 'Perfect!' : stars===2 ? 'Great Job!' : 'Lesson Complete!';
  
  // Duolingo style colors for modal banner
  const banner = document.querySelector('.modal-banner');
  banner.style.backgroundColor = stars===3 ? 'var(--yellow)' : stars===2 ? 'var(--green)' : 'var(--blue)';
  
  $('m-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('m-taps').textContent  = taps;
  $('m-ref').textContent   = ref;

  const sol = $('m-solution');
  sol.innerHTML = `<div class="sol-row start">${renderHTML(p.expr)}</div>`;
  p.solution.forEach(s => {
    const ll = LAWS.find(l => l.id === s.law)?.label || s.law;
    sol.innerHTML += `<div class="sol-row">
      <span class="sarr">→</span>
      <span class="sexpr">${renderHTML(s.expr)}</span>
      <span class="snote">${ll}</span></div>`;
  });

  $('modal-overlay').classList.add('show');
}
function closeModal() { $('modal-overlay').classList.remove('show'); }

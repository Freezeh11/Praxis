/* ===== STATE ===== */
const state={xp:0,bestStreak:0,streak:0,currentLevel:0,currentPuzzle:0,levelsCompleted:new Set(),
  expr:null,sel:[],steps:[],exprHistory:[],originalExpr:null,hintIdx:0,hintsUsed:0,goalText:'',goalCanon:'',hintTimer:null,hintsOn:false};

/* ===== DRAG STATE ===== */
let _dragSrc={sumPath:null,idx:null};
const $=id=>document.getElementById(id);
const screens={home:$('screen-home'),levels:$('screen-levels'),game:$('screen-game'),complete:$('screen-complete'),reference:$('screen-reference')};
function showScreen(n){Object.values(screens).forEach(s=>s.classList.remove('active'));screens[n].classList.add('active');}
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('visible');setTimeout(()=>t.classList.remove('visible'),2200);}
function burstP(x,y,col){const c=$('particle-container');for(let i=0;i<18;i++){const p=document.createElement('div');p.className='particle';const a=Math.PI*2*i/18,d=40+Math.random()*60;p.style.left=x+'px';p.style.top=y+'px';p.style.background=col;p.style.setProperty('--tx',Math.cos(a)*d+'px');p.style.setProperty('--ty',Math.sin(a)*d+'px');c.appendChild(p);setTimeout(()=>p.remove(),850);}}
function updateHome(){$('home-total-xp').textContent=state.xp;$('home-levels-done').textContent=state.levelsCompleted.size+'/'+LEVELS.length;$('home-streak').textContent=state.bestStreak;}

/* ===== RENDER TREE → DOM ===== */
function renderExpression(){
  const disp=$('expr-display');disp.innerHTML='';
  if(!state.expr)return;
  disp.appendChild(renderNode(state.expr,'R',null));
  markRelated();
  if(state.hintsOn)applyHints();
}

function renderNode(node,path,parentType){
  if(node.type==='lit'){
    const el=document.createElement('span');el.className='expr-literal';
    el.dataset.path=path;el.dataset.varName=node.v;el.dataset.neg=node.n?'1':'0';
    if(node.n)el.classList.add('overbar');
    el.textContent=node.v;
    if(state.sel.some(s=>s.path===path))el.classList.add('selected');
    el.addEventListener('click',e=>{e.stopPropagation();clickLit(path);});
    el.addEventListener('mouseenter',()=>hlVar(node.v,true));
    el.addEventListener('mouseleave',()=>hlVar(node.v,false));
    return el;
  }
  if(node.type==='const'){
    const el=document.createElement('span');el.className='expr-literal expr-const';
    el.dataset.path=path;el.textContent=''+node.val;
    if(state.sel.some(s=>s.path===path))el.classList.add('selected');
    el.addEventListener('click',e=>{e.stopPropagation();clickLit(path);});
    return el;
  }
  if(node.type==='prod'){
    const wrap=document.createElement('span');wrap.className='expr-prod';
    node.factors.forEach((f,i)=>{
      const cp=path+'.'+i;
      // Show · dot when a constant is adjacent (e.g. y·1, x·0)
      if(i>0){
        const prev=node.factors[i-1];
        if(f.type==='const'||prev.type==='const'){
          const dot=document.createElement('span');dot.className='expr-dot';dot.textContent=' \u00b7 ';wrap.appendChild(dot);
        }
      }
      if(f.type==='sum'){
        const lp=document.createElement('span');lp.className='expr-paren';lp.textContent='(';wrap.appendChild(lp);
        wrap.appendChild(renderNode(f,cp,'prod'));
        const rp=document.createElement('span');rp.className='expr-paren';rp.textContent=')';wrap.appendChild(rp);
      } else {
        wrap.appendChild(renderNode(f,cp,'prod'));
      }
    });
    return wrap;
  }
  if(node.type==='sum'){
    const wrap=document.createElement('span');wrap.className='expr-sum';
    const len=node.terms.length;
    node.terms.forEach((t,i)=>{
      if(i>0){const pl=document.createElement('span');pl.className='expr-plus';pl.textContent=' + ';wrap.appendChild(pl);}
      if(len>=2){
        const tw=document.createElement('span');
        tw.className='drag-term';
        tw.draggable=true;
        tw.dataset.sumPath=path;
        tw.dataset.termIdx=i;
        tw.dataset.path=path+'.'+i; // unified path for term-level selection
        if(state.sel.some(s=>s.path===path+'.'+i))tw.classList.add('term-selected');
        const handle=document.createElement('span');
        handle.className='drag-handle';
        handle.textContent='⠿';
        handle.title='Drag to reorder • Click to select term';
        tw.appendChild(handle);
        tw.appendChild(renderNode(t,path+'.'+i,'sum'));
        // Drag events
        tw.addEventListener('dragstart',e=>{
          _dragSrc={sumPath:path,idx:i};
          tw.classList.add('dragging');
          e.dataTransfer.effectAllowed='move';
          e.dataTransfer.setData('text/plain',i);
        });
        tw.addEventListener('dragend',()=>{
          tw.classList.remove('dragging');
          document.querySelectorAll('.drag-term').forEach(el=>el.classList.remove('drag-over'));
        });
        tw.addEventListener('dragover',e=>{
          e.preventDefault();
          e.dataTransfer.dropEffect='move';
          if(_dragSrc.sumPath===path&&_dragSrc.idx!==i)tw.classList.add('drag-over');
        });
        tw.addEventListener('dragleave',()=>tw.classList.remove('drag-over'));
        tw.addEventListener('drop',e=>{
          e.preventDefault();
          tw.classList.remove('drag-over');
          if(_dragSrc.sumPath===path&&_dragSrc.idx!==null&&_dragSrc.idx!==i){
            swapTerms(path,_dragSrc.idx,i);
          }
          _dragSrc={sumPath:null,idx:null};
        });
        // Click the wrapper (handle or gaps) to select the whole term
        tw.addEventListener('click',e=>{
          clickTerm(path+'.'+i);
        });
        wrap.appendChild(tw);
      } else {
        wrap.appendChild(renderNode(t,path+'.'+i,'sum'));
      }
    });
    return wrap;
  }
  if(node.type==='not'){
    const wrap=document.createElement('span');wrap.className='expr-not';
    wrap.dataset.path=path;
    if(state.sel.some(s=>s.path===path))wrap.classList.add('selected');
    const inner=document.createElement('span');inner.className='expr-not-inner';
    inner.appendChild(renderNode(node.child,path+'.0','not'));
    wrap.appendChild(inner);
    wrap.addEventListener('click',e=>{e.stopPropagation();clickNot(path);});
    return wrap;
  }
}

function swapTerms(sumPath,i,j){
  const sn=getNode(state.expr,sumPath);
  if(!sn||sn.type!=='sum')return;
  [sn.terms[i],sn.terms[j]]=[sn.terms[j],sn.terms[i]];
  state.sel=[];renderExpression();$('action-menu').classList.add('hidden');
  toast('↔ Swapped');
}

function hlVar(v,on){document.querySelectorAll('.expr-literal').forEach(el=>{if(el.dataset.varName===v){if(on)el.classList.add('highlight');else el.classList.remove('highlight');}});}

function markRelated(){
  if(state.sel.length!==1)return;
  const s=state.sel[0],node=getNode(state.expr,s.path);
  if(!node||node.type!=='lit')return; // skip term-level selections
  document.querySelectorAll('.expr-literal').forEach(el=>{
    if(el.classList.contains('selected'))return;
    if(el.dataset.varName===node.v){
      if((el.dataset.neg==='1')!==node.n)el.classList.add('complement-match');
      else el.classList.add('related');
    }
  });
}

/* ===== CLICK NOT NODE ===== */
function clickNot(path){
  const existing=state.sel.findIndex(s=>s.path===path);
  if(existing>=0){state.sel.splice(existing,1);renderExpression();$('action-menu').classList.add('hidden');updateInstr();return;}
  if(state.sel.length>=2)state.sel.shift();
  state.sel.push({path,isTermSel:false});
  notifyHintActivity();
  renderExpression();updateInstr();
  if(state.sel.length===2)analyze();
  else analyzeNot(path);
}

function analyzeNot(path){
  const node=getNode(state.expr,path);
  if(!node||node.type!=='not')return;
  const child=node.child,laws=[];
  // Double Negation: (A')' = A
  if(child.type==='not'){
    const r=cloneN(child.child);
    laws.push({name:'Double Negation',id:'double-neg',desc:`(${nodeText(child)})' = ${nodeText(r)}`,
      apply:()=>{const tree=cloneN(state.expr);return normalize(setNode(tree,path,r));}});
  }
  // De Morgan's AND: (AB)' = A' + B'
  if(child.type==='prod'){
    const expanded=sum(...child.factors.map(f=>f.type==='lit'?lit(f.v,!f.n):neg(cloneN(f))));
    laws.push({name:"De Morgan's (AND→OR)",id:'demorgan-and',desc:`${nodeText(node)} = ${nodeText(expanded)}`,
      apply:()=>{const tree=cloneN(state.expr);return normalize(setNode(tree,path,cloneN(expanded)));}});
  }
  // De Morgan's OR: (A+B)' = A'B'
  if(child.type==='sum'){
    const expanded=prod(...child.terms.map(t=>t.type==='lit'?lit(t.v,!t.n):neg(cloneN(t))));
    laws.push({name:"De Morgan's (OR→AND)",id:'demorgan-or',desc:`${nodeText(node)} = ${nodeText(expanded)}`,
      apply:()=>{const tree=cloneN(state.expr);return normalize(setNode(tree,path,cloneN(expanded)));}});
  }
  if(laws.length===0){setInstr('No law applies here — try a different element',false);$('action-menu').classList.add('hidden');return;}
  setInstr('Choose an action:',true);
  showActions(laws);
}

/* ===== CLICK WHOLE TERM ===== */
function clickTerm(path){
  const existing=state.sel.findIndex(s=>s.path===path);
  if(existing>=0){state.sel.splice(existing,1);renderExpression();$('action-menu').classList.add('hidden');updateInstr();return;}
  if(state.sel.length>=2)state.sel.shift();
  state.sel.push({path,isTermSel:true});
  notifyHintActivity();
  renderExpression();updateInstr();
  if(state.sel.length===2)analyze();
  else $('action-menu').classList.add('hidden');
}

/* ===== CLICK LITERAL ===== */
function clickLit(path){
  const node=getNode(state.expr,path);
  // Special case: const (1 or 0) directly inside a product
  if(node&&node.type==='const'){
    const parts=path.split('.');
    if(parts.length>1){
      const parentPath=parts.slice(0,-1).join('.');
      const parent=getNode(state.expr,parentPath);
      if(parent&&parent.type==='prod'){analyzeProductConst(path,node.val,parentPath);return;}
    }
  }
  const existing=state.sel.findIndex(s=>s.path===path);
  if(existing>=0){state.sel.splice(existing,1);renderExpression();updateInstr();$('action-menu').classList.add('hidden');return;}
  if(state.sel.length>=2)state.sel.shift();
  state.sel.push({path,isTermSel:false});
  notifyHintActivity();
  renderExpression();updateInstr();
  if(state.sel.length===2)analyze();else $('action-menu').classList.add('hidden');
}

/* ===== IDENTITY / ZERO for PRODUCT FACTORS ===== */
function analyzeProductConst(constPath,constVal,prodPath){
  const laws=[];
  const idx=parseInt(constPath.split('.').pop());
  if(constVal===1){
    laws.push({name:'Identity Law',id:'identity',
      desc:'A · 1 = A — remove the 1 factor',
      apply:()=>{
        const tree=cloneN(state.expr);
        const p=getNode(tree,prodPath);
        const nf=p.factors.filter((_,i)=>i!==idx);
        const result=nf.length===1?nf[0]:{type:'prod',factors:nf};
        if(prodPath==='R')return normalize(result);
        setNode(tree,prodPath,normalize(result));
        return normalize(tree);
      }});
  }
  if(constVal===0){
    laws.push({name:'Annulment Law (Product)',id:'annulment',
      desc:'A · 0 = 0 — anything times 0 is 0',
      apply:()=>{
        const tree=cloneN(state.expr);
        if(prodPath==='R')return con(0);
        setNode(tree,prodPath,con(0));
        return normalize(tree);
      }});
  }
  state.sel=[];renderExpression();
  showActions(laws);
}

/* ===== ANALYZE TWO SELECTED ITEMS ===== */
function analyze(){
  const p1=state.sel[0].path,p2=state.sel[1].path;
  const bothTermSel=state.sel[0].isTermSel&&state.sel[1].isTermSel;
  const n1=getNode(state.expr,p1),n2=getNode(state.expr,p2);
  if(!n1||!n2){$('action-menu').classList.add('hidden');return;}

  const cs=findCommonSum(state.expr,p1,p2);
  if(!cs){setInstr('These are not in the same sum — try variables from terms connected by +',false);$('action-menu').classList.add('hidden');return;}

  const t1=cs.sumNode.terms[cs.ti1],t2=cs.sumNode.terms[cs.ti2];
  const laws=[];

  if(!bothTermSel){
    // ── LITERAL-LEVEL LAWS (user clicked individual variables) ──
    // 1. DISTRIBUTIVE: same literal in both terms
    if(n1.type==='lit'&&n2.type==='lit'&&n1.v===n2.v&&n1.n===n2.n){
      if(termContainsLit(t1,n1.v,n1.n)&&termContainsLit(t2,n2.v,n2.n)){
        const vLabel=n1.n?n1.v+'\u0305':n1.v;
        const r1=removeLitFromNode(t1,n1.v,n1.n),r2=removeLitFromNode(t2,n2.v,n2.n);
        laws.push({name:'Distributive (Factor)',id:'distributive',
          desc:`Factor out ${vLabel} → ${vLabel}(${nodeText(r1)} + ${nodeText(r2)})`,
          apply:()=>{
            const tree=cloneN(state.expr);const sn=getNode(tree,cs.sumPath);
            const newTerms=sn.terms.filter((_,k)=>k!==cs.ti1&&k!==cs.ti2);
            const nr1=removeLitFromNode(cloneN(t1),n1.v,n1.n),nr2=removeLitFromNode(cloneN(t2),n2.v,n2.n);
            newTerms.push(prod(lit(n1.v,n1.n),sum(nr1,nr2)));
            sn.terms=newTerms;
            return normalizeFlat(tree);
          }});
      }
    }
    // 2. COMPLEMENT: both terms are single literals that are complements
    if(n1.type==='lit'&&n2.type==='lit'&&n1.v===n2.v&&n1.n!==n2.n){
      if(t1.type==='lit'&&t2.type==='lit'){
        laws.push({name:'Complement Law',id:'complement',
          desc:`${n1.n?n1.v+'\u0305':n1.v} + ${n2.n?n2.v+'\u0305':n2.v} = 1`,
          apply:()=>{
            const tree=cloneN(state.expr);const sn=getNode(tree,cs.sumPath);
            const newTerms=sn.terms.filter((_,k)=>k!==cs.ti1&&k!==cs.ti2);
            newTerms.push(con(1));sn.terms=newTerms;
            return normalizeFlat(tree);
          }});
      }
    }
    // 3. IDENTITY: one term in the common sum is con(0)
    if(t1.type==='const'&&t1.val===0){
      laws.push({name:'Identity Law',id:'identity',desc:'Remove the 0 term',
        apply:()=>{const tree=cloneN(state.expr);const sn=getNode(tree,cs.sumPath);sn.terms=sn.terms.filter((_,k)=>k!==cs.ti1);return normalize(tree);}});}
    if(t2.type==='const'&&t2.val===0){
      laws.push({name:'Identity Law',id:'identity',desc:'Remove the 0 term',
        apply:()=>{const tree=cloneN(state.expr);const sn=getNode(tree,cs.sumPath);sn.terms=sn.terms.filter((_,k)=>k!==cs.ti2);return normalize(tree);}});}
    // 4. ANNULMENT: one term in the common sum is con(1)
    if((t1.type==='const'&&t1.val===1)||(t2.type==='const'&&t2.val===1)){
      laws.push({name:'Annulment Law',id:'annulment',desc:'A + 1 = 1',
        apply:()=>{const tree=cloneN(state.expr);const sn=getNode(tree,cs.sumPath);sn.terms=[con(1)];return normalizeFlat(tree);}});}
  } else {
    // ── TERM-LEVEL LAWS (user clicked whole terms via ⠿ or term click) ──
    // 3. IDEMPOTENT
    if(termsEq(t1,t2)){
      laws.push({name:'Idempotent Law',id:'idempotent',
        desc:'These terms are identical — remove duplicate',
        apply:()=>{
          const tree=cloneN(state.expr);const sn=getNode(tree,cs.sumPath);
          sn.terms=sn.terms.filter((_,k)=>k!==cs.ti2);
          return normalize(tree);
        }});
    }
    // 4. ABSORPTION
    if(isSubT(t1,t2)){
      laws.push({name:'Absorption Law',id:'absorption',
        desc:`${nodeText(t1)} absorbs ${nodeText(t2)}`,
        apply:()=>{const tree=cloneN(state.expr);const sn=getNode(tree,cs.sumPath);sn.terms=sn.terms.filter((_,k)=>k!==cs.ti2);return normalize(tree);}});}
    if(isSubT(t2,t1)){
      laws.push({name:'Absorption Law',id:'absorption',
        desc:`${nodeText(t2)} absorbs ${nodeText(t1)}`,
        apply:()=>{const tree=cloneN(state.expr);const sn=getNode(tree,cs.sumPath);sn.terms=sn.terms.filter((_,k)=>k!==cs.ti1);return normalize(tree);}});}
    // 5. IDENTITY: one term is 0
    if(t1.type==='const'&&t1.val===0){
      laws.push({name:'Identity Law',id:'identity',desc:'Remove the 0 term',
        apply:()=>{const tree=cloneN(state.expr);const sn=getNode(tree,cs.sumPath);sn.terms=sn.terms.filter((_,k)=>k!==cs.ti1);return normalize(tree);}});}
    if(t2.type==='const'&&t2.val===0){
      laws.push({name:'Identity Law',id:'identity',desc:'Remove the 0 term',
        apply:()=>{const tree=cloneN(state.expr);const sn=getNode(tree,cs.sumPath);sn.terms=sn.terms.filter((_,k)=>k!==cs.ti2);return normalize(tree);}});}
    // 6. ANNULMENT: one term is 1
    if((t1.type==='const'&&t1.val===1)||(t2.type==='const'&&t2.val===1)){
      laws.push({name:'Annulment Law',id:'annulment',desc:'A + 1 = 1',
        apply:()=>{const tree=cloneN(state.expr);const sn=getNode(tree,cs.sumPath);sn.terms=[con(1)];return normalize(tree);}});}
  }

  showActions(laws);
}

function termsEq(a,b){return nodeText(a)===nodeText(b);}

function isSubT(shorter,longer){
  const sLits=getLits(shorter),lLits=getLits(longer);
  if(sLits.length>=lLits.length)return false;
  return sLits.every(sl=>lLits.some(ll=>ll.v===sl.v&&ll.n===sl.n));
}

function getLits(node){
  if(node.type==='lit')return[node];
  if(node.type==='prod')return node.factors.filter(f=>f.type==='lit');
  return[];
}

/* ===== ACTION MENU ===== */
function showActions(laws){
  const menu=$('action-menu'),items=$('action-items');
  if(laws.length===0){menu.classList.add('hidden');setInstr('No simplification here — try different variables',false);notifyHintMisinput();return;}
  setInstr('Choose an action:',true);
  items.innerHTML='';
  laws.forEach(law=>{
    const result=law.apply();const resText=nodeText(result);
    const item=document.createElement('div');item.className='action-item';
    item.innerHTML=`<div><div class="action-law-name">${law.name}</div><div class="action-desc">${law.desc}</div></div><div class="action-result">→ ${resText}</div>`;
    item.addEventListener('click',()=>applyAction(law));
    items.appendChild(item);
  });
  menu.classList.remove('hidden');
}

function applyAction(law){
  const before=nodeText(state.expr);
  state.exprHistory.push(cloneN(state.expr)); // save for undo
  state.expr=law.apply();
  const after=nodeText(state.expr);
  state.steps.push({from:before,to:after,law:law.name});
  renderSteps();state.sel=[];$('action-menu').classList.add('hidden');
  renderExpression();setInstr('Click a variable to continue simplifying',false);
  $('btn-undo').disabled=false;
  toast('✓ '+law.name+' applied!');resetHint();
  if(canonText(state.expr)===state.goalCanon)setTimeout(()=>showSuccess(),500);
}

function undoAction(){
  if(state.exprHistory.length===0)return;
  state.expr=state.exprHistory.pop();
  state.steps.pop();
  state.sel=[];
  renderExpression();renderSteps();
  $('action-menu').classList.add('hidden');
  $('btn-undo').disabled=state.exprHistory.length===0;
  setInstr('Click a variable in any term to start',false);
  toast('↩ Undone');resetHint();
}

function resetPuzzle(){
  const p=LEVELS[state.currentLevel].puzzles[state.currentPuzzle];
  if(!p)return;
  state.expr=parseExpr(p.expr);
  state.exprHistory=[];state.steps=[];state.sel=[];
  renderExpression();renderSteps();
  $('action-menu').classList.add('hidden');$('hint-bubble').classList.add('hidden');
  $('step-history').style.display='none';
  $('btn-undo').disabled=true;
  setInstr('Click a variable in any term to start',false);
  toast('⟳ Reset');resetHint();
}

function setInstr(t,isA){const el=$('expr-instruction');el.textContent=t;if(isA)el.classList.add('has-action');else el.classList.remove('has-action');}
function updateInstr(){
  if(state.sel.length===0)setInstr('Click a variable or ⠿ to select a term',false);
  else if(state.sel.length===1)setInstr('Now click another variable or ⠿ to select a second term',false);
}

/* ===== STEP HISTORY ===== */
function renderSteps(){
  const list=$('step-list');list.innerHTML='';
  state.steps.forEach((s,i)=>{const r=document.createElement('div');r.className='step-row';
    r.innerHTML=`<span class="step-num">${i+1}</span><span class="step-from">${s.from}</span><span class="step-arrow">→</span><span class="step-to">${s.to}</span><span class="step-law">${s.law}</span>`;
    list.appendChild(r);});
  if(state.steps.length>0)$('step-history').style.display='';
}

/* ===== TEXT HINTS ===== */
function resetHint(){if(state.hintTimer)clearTimeout(state.hintTimer);state.hintTimer=setTimeout(()=>showHint(),20000);}
function showHint(){
  const p=LEVELS[state.currentLevel]?.puzzles[state.currentPuzzle];
  if(!p?.hints?.length)return;
  $('hint-text').textContent=p.hints[Math.min(state.hintIdx,p.hints.length-1)];
  $('hint-bubble').classList.remove('hidden');state.hintIdx++;state.hintsUsed++;resetHint();
}

/* ===== SMART HINT HIGHLIGHT SYSTEM ===== */
const HINT_PALETTE=['hint-p0','hint-p1','hint-p2','hint-p3','hint-p4','hint-p5','hint-p6','hint-p7'];
let _hintCycleIdx=0,_hintInactiveTimer=null,_hintCleanupTimer=null,_hintList=[],_misinputCount=0;

function toggleHints(){
  state.hintsOn=!state.hintsOn;
  syncHintButton();
  if(state.hintsOn){_hintList=[];_hintCycleIdx=0;_misinputCount=0;scheduleHintAfterInactivity();}
  else clearHints();
}

function syncHintButton(){
  const btn=$('btn-smart-hints');
  if(state.hintsOn){btn.textContent='🔍 Hints: ON';btn.classList.add('hints-active');}
  else{btn.textContent='🔍 Hints: OFF';btn.classList.remove('hints-active');}
}

function clearHints(){
  if(_hintInactiveTimer){clearTimeout(_hintInactiveTimer);_hintInactiveTimer=null;}
  if(_hintCleanupTimer){clearTimeout(_hintCleanupTimer);_hintCleanupTimer=null;}
  _misinputCount=0;
  const all=['hint-glow',...HINT_PALETTE];
  document.querySelectorAll('.hint-glow').forEach(el=>el.classList.remove(...all));
}

// Called after every render when hints are on — rescans and resets idle timer
function applyHints(){
  if(!state.hintsOn)return;
  if(_hintCleanupTimer){clearTimeout(_hintCleanupTimer);_hintCleanupTimer=null;}
  _hintList=scanHints(state.expr,'R');
  _hintCycleIdx=0;_misinputCount=0;
  scheduleHintAfterInactivity();
}

// Reset idle timer on any user interaction
function notifyHintActivity(){
  if(!state.hintsOn)return;
  clearHintGlow();
  scheduleHintAfterInactivity();
}

// Called when a selection yields no applicable laws
function notifyHintMisinput(){
  if(!state.hintsOn)return;
  _misinputCount++;
  if(_misinputCount>=2){_misinputCount=0;showNextHint();}
}

function scheduleHintAfterInactivity(){
  if(_hintInactiveTimer)clearTimeout(_hintInactiveTimer);
  _hintInactiveTimer=setTimeout(showNextHint,5000);
}

function clearHintGlow(){
  const all=['hint-glow',...HINT_PALETTE];
  document.querySelectorAll('.hint-glow').forEach(el=>el.classList.remove(...all));
}

function showNextHint(){
  _hintInactiveTimer=null;
  if(!state.hintsOn||!state.expr)return;
  if(_hintList.length===0)_hintList=scanHints(state.expr,'R');
  if(_hintList.length===0)return;
  clearHintGlow();
  const h=_hintList[_hintCycleIdx%_hintList.length];
  const palCls=HINT_PALETTE[_hintCycleIdx%HINT_PALETTE.length];
  const touched=[];
  (h.paths||[]).forEach(p=>{
    const el=document.querySelector(`[data-path="${p}"]`);
    if(el){el.classList.add('hint-glow',palCls);touched.push(el);}
  });
  _hintCycleIdx++;
  // Auto-remove glow after 2 pulses, then schedule next idle wait
  _hintCleanupTimer=setTimeout(()=>{
    _hintCleanupTimer=null;
    touched.forEach(el=>el.classList.remove('hint-glow',...HINT_PALETTE));
    if(state.hintsOn)scheduleHintAfterInactivity();
  },3700);
}

function findLitPath(node,base,v,n){
  if(node.type==='lit'&&node.v===v&&node.n===n)return base;
  if(node.type==='prod'){for(let i=0;i<node.factors.length;i++){if(node.factors[i].type==='lit'&&node.factors[i].v===v&&node.factors[i].n===n)return base+'.'+i;}}
  return null;
}

function scanHints(node,path){
  const hints=[],seen=new Set();
  function add(law,paths){const k=law+'|'+paths.join(',');if(!seen.has(k)){seen.add(k);hints.push({law,paths});}}
  function walk(node,path){
    if(node.type==='not'){
      if(node.child.type==='not')add('double-neg',[path]);
      else if(node.child.type==='prod'||node.child.type==='sum')add('demorgan',[path]);
      walk(node.child,path+'.0');
      return;
    }
    if(node.type==='prod'){node.factors.forEach((f,i)=>walk(f,path+'.'+i));return;}
    if(node.type==='sum'){
      const T=node.terms;
      for(let i=0;i<T.length;i++){
        const p1=path+'.'+i,t1=T[i];
        for(let j=i+1;j<T.length;j++){
          const p2=path+'.'+j,t2=T[j];
          if(termsEq(t1,t2))add('idempotent',[p1,p2]);
          if(isSubT(t1,t2))add('absorption',[p1]);
          if(isSubT(t2,t1))add('absorption',[p2]);
          if(t1.type==='lit'&&t2.type==='lit'&&t1.v===t2.v&&t1.n!==t2.n)add('complement',[p1,p2]);
          // Annulment/Identity: highlight BOTH the constant and its partner
          if((t1.type==='const'&&t1.val===1)||(t2.type==='const'&&t2.val===1))add('annulment',[p1,p2]);
          if((t1.type==='const'&&t1.val===0)||(t2.type==='const'&&t2.val===0))add('identity',[p1,p2]);
          // Distributive: find each shared literal
          const done=new Set();
          for(const l1 of getLits(t1))for(const l2 of getLits(t2)){
            if(l1.v===l2.v&&l1.n===l2.n&&!done.has(l1.v+l1.n)){
              done.add(l1.v+l1.n);
              const lp1=findLitPath(t1,p1,l1.v,l1.n),lp2=findLitPath(t2,p2,l2.v,l2.n);
              if(lp1&&lp2)add('distributive',[lp1,lp2]);
            }
          }
        }
        walk(t1,p1);
      }
    }
  }
  walk(node,path);
  return hints;
}

/* ===== LEVELS ===== */
function renderLevels(){
  const path=$('level-path');path.innerHTML='';$('header-xp').textContent=state.xp;
  const pos=['left','center','right','center'];
  LEVELS.forEach((lv,i)=>{
    const done=state.levelsCompleted.has(lv.id);
    if(i>0){const c=document.createElement('div');c.className='stage-connector'+(state.levelsCompleted.has(LEVELS[i-1].id)?' done':'');path.appendChild(c);}
    const row=document.createElement('div');row.className='stage-row '+pos[i%4];
    const nd=document.createElement('div');nd.className='stage-node'+(done?' completed':'')+(lv.id===3?' boss':'');
    const icon=lv.id===3?'🏆':(done?'✅':'📘');
    nd.innerHTML=`<div class="stage-node-icon">${icon}</div><div class="stage-name">${lv.name}</div><div class="stage-desc">${lv.desc}</div><div class="stage-vars">${lv.varCount} variable${lv.varCount>1?'s':''}</div><div class="stage-stars">${done?'⭐⭐⭐':'☆☆☆'}</div>`;
    nd.onclick=()=>startLevel(i);row.appendChild(nd);path.appendChild(row);
  });
}
function startLevel(i){state.currentLevel=i;state.currentPuzzle=0;showScreen('game');loadPuzzle();}

function loadPuzzle(){
  const lv=LEVELS[state.currentLevel],p=lv.puzzles[state.currentPuzzle];
  if(!p){completeLevel();return;}
  state.expr=parseExpr(p.expr);state.goalText=p.goal;state.goalCanon=canonText(parseExpr(p.goal));state.sel=[];state.steps=[];state.exprHistory=[];state.hintIdx=0;state.hintsUsed=0;
  $('game-xp').textContent=state.xp;$('game-level-label').textContent=lv.name;
  $('game-puzzle-counter').textContent=(state.currentPuzzle+1)+'/'+lv.puzzles.length;
  $('progress-bar-fill').style.width=(state.currentPuzzle/lv.puzzles.length*100)+'%';
  $('goal-expr').textContent=p.goal;
  renderExpression();$('action-menu').classList.add('hidden');$('hint-bubble').classList.add('hidden');
  $('success-panel').classList.add('hidden');$('step-history').style.display='none';$('step-list').innerHTML='';
  $('btn-undo').disabled=true;
  syncHintButton();
  setInstr('Click a variable in any term to start',false);resetHint();
}

/* ===== SUCCESS ===== */
function showSuccess(){
  if(state.hintTimer)clearTimeout(state.hintTimer);
  const xp=Math.max(10,40-state.steps.length*3-state.hintsUsed*5);
  state.xp+=xp;state.streak++;if(state.streak>state.bestStreak)state.bestStreak=state.streak;
  $('success-title').textContent=state.streak>2?`🔥 ${state.streak}x Streak!`:'🎉 Simplified!';
  $('success-body').textContent=state.steps.map(s=>s.from+' → '+s.to).join('  ·  ');
  $('success-xp').textContent='+'+xp+' XP';$('success-panel').classList.remove('hidden');
  $('game-xp').textContent=state.xp;burstP(innerWidth/2,innerHeight/2,'#00e676');
}
$('btn-next-puzzle').onclick=()=>{state.currentPuzzle++;loadPuzzle();};

function completeLevel(){
  const lv=LEVELS[state.currentLevel];state.levelsCompleted.add(lv.id);
  $('progress-bar-fill').style.width='100%';
  const stars=state.hintsUsed===0?3:state.hintsUsed<=2?2:1;
  showScreen('complete');
  $('complete-stars').textContent='⭐'.repeat(stars)+'☆'.repeat(3-stars);
  $('complete-title').textContent=lv.name+' Complete!';$('complete-subtitle').textContent='You mastered '+lv.desc;
  $('cs-xp').textContent=state.xp;$('cs-steps').textContent=state.steps.length;$('cs-hints').textContent=state.hintsUsed;
  $('complete-badge').textContent=stars===3?'🏆 Perfect!':stars===2?'🥈 Great Job!':'🥉 Keep Practicing!';
  burstP(innerWidth/2,innerHeight/3,'#ffd740');
}

/* ===== REFERENCE ===== */
function renderRef(){const g=$('reference-grid');g.innerHTML='';LAWS.forEach(l=>{const c=document.createElement('div');c.className='ref-card';c.innerHTML=`<div class="ref-card-name">${l.name}</div><div class="ref-card-formula">${l.formulas.join('<br>')}</div><div class="ref-card-desc">${l.desc}</div>`;g.appendChild(c);});}

/* ===== NAV ===== */
let refRet='home';
$('btn-start').onclick=()=>{renderLevels();showScreen('levels');};
$('btn-reference').onclick=()=>{refRet='home';renderRef();showScreen('reference');};
$('levels-ref-btn').onclick=()=>{refRet='levels';renderRef();showScreen('reference');};
$('game-ref-btn').onclick=()=>{refRet='game';renderRef();showScreen('reference');};
$('levels-home-btn').onclick=()=>{updateHome();showScreen('home');};
$('game-back-btn').onclick=()=>{if(_hintInactiveTimer){clearTimeout(_hintInactiveTimer);_hintInactiveTimer=null;}clearHintGlow();renderLevels();showScreen('levels');};
$('ref-back-btn').onclick=()=>{if(refRet==='levels'){renderLevels();showScreen('levels');}else if(refRet==='game')showScreen('game');else{updateHome();showScreen('home');}};
$('btn-next-level').onclick=()=>{if(state.currentLevel<LEVELS.length-1)startLevel(state.currentLevel+1);else{updateHome();renderLevels();showScreen('levels');}};
$('btn-replay-level').onclick=()=>startLevel(state.currentLevel);
$('btn-to-levels').onclick=()=>{renderLevels();showScreen('levels');};
$('btn-hint').onclick=()=>showHint();
$('btn-smart-hints').onclick=()=>toggleHints();
$('btn-undo').onclick=()=>undoAction();
$('btn-reset').onclick=()=>resetPuzzle();
updateHome();

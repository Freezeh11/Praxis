/**
 * ExpressionDisplay — Renders a Boolean expression tree as interactive React elements.
 *
 * Each SOP term gets a ⠿ handle:
 *   • Click handle → select the whole term (for Idempotent / Absorption)
 *   • Drag handle  → reorder terms inside the same sum
 *
 * Clicking a literal (variable) → onClickLit(path)
 * Clicking a NOT group          → onClickNot(path)
 */

import { useRef } from 'react'
import { motion } from 'framer-motion'

const transitionConfig = { type: 'spring', bounce: 0.15, duration: 0.5 }

// Module-level drag state removed in favor of useRef inside SumNode to fix linting.

function isSelected(sel, path) {
  return sel.some(s => s.path === path)
}

function isNodeAnimatingHide(path, animationPaths, animationLaw) {
  if (!animationLaw || !animationPaths || animationPaths.length === 0) return false
  return animationPaths.some(p => path === p || path.startsWith(p + '.'))
}

/* ── Literal node (variable or constant) ── */
function LitNode({ node, path, sel, onClickLit, activeGuidePaths, animationPaths, animationLaw }) {
  const selected = isSelected(sel, path)
  const isGuide = activeGuidePaths?.includes(path)
  const isAnimatingHide = isNodeAnimatingHide(path, animationPaths, animationLaw)
  return (
    <motion.span
      layout
      transition={transitionConfig}
      className={`inline-flex items-baseline px-[7px] py-[3px] rounded-[5px] cursor-pointer transition-all border-[1.5px]
        ${selected ? 'bg-teal-light border-teal text-teal' : 'border-transparent hover:bg-teal-light hover:border-teal hover:text-teal'}
        ${node.type === 'const' ? 'text-text-3' : ''}
        ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal shadow-[0_0_0_6px_rgba(46,196,182,0)] animate-[guidePulse_2s_infinite] z-10' : ''}
        ${isAnimatingHide ? 'opacity-0 pointer-events-none' : ''}
      `}
      data-path={path}
      onClick={e => { e.stopPropagation(); onClickLit(path) }}
    >
      {node.type === 'lit' ? (
        node.n
          ? <span style={{ textDecoration: 'overline', textUnderlineOffset: '2px' }}>{node.v}</span>
          : node.v
      ) : node.val}
    </motion.span>
  )
}

/* ── NOT group: (child)' ── */
function NotNode({ node, path, sel, onClickLit, onClickNot, onClickTerm, activeGuidePaths, animationPaths, animationLaw }) {
  const selected = isSelected(sel, path)
  const isGuide = activeGuidePaths?.includes(path)
  const isAnimatingHide = isNodeAnimatingHide(path, animationPaths, animationLaw)
  return (
    <motion.span
      layout
      transition={transitionConfig}
      className={`inline-flex items-baseline px-1 py-[3px] rounded-[5px] cursor-pointer transition-all border-[1.5px]
        ${selected ? 'bg-amber-light border-amber' : 'border-transparent hover:bg-amber-light hover:border-amber'}
        ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''}
        ${isAnimatingHide ? 'opacity-0 pointer-events-none' : ''}
      `}
      data-path={path}
      onClick={e => { e.stopPropagation(); onClickNot(path) }}
    >
      {/* Parens are OUTSIDE the border-top span so only the inner content gets the bar */}
      <span className="text-text-3">(</span>
      <span style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        borderTop: '1.8px solid currentColor',
        paddingTop: '4px',
      }}>
        <ExprNode
          node={node.child}
          path={`${path}.0`}
          sel={sel}
          onClickLit={onClickLit}
          onClickNot={onClickNot}
          onClickTerm={onClickTerm}
          activeGuidePaths={activeGuidePaths}
          animationPaths={animationPaths}
          animationLaw={animationLaw}
        />
      </span>
      <span className="text-text-3">)</span>
    </motion.span>
  )
}

/* ── Product (AND): juxtaposition or clause-level POS wrappers ── */
function ProdNode({ node, path, sel, onClickLit, onClickNot, onClickTerm, onSwapTerms, activeGuidePaths, animationPaths, animationLaw }) {
  const isGuide = activeGuidePaths?.includes(path)
  const isAnimatingHide = isNodeAnimatingHide(path, animationPaths, animationLaw)
  const hasMultiple = node.factors.length >= 2 && (node.factors.some(f => f.type === 'sum' || f.type === 'not') || path === 'R')

  const dragOverIdx = useRef(null)
  const dragSrc = useRef({ prodPath: null, idx: null })

  const handleDragStart = (prodPath, idx, e) => {
    dragSrc.current.prodPath = prodPath
    dragSrc.current.idx = idx
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
    e.currentTarget.classList.add('opacity-45', 'border-border-dark', '!border-solid')
  }

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('opacity-45', 'border-border-dark', '!border-solid')
    document.querySelectorAll('[data-dragover="true"]').forEach(el => {
      el.removeAttribute('data-dragover')
      el.className = el.className.replace(/border-amber bg-amber-light scale-\[1\.04\] !border-solid/g, '')
    })
    dragSrc.current.prodPath = null
    dragSrc.current.idx = null
    dragOverIdx.current = null
  }

  const handleDragOver = (prodPath, idx, e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragSrc.current.prodPath === prodPath && dragSrc.current.idx !== idx) {
      if (!e.currentTarget.hasAttribute('data-dragover')) {
        e.currentTarget.setAttribute('data-dragover', 'true')
        e.currentTarget.className += ' border-amber bg-amber-light scale-[1.04] !border-solid'
      }
      dragOverIdx.current = idx
    }
  }

  const handleDragLeave = (e) => {
    if (e.currentTarget.hasAttribute('data-dragover')) {
      e.currentTarget.removeAttribute('data-dragover')
      e.currentTarget.className = e.currentTarget.className.replace(/ border-amber bg-amber-light scale-\[1\.04\] !border-solid/g, '')
    }
  }

  const handleDrop = (prodPath, idx, e) => {
    e.preventDefault()
    if (e.currentTarget.hasAttribute('data-dragover')) {
      e.currentTarget.removeAttribute('data-dragover')
      e.currentTarget.className = e.currentTarget.className.replace(/ border-amber bg-amber-light scale-\[1\.04\] !border-solid/g, '')
    }
    if (dragSrc.current.prodPath === prodPath && dragSrc.current.idx !== null && dragSrc.current.idx !== idx) {
      if (onSwapTerms) onSwapTerms(prodPath, dragSrc.current.idx, idx)
    }
    dragSrc.current.prodPath = null
    dragSrc.current.idx = null
  }

  return (
    <motion.span layout transition={transitionConfig} data-path={path} className={`inline-flex items-center ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''} ${isAnimatingHide ? 'opacity-0 pointer-events-none' : ''}`}>
      {node.factors.map((f, i) => {
        const fPath = `${path}.${i}`
        const factorSel = sel.some(s => s.path === fPath)
        const isFactorGuide = activeGuidePaths?.includes(fPath)
        const factorAnimatingHide = isNodeAnimatingHide(fPath, animationPaths, animationLaw)
        const prevIsConst = i > 0 && node.factors[i - 1].type === 'const'
        const currIsConst = f.type === 'const'

        return (
          <motion.span layout transition={transitionConfig} key={i} className="inline-flex items-center">
            {(prevIsConst || currIsConst) && i > 0 && (
              <span className="text-text-3 mx-0.5 text-[0.9em]"> · </span>
            )}
            {hasMultiple ? (
              <motion.span
                layout
                transition={transitionConfig}
                data-path={fPath}
                className={`inline-flex items-center px-1.5 py-[2px] rounded-lg border-[1.5px] transition-all gap-1 cursor-default group
                  ${factorSel
                    ? 'border-indigo-500 bg-indigo-50/80 shadow-xs !border-solid'
                    : 'border-transparent hover:border-slate-300 hover:bg-slate-50/70 border-dashed'
                  }
                  ${isFactorGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''}
                  ${factorAnimatingHide ? 'opacity-0 pointer-events-none' : ''}
                `}
                draggable={true}
                onDoubleClick={e => { e.stopPropagation(); onClickTerm(fPath) }}
                onDragStart={e => handleDragStart(path, i, e)}
                onDragEnd={handleDragEnd}
                onDragOver={e => handleDragOver(path, i, e)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(path, i, e)}
              >
                {/* Visible clause handle — click to select entire clause */}
                <span
                  className={`text-[13px] font-sans px-1 py-0.5 rounded cursor-pointer select-none transition-all
                    ${factorSel
                      ? 'text-indigo-600 font-bold bg-indigo-100/70'
                      : 'text-slate-400 opacity-40 group-hover:opacity-100 hover:text-indigo-600 hover:bg-slate-200/60'
                    }`}
                  title="Click to select clause (Absorption / Idempotent)"
                  onClick={e => { e.stopPropagation(); onClickTerm(fPath) }}
                >
                  ⠿
                </span>

                {f.type === 'sum' ? (
                  <>
                    <span className="text-text-3">(</span>
                    <ExprNode node={f} path={fPath} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} onSwapTerms={onSwapTerms} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
                    <span className="text-text-3">)</span>
                  </>
                ) : (
                  <ExprNode node={f} path={fPath} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} onSwapTerms={onSwapTerms} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
                )}
              </motion.span>
            ) : (
              f.type === 'sum' ? (
                <>
                  <span className="text-text-3">(</span>
                  <ExprNode node={f} path={fPath} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} onSwapTerms={onSwapTerms} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
                  <span className="text-text-3">)</span>
                </>
              ) : (
                <ExprNode node={f} path={fPath} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} onSwapTerms={onSwapTerms} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
              )
            )}
          </motion.span>
        )
      })}
    </motion.span>
  )
}

/* ── Sum (OR): terms separated by + with selectable/draggable term wrappers ── */
function SumNode({ node, path, sel, onClickLit, onClickNot, onClickTerm, onSwapTerms, activeGuidePaths, animationPaths, animationLaw }) {
  const hasMultiple = node.terms.length >= 2 && (path === 'R' || node.terms.some(t => t.type === 'prod' || t.type === 'not'))
  const dragOverIdx = useRef(null)
  const dragSrc = useRef({ sumPath: null, idx: null })

  const handleDragStart = (sumPath, idx, e) => {
    dragSrc.current.sumPath = sumPath
    dragSrc.current.idx = idx
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
    e.currentTarget.classList.add('opacity-45', 'border-border-dark', '!border-solid')
  }

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('opacity-45', 'border-border-dark', '!border-solid')
    // Clear all drag-over highlights
    document.querySelectorAll('[data-dragover="true"]').forEach(el => {
      el.removeAttribute('data-dragover')
      el.className = el.className.replace(/border-amber bg-amber-light scale-\[1\.04\] !border-solid/g, '')
    })
    dragSrc.current.sumPath = null
    dragSrc.current.idx = null
    dragOverIdx.current = null
  }

  const handleDragOver = (sumPath, idx, e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragSrc.current.sumPath === sumPath && dragSrc.current.idx !== idx) {
      if (!e.currentTarget.hasAttribute('data-dragover')) {
        e.currentTarget.setAttribute('data-dragover', 'true')
        e.currentTarget.className += ' border-amber bg-amber-light scale-[1.04] !border-solid'
      }
      dragOverIdx.current = idx
    }
  }

  const handleDragLeave = (e) => {
    if (e.currentTarget.hasAttribute('data-dragover')) {
      e.currentTarget.removeAttribute('data-dragover')
      e.currentTarget.className = e.currentTarget.className.replace(/ border-amber bg-amber-light scale-\[1\.04\] !border-solid/g, '')
    }
  }

  const handleDrop = (sumPath, idx, e) => {
    e.preventDefault()
    if (e.currentTarget.hasAttribute('data-dragover')) {
      e.currentTarget.removeAttribute('data-dragover')
      e.currentTarget.className = e.currentTarget.className.replace(/ border-amber bg-amber-light scale-\[1\.04\] !border-solid/g, '')
    }
    if (dragSrc.current.sumPath === sumPath && dragSrc.current.idx !== null && dragSrc.current.idx !== idx) {
      if (onSwapTerms) onSwapTerms(sumPath, dragSrc.current.idx, idx)
    }
    dragSrc.current.sumPath = null
    dragSrc.current.idx = null
  }

  const isAnimatingHide = isNodeAnimatingHide(path, animationPaths, animationLaw)

  return (
    <motion.span layout transition={transitionConfig} className={`inline-flex flex-wrap items-center gap-0.5 ${isAnimatingHide ? 'opacity-0 pointer-events-none' : ''}`}>
      {node.terms.map((t, i) => {
        const tPath = `${path}.${i}`
        const termSel = sel.some(s => s.path === tPath)
        const isGuide = activeGuidePaths?.includes(tPath)
        const termAnimatingHide = isNodeAnimatingHide(tPath, animationPaths, animationLaw)

        return (
          <motion.span layout transition={transitionConfig} key={i} className="inline-flex items-center">
            {i > 0 && (
              <span className={`text-text-2 font-normal ${termAnimatingHide && isNodeAnimatingHide(`${path}.${i - 1}`, animationPaths, animationLaw) ? 'opacity-0 pointer-events-none' : ''}`}>
                {' '}+{' '}
              </span>
            )}

            {hasMultiple ? (
              <motion.span
                layout
                transition={transitionConfig}
                data-path={tPath}
                className={`inline-flex items-center px-1.5 py-[2px] rounded-lg border-[1.5px] transition-all gap-1 cursor-default group
                  ${termSel
                    ? 'border-indigo-500 bg-indigo-50/80 shadow-xs !border-solid'
                    : 'border-transparent hover:border-slate-300 hover:bg-slate-50/70 border-dashed'
                  }
                  ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''}
                  ${termAnimatingHide ? 'opacity-0 pointer-events-none' : ''}
                `}
                draggable={true}
                onDoubleClick={e => { e.stopPropagation(); onClickTerm(tPath) }}
                onDragStart={e => handleDragStart(path, i, e)}
                onDragEnd={handleDragEnd}
                onDragOver={e => handleDragOver(path, i, e)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(path, i, e)}
              >
                {/* Visible term handle — click to select entire term */}
                <span
                  className={`text-[13px] font-sans px-1 py-0.5 rounded cursor-pointer select-none transition-all
                    ${termSel
                      ? 'text-indigo-600 font-bold bg-indigo-100/70'
                      : 'text-slate-400 opacity-40 group-hover:opacity-100 hover:text-indigo-600 hover:bg-slate-200/60'
                    }`}
                  title="Click to select entire term (Absorption / Idempotent)"
                  onClick={e => { e.stopPropagation(); onClickTerm(tPath) }}
                >
                  ⠿
                </span>

                <ExprNode
                  node={t}
                  path={tPath}
                  sel={sel}
                  onClickLit={onClickLit}
                  onClickNot={onClickNot}
                  onClickTerm={onClickTerm}
                  onSwapTerms={onSwapTerms}
                  activeGuidePaths={activeGuidePaths}
                  animationPaths={animationPaths}
                  animationLaw={animationLaw}
                />
              </motion.span>
            ) : (
              <motion.span layout transition={transitionConfig} className={isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''}>
                <ExprNode
                  node={t}
                  path={tPath}
                  sel={sel}
                  onClickLit={onClickLit}
                  onClickNot={onClickNot}
                  onClickTerm={onClickTerm}
                  onSwapTerms={onSwapTerms}
                  activeGuidePaths={activeGuidePaths}
                  animationPaths={animationPaths}
                  animationLaw={animationLaw}
                />
              </motion.span>
            )}
          </motion.span>
        )
      })}
    </motion.span>
  )
}

/* ── Recursive dispatcher ── */
function ExprNode({ node, path, sel, onClickLit, onClickNot, onClickTerm, onSwapTerms, activeGuidePaths, animationPaths, animationLaw }) {
  if (!node) return null
  if (node.type === 'lit' || node.type === 'const')
    return <LitNode node={node} path={path} sel={sel} onClickLit={onClickLit} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
  if (node.type === 'not')
    return <NotNode node={node} path={path} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
  if (node.type === 'prod')
    return <ProdNode node={node} path={path} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} onSwapTerms={onSwapTerms} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
  if (node.type === 'sum')
    return <SumNode node={node} path={path} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} onSwapTerms={onSwapTerms} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
  return null
}

/* ── Public component ── */
export default function ExpressionDisplay({ expr, sel, onClickLit, onClickNot, onClickTerm, onSwapTerms, activeGuidePaths, animationPaths, animationLaw }) {
  if (!expr) return null
  return (
    <div className="font-mono text-[22px] font-medium text-text-1 leading-[1.8] text-center select-none tracking-[0.5px]">
      <ExprNode
        node={expr}
        path="R"
        sel={sel}
        onClickLit={onClickLit}
        onClickNot={onClickNot}
        onClickTerm={onClickTerm}
        onSwapTerms={onSwapTerms}
        activeGuidePaths={activeGuidePaths}
        animationPaths={animationPaths}
        animationLaw={animationLaw}
      />
    </div>
  )
}

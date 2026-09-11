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

import { useState, useRef } from 'react'
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
      className={`inline-flex items-baseline px-1 py-[2px] rounded-[4px] cursor-pointer transition-all border-[1.5px]
        ${selected ? 'bg-teal-light border-teal text-teal font-semibold' : 'border-transparent hover:bg-teal-light/60 hover:border-teal/60 hover:text-teal'}
        ${node.type === 'const' ? 'text-text-3 font-semibold' : ''}
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
function NotNode({ node, path, sel, onClickLit, onClickNot, onClickTerm, onSwapTerms, activeGuidePaths, animationPaths, animationLaw }) {
  const selected = isSelected(sel, path)
  const isGuide = activeGuidePaths?.includes(path)
  const isAnimatingHide = isNodeAnimatingHide(path, animationPaths, animationLaw)
  return (
    <motion.span
      layout
      transition={transitionConfig}
      className={`inline-flex items-baseline px-0.5 py-[2px] rounded-[5px] cursor-pointer transition-all border-[1.5px]
        ${selected ? 'bg-amber-light border-amber' : 'border-transparent hover:bg-amber-light/60 hover:border-amber/60'}
        ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''}
        ${isAnimatingHide ? 'opacity-0 pointer-events-none' : ''}
      `}
      data-path={path}
      data-tutorial="not-capsule"
      onClick={e => { e.stopPropagation(); onClickNot(path) }}
    >
      {/* Parens are OUTSIDE the border-top span so only the inner content gets the bar */}
      <span className="text-text-3">(</span>
      <span style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        borderTop: '1.8px solid currentColor',
        paddingTop: '2px',
      }}>
        <ExprNode
          node={node.child}
          path={`${path}.0`}
          sel={sel}
          onClickLit={onClickLit}
          onClickNot={onClickNot}
          onClickTerm={onClickTerm}
          onSwapTerms={onSwapTerms}
          activeGuidePaths={activeGuidePaths}
          animationPaths={animationPaths}
          animationLaw={animationLaw}
        />
      </span>
      <span className="text-text-3">)</span>
    </motion.span>
  )
}

/* ── Product (AND): juxtaposition with selectable/draggable factor/clause capsules ── */
function ProdNode({ node, path, sel, onClickLit, onClickNot, onClickTerm, onSwapTerms, activeGuidePaths, animationPaths, animationLaw }) {
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [dragSourceIdx, setDragSourceIdx] = useState(null)

  if (!node || !Array.isArray(node.factors)) return null
  const isGuide = activeGuidePaths?.includes(path)
  const isAnimatingHide = isNodeAnimatingHide(path, animationPaths, animationLaw)
  const isTopLevel = path === 'R'
  const hasMultiple = isTopLevel && node.factors.length >= 2

  const handleDragStart = (idx, e) => {
    setDragSourceIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }

  const handleDragEnd = () => {
    setDragSourceIdx(null)
    setDragOverIdx(null)
  }

  const handleDragOver = (idx, e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragSourceIdx !== null && dragSourceIdx !== idx) {
      setDragOverIdx(idx)
    }
  }

  const handleDragLeave = (idx) => {
    if (dragOverIdx === idx) {
      setDragOverIdx(null)
    }
  }

  const handleDrop = (idx, e) => {
    e.preventDefault()
    if (dragSourceIdx !== null && dragSourceIdx !== idx) {
      if (onSwapTerms) onSwapTerms(path, dragSourceIdx, idx)
    }
    setDragSourceIdx(null)
    setDragOverIdx(null)
  }

  return (
    <motion.span layout transition={transitionConfig} data-path={path} className={`inline-flex items-center gap-0 ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''} ${isAnimatingHide ? 'opacity-0 pointer-events-none' : ''}`}>
      {node.factors.map((f, i) => {
        const fPath = `${path}.${i}`
        const factorSel = sel.some(s => s.path === fPath)
        const isFactorGuide = activeGuidePaths?.includes(fPath)
        const factorAnimatingHide = isNodeAnimatingHide(fPath, animationPaths, animationLaw)
        const prevIsConst = i > 0 && node.factors[i - 1]?.type === 'const'
        const currIsConst = f?.type === 'const'
        const isSumClause = f?.type === 'sum'
        const isDragging = dragSourceIdx === i
        const isDragTarget = dragOverIdx === i

        return (
          <motion.span layout transition={transitionConfig} key={f._id || fPath} className="inline-flex items-center">
            {(prevIsConst || currIsConst) && i > 0 && (
              <span className={`text-text-3 mx-0.5 text-[0.9em] ${factorAnimatingHide && isNodeAnimatingHide(`${path}.${i - 1}`, animationPaths, animationLaw) ? 'opacity-0 pointer-events-none' : ''}`}> · </span>
            )}
            {hasMultiple ? (
              <motion.span
                layout
                transition={transitionConfig}
                data-path={fPath}
                data-tutorial={`term-${i}`}
                className={`relative inline-flex items-center px-1.5 py-[2px] rounded-lg border-[1.5px] transition-all cursor-grab active:cursor-grabbing group
                  ${isDragTarget ? 'border-amber bg-amber-light scale-[1.04] !border-solid' : ''}
                  ${isDragging ? 'opacity-45 border-border-dark !border-solid' : ''}
                  ${factorSel
                    ? 'border-indigo-500 bg-indigo-50/80 shadow-xs !border-solid'
                    : 'border-transparent hover:border-slate-300/80 hover:bg-slate-50/80 border-dashed'
                  }
                  ${isFactorGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''}
                  ${factorAnimatingHide ? 'opacity-0 pointer-events-none' : ''}
                `}
                draggable={true}
                title="Click clause grip to select whole clause, or click variable inside"
                onClick={e => { e.stopPropagation(); onClickTerm(fPath) }}
                onDragStart={e => handleDragStart(i, e)}
                onDragEnd={handleDragEnd}
                onDragOver={e => handleDragOver(i, e)}
                onDragLeave={() => handleDragLeave(i)}
                onDrop={e => handleDrop(i, e)}
              >
                {/* Floating Top Grip Badge on Hover / Selected */}
                <button
                  type="button"
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold select-none cursor-pointer transition-all duration-150 shadow-xs z-30 flex items-center justify-center
                    ${factorSel
                      ? 'opacity-100 bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200 scale-100'
                      : 'opacity-0 group-hover:opacity-100 bg-slate-700/90 text-white hover:bg-indigo-600 hover:scale-105 pointer-events-none group-hover:pointer-events-auto'
                    }
                  `}
                  title="Select entire clause (Dual Absorption / Idempotent)"
                  onClick={e => {
                    e.stopPropagation()
                    onClickTerm(fPath)
                  }}
                >
                  ⠿
                </button>

                {isSumClause ? (
                  <>
                    <span className="text-text-3 font-normal">(</span>
                    <ExprNode
                      node={f}
                      path={fPath}
                      sel={sel}
                      onClickLit={onClickLit}
                      onClickNot={onClickNot}
                      onClickTerm={onClickTerm}
                      onSwapTerms={onSwapTerms}
                      activeGuidePaths={activeGuidePaths}
                      animationPaths={animationPaths}
                      animationLaw={animationLaw}
                    />
                    <span className="text-text-3 font-normal">)</span>
                  </>
                ) : (
                  <ExprNode
                    node={f}
                    path={fPath}
                    sel={sel}
                    onClickLit={onClickLit}
                    onClickNot={onClickNot}
                    onClickTerm={onClickTerm}
                    onSwapTerms={onSwapTerms}
                    activeGuidePaths={activeGuidePaths}
                    animationPaths={animationPaths}
                    animationLaw={animationLaw}
                  />
                )}
              </motion.span>
            ) : (
              <motion.span layout transition={transitionConfig} className={isFactorGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''}>
                {isSumClause ? (
                  <>
                    <span className="text-text-3 font-normal">(</span>
                    <ExprNode node={f} path={fPath} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} onSwapTerms={onSwapTerms} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
                    <span className="text-text-3 font-normal">)</span>
                  </>
                ) : (
                  <ExprNode node={f} path={fPath} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} onSwapTerms={onSwapTerms} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
                )}
              </motion.span>
            )}
          </motion.span>
        )
      })}
    </motion.span>
  )
}

/* ── Sum (OR): terms separated by + with selectable/draggable term capsules ── */
function SumNode({ node, path, sel, onClickLit, onClickNot, onClickTerm, onSwapTerms, activeGuidePaths, animationPaths, animationLaw }) {
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [dragSourceIdx, setDragSourceIdx] = useState(null)

  if (!node || !Array.isArray(node.terms)) return null
  const isTopLevel = path === 'R'
  const hasMultiple = isTopLevel && node.terms.length >= 2

  const handleDragStart = (idx, e) => {
    setDragSourceIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }

  const handleDragEnd = () => {
    setDragSourceIdx(null)
    setDragOverIdx(null)
  }

  const handleDragOver = (idx, e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragSourceIdx !== null && dragSourceIdx !== idx) {
      setDragOverIdx(idx)
    }
  }

  const handleDragLeave = (idx) => {
    if (dragOverIdx === idx) {
      setDragOverIdx(null)
    }
  }

  const handleDrop = (idx, e) => {
    e.preventDefault()
    if (dragSourceIdx !== null && dragSourceIdx !== idx) {
      if (onSwapTerms) onSwapTerms(path, dragSourceIdx, idx)
    }
    setDragSourceIdx(null)
    setDragOverIdx(null)
  }

  const isAnimatingHide = isNodeAnimatingHide(path, animationPaths, animationLaw)

  return (
    <motion.span layout transition={transitionConfig} className={`inline-flex flex-wrap items-center gap-0 ${isAnimatingHide ? 'opacity-0 pointer-events-none' : ''}`}>
      {node.terms.map((t, i) => {
        const tPath = `${path}.${i}`
        const termSel = sel.some(s => s.path === tPath)
        const isGuide = activeGuidePaths?.includes(tPath)
        const termAnimatingHide = isNodeAnimatingHide(tPath, animationPaths, animationLaw)
        const isDragging = dragSourceIdx === i
        const isDragTarget = dragOverIdx === i

        return (
          <motion.span layout transition={transitionConfig} key={t._id || tPath} className="inline-flex items-center">
            {i > 0 && (
              <span className={`text-text-2 font-normal mx-1.5 select-none ${termAnimatingHide && isNodeAnimatingHide(`${path}.${i - 1}`, animationPaths, animationLaw) ? 'opacity-0 pointer-events-none' : ''}`}>
                +
              </span>
            )}

            {hasMultiple ? (
              <motion.span
                layout
                transition={transitionConfig}
                data-path={tPath}
                data-tutorial={`term-${i}`}
                className={`relative inline-flex items-center px-1.5 py-[2px] rounded-lg border-[1.5px] transition-all cursor-grab active:cursor-grabbing group
                  ${isDragTarget ? 'border-amber bg-amber-light scale-[1.04] !border-solid' : ''}
                  ${isDragging ? 'opacity-45 border-border-dark !border-solid' : ''}
                  ${termSel
                    ? 'border-indigo-500 bg-indigo-50/80 shadow-xs !border-solid'
                    : 'border-transparent hover:border-slate-300/80 hover:bg-slate-50/80 border-dashed'
                  }
                  ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''}
                  ${termAnimatingHide ? 'opacity-0 pointer-events-none' : ''}
                `}
                draggable={true}
                title="Click term grip to select whole term, or click variable inside"
                onClick={e => { e.stopPropagation(); onClickTerm(tPath) }}
                onDragStart={e => handleDragStart(i, e)}
                onDragEnd={handleDragEnd}
                onDragOver={e => handleDragOver(i, e)}
                onDragLeave={() => handleDragLeave(i)}
                onDrop={e => handleDrop(i, e)}
              >
                {/* Floating Top Grip Badge on Hover / Selected */}
                <button
                  type="button"
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold select-none cursor-pointer transition-all duration-150 shadow-xs z-30 flex items-center justify-center
                    ${termSel
                      ? 'opacity-100 bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200 scale-100'
                      : 'opacity-0 group-hover:opacity-100 bg-slate-700/90 text-white hover:bg-indigo-600 hover:scale-105 pointer-events-none group-hover:pointer-events-auto'
                    }
                  `}
                  title="Select entire term (Absorption / Idempotent)"
                  onClick={e => {
                    e.stopPropagation()
                    onClickTerm(tPath)
                  }}
                >
                  ⠿
                </button>

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
                <ExprNode node={t} path={tPath} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} onSwapTerms={onSwapTerms} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
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
    return <NotNode node={node} path={path} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} onSwapTerms={onSwapTerms} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
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

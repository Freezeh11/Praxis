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

/* ── Literal node (variable or constant) ── */
function LitNode({ node, path, sel, onClickLit, activeGuidePaths, animationPaths, animationLaw }) {
  const selected = isSelected(sel, path)
  const isGuide = activeGuidePaths?.includes(path)
  const isAnimatingHide = animationPaths?.includes(path) && ['annulment', 'identity', 'idempotent', 'complement'].includes(animationLaw)
  return (
    <motion.span
      layout
      transition={transitionConfig}
      className={`inline-flex items-baseline px-[7px] py-[3px] rounded-[5px] cursor-pointer transition-all border-[1.5px]
        ${selected ? 'bg-teal-light border-teal text-teal' : 'border-transparent hover:bg-teal-light hover:border-teal hover:text-teal'}
        ${node.type === 'const' ? 'text-text-3' : ''}
        ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal shadow-[0_0_0_6px_rgba(46,196,182,0)] animate-[guidePulse_2s_infinite] z-10' : ''}
        ${isAnimatingHide ? 'opacity-0' : ''}
      `}
      data-path={path}
      onClick={e => { e.stopPropagation(); onClickLit(path) }}
    >
      {node.type === 'lit' ? (
        node.n
          ? <span style={{ borderTop: '1.8px solid currentColor', paddingTop: '2px', display: 'inline-block' }}>{node.v}</span>
          : node.v
      ) : node.val}
    </motion.span>
  )
}

/* ── NOT group: (child)' ── */
function NotNode({ node, path, sel, onClickLit, onClickNot, onClickTerm, activeGuidePaths, animationPaths, animationLaw }) {
  const selected = isSelected(sel, path)
  const isGuide = activeGuidePaths?.includes(path)
  const isAnimatingHide = animationPaths?.includes(path) && ['annulment', 'identity', 'idempotent', 'complement'].includes(animationLaw)
  return (
    <motion.span
      layout
      transition={transitionConfig}
      className={`inline-flex items-baseline px-1 py-[3px] rounded-[5px] cursor-pointer transition-all border-[1.5px]
        ${selected ? 'bg-amber-light border-amber' : 'border-transparent hover:bg-amber-light hover:border-amber'}
        ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''}
        ${isAnimatingHide ? 'opacity-0' : ''}
      `}
      data-path={path}
      onClick={e => { e.stopPropagation(); onClickNot(path) }}
    >
      {/* Single continuous overline bar via border-top on the whole group */}
      <span style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        borderTop: '1.8px solid currentColor',
        paddingTop: '2px',
      }}>
        <span className="text-text-3" style={{ textDecoration: 'none' }}>(</span>
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
        <span className="text-text-3" style={{ textDecoration: 'none' }}>)</span>
      </span>
    </motion.span>
  )
}

/* ── Product (AND): juxtaposition ── */
function ProdNode({ node, path, sel, onClickLit, onClickNot, onClickTerm, activeGuidePaths, animationPaths, animationLaw }) {
  const isGuide = activeGuidePaths?.includes(path)
  const isAnimatingHide = animationPaths?.includes(path) && ['annulment', 'identity', 'idempotent', 'complement'].includes(animationLaw)
  return (
    <motion.span layout transition={transitionConfig} data-path={path} className={`inline-flex items-center ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''} ${isAnimatingHide ? 'opacity-0' : ''}`}>
      {node.factors.map((f, i) => {
        const fPath = `${path}.${i}`
        const prevIsConst = i > 0 && node.factors[i - 1].type === 'const'
        const currIsConst = f.type === 'const'
        return (
          <motion.span layout transition={transitionConfig} key={i} className="inline-flex items-center">
            {(prevIsConst || currIsConst) && i > 0 && (
              <span className="text-text-3 mx-0.5 text-[0.9em]"> · </span>
            )}
            {f.type === 'sum' ? (
              <>
                <span className="text-text-3">(</span>
                <ExprNode node={f} path={fPath} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
                <span className="text-text-3">)</span>
              </>
            ) : (
              <ExprNode node={f} path={fPath} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
            )}
          </motion.span>
        )
      })}
    </motion.span>
  )
}

/* ── Sum (OR): terms separated by + with selectable/draggable term wrappers ── */
function SumNode({ node, path, sel, onClickLit, onClickNot, onClickTerm, onSwapTerms, activeGuidePaths, animationPaths, animationLaw }) {
  const hasMultiple = node.terms.length >= 2
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
      onSwapTerms(sumPath, dragSrc.current.idx, idx)
    }
    dragSrc.current.sumPath = null
    dragSrc.current.idx = null
  }

  const isAnimatingHide = animationPaths?.includes(path) && ['annulment', 'identity', 'idempotent', 'complement'].includes(animationLaw)

  return (
    <motion.span layout transition={transitionConfig} className={`inline-flex flex-wrap items-center gap-0.5 ${isAnimatingHide ? 'opacity-0' : ''}`}>
      {node.terms.map((t, i) => {
        const tPath = `${path}.${i}`
        const termSel = sel.some(s => s.path === tPath)
        const isGuide = activeGuidePaths?.includes(tPath)

        return (
          <motion.span layout transition={transitionConfig} key={i} className="inline-flex items-center">
            {i > 0 && <span className="text-text-2 font-normal"> + </span>}

            {hasMultiple ? (
              <motion.span
                layout
                transition={transitionConfig}
                data-path={tPath}
                className={`inline-flex items-center px-1.5 py-[3px] pl-0.5 rounded-md border-[1.5px] border-dashed transition-all gap-0.5 cursor-default group
                  ${termSel ? 'border-teal bg-teal-light !border-solid' : 'border-transparent hover:border-border-dark hover:bg-bg'}
                  ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''}
                  ${animationPaths?.includes(tPath) && ['annulment','identity','idempotent','complement'].includes(animationLaw) ? 'opacity-0' : ''}
                `}
                draggable={true}
                onDragStart={e => handleDragStart(path, i, e)}
                onDragEnd={handleDragEnd}
                onDragOver={e => handleDragOver(path, i, e)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(path, i, e)}
              >
                {/* Invisible zone — click to select term, drag to reorder */}
                <span
                  className="w-2 h-full min-h-[1.6em] shrink-0 cursor-grab rounded-[3px] transition-colors group-hover:bg-sky-500/10 active:cursor-grabbing"
                  title="Click to select term · Drag to reorder"
                  onClick={e => { e.stopPropagation(); onClickTerm(tPath) }}
                />

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
    return <ProdNode node={node} path={path} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
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

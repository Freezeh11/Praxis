/**
 * ExpressionDisplay — Renders a Boolean expression tree as interactive React elements.
 *
 * Each SOP term gets a ⠿ handle:
 *   • Click handle → select the whole term (for Idempotent / Absorption)
 *   • Drag handle  → reorder terms inside the same sum
 *
 * Dragging is implemented ONCE for both sum terms and product factors by the
 * pointer-event hook `hooks/useTermDrag` (mouse + touch + pen). The markup the
 * two node kinds share lives in `DragCapsule` below; only the two title strings
 * differ between a term and a factor/clause.
 *
 * Clicking a literal (variable) → onClickLit(path)
 * Clicking a NOT group          → onClickNot(path)
 *
 * `touchTargets` (opt-in, set by ProblemPage on touch tiers only) enlarges the
 * clickable boxes of literals, NOT capsules and term grips to >=44x44 CSS px and
 * makes the grips permanently visible, since a touch device has no hover. The
 * default (desktop) rendering is untouched: the flag travels through context so
 * every recursive node picks it up without changing any call site.
 */

import { createContext, useContext } from 'react'
import { motion } from 'framer-motion'

import useTermDrag from '../hooks/useTermDrag.js'

const transitionConfig = { type: 'spring', bounce: 0.15, duration: 0.5 }

/** True only inside an ExpressionDisplay rendered with `touchTargets`. */
const TouchTargetsContext = createContext(false)

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
  const touchTargets = useContext(TouchTargetsContext)
  return (
    <motion.span
      layout
      transition={transitionConfig}
      className={`inline-flex items-baseline rounded-[4px] cursor-pointer transition-all border-[1.5px] touch-none select-none
        ${touchTargets ? 'px-2 py-0.5 min-w-[32px] justify-center' : 'px-1 py-[2px]'}
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
  const touchTargets = useContext(TouchTargetsContext)
  return (
    <motion.span
      layout
      transition={transitionConfig}
      className={`inline-flex items-baseline rounded-[5px] cursor-pointer transition-all border-[1.5px] touch-none select-none
        ${touchTargets ? 'px-1 py-0.5' : 'px-0.5 py-[2px]'}
        ${selected ? 'bg-amber-light border-amber' : 'border-transparent hover:bg-amber-light/60 hover:border-amber/60'}
        ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''}
        ${isAnimatingHide ? 'opacity-0 pointer-events-none' : ''}
      `}
      data-path={path}
      data-tutorial="not-capsule"
      onClick={e => { e.stopPropagation(); onClickNot(path) }}
    >
      {/* Parens are OUTSIDE the overline container so only the inner content gets the bar */}
      <span className="text-text-3 select-none self-center">(</span>
      <span className="relative inline-flex items-baseline">
        {/* Dedicated overline negation bar button with generous touch target */}
        <button
          type="button"
          data-tutorial="not-bar"
          aria-label="Negation overline bar: click to apply De Morgan's Law"
          title="Negation overline bar: click to apply De Morgan's Law"
          className={`absolute left-0 right-0 z-20 flex items-center justify-center cursor-pointer touch-none group/notbar select-none ${
            touchTargets ? '-top-3.5 h-7 pt-1' : '-top-2 h-4'
          }`}
          onClick={e => {
            e.stopPropagation()
            onClickNot(path)
          }}
        >
          {/* Overline bar line */}
          <span
            className={`w-full rounded-full transition-all duration-150 ${
              touchTargets ? 'h-[3px]' : 'h-[2px]'
            } ${
              selected
                ? 'bg-amber-600 shadow-[0_0_8px_rgba(245,158,11,0.5)] ring-1 ring-amber-400'
                : isGuide
                  ? 'bg-teal animate-[pulse_1.5s_infinite]'
                  : 'bg-current group-hover/notbar:bg-amber-500 group-active/notbar:bg-amber-600'
            }`}
          />
        </button>

        {/* Inner expression with clearance under the overline bar */}
        <span className={`inline-flex items-baseline ${touchTargets ? 'pt-1.5 pb-0.5' : 'pt-0.5'}`}>
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
      </span>
      <span className="text-text-3 select-none self-center">)</span>
    </motion.span>
  )
}

/* ── Reorderable capsule shared by SumNode (terms) and ProdNode (factors) ──
   The drag behaviour lives in hooks/useTermDrag; this wrapper only supplies the
   capsule markup, which is identical for both node kinds apart from the copy in
   the two titles. `data-drag-index`/`data-drag-group` are the hit-testing
   contract the hook uses to find the sibling under the pointer. */
function DragCapsule({ group, index, onSwapTerms, onSelect, selected, isGuide, isAnimatingHide, wrapperTitle, gripTitle, children }) {
  const touchTargets = useContext(TouchTargetsContext)
  const { isDragging, isDragTarget, handlers } = useTermDrag({ group, index, onSwapTerms })

  return (
    <motion.span
      layout
      transition={transitionConfig}
      data-path={`${group}.${index}`}
      data-tutorial={`term-${index}`}
      data-drag-index={index}
      data-drag-group={group}
      className={`relative inline-flex items-baseline px-1.5 rounded-lg border-[1.5px] transition-all cursor-grab active:cursor-grabbing group touch-none select-none ${touchTargets ? 'py-1' : 'py-[2px]'}
        ${isDragTarget ? 'border-amber bg-amber-light scale-[1.04] !border-solid' : ''}
        ${isDragging ? 'opacity-45 border-border-dark !border-solid' : ''}
        ${selected
          ? 'border-indigo-500 bg-indigo-50/80 shadow-xs !border-solid'
          : 'border-transparent hover:border-slate-300/80 hover:bg-slate-50/80 border-dashed'
        }
        ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''}
        ${isAnimatingHide ? 'opacity-0 pointer-events-none' : ''}
      `}
      title={wrapperTitle}
      onClick={e => { e.stopPropagation(); onSelect() }}
      {...handlers}
    >
      {/* Floating Top Grip Badge on Hover / Selected / Touch. `touch-none` on the
          handle is what lets a finger start the drag instead of scrolling. */}
      <button
        type="button"
        className={`touch-none absolute -top-3.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] leading-none font-bold select-none cursor-pointer transition-all duration-150 shadow-xs z-30 flex items-center justify-center ${selected
          ? 'opacity-100 bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200 scale-100'
          : touchTargets
            ? 'opacity-85 bg-slate-700/85 text-white hover:opacity-100 active:bg-indigo-600 active:scale-105'
            : 'opacity-0 group-hover:opacity-100 bg-slate-700/90 text-white hover:bg-indigo-600 hover:scale-105 pointer-events-none group-hover:pointer-events-auto'}`}
        title={gripTitle}
        onClick={e => {
          e.stopPropagation()
          onSelect()
        }}
      >
        ⠿
      </button>

      {children}
    </motion.span>
  )
}

/* ── Product (AND): juxtaposition with selectable/draggable factor/clause capsules ── */
function ProdNode({ node, path, sel, onClickLit, onClickNot, onClickTerm, onSwapTerms, activeGuidePaths, animationPaths, animationLaw }) {
  if (!node || !Array.isArray(node.factors)) return null
  const isGuide = activeGuidePaths?.includes(path)
  const isAnimatingHide = isNodeAnimatingHide(path, animationPaths, animationLaw)
  const isTopLevel = path === 'R'
  const hasMultiple = isTopLevel && node.factors.length >= 2

  return (
    <motion.span layout transition={transitionConfig} data-path={path} className={`inline-flex items-baseline gap-0 ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''} ${isAnimatingHide ? 'opacity-0 pointer-events-none' : ''}`}>
      {node.factors.map((f, i) => {
        const fPath = `${path}.${i}`
        const factorSel = sel.some(s => s.path === fPath)
        const isFactorGuide = activeGuidePaths?.includes(fPath)
        const factorAnimatingHide = isNodeAnimatingHide(fPath, animationPaths, animationLaw)
        const prevIsConst = i > 0 && node.factors[i - 1]?.type === 'const'
        const currIsConst = f?.type === 'const'
        const isSumClause = f?.type === 'sum'

        return (
          <motion.span layout transition={transitionConfig} key={f._id || fPath} className="inline-flex items-baseline">
            {(prevIsConst || currIsConst) && i > 0 && (
              <span className={`text-text-3 mx-0.5 text-[0.9em] self-center ${factorAnimatingHide && isNodeAnimatingHide(`${path}.${i - 1}`, animationPaths, animationLaw) ? 'opacity-0 pointer-events-none' : ''}`}> · </span>
            )}
            {hasMultiple ? (
              <DragCapsule
                group={path}
                index={i}
                onSwapTerms={onSwapTerms}
                onSelect={() => onClickTerm(fPath)}
                selected={factorSel}
                isGuide={isFactorGuide}
                isAnimatingHide={factorAnimatingHide}
                wrapperTitle="Click clause grip to select whole clause, or click variable inside"
                gripTitle="Clause grip: select the whole clause (Dual Absorption / Idempotent)"
              >
                {isSumClause ? (
                  <>
                    <span className="text-text-3 font-normal self-center">(</span>
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
                    <span className="text-text-3 font-normal self-center">)</span>
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
              </DragCapsule>
            ) : (
              <motion.span
                layout
                transition={transitionConfig}
                data-path={fPath}
                className={`inline-flex items-baseline ${isFactorGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''} ${factorAnimatingHide ? 'opacity-0 pointer-events-none' : ''}`}
                onClick={isSumClause ? (e) => { e.stopPropagation(); onClickTerm(fPath) } : undefined}
              >
                {isSumClause ? (
                  <>
                    <span className="text-text-3 font-normal self-center">(</span>
                    <ExprNode node={f} path={fPath} sel={sel} onClickLit={onClickLit} onClickNot={onClickNot} onClickTerm={onClickTerm} onSwapTerms={onSwapTerms} activeGuidePaths={activeGuidePaths} animationPaths={animationPaths} animationLaw={animationLaw} />
                    <span className="text-text-3 font-normal self-center">)</span>
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
  if (!node || !Array.isArray(node.terms)) return null
  const isTopLevel = path === 'R'
  const hasMultiple = isTopLevel && node.terms.length >= 2

  const isAnimatingHide = isNodeAnimatingHide(path, animationPaths, animationLaw)

  return (
    <motion.span layout transition={transitionConfig} className={`inline-flex ${isTopLevel ? 'flex-wrap' : 'flex-nowrap whitespace-nowrap'} items-baseline gap-0 ${isAnimatingHide ? 'opacity-0 pointer-events-none' : ''}`}>
      {node.terms.map((t, i) => {
        const tPath = `${path}.${i}`
        const termSel = sel.some(s => s.path === tPath)
        const isGuide = activeGuidePaths?.includes(tPath)
        const termAnimatingHide = isNodeAnimatingHide(tPath, animationPaths, animationLaw)

        return (
          <motion.span layout transition={transitionConfig} key={t._id || tPath} className="inline-flex items-baseline">
            {i > 0 && (
              <span className={`text-text-2 font-normal mx-1.5 select-none self-center ${termAnimatingHide && isNodeAnimatingHide(`${path}.${i - 1}`, animationPaths, animationLaw) ? 'opacity-0 pointer-events-none' : ''}`}>
                +
              </span>
            )}

            {hasMultiple ? (
              <DragCapsule
                group={path}
                index={i}
                onSwapTerms={onSwapTerms}
                onSelect={() => onClickTerm(tPath)}
                selected={termSel}
                isGuide={isGuide}
                isAnimatingHide={termAnimatingHide}
                wrapperTitle="Click term grip to select whole term, or click variable inside"
                gripTitle="Term grip: select the whole term (Absorption / Idempotent)"
              >
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
              </DragCapsule>
            ) : (
              <motion.span
                layout
                transition={transitionConfig}
                data-path={tPath}
                className={`inline-flex items-baseline ${isGuide ? 'relative rounded-md bg-teal/10 border border-dashed border-teal animate-[guidePulse_2s_infinite] z-10' : ''} ${termAnimatingHide ? 'opacity-0 pointer-events-none' : ''}`}
                onClick={(e) => { e.stopPropagation(); onClickTerm(tPath) }}
              >
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
export default function ExpressionDisplay({ expr, sel, onClickLit, onClickNot, onClickTerm, onSwapTerms, activeGuidePaths, animationPaths, animationLaw, touchTargets = false }) {
  if (!expr) return null
  return (
    <TouchTargetsContext.Provider value={Boolean(touchTargets)}>
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
    </TouchTargetsContext.Provider>
  )
}

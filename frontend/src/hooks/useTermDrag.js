/**
 * useTermDrag — ONE pointer-event drag implementation for the reorderable term
 * (sum) and factor (product) capsules rendered by components/ExpressionDisplay.
 *
 * Why not HTML5 drag-and-drop: `draggable` + dragstart/dragover/drop never fire
 * on touch devices, so a phone learner physically could not reorder a term —
 * while the tutorial explicitly asks them to grab a term by its grip handle.
 * Pointer events give mouse, touch and pen the exact same code path.
 *
 * FROZEN CONTRACT (ExpressionDisplay renders one capsule per term/factor):
 *
 *   const { isDragging, isDragTarget, handlers } = useTermDrag({
 *     group,        // parent path, e.g. 'R' — the drag scope, shared by siblings
 *     index,        // this capsule's index inside that parent
 *     onSwapTerms,  // (parentPath, fromIdx, toIdx) — committed once, on drop
 *   })
 *
 *   handlers — { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
 *              spread onto the capsule element, which MUST also carry
 *              `data-drag-index={index}` and `data-drag-group={group}` so the
 *              siblings can be hit-tested with document.elementFromPoint().
 *
 * Behaviour (kept identical to the HTML5 handlers it replaces):
 *   • a plain tap is untouched — the drag only arms after DRAG_THRESHOLD_PX of
 *     movement, so `onClick` still selects the term (or the literal under the
 *     finger); once armed, the click that follows the drag is swallowed in the
 *     capture phase so a drag never also selects;
 *   • pointer capture is taken on the capsule at that moment (never on
 *     pointerdown — capture retargets `click`, which would break clicking a
 *     variable inside a term);
 *   • dropping on the source capsule or on empty space is a no-op (no swap);
 *   • the drop target is the sibling capsule under the pointer, matching the
 *     old dragover behaviour, with the "+" gap resolved to the nearest sibling.
 *
 * Sibling state is shared through a module-level session plus a subscriber set:
 * that is what lets the TARGET capsule re-render its own amber highlight while
 * the SOURCE capsule renders its 45% opacity. At most one drag exists at a time
 * app-wide; a pointercancel, a window blur, a second pointerdown or an unmount
 * aborts it without committing.
 */
import { useEffect, useReducer, useRef } from 'react'

/** Movement (CSS px) that turns a press into a drag. */
export const DRAG_THRESHOLD_PX = 6

/** How far past a capsule's edge a release still counts as targeting it (the "+" gap). */
const NEAR_CAPSULE_TOLERANCE_PX = 16

/** How long a stray click stays swallowed after a drag (covers delayed touch clicks). */
const CLICK_SUPPRESS_MS = 400

/** The single live drag session, or null. */
let session = null

/** Capsule hooks re-rendering when the session changes (source / target highlight). */
const subscribers = new Set()

function notify() {
  for (const rerender of subscribers) rerender()
}

/**
 * Index of the sibling capsule under (x, y), or null when the pointer is over
 * the source capsule itself, another group, or empty space.
 */
function capsuleIndexAt(group, x, y, sourceIdx) {
  if (typeof document === 'undefined') return null

  const hit = document.elementFromPoint(x, y)
  const capsule = hit && typeof hit.closest === 'function' ? hit.closest('[data-drag-index]') : null
  if (capsule) {
    if (capsule.getAttribute('data-drag-group') !== group) return null
    const idx = Number(capsule.getAttribute('data-drag-index'))
    return Number.isNaN(idx) || idx === sourceIdx ? null : idx
  }

  // Between two capsules (the "+" separators, or a wrapped line) elementFromPoint
  // lands on a non-capsule node. Fall back to the closest sibling rect so a drop
  // in the gap still lands on the neighbour the learner aimed at.
  let best = null
  let bestDist = Infinity
  for (const sibling of document.querySelectorAll(`[data-drag-group="${group}"][data-drag-index]`)) {
    const idx = Number(sibling.getAttribute('data-drag-index'))
    if (Number.isNaN(idx) || idx === sourceIdx) continue
    const rect = sibling.getBoundingClientRect()
    const dx = Math.max(rect.left - x, 0, x - rect.right)
    const dy = Math.max(rect.top - y, 0, y - rect.bottom)
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < bestDist) {
      bestDist = dist
      best = idx
    }
  }
  return bestDist <= NEAR_CAPSULE_TOLERANCE_PX ? best : null
}

/**
 * Swallows the click that a completed drag would otherwise turn into a term
 * selection. Capture phase on the capsule: the event is stopped before it
 * reaches the grip/literal underneath and before React's root bubble listener.
 *
 * The guard has to outlive the gesture: the browser sends `click` AFTER
 * pointerup (and, on touch, up to a few hundred ms later), so `endSession`
 * re-arms it instead of tearing it down.
 */
function armClickGuard(s) {
  if (s.clickGuardTimer) window.clearTimeout(s.clickGuardTimer)
  if (!s.clickGuard) {
    s.clickGuard = (event) => {
      event.stopPropagation()
      event.preventDefault()
      dropClickGuard(s)
    }
    s.el.addEventListener('click', s.clickGuard, true)
  }
  s.clickGuardTimer = window.setTimeout(() => dropClickGuard(s), CLICK_SUPPRESS_MS)
}

function dropClickGuard(s) {
  if (s.clickGuardTimer) {
    window.clearTimeout(s.clickGuardTimer)
    s.clickGuardTimer = 0
  }
  if (!s.clickGuard) return
  s.el.removeEventListener('click', s.clickGuard, true)
  s.clickGuard = null
}

function activateSession(s) {
  s.active = true
  try {
    // Capture keeps the rest of the gesture on this capsule for mouse, touch
    // and pen alike. A browser without it still works through the window
    // listeners installed below.
    if (typeof s.el.setPointerCapture === 'function') s.el.setPointerCapture(s.pointerId)
  } catch {
    // Capture is already held / pointer gone — the window listeners carry the drag.
  }
  armClickGuard(s)
  notify()
}

function moveSession(s, event) {
  const ev = event.nativeEvent || event
  if (s.ended || ev.pointerId !== s.pointerId) return
  // The element handler and the window listener both see every move over the
  // capsule; the event object identity dedupes the two paths.
  if (s.lastEvent === ev) return
  s.lastEvent = ev

  if (!s.active) {
    const dx = ev.clientX - s.startX
    const dy = ev.clientY - s.startY
    if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
    activateSession(s)
  }

  const next = capsuleIndexAt(s.group, ev.clientX, ev.clientY, s.index)
  if (next !== s.targetIdx) {
    s.targetIdx = next
    notify()
  }
}

/**
 * Ends the session. `commit` is true only for pointerup: the swap is issued
 * exactly like the old drop handler (`onSwapTerms(parentPath, from, to)`) and
 * only when a different capsule was actually targeted.
 */
function endSession(s, { commit }) {
  if (!s || s.ended) return
  s.ended = true

  window.removeEventListener('pointermove', s.onMove)
  window.removeEventListener('pointerup', s.onUp, true)
  window.removeEventListener('pointercancel', s.onCancel, true)
  window.removeEventListener('blur', s.onBlur, true)
  // A drag ends with a trailing `click`; keep the guard armed for it. A plain
  // tap never installed one, so its click travels normally.
  if (s.active) armClickGuard(s)
  else dropClickGuard(s)
  try {
    if (typeof s.el.hasPointerCapture === 'function' && s.el.hasPointerCapture(s.pointerId)) {
      s.el.releasePointerCapture(s.pointerId)
    }
  } catch {
    // Capture was already released by the browser — nothing to undo.
  }

  const { group, index, targetIdx, active, onSwapTerms } = s
  if (session === s) {
    session = null
    notify()
  }
  if (commit && active && targetIdx !== null && targetIdx !== index) {
    onSwapTerms?.(group, index, targetIdx)
  }
}

function createSession({ el, pointerId, group, index, onSwapTerms, clientX, clientY }) {
  const s = {
    el,
    pointerId,
    group,
    index,
    onSwapTerms,
    startX: clientX,
    startY: clientY,
    active: false,
    targetIdx: null,
    ended: false,
    lastEvent: null,
    clickGuard: null,
    clickGuardTimer: 0,
  }
  // Window listeners: they carry the gesture when the pointer leaves the capsule
  // before the threshold is crossed (fast flick) or when pointer capture is
  // unavailable. Both paths funnel into the same idempotent session functions.
  s.onMove = (ev) => moveSession(s, ev)
  s.onUp = (ev) => { if (ev.pointerId === s.pointerId) endSession(s, { commit: true }) }
  s.onCancel = (ev) => { if (ev.pointerId === s.pointerId) endSession(s, { commit: false }) }
  s.onBlur = () => endSession(s, { commit: false })
  return s
}

/**
 * @param {{group: string, index: number, onSwapTerms?: Function}} options
 * @returns {{isDragging: boolean, isDragTarget: boolean, handlers: object}}
 */
export default function useTermDrag({ group, index, onSwapTerms }) {
  const [, forceRender] = useReducer((n) => n + 1, 0)
  const elementRef = useRef(null)

  useEffect(() => {
    const rerender = () => forceRender()
    subscribers.add(rerender)
    return () => {
      subscribers.delete(rerender)
      // The capsule unmounted mid-gesture (a law animation removed the term):
      // abort instead of leaving a highlight stuck on a detached node.
      if (session && session.el === elementRef.current) endSession(session, { commit: false })
    }
  }, [])

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (session) endSession(session, { commit: false })

    const el = event.currentTarget
    elementRef.current = el
    // Pointer capture (and therefore the `touch-none` scroll suppression) only
    // starts once the drag is armed — on pointerdown it would retarget the
    // click, breaking a tap on a variable inside the term.
    session = createSession({
      el,
      pointerId: event.pointerId,
      group,
      index,
      onSwapTerms,
      clientX: event.clientX,
      clientY: event.clientY,
    })

    // Window listeners: they carry the gesture when the pointer leaves the
    // capsule before the threshold is crossed (fast flick) or when pointer
    // capture is unavailable. Both paths funnel into the same session functions.
    window.addEventListener('pointermove', session.onMove, { passive: true })
    window.addEventListener('pointerup', session.onUp, true)
    window.addEventListener('pointercancel', session.onCancel, true)
    window.addEventListener('blur', session.onBlur, true)
  }

  const owned = (event) => session !== null && !session.ended && session.el === event.currentTarget
  const onPointerMove = (event) => { if (owned(event)) moveSession(session, event) }
  const onPointerUp = (event) => { if (owned(event)) endSession(session, { commit: true }) }
  const onPointerCancel = (event) => { if (owned(event)) endSession(session, { commit: false }) }

  return {
    isDragging: Boolean(session && session.active && session.group === group && session.index === index),
    isDragTarget: Boolean(session && session.active && session.group === group && session.targetIdx === index),
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  }
}

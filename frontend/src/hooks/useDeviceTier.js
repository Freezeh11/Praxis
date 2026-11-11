/**
 * useDeviceTier — device-class + orientation detection for the responsive
 * workspace (Feature 2).
 *
 * Design rules:
 *  - NO User-Agent sniffing. Touch capability comes from `(pointer: coarse)`,
 *    `navigator.maxTouchPoints` and the legacy `ontouchstart` probe; the device
 *    class comes from the *width* of a touch device, which is what actually
 *    determines whether a layout fits.
 *  - The tier decision is a pure function (`detectDeviceTier`) so it can be
 *    unit-tested without a DOM.
 *  - The hook re-evaluates on every relevant event (resize, orientationchange,
 *    pointer-coarseness change, screen.orientation change), throttled through
 *    requestAnimationFrame with a timer fallback, and cleans up fully so it is
 *    safe under React 19 StrictMode's double mount.
 *
 * FROZEN CONTRACT (the tiered-workspace work imports these names/fields):
 *   DEVICE_TIERS, detectDeviceTier(), default useDeviceTier()
 */
import { useCallback, useEffect, useState } from 'react'

import { HIDE_ROTATE_BANNER } from '../config/storageKeys.js'

/** Device classes, ordered smallest → largest. */
export const DEVICE_TIERS = {
  PHONE: 'phone',
  TABLET_SM: 'tablet-sm',
  TABLET: 'tablet',
  DESKTOP: 'desktop',
}

/** sessionStorage flag that keeps the rotate banner dismissed for the session. */
export const ROTATE_BANNER_STORAGE_KEY = HIDE_ROTATE_BANNER

/** Widest CSS pixel width still treated as a phone (inclusive). */
export const PHONE_MAX_WIDTH = 767
/** Widest CSS pixel width still treated as a small tablet (inclusive). */
export const SMALL_TABLET_MAX_WIDTH = 1023

const ORIENTATION_PORTRAIT = 'portrait'
const ORIENTATION_LANDSCAPE = 'landscape'

/**
 * Pure tier/orientation decision. No DOM access, no side effects.
 *
 * @param {object} input
 * @param {number} input.width       viewport width in CSS px
 * @param {number} input.height      viewport height in CSS px
 * @param {boolean} input.isTouch    coarse pointer / touch points detected
 * @param {'portrait'|'landscape'} input.orientation
 * @param {boolean} [input.bannerDismissed] sessionStorage dismissal flag
 *        (optional so the function stays a pure projection of its inputs; it
 *        defaults to "not dismissed").
 * @returns {{tier: string, isPortrait: boolean, isLandscape: boolean,
 *            showRotateOverlay: boolean, showRotateBanner: boolean}}
 */
export function detectDeviceTier({ width, height, isTouch, orientation, bannerDismissed = false }) {
  const size = Number(width) || 0
  const touch = Boolean(isTouch)
  // The hook always passes an explicit orientation; the aspect-ratio fallback
  // keeps this pure decision function meaningful when called on its own.
  const resolvedOrientation =
    orientation === ORIENTATION_PORTRAIT || orientation === ORIENTATION_LANDSCAPE
      ? orientation
      : (Number(height) || 0) > size
        ? ORIENTATION_PORTRAIT
        : ORIENTATION_LANDSCAPE
  const isPortrait = resolvedOrientation === ORIENTATION_PORTRAIT
  const isLandscape = resolvedOrientation === ORIENTATION_LANDSCAPE

  let tier
  if (!touch) {
    // Pointer-fine devices keep the desktop layout at any width — a narrow
    // desktop window is not a phone.
    tier = DEVICE_TIERS.DESKTOP
  } else if (size <= PHONE_MAX_WIDTH) {
    tier = DEVICE_TIERS.PHONE
  } else if (size <= SMALL_TABLET_MAX_WIDTH) {
    tier = DEVICE_TIERS.TABLET_SM
  } else {
    tier = DEVICE_TIERS.TABLET
  }

  const isPhonePortrait = tier === DEVICE_TIERS.PHONE && isPortrait
  const isSmallTabletPortrait = tier === DEVICE_TIERS.TABLET_SM && isPortrait

  return {
    tier,
    isPortrait,
    isLandscape,
    showRotateOverlay: isPhonePortrait,
    showRotateBanner: isSmallTabletPortrait && !bannerDismissed,
  }
}

/** Touch capability without any UA sniffing. */
function readIsTouch() {
  if (typeof window === 'undefined') return false
  let coarse
  try {
    coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  } catch {
    coarse = false
  }
  const maxTouchPoints = typeof navigator !== 'undefined' ? Number(navigator.maxTouchPoints) || 0 : 0
  const hasTouchStart = 'ontouchstart' in window
  return Boolean(coarse || maxTouchPoints > 0 || hasTouchStart)
}

/**
 * Current orientation. Preference order:
 *   screen.orientation.type → screen.orientation.angle → window.orientation →
 *   viewport aspect ratio.
 */
function readOrientation() {
  if (typeof window === 'undefined') return ORIENTATION_LANDSCAPE

  const screenOrientation = window.screen && window.screen.orientation
  if (screenOrientation) {
    const type = screenOrientation.type
    if (typeof type === 'string' && type) {
      if (type.indexOf('portrait') === 0) return ORIENTATION_PORTRAIT
      if (type.indexOf('landscape') === 0) return ORIENTATION_LANDSCAPE
    }
    const angle = screenOrientation.angle
    if (typeof angle === 'number' && !Number.isNaN(angle)) {
      return angle === 90 || angle === 270 ? ORIENTATION_LANDSCAPE : ORIENTATION_PORTRAIT
    }
  }

  // Deprecated but still the only signal on some older mobile browsers.
  if (typeof window.orientation === 'number') {
    const legacy = window.orientation
    return legacy === 90 || legacy === -90 || legacy === 270
      ? ORIENTATION_LANDSCAPE
      : ORIENTATION_PORTRAIT
  }

  return window.innerHeight > window.innerWidth ? ORIENTATION_PORTRAIT : ORIENTATION_LANDSCAPE
}

/** Viewport size in CSS px, tolerant of a missing document. */
function readViewport() {
  if (typeof window === 'undefined') return { width: 0, height: 0 }
  const doc = typeof document !== 'undefined' ? document.documentElement : null
  const width = window.innerWidth || (doc ? doc.clientWidth : 0) || 0
  const height = window.innerHeight || (doc ? doc.clientHeight : 0) || 0
  return { width: Math.round(width), height: Math.round(height) }
}

/** Whether the rotate banner was dismissed earlier in this browser session. */
function readBannerDismissed() {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(ROTATE_BANNER_STORAGE_KEY) === 'true'
  } catch {
    // Storage can throw in private mode / sandboxed iframes — treat as fresh.
    return false
  }
}

/** Full environment snapshot: tier decision plus the raw inputs behind it. */
function readDeviceSnapshot(bannerDismissed = false) {
  const { width, height } = readViewport()
  const isTouch = readIsTouch()
  const orientation = readOrientation()
  return {
    ...detectDeviceTier({ width, height, isTouch, orientation, bannerDismissed }),
    width,
    height,
    isTouch,
    orientation,
  }
}

/** Shallow compare of the fields a resize/orientation change can move. */
function sameSnapshot(a, b) {
  return (
    a.tier === b.tier &&
    a.isPortrait === b.isPortrait &&
    a.isLandscape === b.isLandscape &&
    a.showRotateOverlay === b.showRotateOverlay &&
    a.showRotateBanner === b.showRotateBanner &&
    a.width === b.width &&
    a.height === b.height &&
    a.isTouch === b.isTouch &&
    a.orientation === b.orientation
  )
}

/**
 * Subscribes to every signal that can change the device class or orientation.
 * The callback is throttled to at most once per animation frame (with a timer
 * fallback for background/headless tabs where rAF may be throttled).
 */
export default function useDeviceTier() {
  const [bannerDismissed, setBannerDismissed] = useState(readBannerDismissed)
  const [snapshot, setSnapshot] = useState(() => readDeviceSnapshot(readBannerDismissed()))

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    let frameId = 0
    let timerId = 0

    /** Drops whichever callback has not fired yet. */
    const clearScheduled = () => {
      if (frameId && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(frameId)
      }
      if (timerId) window.clearTimeout(timerId)
      frameId = 0
      timerId = 0
    }

    /** Throttled re-read: the first of rAF/timer wins and cancels the other. */
    const evaluate = () => {
      clearScheduled()
      const next = readDeviceSnapshot()
      // Functional update: never reads a stale closure, and bails out of the
      // re-render when nothing the UI depends on actually moved.
      setSnapshot(current => (sameSnapshot(current, next) ? current : next))
    }

    const schedule = () => {
      if (frameId || timerId) return
      if (typeof window.requestAnimationFrame === 'function') {
        frameId = window.requestAnimationFrame(evaluate)
        // Safety net: if rAF is throttled (hidden/background tab) the timer
        // still lands, so the gate can never get stuck on a stale tier.
        timerId = window.setTimeout(evaluate, 150)
      } else {
        timerId = window.setTimeout(evaluate, 50)
      }
    }

    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)

    let coarseQuery = null
    const onCoarseChange = () => schedule()
    try {
      if (typeof window.matchMedia === 'function') {
        coarseQuery = window.matchMedia('(pointer: coarse)')
        if (coarseQuery.addEventListener) coarseQuery.addEventListener('change', onCoarseChange)
        else if (coarseQuery.addListener) coarseQuery.addListener(onCoarseChange)
      }
    } catch {
      coarseQuery = null
    }

    const screenOrientation = window.screen && window.screen.orientation
    if (screenOrientation && typeof screenOrientation.addEventListener === 'function') {
      screenOrientation.addEventListener('change', schedule)
    }

    // The viewport can already have changed between render and effect (e.g. a
    // rotation during hydration) — reconcile once on mount.
    schedule()

    return () => {
      clearScheduled()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      if (coarseQuery) {
        if (coarseQuery.removeEventListener) coarseQuery.removeEventListener('change', onCoarseChange)
        else if (coarseQuery.removeListener) coarseQuery.removeListener(onCoarseChange)
      }
      if (screenOrientation && typeof screenOrientation.removeEventListener === 'function') {
        screenOrientation.removeEventListener('change', schedule)
      }
    }
  }, [])

  const dismissRotateBanner = useCallback(() => {
    try {
      window.sessionStorage.setItem(ROTATE_BANNER_STORAGE_KEY, 'true')
    } catch {
      // Storage unavailable — the in-memory state still hides it for this mount.
    }
    setBannerDismissed(true)
  }, [])

  const { tier, isTouch, width, height, orientation, isPortrait, isLandscape } = snapshot
  const isPhone = tier === DEVICE_TIERS.PHONE
  const isSmallTablet = tier === DEVICE_TIERS.TABLET_SM
  const isTablet = tier === DEVICE_TIERS.TABLET
  const isDesktop = tier === DEVICE_TIERS.DESKTOP

  const isPhonePortrait = isPhone && isPortrait
  const isSmallTabletPortrait = isSmallTablet && isPortrait

  return {
    tier,
    isTouch,
    isPortrait,
    isLandscape,
    width,
    height,
    orientation,
    isPhone,
    isSmallTablet,
    isTablet,
    isDesktop,
    isPhonePortrait,
    isSmallTabletPortrait,
    showRotateOverlay: isPhonePortrait,
    showRotateBanner: isSmallTabletPortrait && !bannerDismissed,
    dismissRotateBanner,
  }
}

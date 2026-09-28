/**
 * @file coachCardFallbackStyle.js
 * @description Pre-measurement fallback styling for the coach card: declarative
 * coordinates, named anchor zones and target-relative offsets. The measured
 * placement pass overwrites these values before the first paint.
 */

// Pre-measurement fallback styling. `placeCoachCard` below overwrites this
// with the collision-aware placement before the first paint; this keeps the
// card sane for the single frame before any measurement exists.
export function getTooltipStyle(currentStep, highlightRect) {
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 768
  const cardWidth = 330
  const margin = 14

  // Landscape phones are ~320-400px tall. A 330px floating card anchored next
  // to a spotlight cannot fit there: it either overflowed the bottom edge or
  // sat on top of the very control it pointed at. On those screens the coach
  // becomes a bottom sheet that spans the width and scrolls internally, with
  // its step header and action row sticky, so nothing can trap the learner.
  if (screenHeight <= 480) {
    return {
      left: '0.75rem',
      right: '0.75rem',
      bottom: '0.75rem',
      top: 'auto',
      width: 'auto',
      maxWidth: 'none',
    }
  }

  if (!currentStep) {
    return {
      top: `${Math.max(20, (screenHeight - 240) / 2)}px`,
      left: `${Math.max(20, (screenWidth - cardWidth) / 2)}px`,
      right: 'auto',
      bottom: 'auto',
    }
  }

  // 1. Direct explicit coordinate placement: e.g. { left: 240, bottom: 120 } or { top: 100, right: 40 }
  if (typeof currentStep.position === 'object' && currentStep.position !== null) {
    const { top, bottom, left, right } = currentStep.position
    return {
      top: top !== undefined ? (typeof top === 'number' ? `${top}px` : top) : 'auto',
      bottom: bottom !== undefined ? (typeof bottom === 'number' ? `${bottom}px` : bottom) : 'auto',
      left: left !== undefined ? (typeof left === 'number' ? `${left}px` : left) : 'auto',
      right: right !== undefined ? (typeof right === 'number' ? `${right}px` : right) : 'auto',
    }
  }

  const pos = currentStep.tooltipPosition || currentStep.position || 'bottom'

  // 2. Named Workspace Anchor Zones
  switch (pos) {
    case 'workspace-bottom-left':
    case 'bottom-left':
      return {
        bottom: '154px',
        left: 'max(24px, calc(260px + 24px))',
        top: 'auto',
        right: 'auto',
      }
    case 'workspace-top-left':
    case 'top-left':
      return {
        top: '84px',
        left: 'max(24px, calc(160px + 32px))',
        bottom: 'auto',
        right: 'auto',
      }
    case 'workspace-top-right':
    case 'top-right':
      return {
        top: '84px',
        right: 'max(24px, calc(280px + 24px))',
        bottom: 'auto',
        left: 'auto',
      }
    case 'workspace-bottom-right':
    case 'bottom-right':
      return {
        bottom: '120px',
        right: 'max(24px, calc(280px + 24px))',
        top: 'auto',
        left: 'auto',
      }
    case 'workspace-center':
    case 'center':
      return {
        top: `${Math.max(20, (screenHeight - 240) / 2)}px`,
        left: `${Math.max(20, (screenWidth - cardWidth) / 2)}px`,
        bottom: 'auto',
        right: 'auto',
      }
    default:
      break
  }

  // 3. Fallback to Target-Relative Bounding Box Math if target exists
  if (!highlightRect) {
    return {
      top: `${Math.max(20, (screenHeight - 240) / 2)}px`,
      left: `${Math.max(20, (screenWidth - cardWidth) / 2)}px`,
      bottom: 'auto',
      right: 'auto',
    }
  }

  // Score Modal special anchoring (side-by-side or bottom)
  if (highlightRect.isScoreModal) {
    const rightAvailable = screenWidth - (highlightRect.left + highlightRect.width)
    if (rightAvailable >= 350) {
      return {
        top: `${Math.max(40, highlightRect.top + 20)}px`,
        left: `${highlightRect.left + highlightRect.width + 20}px`,
        bottom: 'auto',
        right: 'auto',
      }
    }
    const leftAvailable = highlightRect.left
    if (leftAvailable >= 350) {
      return {
        top: `${Math.max(40, highlightRect.top + 20)}px`,
        left: `${Math.max(20, highlightRect.left - cardWidth - 20)}px`,
        bottom: 'auto',
        right: 'auto',
      }
    }
    return {
      bottom: '24px',
      left: `${Math.max(20, (screenWidth - cardWidth) / 2)}px`,
      top: 'auto',
      right: 'auto',
    }
  }

  if (pos === 'top') {
    const targetCenterX = highlightRect.left + highlightRect.width / 2
    const left = Math.max(20, Math.min(screenWidth - cardWidth - 20, targetCenterX - cardWidth / 2))
    const bottom = Math.max(20, Math.min(screenHeight - 220, screenHeight - highlightRect.top + margin))
    return {
      bottom: `${bottom}px`,
      left: `${left}px`,
      top: 'auto',
      right: 'auto',
    }
  }

  if (pos === 'bottom') {
    const targetCenterX = highlightRect.left + highlightRect.width / 2
    const left = Math.max(20, Math.min(screenWidth - cardWidth - 20, targetCenterX - cardWidth / 2))
    const top = Math.max(20, Math.min(screenHeight - 240, highlightRect.top + highlightRect.height + margin))
    return {
      top: `${top}px`,
      left: `${left}px`,
      bottom: 'auto',
      right: 'auto',
    }
  }

  if (pos === 'left') {
    const right = Math.max(20, screenWidth - highlightRect.left + margin)
    const targetCenterY = highlightRect.top + highlightRect.height / 2
    const top = Math.max(20, Math.min(screenHeight - 240, targetCenterY - 100))
    return {
      right: `${right}px`,
      top: `${top}px`,
      left: 'auto',
      bottom: 'auto',
    }
  }

  if (pos === 'right') {
    const left = Math.max(20, highlightRect.left + highlightRect.width + margin)
    const targetCenterY = highlightRect.top + highlightRect.height / 2
    const top = Math.max(20, Math.min(screenHeight - 240, targetCenterY - 100))
    return {
      left: `${left}px`,
      top: `${top}px`,
      right: 'auto',
      bottom: 'auto',
    }
  }

  return {
    top: `${Math.max(20, (screenHeight - 240) / 2)}px`,
    left: `${Math.max(20, (screenWidth - cardWidth) / 2)}px`,
    bottom: 'auto',
    right: 'auto',
  }
}

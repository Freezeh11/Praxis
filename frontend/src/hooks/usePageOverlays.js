import { useState } from 'react'
import { usePopupPlacement } from './usePopupPlacement'
import { useTutorialReplay } from './useTutorialReplay'

/**
 * Overlay state shared by the level screens: the tutorial-replay prompt (useTutorialReplay
 * owns its "don't ask again" memory), the laws drawer, and the anchor both are measured against.
 */
export function usePageOverlays({ navigate, hasSeenTutorial, resetLevelProgress }) {
  const [showLawsDrawer, setShowLawsDrawer] = useState(false)

  const {
    showTutorialPrompt,
    dontAskTutorialAgain,
    setDontAskTutorialAgain,
    handleTutorialClick,
    handleRestartTutorial,
    closeTutorialPrompt,
  } = useTutorialReplay({ navigate, hasSeenTutorial, resetLevelProgress })

  // Each overlay belongs to the control that opened it, so its band/shift is
  // measured against that control.
  const popupAnchorSelector = showLawsDrawer ? '[data-popup-anchor="laws"]' : '[data-popup-anchor="tutorial"]'
  const popupPlacement = usePopupPlacement(popupAnchorSelector, showTutorialPrompt || showLawsDrawer)

  return {
    showTutorialPrompt,
    dontAskTutorialAgain,
    setDontAskTutorialAgain,
    handleTutorialClick,
    handleRestartTutorial,
    closeTutorialPrompt,
    showLawsDrawer,
    setShowLawsDrawer,
    popupPlacement,
  }
}

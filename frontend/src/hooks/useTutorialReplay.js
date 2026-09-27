import { useState } from 'react'
import { SKIP_TUTORIAL_REPLAY_PROMPT } from '../config/storageKeys'
import { TUTORIAL } from '../config/game-rules'

/** Replay always restarts the very first tutorial stage. */
const REPLAY_ROUTE = `/level/${TUTORIAL.levelId}/stage/${TUTORIAL.stageIndexes[0]}?tutorial=true`

/**
 * Tutorial-replay prompt state: asks before resetting level 0, remembers "don't ask
 * again" for the session, then resets that level and opens the walkthrough.
 */
export function useTutorialReplay({ navigate, hasSeenTutorial, resetLevelProgress }) {
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false)
  const [dontAskTutorialAgain, setDontAskTutorialAgain] = useState(false)

  const handleTutorialClick = () => {
    const skipPrompt = sessionStorage.getItem(SKIP_TUTORIAL_REPLAY_PROMPT) === 'true'

    if (hasSeenTutorial && !skipPrompt) {
      setDontAskTutorialAgain(false)
      setShowTutorialPrompt(true)
    } else {
      navigate(REPLAY_ROUTE)
    }
  }

  const handleRestartTutorial = () => {
    if (dontAskTutorialAgain) {
      sessionStorage.setItem(SKIP_TUTORIAL_REPLAY_PROMPT, 'true')
    }
    resetLevelProgress(TUTORIAL.levelId)
    setShowTutorialPrompt(false)
    navigate(REPLAY_ROUTE)
  }

  const closeTutorialPrompt = () => setShowTutorialPrompt(false)

  return {
    showTutorialPrompt,
    dontAskTutorialAgain,
    setDontAskTutorialAgain,
    handleTutorialClick,
    handleRestartTutorial,
    closeTutorialPrompt,
  }
}

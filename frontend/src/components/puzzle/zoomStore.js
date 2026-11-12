import { createContext, useContext } from 'react'

/**
 * Zoom state for the derivation canvas.
 *
 * Zoom lives in its own context rather than in ProblemPage state: a zoom tick
 * used to re-render the page, and with it the law palette, the stage list and
 * the side panel — three surfaces whose output does not depend on zoom. Only
 * the three consumers (header, canvas, step history) subscribe.
 */
export const ZoomContext = createContext(null)

export function useZoom() {
  const context = useContext(ZoomContext)
  if (!context) throw new Error('useZoom must be called inside <ZoomProvider>')
  return context
}

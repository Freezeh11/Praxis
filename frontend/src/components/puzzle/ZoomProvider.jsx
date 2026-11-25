import { useMemo, useState } from 'react'

import { ZoomContext } from './zoomStore'

export default function ZoomProvider({ children }) {
  const [zoom, setZoom] = useState(1)
  const value = useMemo(() => ({ zoom, setZoom }), [zoom])
  return <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>
}

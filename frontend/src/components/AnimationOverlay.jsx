import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Renders pedagogical 2-second animations over the workspace when a law is applied.
 */
export default function AnimationOverlay({ data }) {
  const [elements, setElements] = useState(null)

  // On mount, measure the DOM elements associated with the selected paths
  useEffect(() => {
    if (!data) return
    const rects = data.paths.map(path => {
      const el = document.querySelector(`[data-path="${path}"]`)
      if (!el) return null
      const rect = el.getBoundingClientRect()
      // Adjust for scroll/offset if necessary (workspace is generally fixed but just in case)
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        text: el.innerText
      }
    })
    setElements(rects)
  }, [data])

  if (!data || !elements) return null

  // The overlay covers the entire screen, allowing absolute SVG positioning
  return (
    <div className="fixed top-0 left-0 w-screen h-screen z-[9999] pointer-events-none">
      <svg className="fixed top-0 left-0 w-screen h-screen pointer-events-none overflow-visible" width="100%" height="100%">
        <AnimatePresence>
          {data.lawId === 'distributive' && <DistributiveAnimation rects={elements} />}
          {data.lawId === 'idempotent' && <IdempotentAnimation rects={elements} />}
          {data.lawId === 'annulment' && <AnnulmentAnimation rects={elements} />}
          {data.lawId === 'identity' && <IdentityAnimation rects={elements} />}
          {data.lawId?.startsWith('demorgan') && <DeMorganAnimation rects={elements} />}
        </AnimatePresence>
      </svg>
    </div>
  )
}

function DistributiveAnimation({ rects }) {
  if (rects.length < 2 || !rects[0] || !rects[1]) return null
  const [r1, r2] = rects
  
  // Draw an arc connecting the two identical variables being factored
  const midX = (r1.cx + r2.cx) / 2
  const midY = Math.min(r1.y, r2.y) - 60
  
  const pathData = `M ${r1.cx} ${r1.cy - 10} Q ${midX} ${midY}, ${r2.cx} ${r2.cy - 10}`

  return (
    <>
      <motion.path
        d={pathData}
        fill="transparent"
        stroke="var(--color-teal)"
        strokeWidth="4"
        strokeDasharray="8 8"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />
      {/* Floating text to emphasize factoring */}
      <motion.text
        x={midX}
        y={midY - 10}
        fill="var(--color-teal)"
        fontSize="24"
        fontWeight="bold"
        textAnchor="middle"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        Factor Out
      </motion.text>
    </>
  )
}

function IdempotentAnimation({ rects }) {
  if (rects.length < 2 || !rects[0] || !rects[1]) return null
  const [r1, r2] = rects

  return (
    <>
      <motion.line
        x1={r1.cx} y1={r1.cy} x2={r2.cx} y2={r2.cy}
        stroke="var(--color-purple)"
        strokeWidth="6"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1 }}
      />
      <motion.text
        x={(r1.cx + r2.cx) / 2}
        y={(r1.cy + r2.cy) / 2 - 30}
        fill="var(--color-purple)"
        fontSize="24"
        fontWeight="bold"
        textAnchor="middle"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.8, type: 'spring' }}
      >
        Merge Identical
      </motion.text>
    </>
  )
}

function AnnulmentAnimation({ rects }) {
  if (rects.length < 2 || !rects[0] || !rects[1]) return null
  const [r1, r2] = rects
  
  const midX = (r1.cx + r2.cx) / 2
  const midY = (r1.cy + r2.cy) / 2

  return (
    <>
      <motion.text
        x={r1.cx} y={r1.cy}
        fill="var(--color-red)"
        fontSize="32"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="middle"
        initial={{ cx: r1.cx, cy: r1.cy, opacity: 1 }}
        animate={{ cx: midX, cy: midY, scale: 0, opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      >
        {r1.text}
      </motion.text>
      <motion.text
        x={r2.cx} y={r2.cy}
        fill="var(--color-red)"
        fontSize="32"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="middle"
        initial={{ cx: r2.cx, cy: r2.cy, opacity: 1 }}
        animate={{ cx: midX, cy: midY, scale: 0, opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      >
        {r2.text}
      </motion.text>
      <motion.text
        x={midX} y={midY - 40}
        fill="var(--color-red)"
        fontSize="24"
        fontWeight="bold"
        textAnchor="middle"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.8, type: 'spring' }}
      >
        Absorbed by 1
      </motion.text>
    </>
  )
}

function IdentityAnimation({ rects }) {
  if (rects.length < 2 || !rects[0] || !rects[1]) return null
  const [r1, r2] = rects

  const midX = (r1.cx + r2.cx) / 2
  const midY = (r1.cy + r2.cy) / 2

  return (
    <>
      <motion.line
        x1={r1.cx} y1={r1.cy} x2={r2.cx} y2={r2.cy}
        stroke="var(--color-text-muted)"
        strokeWidth="4"
        strokeDasharray="6 6"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1 }}
      />
      <motion.text
        x={r1.cx} y={r1.cy}
        fill="var(--color-text-muted)"
        fontSize="32"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="middle"
        initial={{ cx: r1.cx, cy: r1.cy, opacity: 1 }}
        animate={{ cx: midX, cy: midY, scale: 0, opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      >
        {r1.text}
      </motion.text>
      <motion.text
        x={r2.cx} y={r2.cy}
        fill="var(--color-text-muted)"
        fontSize="32"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="middle"
        initial={{ cx: r2.cx, cy: r2.cy, opacity: 1 }}
        animate={{ cx: midX, cy: midY, scale: 0, opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      >
        {r2.text}
      </motion.text>
      <motion.text
        x={midX} y={midY - 30}
        fill="var(--color-text-muted)"
        fontSize="20"
        fontWeight="bold"
        textAnchor="middle"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: -10 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        Merge & Remove 0
      </motion.text>
    </>
  )
}

function DeMorganAnimation({ rects }) {
  if (rects.length < 1 || !rects[0]) return null
  const r = rects[0]
  
  return (
    <motion.text
      x={r.cx} y={r.cy - 40}
      fill="var(--color-blue)"
      fontSize="24"
      fontWeight="bold"
      textAnchor="middle"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1.2 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5 }}
    >
      Break the line, change the sign!
    </motion.text>
  )
}

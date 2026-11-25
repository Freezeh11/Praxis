import { LazyMotion } from 'framer-motion'

/**
 * Resolved after first paint: the feature bundle is the expensive half of
 * framer-motion and no route that renders `m` elements mounts on the entry
 * screen, so paying for it during the first paint would be waste.
 */
const loadFeatures = () => import('framer-motion').then((mod) => mod.domMax)

/**
 * Single LazyMotion boundary for the whole app.
 *
 * `m` components only carry the tiny renderer; the animation feature bundle
 * (gestures, drag and layout projection) lives here, loaded once instead of
 * being pulled into every route chunk. `domMax` rather than `domAnimation` is
 * required: ExpressionDisplay, DerivationCanvas and WelcomeModal animate the
 * `layout` prop (shared layout projection), which the smaller bundle lacks.
 *
 * `strict` makes any leftover `motion.*` component throw in development, so a
 * component that escapes the `m` migration fails loudly instead of silently
 * shipping the eager bundle.
 */
export default function MotionProvider({ children }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  )
}

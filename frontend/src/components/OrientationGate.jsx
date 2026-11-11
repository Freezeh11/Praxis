/**
 * OrientationGate — the app-wide orientation policy, mounted by App.jsx inside
 * BrowserRouter so it also covers the public routes.
 *
 * Policy (all decided by `useDeviceTier`, no User-Agent sniffing):
 *   - phone + portrait        → blocking RotateOverlay, nothing else is usable
 *   - small tablet + portrait → dismissible RotateBanner, app stays usable
 *   - everything else         → renders nothing
 *
 * The overlay is rendered last so it stacks above the banner.
 */
import useDeviceTier from '../hooks/useDeviceTier'
import RotateBanner from './RotateBanner'
import RotateOverlay from './RotateOverlay'

export default function OrientationGate() {
  const { tier, showRotateOverlay, showRotateBanner, dismissRotateBanner } = useDeviceTier()

  return (
    <>
      {showRotateBanner && <RotateBanner tier={tier} onDismiss={dismissRotateBanner} />}
      {showRotateOverlay && <RotateOverlay tier={tier} />}
    </>
  )
}

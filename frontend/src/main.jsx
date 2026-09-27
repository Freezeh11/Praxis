import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Order matters: Tailwind layers, then tokens, shared utilities, orientation
// gate and animation keyframes. See styles/index.css for why.
import './styles/index.css'
import './styles/tokens.css'
import './styles/utilities.css'
import './styles/orientation.css'
import './styles/animations.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

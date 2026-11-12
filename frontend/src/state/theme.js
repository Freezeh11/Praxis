import { useSyncExternalStore } from 'react'
const KEY = 'praxis-theme'
function readTheme() {
  try { const saved = localStorage.getItem(KEY); if (saved === 'dark' || saved === 'light') return saved } catch { /* Storage may be unavailable. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
let theme = readTheme()
const listeners = new Set()
function apply() {
  const root = document.documentElement
  // Two signals, one source of truth: the attribute every token selector and
  // legacy remap keys off, and the class Tailwind's `darkMode: 'class'` reads.
  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}
apply()
window.addEventListener('storage', event => {
  if (event.key === KEY || event.key === null) { theme = readTheme(); apply(); listeners.forEach(listener => listener()) }
})
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener) }
export function useTheme() {
  const value = useSyncExternalStore(subscribe, () => theme)
  return { theme: value, toggleTheme: () => {
    theme = theme === 'dark' ? 'light' : 'dark'
    try { localStorage.setItem(KEY, theme) } catch { /* Keep in-memory preference. */ }
    apply(); listeners.forEach(listener => listener())
  } }
}

import { Link } from 'react-router-dom'

export default function ProfileLink() {
  return (
    <Link to="/profile" className="min-h-9 [@media(max-height:480px)]:min-h-11 px-3 rounded-xl inline-flex items-center gap-2 border border-border bg-bg-card text-text-2 text-xs font-bold hover:border-accent hover:text-accent transition-colors" aria-label="My profile" title="My profile">
      <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>
    </Link>
  )
}

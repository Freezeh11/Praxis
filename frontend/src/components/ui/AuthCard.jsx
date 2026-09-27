import { Link } from 'react-router-dom'
import logoFull from '../../assets/logo-full.png'

/**
 * Auth page shell: logo link, heading, subtitle, back link and the white card.
 * `children` is the form, `footer` the divider + alternate-action slot; the page owns
 * the motion wrapper, submit/toast/navigation logic and any decorative background.
 */
export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <>
      {/* Header */}
      <div className="text-center mb-5 sm:mb-6">
        <Link to="/" className="inline-flex items-center justify-center h-12 [@media(max-height:480px)]:h-9 mb-4 sm:mb-6 hover:scale-105 transition-transform drop-shadow-sm">
          <img src={logoFull} alt="Praxis" className="h-full object-contain" />
        </Link>
        <h1 className="text-[26px] sm:text-[28px] font-extrabold text-text-1 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-text-3 font-medium mt-1.5">
          {subtitle}
        </p>
      </div>

      <div className="mb-2.5">
        <Link to="/" className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-semibold text-text-2 bg-transparent hover:bg-border rounded transition-all -ml-2">
          ← Back
        </Link>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-5 sm:p-7">
        {children}
        {footer}
      </div>
    </>
  )
}

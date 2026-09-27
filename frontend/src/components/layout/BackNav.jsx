import { Link } from 'react-router-dom'
import logoFull from '../../assets/logo-full.png'

/**
 * Back control + Praxis logo cluster shared by the level screens. `variant` keeps the two
 * existing header treatments: 'home' (inline pair) and 'levels' (centred logo).
 */
export default function BackNav({ variant = 'home', label, to, onClick, title, testId }) {
  const isHome = variant === 'home'

  const backClassName = isHome
    ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-slate-800 bg-white border border-slate-300 shadow-xs hover:bg-slate-50 hover:shadow-sm transition-all active:scale-95 cursor-pointer'
    : 'flex items-center gap-2 px-3.5 py-1.5 min-h-9 [@media(max-height:480px)]:min-h-11 text-xs sm:text-sm font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs hover:shadow-sm rounded-xl transition-all cursor-pointer active:scale-95'

  const arrowClassName = isHome
    ? 'font-extrabold text-teal leading-none text-sm'
    : 'text-sm font-extrabold text-teal leading-none'

  const backControl = to ? (
    <Link to={to} data-testid={testId} className={backClassName} title={title}>
      <span className={arrowClassName}>←</span>
      <span>{label}</span>
    </Link>
  ) : (
    <button data-testid={testId} className={backClassName} onClick={onClick} title={title}>
      <span className={arrowClassName}>←</span>
      <span>{label}</span>
    </button>
  )

  const logo = (
    <Link
      to="/"
      className={isHome
        ? 'flex items-center hover:opacity-80 transition-opacity'
        : 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center hover:opacity-85 transition-opacity'}
    >
      <img
        src={logoFull}
        alt="Praxis"
        className={isHome ? 'h-8 [@media(max-height:480px)]:h-6 object-contain' : 'h-7 [@media(max-height:480px)]:h-6 object-contain'}
      />
    </Link>
  )

  if (isHome) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        {backControl}
        {logo}
      </div>
    )
  }

  return (
    <>
      {backControl}
      {logo}
    </>
  )
}

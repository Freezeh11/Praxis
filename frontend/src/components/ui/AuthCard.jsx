/**
 * Auth page card: eyebrow + h1 + one-line subtitle inside the glass surface, the
 * form children and the footer slot (divider, alternate action, legal caption).
 *
 * Pages own the page background, the top bar (Back to home + ThemeToggle) and the
 * single centered column that sizes this card to max-w-[440px], so the card itself
 * carries no wordmark and no brand story panel.
 */
export default function AuthCard({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="w-full rounded-2xl border border-slate-200/90 bg-white/85 p-5 shadow-[0_4px_20px_rgba(15,23,42,0.06)] transition-colors duration-200 sm:p-7 dark:border-white/10 dark:bg-slate-900/65 dark:shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_0_rgba(255,255,255,0.08)]">
      <header className="mb-6">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-cyan-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1.5 text-[26px] font-extrabold tracking-tight text-slate-900 sm:text-[28px] dark:text-white">
          {title}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {subtitle}
        </p>
      </header>

      {children}
      {footer}
    </div>
  )
}

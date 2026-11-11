import { authInputClassName } from './authInputStyles.js'

// Inline stroke glyphs (24x24) so the fields never pull in an icon dependency.
const FIELD_ICONS = {
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  lock: 'M8 10V6a4 4 0 0 1 8 0v4M5 10h14v12H5zm7 4v4',
}

/** Decorative leading glyph for an auth field; `aria-hidden` because the label names the field. */
export function AuthFieldIcon({ name }) {
  const path = FIELD_ICONS[name]
  if (!path) return null
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
    >
      <path d={path} />
    </svg>
  )
}

/**
 * Auth form input: label + input + a reserved helper/error line. The line is always
 * present, so surfacing a message never shifts the fields below it. `className`
 * appends utilities; `borderClassName` replaces the default border/focus utilities;
 * `invalid`/`error` switch the field to the danger pairing and set aria-invalid.
 */
export default function AuthTextField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  autoComplete,
  required,
  className = '',
  borderClassName,
  icon,
  invalid,
  error,
  hint,
  describedBy,
  hintLive = false,
}) {
  const message = typeof error === 'string' && error ? error : hint
  const isInvalid = Boolean(invalid || (typeof error === 'string' && error))
  const messageId = message ? id + '-hint' : undefined
  const describedById = [describedBy, messageId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        {icon ? <AuthFieldIcon name={icon} /> : null}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedById}
          className={`${authInputClassName({ border: borderClassName, padLeft: Boolean(icon), invalid: isInvalid })} ${className}`}
        />
      </div>
      {/* Reserved so an error appearing/disappearing never moves the layout. The
          live region is the wrapper, so text injected into it is announced. */}
      <div className="min-h-[18px]" aria-live={hintLive ? 'polite' : undefined}>
        {message ? (
          <p
            id={messageId}
            className={`text-xs leading-[18px] ${isInvalid ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </div>
  )
}

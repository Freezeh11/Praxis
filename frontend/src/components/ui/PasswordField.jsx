import { useState } from 'react'
import { authInputClassName } from './authInputStyles.js'
import { AuthFieldIcon } from './AuthTextField.jsx'

/**
 * Password input with a show/hide toggle; owns only the reveal boolean. The toggle
 * is a full 44x44 hit area and names its action, so the icon is never the only cue.
 * `children` renders extra guidance (the register requirements list) directly under
 * the field, replacing the empty reserved line.
 */
export default function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  autoComplete,
  required,
  className = '',
  borderClassName,
  icon = 'lock',
  invalid,
  error,
  hint,
  describedBy,
  hintLive = false,
  children,
}) {
  const [showPassword, setShowPassword] = useState(false)
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
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedById}
          className={`${authInputClassName({ border: borderClassName, padLeft: Boolean(icon), padRight: true, invalid: isInvalid })} ${className}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:text-slate-200 dark:focus-visible:ring-cyan-400/40"
        >
          {showPassword ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          )}
        </button>
      </div>
      {message || !children ? (
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
      ) : null}
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  )
}

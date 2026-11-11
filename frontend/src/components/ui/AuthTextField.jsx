import { authInputClassName } from './authInputStyles.js'

/**
 * Auth form input: label + input. `className` appends utilities; `borderClassName`
 * replaces the default border/focus utilities (used by the register page's invalid state).
 */
export default function AuthTextField({ id, label, type, value, onChange, placeholder, autoComplete, required, className = '', borderClassName }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-text-2">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className={`${authInputClassName({ border: borderClassName })} ${className}`}
      />
    </div>
  )
}

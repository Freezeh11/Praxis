import Icon from './Icon.jsx'
import { PASSWORD_REQUIREMENTS, passwordError } from '../../services/passwordPolicy.js'

/**
 * The three clauses of the password policy, as a live checklist. Register and
 * reset share it so a learner sees the same rules and the same ticks whichever
 * door they came through. passwordError() stays the single validator; the list
 * only visualises what it will accept.
 */
const CHECKS = [
  { key: 'length', label: 'At least 8 characters', test: value => value.length >= 8 },
  { key: 'digit', label: 'Contains a digit', test: value => /[0-9]/.test(value) },
  { key: 'special', label: 'Contains a special character', test: value => /[^\p{L}\p{N}\s]/u.test(value) },
]

export default function PasswordChecklist({ password, id = 'password-requirements' }) {
  const checks = CHECKS.map(check => ({ ...check, met: check.test(password) }))
  // Safety net against policy drift: if the policy rejects a password that clears
  // every visible clause, show its canonical sentence instead of failing silently.
  const drift = password.length > 0 && checks.every(check => check.met) && Boolean(passwordError(password))

  return (
    <ul id={id} aria-label="Password requirements" className="flex flex-col gap-1.5">
      {checks.map(check => (
        <li key={check.key} className="flex items-center gap-2 text-[12px] leading-5">
          {check.met ? (
            <span
              aria-hidden="true"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            >
              <Icon name="check" className="text-[10px]" />
            </span>
          ) : (
            <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            </span>
          )}
          <span className="text-slate-600 dark:text-slate-300">
            <span className="sr-only">{check.met ? 'Met: ' : 'Not met: '}</span>
            {check.label}
          </span>
        </li>
      ))}
      {drift ? (
        <li className="text-[12px] leading-5 text-rose-600 dark:text-rose-400">{PASSWORD_REQUIREMENTS}</li>
      ) : null}
    </ul>
  )
}

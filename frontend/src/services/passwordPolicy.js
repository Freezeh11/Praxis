export const PASSWORD_REQUIREMENTS = 'Use at least 8 characters, including a digit and a special character.'
export function passwordError(password) {
  return password.length >= 8 && /[0-9]/.test(password) && /[^\p{L}\p{N}\s]/u.test(password) ? null : PASSWORD_REQUIREMENTS
}

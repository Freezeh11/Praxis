import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signUp } from '../services/authActions.js'
import { useSession } from '../state/useSession.js'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import AuthCard from '../components/ui/AuthCard.jsx'
import AuthTextField from '../components/ui/AuthTextField.jsx'
import PasswordField from '../components/ui/PasswordField.jsx'
import SubmitButton from '../components/ui/SubmitButton.jsx'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Wait for session state to update before navigating
  useEffect(() => {
    if (session) {
      navigate('/levels', { replace: true })
    }
  }, [session, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const result = await signUp.email({
        email,
        password,
        name,
      })

      if (result.error) {
        toast.error(result.error.message || 'Registration failed. Please try again.')
      } else {
        toast.success('Account created successfully! Welcome to Praxis.')
        // useEffect will handle the navigation once the session state updates globally
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword
  const passwordLongEnough = password.length === 0 || password.length >= 6

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.96 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-bg flex items-center justify-center praxis-page-x py-6 relative overflow-hidden bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px]">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-[400px] z-10"
      >
        <AuthCard
          title="Create your account"
          subtitle="Start mastering Boolean expressions today"
          footer={
            <>
              <div className="flex items-center gap-3 my-5 sm:my-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-text-3 font-semibold uppercase tracking-wider">Already have an account?</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <Link
                to="/login"
                className="block w-full min-h-11 py-2.5 text-center border-[1.5px] border-border text-text-2 font-bold text-[14px] rounded-lg bg-transparent transition-all hover:bg-bg hover:text-text-1"
              >
                Sign In Instead
              </Link>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AuthTextField
              id="register-name"
              label="Full Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              autoComplete="name"
            />

            <AuthTextField
              id="register-email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />

            <PasswordField
              id="register-password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              autoComplete="new-password"
              borderClassName={!passwordLongEnough ? 'border border-red focus:border-red' : 'border border-border focus:border-accent'}
            />

            <PasswordField
              id="register-confirm"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              borderClassName={!passwordsMatch ? 'border border-red focus:border-red' : 'border border-border focus:border-accent'}
            />

            <SubmitButton loading={loading} disabled={!passwordsMatch || !passwordLongEnough} busyLabel="Creating account...">
              Create Account
            </SubmitButton>
          </form>
        </AuthCard>
      </motion.div>

      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-accent/20 blur-[100px] -z-10 mix-blend-multiply pointer-events-none" />
    </div>
  )
}

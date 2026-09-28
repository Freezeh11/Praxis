import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signIn } from '../services/authActions.js'
import { useSession } from '../state/useSession.js'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import AuthCard from '../components/ui/AuthCard.jsx'
import AuthTextField from '../components/ui/AuthTextField.jsx'
import PasswordField from '../components/ui/PasswordField.jsx'
import SubmitButton from '../components/ui/SubmitButton.jsx'

export default function LoginPage() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Wait for session state to update before navigating
  useEffect(() => {
    if (session) {
      navigate('/', { replace: true })
    }
  }, [session, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await signIn.email({
        email,
        password,
      })

      if (result.error) {
        toast.error(result.error.message || 'Invalid email or password')
      } else {
        toast.success('Welcome back!')
        // useEffect will handle the navigation once the session state updates globally
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
          title="Welcome back"
          subtitle="Sign in to continue your progress"
          footer={
            <>
              <div className="flex items-center gap-3 my-5 sm:my-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-text-3 font-semibold uppercase tracking-wider">New here?</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <Link
                to="/register"
                className="block w-full min-h-11 py-2.5 text-center border-[1.5px] border-border text-text-2 font-bold text-[14px] rounded-lg bg-transparent transition-all hover:bg-bg hover:text-text-1"
              >
                Create an Account
              </Link>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <AuthTextField
              id="login-email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />

            <PasswordField
              id="login-password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />

            <SubmitButton loading={loading} busyLabel="Signing in...">
              Sign In
            </SubmitButton>
          </form>
        </AuthCard>
      </motion.div>

      {/* Decorative Orbs */}
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] rounded-full bg-accent/20 blur-[100px] -z-10 mix-blend-multiply pointer-events-none" />
    </div>
  )
}

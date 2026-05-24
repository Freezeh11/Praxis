import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signUp, useSession } from '../lib/auth-client'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

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
    } catch (err) {
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
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative overflow-hidden bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px]">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-[400px] z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-12 h-12 bg-accent text-white rounded-xl font-bold text-2xl shadow-sm mb-6 hover:scale-105 transition-transform">
            ⊕
          </Link>
          <h1 className="text-[28px] font-extrabold text-text-1 tracking-tight">
            Create your account
          </h1>
          <p className="text-sm text-text-3 font-medium mt-1.5">
            Set up access to the interactive Boolean algebra workspace
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-name" className="text-[13px] font-semibold text-text-2">
                Full Name
              </label>
              <input
                id="register-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                autoComplete="name"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-bg text-sm text-text-1 placeholder:text-text-3/60 outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-email" className="text-[13px] font-semibold text-text-2">
                Email
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-bg text-sm text-text-1 placeholder:text-text-3/60 outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-password" className="text-[13px] font-semibold text-text-2">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                autoComplete="new-password"
                className={`w-full px-3.5 py-2.5 rounded-lg border bg-bg text-sm text-text-1 placeholder:text-text-3/60 outline-none transition-all focus:ring-2 focus:ring-accent/10 ${
                  !passwordLongEnough ? 'border-red focus:border-red' : 'border-border focus:border-accent'
                }`}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="register-confirm" className="text-[13px] font-semibold text-text-2">
                Confirm Password
              </label>
              <input
                id="register-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className={`w-full px-3.5 py-2.5 rounded-lg border bg-bg text-sm text-text-1 placeholder:text-text-3/60 outline-none transition-all focus:ring-2 focus:ring-accent/10 ${
                  !passwordsMatch ? 'border-red focus:border-red' : 'border-border focus:border-accent'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !passwordsMatch || !passwordLongEnough}
              className="mt-2 w-full py-2.5 bg-accent text-white rounded-lg font-bold text-[14px] transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-text-3 font-semibold uppercase tracking-wider">Already have an account?</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Link
            to="/login"
            className="block w-full py-2.5 text-center border-[1.5px] border-border text-text-2 font-bold text-[14px] rounded-lg bg-transparent transition-all hover:bg-bg hover:text-text-1"
          >
            Sign In Instead
          </Link>
        </div>
      </motion.div>

      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-accent/20 blur-[100px] -z-10 mix-blend-multiply pointer-events-none" />
    </div>
  )
}

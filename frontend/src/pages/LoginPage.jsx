import { useState, useEffect } from 'react'
import logoFull from '../assets/logo-full.png'
import { useNavigate, Link } from 'react-router-dom'
import { signIn, useSession } from '../lib/auth-client'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

export default function LoginPage() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    } catch (err) {
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
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 relative overflow-hidden bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px]">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-[400px] z-10"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center justify-center h-12 mb-6 hover:scale-105 transition-transform drop-shadow-sm">
            <img src={logoFull} alt="Praxis" className="h-full object-contain" />
          </Link>
          <h1 className="text-[28px] font-extrabold text-text-1 tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-text-3 font-medium mt-1.5">
            Sign in to continue your progress
          </p>
        </div>

        <div className="mb-2.5">
          <Link to="/" className="inline-flex items-center gap-1.5 px-2 py-1 text-sm font-semibold text-text-2 bg-transparent hover:bg-border rounded transition-all -ml-2">
            ← Back
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-7">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-[13px] font-semibold text-text-2">
                Email
              </label>
              <input
                id="login-email"
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
              <label htmlFor="login-password" className="text-[13px] font-semibold text-text-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-bg text-sm text-text-1 placeholder:text-text-3/60 outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1 transition-colors flex items-center justify-center"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 bg-accent text-white rounded-lg font-bold text-[14px] transition-all shadow-sm hover:bg-text-1 hover:shadow-md hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-text-3 font-semibold uppercase tracking-wider">New here?</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Link
            to="/register"
            className="block w-full py-2.5 text-center border-[1.5px] border-border text-text-2 font-bold text-[14px] rounded-lg bg-transparent transition-all hover:bg-bg hover:text-text-1"
          >
            Create an Account
          </Link>
        </div>
      </motion.div>
      
      {/* Decorative Orbs */}
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] rounded-full bg-accent/20 blur-[100px] -z-10 mix-blend-multiply pointer-events-none" />
    </div>
  )
}

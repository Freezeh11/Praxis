import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSession } from '../lib/auth-client'

export default function LandingPage() {
  const { data: session, isPending } = useSession()

  // If already logged in, skip landing page and go to dashboard
  if (!isPending && session) {
    return <Navigate to="/levels" replace />
  }

  // Fade-in animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col relative overflow-hidden bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px]">
      
      {/* Header */}
      <header className="w-full h-[72px] px-8 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 bg-accent text-white rounded-md flex items-center justify-center font-bold text-lg shadow-sm">⊕</span>
          <span className="font-bold text-[19px] tracking-tight text-accent">Praxis</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-semibold text-text-2 hover:text-accent transition-colors">
            Log In
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 z-10 -mt-10">
        <motion.div 
          className="max-w-3xl w-full flex flex-col items-center text-center"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-6">
            <span className="px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[13px] font-bold uppercase tracking-wider">
              Interactive Learning
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1 variants={itemVariants} className="text-5xl md:text-6xl font-extrabold text-text-1 tracking-tight leading-[1.1] mb-6">
            Master Boolean Algebra<br className="hidden md:block"/> Without the Headache.
          </motion.h1>

          {/* Subheadline */}
          <motion.p variants={itemVariants} className="text-lg md:text-xl text-text-3 font-medium max-w-xl mb-10 leading-relaxed">
            Solve logic puzzles, apply laws, and prove equivalences in a beautiful, game-like environment designed to make discrete math finally click.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
            <Link 
              to="/register" 
              className="w-full sm:w-auto px-8 py-3.5 bg-accent text-white rounded-xl font-bold text-[15px] shadow-[0_8px_16px_-6px_rgba(37,99,235,0.4)] hover:shadow-[0_12px_20px_-6px_rgba(37,99,235,0.5)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
            >
              Start Learning Free <span>→</span>
            </Link>
            <Link 
              to="/login" 
              className="w-full sm:w-auto px-8 py-3.5 bg-white text-text-1 border-[1.5px] border-border rounded-xl font-bold text-[15px] shadow-sm hover:border-text-2 hover:bg-bg-card hover:-translate-y-0.5 transition-all text-center"
            >
              I already have an account
            </Link>
          </motion.div>
        </motion.div>

        {/* Feature Grid */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-24"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
        >
          {[
            { icon: "🧩", title: "Interactive Puzzles", desc: "Step-by-step logic gates and expression simplification." },
            { icon: "⚡", title: "Instant Feedback", desc: "Know immediately if your applied law is valid or invalid." },
            { icon: "🏆", title: "Earn XP & Streaks", desc: "Build a daily habit and track your progress through stages." }
          ].map((feat, i) => (
            <motion.div key={i} variants={itemVariants} className="bg-white border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-bg rounded-xl flex items-center justify-center text-2xl mb-4 border border-border">
                {feat.icon}
              </div>
              <h3 className="font-bold text-text-1 text-[17px] mb-2 tracking-tight">{feat.title}</h3>
              <p className="text-text-3 text-[14px] leading-relaxed">{feat.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent/20 blur-[120px] -z-10 mix-blend-multiply pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-green/10 blur-[120px] -z-10 mix-blend-multiply pointer-events-none" />
    </div>
  )
}

/**
 * ExpressionGuideModal: Guide modal explaining how to write, format,
 * and test Boolean expressions in Praxis.
 */
import { motion, AnimatePresence } from 'framer-motion'

const EXAMPLES = [
  {
    name: 'Absorption Law',
    expr: 'A + AB',
    goal: 'A',
    desc: 'The term A absorbs AB because if A is true, the whole expression is true.',
  },
  {
    name: "De Morgan's Law",
    expr: "!(A * B) + C'",
    goal: "A' + B' + C'",
    desc: 'Negation of an AND product splits into an OR sum of negated literals.',
  },
  {
    name: 'Distributive Factoring',
    expr: "(A + B)(A + B')",
    goal: 'A',
    desc: 'Factoring out common literal A leaves B and B prime, which simplifies to 0.',
  },
  {
    name: 'Complement & Expansion',
    expr: "A(B + A')",
    goal: 'AB',
    desc: "Distributing A over B + A' eliminates the complement term A·A'.",
  },
  {
    name: 'Redundant Terms',
    expr: "AB + A'C + BC",
    goal: "AB + A'C",
    desc: 'The consensus term BC is redundant and can be simplified out.',
  },
]

export default function ExpressionGuideModal({ show, onClose, onSelectExample }) {
  if (!show) return null

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="bg-white rounded-2xl flex flex-col shadow-2xl max-w-xl w-full max-h-[90vh] border border-border overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-bg/50 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="text-xl leading-none">📖</span>
              <div>
                <h3 className="text-base font-bold text-text-1">How to Write Expressions</h3>
                <p className="text-xs text-text-3 font-medium">Syntax rules and interactive examples</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-border/60 transition-all font-bold text-sm cursor-pointer"
              title="Close guide"
            >
              ✕
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 text-text-1 text-xs">
            {/* Overview */}
            <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-3.5 flex flex-col gap-1.5">
              <span className="font-bold text-[13px] text-sky-900">How the Sandbox Works</span>
              <p className="text-sky-950/90 leading-relaxed font-normal">
                Type any Boolean expression below. Praxis validates its syntax, verifies that it can be simplified, and loads it into the interactive canvas so you can apply laws step by step.
              </p>
            </div>

            {/* Notation Reference */}
            <div className="flex flex-col gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-text-3">Accepted Notation</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg border border-border bg-bg/40 flex flex-col gap-1">
                  <span className="font-bold text-text-1">AND (Conjunction)</span>
                  <div className="flex flex-wrap gap-1 font-mono text-[11.5px] text-accent font-semibold">
                    <span className="bg-white px-1.5 py-0.5 rounded border border-border">AB</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-border">A·B</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-border">A*B</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-border">A&amp;B</span>
                  </div>
                  <span className="text-[11px] text-text-3">Implicit multiplication is supported.</span>
                </div>

                <div className="p-2.5 rounded-lg border border-border bg-bg/40 flex flex-col gap-1">
                  <span className="font-bold text-text-1">OR (Disjunction)</span>
                  <div className="flex flex-wrap gap-1 font-mono text-[11.5px] text-accent font-semibold">
                    <span className="bg-white px-1.5 py-0.5 rounded border border-border">A + B</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-border">A | B</span>
                  </div>
                  <span className="text-[11px] text-text-3">Use + or vertical bar.</span>
                </div>

                <div className="p-2.5 rounded-lg border border-border bg-bg/40 flex flex-col gap-1">
                  <span className="font-bold text-text-1">NOT (Negation)</span>
                  <div className="flex flex-wrap gap-1 font-mono text-[11.5px] text-accent font-semibold">
                    <span className="bg-white px-1.5 py-0.5 rounded border border-border">A&apos;</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-border">!A</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-border">!(A + B)</span>
                  </div>
                  <span className="text-[11px] text-text-3">Postfix apostrophe or prefix exclamation.</span>
                </div>

                <div className="p-2.5 rounded-lg border border-border bg-bg/40 flex flex-col gap-1">
                  <span className="font-bold text-text-1">Constants &amp; Groups</span>
                  <div className="flex flex-wrap gap-1 font-mono text-[11.5px] text-accent font-semibold">
                    <span className="bg-white px-1.5 py-0.5 rounded border border-border">0</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-border">1</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-border">(A + B)</span>
                  </div>
                  <span className="text-[11px] text-text-3">Up to 4 variables: A, B, C, D</span>
                </div>
              </div>
            </div>

            {/* Key Rules */}
            <div className="flex flex-col gap-1.5 bg-amber-50/60 border border-amber-200/80 rounded-xl p-3">
              <span className="font-bold text-[12px] text-amber-900 flex items-center gap-1.5">
                <span>💡</span> Helpful Tips
              </span>
              <ul className="list-disc list-inside text-amber-950/90 text-[11.5px] leading-relaxed flex flex-col gap-1">
                <li>
                  <strong className="font-semibold">Must be simplifiable:</strong> Expressions already in simplest form (such as <code className="font-mono font-bold">A</code> or <code className="font-mono font-bold">A + B</code>) cannot be simplified further.
                </li>
                <li>
                  <strong className="font-semibold">Balanced parentheses:</strong> Ensure every opening parenthesis has a matching closing parenthesis.
                </li>
                <li>
                  <strong className="font-semibold">Variable limit:</strong> Supports up to 4 variables at once.
                </li>
              </ul>
            </div>

            {/* Example Expressions */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-text-3">Try Example Expressions</span>
                <span className="text-[11px] text-text-3">Click to insert and test</span>
              </div>
              <div className="flex flex-col gap-2">
                {EXAMPLES.map((item) => (
                  <div
                    key={item.name}
                    className="p-3 rounded-xl border border-border bg-white hover:border-teal/60 transition-all flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-1 text-[12px]">{item.name}</span>
                        <span className="font-mono text-xs font-bold text-accent px-1.5 py-0.5 bg-bg rounded border border-border">
                          {item.expr}
                        </span>
                        <span className="text-[11px] text-text-3">→ {item.goal}</span>
                      </div>
                      <p className="text-[11px] text-text-3 leading-snug truncate sm:whitespace-normal">
                        {item.desc}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectExample(item.expr)
                        onClose()
                      }}
                      className="shrink-0 px-3 py-1.5 bg-teal-light hover:bg-teal text-sky-800 hover:text-white border border-teal/40 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      Try this
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-border bg-bg/30 flex justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold text-text-2 bg-white hover:bg-border/60 rounded-lg border border-border transition-all cursor-pointer"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

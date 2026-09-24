import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('React ErrorBoundary caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center font-sans">
          <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-8 max-w-md w-full flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-2xl font-bold">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-slate-800">Something went wrong</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              An unexpected display glitch occurred while updating the equation workspace.
            </p>
            {this.state.error && (
              <div className="w-full bg-slate-100 rounded-lg p-3 text-left overflow-x-auto text-xs font-mono text-slate-700 border border-slate-200 max-h-28">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => window.location.href = '/levels'}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all"
              >
                Back to Levels
              </button>
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-all shadow-sm"
              >
                Reload Stage
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

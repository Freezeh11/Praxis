import React from 'react'

const SURVEY_URL = 'https://docs.google.com/forms/d/1P4O0MdbQUAUGz-xNL-neMHX5ukDuLTjCq-nXpEaFdb8/viewform?edit_requested=true'

export default function SurveyBanner({ className = '' }) {
  return (
    <a
      href={SURVEY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2.5 px-4 py-2 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-900 border-2 border-dashed border-emerald-400/80 rounded-2xl transition-all shadow-[0_0_14px_rgba(16,185,129,0.18)] hover:shadow-[0_0_18px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 group cursor-pointer select-none ${className}`}
      title="Open Praxis User Feedback Survey in new tab"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
      </span>

      <span className="text-xs sm:text-[13px] font-bold text-emerald-950 tracking-tight leading-tight">
        Hey! We need your help! Please take this survey to help improve Praxis!
      </span>

      <span className="text-emerald-700 text-xs font-bold transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
        ↗
      </span>
    </a>
  )
}

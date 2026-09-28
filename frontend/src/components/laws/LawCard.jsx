/**
 * One law reference entry: the law name, its formula lines and the prose description.
 * Presentational — the caller owns the law data.
 */
export default function LawCard({ law }) {
  return (
    <div className="bg-bg border border-border rounded-lg p-3.5 text-left">
      <div className="text-[13px] font-bold text-text-1 mb-1">{law.name}</div>
      <div className="flex flex-col gap-1 my-2 bg-white border border-border rounded px-3 py-2 shadow-sm">
        {law.formulas && law.formulas.map((f, idx) => (
          <div key={idx} className="font-mono text-xs font-semibold text-text-1">{f}</div>
        ))}
      </div>
      <div className="text-[12px] text-text-3 leading-relaxed mt-2">{law.desc}</div>
    </div>
  )
}

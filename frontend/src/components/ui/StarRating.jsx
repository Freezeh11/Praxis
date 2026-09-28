/** Read-only 3-star rating display (one star per earned point). Presentational only. */
export default function StarRating({ stars = 0 }) {
  return (
    <div className="flex items-center gap-0.5" title={`${stars} of 3 Stars`}>
      {[1, 2, 3].map((s) => (
        <span
          key={s}
          className={`text-sm leading-none select-none transition-all ${
            s <= stars
              ? 'text-amber-400 drop-shadow-[0_1px_2px_rgba(245,158,11,0.4)]'
              : 'text-slate-200'
          }`}
        >
          ★
        </span>
      ))}
    </div>
  )
}

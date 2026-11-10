// Shared, font-independent icons. Visible labels belong to the surrounding UI.
const paths = {
  book: 'M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15',
  clipboard: 'M9 4H5v18h14V4h-4M9 2h6v4H9ZM8 11h8M8 15h8M8 19h5',
  trophy: 'M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v6m-4 2h8',
  unlock: 'M8 10V6a4 4 0 0 1 8 0M5 10h14v12H5Zm7 5v2',
  lock: 'M8 10V6a4 4 0 0 1 8 0v4M5 10h14v12H5Zm7 5v2',
  celebration: 'm3 21 5-15 10 10ZM6 12l6 6M14 3l1 3m5-3-3 5m4 3-3 1M10 2v1m12 14h-1',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01',
  volume: 'M11 4 6 8H2v8h4l5 4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  muted: 'M11 4 6 8H2v8h4l5 4Zm5 5 6 6m0-6-6 6',
  warning: 'm12 3 10 18H2ZM12 9v5m0 3h.01',
  flask: 'M9 2h6m-5 0v7L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V2M7 15h10',
  flame: 'M12 2c1 6 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 4-7 0 4 2 4 3 5 2-3 2-6 0-11Z',
  chart: 'M4 3v18h17M8 16v-4m5 4V8m5 8V5',
  bulb: 'M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z',
  scale: 'M12 3v18m-5 0h10M4 7h16M5 7l-3 7h6Zm14 0-3 7h6Z',
  target: 'M22 12a10 10 0 1 1-10-10m5 10a5 5 0 1 1-5-5m0 5L22 2m-6 0v6h6',
  search: 'M21 21l-5-5m2-6a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  bolt: 'm13 2-9 12h7l-1 8 10-12h-7Z',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M18 6 6 18',
  edit: 'm15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z',
  star: 'm12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',
  info: 'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
}

export default function Icon({ name, className = '', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      width="1em" height="1em" fill={name === 'star' ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
      className={`inline-block shrink-0 align-[-0.125em] ${className}`} {...props}
    >
      <path d={paths[name]} />
    </svg>
  )
}

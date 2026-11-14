// Original low-poly SVG artwork (faceted shapes in navy + gold) for empty and success states.

/** A faceted gold gem with a check: "done / all clear". */
export function GemCheck({ className = "size-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <ellipse cx="60" cy="104" rx="34" ry="6" fill="#000" opacity=".28" />
      <polygon points="60,10 96,34 60,48" fill="#e6dcae" />
      <polygon points="60,10 24,34 60,48" fill="#d9cc97" />
      <polygon points="24,34 60,48 34,78" fill="#b3a369" />
      <polygon points="96,34 60,48 86,78" fill="#c6b87e" />
      <polygon points="34,78 60,48 86,78 60,100" fill="#a08f55" />
      <polygon points="24,34 34,78 60,100" fill="#8a7b45" opacity=".55" />
      <path d="M44 56l11 11 22-24" fill="none" stroke="#00111f" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A small low-poly campus block: "nothing here yet". */
export function BlockTower({ className = "size-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <ellipse cx="60" cy="102" rx="44" ry="8" fill="#000" opacity=".28" />
      {/* low block */}
      <polygon points="18,70 46,58 46,90 18,100" fill="#1d4e7a" />
      <polygon points="46,58 70,68 70,100 46,90" fill="#0f3f6a" />
      <polygon points="18,70 46,58 70,68 42,80" fill="#7fa3c4" />
      {/* tower */}
      <polygon points="52,34 76,24 76,84 52,94" fill="#255c8c" />
      <polygon points="76,24 100,34 100,94 76,84" fill="#003057" />
      <polygon points="52,34 76,24 100,34 76,44" fill="#d9cc97" />
      <polygon points="76,44 100,34 100,40 76,50" fill="#b3a369" />
      <polygon points="52,34 76,44 76,50 52,40" fill="#c6b87e" />
      {/* windows */}
      <g fill="#d9cc97" opacity=".85">
        <polygon points="58,50 64,47.500 64,55.500 58,58" />
        <polygon points="58,64 64,61.500 64,69.500 58,72" />
        <polygon points="58,78 64,75.500 64,83.500 58,86" />
      </g>
    </svg>
  );
}

/** A faceted wrench badge: "work to do". */
export function WrenchGem({ className = "size-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <ellipse cx="60" cy="104" rx="34" ry="6" fill="#000" opacity=".28" />
      <polygon points="60,12 100,36 100,80 60,104 20,80 20,36" fill="#0f3f6a" />
      <polygon points="60,12 100,36 60,58" fill="#1d4e7a" />
      <polygon points="60,12 20,36 60,58" fill="#255c8c" />
      <polygon points="20,36 60,58 20,80" fill="#003057" />
      <polygon points="100,36 60,58 100,80" fill="#00264a" />
      <path
        d="M71 39a13 13 0 0 0-16 16L37 73a6 6 0 0 0 8.500 8.500L63.500 63.500a13 13 0 0 0 16-16l-8 8-6.500-1.500L63.500 47.500l7.500-8.500Z"
        fill="#d9cc97"
        stroke="#8a7b45"
        strokeWidth="1.500"
        strokeLinejoin="round"
      />
    </svg>
  );
}

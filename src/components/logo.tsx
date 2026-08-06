/**
 * The Daysi Collection mark, redrawn as vector from the printed logo: a ring, a
 * daisy, and the wordmark. It is drawn rather than photographed so it stays
 * crisp at any size and inherits the surrounding text colour.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <DaisyMark className="h-9 w-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.35rem] tracking-[-0.01em]">Daysi</span>
        <span className="mt-[3px] text-[0.5rem] font-medium uppercase tracking-[0.42em] opacity-55">
          Collection
        </span>
      </span>
    </span>
  );
}

export function DaisyMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Daysi Collection"
      className={className}
      fill="none"
    >
      <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.25" />
      {/*
        Twelve petals set far enough out that the ring of background between
        them and the centre reads as a daisy in any colour — the mark inherits
        the text colour, so it cannot rely on a second fill for contrast.
      */}
      {Array.from({ length: 12 }, (_, index) => (
        <ellipse
          key={index}
          cx="24"
          cy="12.5"
          rx="2.4"
          ry="5.6"
          fill="currentColor"
          transform={`rotate(${index * 30} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="3.6" fill="currentColor" />
    </svg>
  );
}

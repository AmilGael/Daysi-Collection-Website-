import Image from "next/image";

/**
 * Daysi's own mark, knocked out of the white paper it was drawn on so it can
 * sit on the dark hero and on the light chrome alike. Two files rather than
 * one tinted file: the art is fine enough — the daisy's petals, the figure's
 * shoulder — that a CSS filter would silt it up.
 *
 * The wordmark stays typeset rather than cropped from the same drawing. Hers
 * is set small under the circle and turns to mud at header size; this is the
 * same lockup, rebuilt so it is legible at 36px.
 */
export function Logo({
  tone = "ink",
  className = "",
}: {
  tone?: "ink" | "paper";
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <Image
        src={tone === "paper" ? "/brand/mark-paper.png" : "/brand/mark-ink.png"}
        alt=""
        width={512}
        height={451}
        priority
        className="h-10 w-auto shrink-0"
      />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.35rem] tracking-[-0.01em]">Daysi</span>
        <span className="mt-[3px] text-[0.5rem] font-medium uppercase tracking-[0.42em] opacity-55">
          Collection
        </span>
      </span>
    </span>
  );
}

/**
 * The mark on its own, for places that already say the name — the sign-in
 * card, an empty state, the office.
 */
export function DaisyMark({
  tone = "ink",
  className = "",
}: {
  tone?: "ink" | "paper";
  className?: string;
}) {
  return (
    <Image
      src={tone === "paper" ? "/brand/mark-paper.png" : "/brand/mark-ink.png"}
      alt="Daysi Collection"
      width={512}
      height={451}
      className={className}
    />
  );
}

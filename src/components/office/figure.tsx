/** One of the four figures at the top of the office. */
export function Figure({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 p-6 ${emphasis ? "bg-ink text-paper" : "bg-paper"}`}>
      <p
        className={`text-[0.625rem] font-medium uppercase tracking-[0.2em] ${
          emphasis ? "text-paper-faint" : "text-ink-faint"
        }`}
      >
        {label}
      </p>
      <p className="font-display text-[1.75rem] tabular-nums leading-none">{value}</p>
    </div>
  );
}

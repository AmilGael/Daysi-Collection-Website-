import type { ReactNode } from "react";

/**
 * The masthead every page below the home page opens with.
 *
 * `eyebrow` is optional and mostly unused: repeating the page name in small
 * capitals directly above the page name in large serif is the sort of thing
 * that gets written when a slot exists and nobody asks whether it should be
 * filled. Where it does appear it says something the title does not.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <header className="shell pb-12 pt-20 md:pb-16 md:pt-32">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end lg:gap-16">
        <div className="flex flex-col gap-4">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="text-title text-balance">{title}</h1>
        </div>
        {lead ? (
          <p className="max-w-xl text-pretty text-[1.0625rem] leading-[1.7] text-ink-soft lg:pb-2">
            {lead}
          </p>
        ) : null}
      </div>
      {children}
    </header>
  );
}

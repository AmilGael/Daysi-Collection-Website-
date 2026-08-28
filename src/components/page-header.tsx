import type { ReactNode } from "react";

/**
 * The masthead every page below the home page opens with.
 *
 * `eyebrow` is optional and mostly unused: repeating the page name in small
 * capitals directly above the page name in large serif is the sort of thing
 * that gets written when a slot exists and nobody asks whether it should be
 * filled. Where it does appear it says something the title does not.
 *
 * The lead sits under the title rather than beside it. A giant headline on the
 * left with a small explainer floating right is a shape that reads as a
 * template, and it breaks the reading order it implies: on a wide screen the
 * eye finishes the title at the top left and has to travel back up and across
 * to find the sentence that explains it.
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
      <div className="flex flex-col">
        {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
        <h1 className="text-title">{title}</h1>
        {lead ? (
          <p className="mt-6 max-w-[58ch] text-[1.0625rem] leading-[1.7] text-ink-soft">
            {lead}
          </p>
        ) : null}
      </div>
      {children}
    </header>
  );
}

import type { ReactNode } from "react";

/**
 * The masthead every page below the home page opens with: an eyebrow, the page
 * title, and a single line saying what the page is for. Consistent height and
 * rhythm across pages is what makes the site feel like one thing.
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <header className="shell pb-14 pt-20 md:pt-28">
      <div className="flex max-w-3xl flex-col gap-6">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="text-title text-balance">{title}</h1>
        {lead ? <p className="max-w-2xl text-lead text-pretty text-ink-soft">{lead}</p> : null}
        {children}
      </div>
    </header>
  );
}

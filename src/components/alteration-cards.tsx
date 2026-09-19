"use client";

import Image from "next/image";
import { useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import { translate, type AlterationService } from "@/content";
import { markFor } from "@/content/alteration-marks";
import { Link, type Locale } from "@/i18n/routing";
import { formatMoney } from "@/lib/money";

/**
 * The alterations as cards: something to look at, the name, one line, the
 * price large and the turnaround small. Each card opens the request form
 * with that alteration already ticked.
 *
 * One switch over the grid turns every price into its rush price, the
 * alteration's own price plus its own surcharge, so nobody has to add it
 * up. The switch names the smallest surcharge on the list, which is what
 * most of them cost.
 */
export function AlterationCards({
  alterations,
  locale,
}: {
  alterations: readonly AlterationService[];
  locale: Locale;
}): JSX.Element {
  const t = useTranslations("alterations");
  const [rush, setRush] = useState(false);
  // The smallest surcharge that actually costs something: an alteration
  // Daysi never charges extra for (a $0 surcharge) should not make the
  // switch itself read "Rush · +$0".
  const surcharges = alterations.map((alteration) => alteration.rushSurcharge).filter((amount) => amount > 0);
  const surcharge = surcharges.length > 0 ? Math.min(...surcharges) : null;

  return (
    <div className="flex flex-col gap-8">
      {alterations.length > 0 ? (
        <label className="flex w-fit cursor-pointer items-center gap-4 text-[0.9375rem]">
          <button
            type="button"
            role="switch"
            aria-checked={rush}
            onClick={() => setRush(!rush)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${rush ? "bg-ink" : "bg-paper-deep"}`}
          >
            <span
              aria-hidden
              className={`absolute top-1 h-5 w-5 rounded-full bg-paper transition-[left] ${rush ? "left-6" : "left-1"}`}
            />
          </button>
          <span>
            {surcharge !== null ? t("rushToggle", { amount: formatMoney(surcharge, locale) }) : t("rushToggleNoAmount")}
          </span>
        </label>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
        {alterations.map((alteration) => {
          const turnaround = translate(alteration.turnaround, locale);
          return (
            <li key={alteration.id}>
              <Link
                href={`/request?kind=alteration&alteration=${encodeURIComponent(alteration.id)}`}
                className="group flex h-full flex-col gap-4 border border-line bg-paper p-3 transition-colors hover:border-ink sm:p-5"
              >
                <span className="relative flex aspect-4/3 items-center justify-center overflow-hidden bg-paper-warm text-ink">
                  {alteration.photo ? (
                    <Image
                      src={alteration.photo}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 30vw, 45vw"
                      className="object-cover"
                    />
                  ) : (
                    <Mark id={alteration.id} />
                  )}
                </span>
                <span className="flex flex-1 flex-col gap-1.5">
                  <span className="font-display text-[1.0625rem] leading-snug sm:text-[1.25rem]">
                    {translate(alteration.name, locale)}
                  </span>
                  <span className="line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-faint">
                    {translate(alteration.description, locale)}
                  </span>
                </span>
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-display text-[1.5rem] leading-none tabular-nums sm:text-[1.875rem]">
                    {formatMoney(alteration.fixedPrice + (rush ? alteration.rushSurcharge : 0), locale)}
                  </span>
                  {turnaround ? <span className="text-[0.75rem] text-ink-faint">{turnaround}</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The alteration's drawing, in ink with its chalk line in the trim colour. */
function Mark({ id }: { id: string }): JSX.Element {
  const mark = markFor(id);
  return (
    <svg
      aria-hidden
      viewBox="0 0 48 48"
      className="h-3/5 w-3/5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {mark.lines.map((d) => (
        <path key={d} d={d} />
      ))}
      {mark.marks.map((d) => (
        <path key={d} d={d} className="text-marigold" strokeDasharray="2.5 2" />
      ))}
    </svg>
  );
}

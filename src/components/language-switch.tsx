"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter, routing, type Locale } from "@/i18n/routing";

/**
 * Switches language without losing the visitor's place: the same route is
 * re-rendered in the other language, dynamic segments and all. Both languages
 * are always one tap away, from anywhere on the site (PRD feature #1).
 */
export function LanguageSwitch({ tone = "ink" }: { tone?: "ink" | "paper" }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  // `usePathname` here is the localised navigation hook: it returns the route
  // with the locale prefix already stripped and dynamic segments filled in, so
  // replacing it under another locale lands on the same page.
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const track = tone === "paper" ? "border-paper/35 text-paper/60" : "border-line text-ink-faint";
  const active = tone === "paper" ? "bg-paper text-ink" : "bg-ink text-paper";

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={`inline-flex items-center rounded-full border p-0.5 ${track} ${
        isPending ? "opacity-60" : ""
      }`}
    >
      {routing.locales.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-current={option === locale ? "true" : undefined}
          disabled={option === locale || isPending}
          onClick={() =>
            startTransition(() => {
              router.replace(pathname, { locale: option });
            })
          }
          className={`rounded-full px-3 py-1 text-[0.6875rem] font-medium uppercase tracking-[0.16em] transition-colors ${
            option === locale ? active : "hover:opacity-100"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

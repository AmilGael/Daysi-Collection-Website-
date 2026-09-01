"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter, routing, type Locale } from "@/i18n/routing";

/**
 * Switches language without losing the visitor's place: the same route is
 * re-rendered in the other language, dynamic segments and all. Both languages
 * are always one tap away, from anywhere on the site (PRD feature #1).
 *
 * Both are still shown rather than one toggle naming the other language: a
 * lone "ES" in the corner does not say whether it is where you are or where
 * you would be going. What went is the box around them. Four bordered controls
 * in a row read as a toolbar bolted to the corner, and this one was the widest
 * of them at 90px for two words of two letters. Set as type, in the same small
 * letterspaced capitals as the tabs, it costs 62px and belongs to the header
 * instead of sitting on top of it.
 */
export function LanguageSwitch() {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  // `usePathname` here is the localised navigation hook: it returns the route
  // with the locale prefix already stripped and dynamic segments filled in, so
  // replacing it under another locale lands on the same page.
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={`inline-flex items-center gap-2 ${isPending ? "opacity-60" : ""}`}
    >
      {routing.locales.map((option, index) => (
        <span key={option} className="inline-flex items-center gap-2">
          {index > 0 ? (
            <span aria-hidden className="text-[0.6875rem] opacity-30">
              /
            </span>
          ) : null}
          <button
            type="button"
            lang={option}
            aria-current={option === locale ? "true" : undefined}
            disabled={option === locale || isPending}
            onClick={() =>
              startTransition(() => {
                router.replace(pathname, { locale: option });
              })
            }
            /* The current language is not a disabled control looking greyed
               out: it is the one you are reading, so it is the one at full
               strength, and the other is the one that dims until you reach
               for it. Same convention as the tabs. */
            className={`text-[0.6875rem] font-medium uppercase tracking-[0.16em] transition-opacity disabled:cursor-default ${
              option === locale ? "opacity-100" : "opacity-55 hover:opacity-100"
            }`}
          >
            {option}
          </button>
        </span>
      ))}
    </div>
  );
}

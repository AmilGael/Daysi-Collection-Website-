"use client";

import { useCallback, useState, type JSX } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { whatsappLink } from "@/lib/whatsapp";
import { ExternalButtonLink, buttonClass } from "./ui";

type Turn = { readonly role: "user" | "assistant"; readonly text: string };

/** Keys in the "helper" namespace, in the order the panel offers them. */
const SUGGESTIONS = ["suggestPrice", "suggestAlteration", "suggestSession"] as const;

/**
 * The public "¿Preguntas?" button: offered on every page except the office
 * (its own "?" answers from the manual instead) and the cart and checkout,
 * where it would sit over the pay button on a phone. `layout.tsx` only
 * renders this at all when the key is present and Daysi has not hidden it
 * from Vitrina; from there, this component decides *where* on the site it
 * still shows, by the same route-name check `site-header.tsx` uses for its
 * dark hero pages.
 *
 * Split in two so the open/close handler stays referentially stable: this
 * component owns only `open`; the thread itself lives in `HelperPanel`,
 * mounted fresh each time the panel opens.
 */
export function SiteHelper(): JSX.Element | null {
  const t = useTranslations("helper");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (pathname.startsWith("/office") || pathname === "/cart" || pathname.startsWith("/checkout")) {
    return null;
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={buttonClass({
            tone: "marigold",
            size: "small",
            className: "fixed right-4 z-40 bottom-[calc(1.25rem+env(safe-area-inset-bottom))]",
          })}
        >
          {t("button")}
        </button>
      ) : null}
      {open ? <HelperPanel onClose={close} /> : null}
    </>
  );
}

/**
 * The thread itself: three suggested questions until the first is asked,
 * then the exchange so far, always with the WhatsApp button in view. A
 * question that comes back with no answer rolls the thread back out —
 * exactly as `office/help-sheet.tsx` does — so the next question never
 * sends a half-finished exchange back to the route.
 */
function HelperPanel({ onClose }: { onClose(): void }): JSX.Element {
  const t = useTranslations("helper");
  const locale = useLocale() as Locale;
  const [thread, setThread] = useState<readonly Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || asking) return;

    const history = thread;
    setThread([...history, { role: "user", text: trimmed }]);
    setQuestion("");
    setFailed(false);
    setAsking(true);
    try {
      const response = await fetch("/api/help", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          locale,
          // Bounded the same way the route bounds it, so a long earlier
          // answer never turns the next question into an invalid request.
          history: history.slice(-6).map((turn) => ({ role: turn.role, text: turn.text.slice(0, 800) })),
        }),
      });
      const body: { answer?: string } | null = response.ok ? await response.json().catch(() => null) : null;
      if (!body?.answer) {
        setThread(history);
        setQuestion(trimmed);
        setFailed(true);
        return;
      }
      setThread([...history, { role: "user", text: trimmed }, { role: "assistant", text: body.answer }]);
    } catch {
      setThread(history);
      setQuestion(trimmed);
      setFailed(true);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      className="fixed right-4 z-40 flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] flex-col gap-4 border border-line bg-paper p-5 shadow-xl bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-[1.125rem] text-ink">{t("title")}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-[0.8125rem] text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          {t("close")}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {thread.length === 0 ? (
          <div className="flex flex-col gap-2">
            {SUGGESTIONS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => ask(t(key))}
                className="w-fit text-left text-[0.8125rem] text-ink-soft underline underline-offset-4 hover:text-ink"
              >
                {t(key)}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {thread.map((turn, index) => (
              <p
                key={index}
                className={
                  turn.role === "user"
                    ? "text-[0.9375rem] font-medium text-ink"
                    : "text-[0.9375rem] leading-relaxed text-ink-soft"
                }
              >
                {turn.text}
              </p>
            ))}
          </div>
        )}

        {failed ? (
          <p role="alert" className="text-[0.875rem] text-ink-soft">
            {t("error")}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        className="flex flex-col gap-2"
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={400}
          rows={2}
          aria-label={t("questionLabel")}
          className="w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink"
        />
        <button
          type="submit"
          disabled={asking || question.trim().length === 0}
          className={buttonClass({ tone: "solid" })}
        >
          {asking ? t("asking") : t("ask")}
        </button>
      </form>

      <ExternalButtonLink href={whatsappLink(t("whatsappMessage"))} tone="outline" size="small" className="w-fit">
        {t("whatsapp")}
      </ExternalButtonLink>
    </div>
  );
}

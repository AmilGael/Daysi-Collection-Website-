"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { tokenizeAnswer } from "@/lib/answer-links";
import { whatsappLink } from "@/lib/whatsapp";
import { DaisyMark } from "./logo";
import { ExternalButtonLink, buttonClass } from "./ui";

type Turn = { readonly role: "user" | "assistant"; readonly text: string };

/**
 * An answer is plain text with, at most, a bare page path the model was told
 * to quote (RULES, `site-helper.ts`) — never Markdown, never HTML. This
 * turns that path into a real `<Link>` by building elements from
 * `tokenizeAnswer`'s segments; it never reaches for
 * `dangerouslySetInnerHTML`, since the model's own words are not markup. The
 * visitor's own question is shown as plain text — only an answer is tokenized.
 */
function renderAnswer(text: string): ReactNode {
  return tokenizeAnswer(text).map((segment, index) =>
    segment.type === "link" ? (
      <Link key={index} href={segment.href} className="font-medium underline underline-offset-4">
        {segment.label}
      </Link>
    ) : (
      <Fragment key={index}>{segment.value}</Fragment>
    ),
  );
}

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
            // Below the phone nav overlay (site-header.tsx, z-30) so it
            // never sits over its own close/back gesture; still above plain
            // page content, which carries no z-index of its own.
            className: "fixed right-4 z-20 bottom-[calc(1.25rem+env(safe-area-inset-bottom))]",
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
  const scroller = useRef<HTMLDivElement>(null);

  // Newest message in view, as in any chat.
  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [thread, asking, failed]);

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
      className="fixed inset-x-0 bottom-0 z-40 flex h-[min(36rem,88svh)] flex-col overflow-hidden border-t border-line bg-paper shadow-[0_-18px_48px_-24px_rgb(20_17_13/0.45)] sm:inset-x-auto sm:right-4 sm:bottom-[calc(1.25rem+env(safe-area-inset-bottom))] sm:w-[23rem] sm:rounded-[6px] sm:border"
    >
      {/* A chat's head: who is answering, and the way out. */}
      <div className="flex items-center gap-3 bg-ink px-4 py-3 text-paper">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper">
          <DaisyMark className="h-7 w-auto" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[1.0625rem] leading-tight">{t("title")}</h2>
          <p className="text-[0.75rem] text-paper/70">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-paper/80 transition-colors hover:bg-paper/10 hover:text-paper"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      <div ref={scroller} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-paper-warm/50 px-4 py-4">
        <p className={bubble("assistant")}>{t("greeting")}</p>

        {thread.length === 0 ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {SUGGESTIONS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => ask(t(key))}
                className="rounded-full border border-line-strong bg-paper px-3.5 py-1.5 text-left text-[0.8125rem] text-ink transition-colors hover:border-ink"
              >
                {t(key)}
              </button>
            ))}
          </div>
        ) : null}

        {thread.map((turn, index) => (
          <p key={index} className={bubble(turn.role)}>
            {turn.role === "assistant" ? renderAnswer(turn.text) : turn.text}
          </p>
        ))}

        {asking ? (
          <p className={bubble("assistant")} aria-label={t("asking")}>
            <span className="inline-flex gap-1 py-1" aria-hidden>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint" />
            </span>
          </p>
        ) : null}

        {failed ? (
          <p role="alert" className={bubble("assistant")}>
            {t("error")}
          </p>
        ) : null}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        className="flex items-end gap-2 border-t border-line bg-paper px-3 py-3"
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, as in any chat; Shift+Enter still breaks a line.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void ask(question);
            }
          }}
          maxLength={400}
          rows={1}
          placeholder={t("placeholder")}
          aria-label={t("questionLabel")}
          className="max-h-28 min-h-11 flex-1 resize-none rounded-[20px] border border-line bg-paper px-4 py-2.5 text-[0.9375rem] leading-snug text-ink placeholder:text-ink-faint focus:border-ink"
        />
        <button
          type="submit"
          disabled={asking || question.trim().length === 0}
          aria-label={t("ask")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-paper transition-opacity disabled:opacity-35"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />
          </svg>
        </button>
      </form>

      <div className="flex items-center justify-between gap-3 bg-paper px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-[0.75rem] text-ink-faint">
        <span>{t("whatsappLead")}</span>
        <ExternalButtonLink
          href={whatsappLink(t("whatsappMessage"))}
          tone="outline"
          size="small"
          className="shrink-0 whitespace-nowrap"
        >
          {t("whatsappShort")}
        </ExternalButtonLink>
      </div>
    </div>
  );
}

/** A chat bubble: the visitor's on the right in ink, the answers on the left on paper. */
function bubble(role: Turn["role"]): string {
  const shared = "max-w-[85%] whitespace-pre-line px-3.5 py-2 text-[0.9375rem] leading-relaxed";
  return role === "user"
    ? `${shared} self-end rounded-[18px] rounded-br-[4px] bg-ink text-paper`
    : `${shared} self-start rounded-[18px] rounded-bl-[4px] border border-line bg-paper text-ink`;
}

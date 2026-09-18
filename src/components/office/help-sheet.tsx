"use client";

import { useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui";
import { Sheet } from "./sheet";

type Turn = { readonly role: "user" | "assistant"; readonly text: string };

/** Keys in the "office" namespace, in the order the sheet offers them. */
const SUGGESTIONS = ["helpSuggestGarment", "helpSuggestEnglish", "helpSuggestWax"] as const;

const box =
  "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink";

/**
 * The "?" beside the office's own tabs: a place to ask what a button does,
 * what a status means, or how a price compares to the list — answered from
 * the manual and the live price list, never from memory. It only ever
 * answers; Confirmar cambios stays the one door anything reaches the site
 * through, so this carries none of the draft/confirm machinery every other
 * office control does.
 *
 * Self-contained, like `OrderNoteCard`: the trigger and its sheet travel
 * together, so wherever this is dropped it needs nothing but the tab it is
 * on.
 */
export function HelpSheet({ tab }: { tab: string }): JSX.Element {
  const t = useTranslations("office");
  const [open, setOpen] = useState(false);
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
      const response = await fetch("/api/office/help", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          tab,
          // Bounded the same way the route bounds it, so a long earlier
          // answer never turns the next question into an invalid request.
          history: history.slice(-6).map((turn) => ({ role: turn.role, text: turn.text.slice(0, 1000) })),
        }),
      });
      const body: { answer?: string } | null = response.ok ? await response.json().catch(() => null) : null;
      if (!body?.answer) {
        setFailed(true);
        return;
      }
      setThread([...history, { role: "user", text: trimmed }, { role: "assistant", text: body.answer }]);
    } catch {
      setFailed(true);
    } finally {
      setAsking(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("helpButton")}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-[0.75rem] font-semibold text-ink-faint transition-colors hover:border-ink hover:text-ink"
      >
        ?
      </button>
      <Sheet open={open} title={t("helpTitle")} onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-5">
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
              {t("helpError")}
            </p>
          ) : null}

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
              maxLength={500}
              rows={2}
              aria-label={t("helpQuestionLabel")}
              className={box}
            />
            <button type="submit" disabled={asking || question.trim().length === 0} className={buttonClass({ tone: "solid" })}>
              {asking ? t("helpAsking") : t("helpAsk")}
            </button>
          </form>

          <a
            href="/api/office/manual"
            target="_blank"
            rel="noopener"
            className="w-fit text-[0.8125rem] underline underline-offset-4"
          >
            {t("helpOpenManual")}
          </a>
        </div>
      </Sheet>
    </>
  );
}

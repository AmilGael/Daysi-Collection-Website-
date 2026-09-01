"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { BotTrap, Field, TextInput, useRenderedAt } from "./form";

/**
 * Asking for a sign-in link. One field, because there is no password to ask
 * for — and the confirmation is deliberately vague about whether the address
 * was known, matching what the server actually does.
 */
export function SignInForm({ googleAuthEnabled = false }: { googleAuthEnabled?: boolean }) {
  const t = useTranslations("account");
  const locale = useLocale() as Locale;
  const renderedAt = useRenderedAt();

  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, locale, website: "", renderedAt }),
      });
      setState(response.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="flex max-w-lg flex-col gap-4 bg-paper-warm p-8">
        <h2 className="text-heading">{t("linkSentTitle")}</h2>
        <p className="leading-relaxed text-ink-soft">{t("linkSentBody", { email })}</p>
        <p className="text-[0.8125rem] text-ink-faint">{t("linkSentNote")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative flex max-w-lg flex-col gap-6">
      <BotTrap renderedAt={renderedAt} />
      <Field label={t("email")} hint={t("signInHint")}>
        {({ id, describedBy }) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            required
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="usted@correo.com"
          />
        )}
      </Field>

      {state === "error" ? (
        <p role="alert" className="bg-paper-warm px-4 py-3 text-[0.875rem]">
          {t("signInError")}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex w-fit items-center justify-center rounded-[2px] bg-ink px-8 py-4 text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-paper transition-colors hover:bg-ink-soft disabled:opacity-45"
      >
        {state === "sending" ? t("sending") : t("sendLink")}
      </button>

      {/* A second way to prove the same address, not a second kind of
          account. A plain anchor: the route redirects to Google, and a
          navigation is exactly what an OAuth flow is. */}
      {googleAuthEnabled ? (
        <div className="flex flex-col gap-4 border-t border-line pt-6">
          <a
            href={`/api/auth/google?locale=${locale}`}
            className="inline-flex w-fit items-center gap-3 rounded-[2px] border border-line px-8 py-4 text-[0.6875rem] font-medium uppercase tracking-[0.16em] transition-colors hover:border-ink/50 hover:bg-paper-warm"
          >
            <svg aria-hidden viewBox="0 0 18 18" className="h-4 w-4">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.32z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"
              />
            </svg>
            {t("continueWithGoogle")}
          </a>
        </div>
      ) : null}
    </form>
  );
}

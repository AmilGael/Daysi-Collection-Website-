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
export function SignInForm() {
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
    </form>
  );
}

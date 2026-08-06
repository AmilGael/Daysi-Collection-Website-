"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import {
  BotTrap,
  Field,
  FormError,
  SubmitButton,
  TextInput,
  useRenderedAt,
  useSubmit,
} from "./form";

/**
 * The list for a premiere. Two fields, because asking for more than that to
 * watch a reveal is how a list stays empty.
 */
export function PremiereSignup({
  premiereId,
  revealDate,
}: {
  premiereId: string;
  revealDate: string;
}) {
  const t = useTranslations("premieres");
  const locale = useLocale() as Locale;
  const renderedAt = useRenderedAt();
  const { state, submit } = useSubmit("/api/premiere-signups");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit({ website: "", renderedAt, email, name, locale, premiereId });
  }

  const readableDate = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(revealDate));

  if (state.status === "done") {
    return (
      <p className="rounded-lg bg-marigold px-6 py-5 text-[0.9375rem] text-ink">
        {t("signupDone", { date: readableDate })}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative flex flex-col gap-5">
      <BotTrap renderedAt={renderedAt} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("signupTitle")}>
          {({ id }) => (
            <TextInput
              id={id}
              required
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>
        <Field label={t("signupCta")} optional>
          {({ id }) => (
            <TextInput
              id={id}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
      </div>
      <FormError state={state} />
      <SubmitButton state={state}>{t("signupCta")}</SubmitButton>
    </form>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import {
  BotTrap,
  Field,
  FormError,
  SubmitButton,
  TextArea,
  TextInput,
  useRenderedAt,
  useSubmit,
} from "./form";

export function ContactForm() {
  const t = useTranslations("contact");
  const tr = useTranslations("request");
  const locale = useLocale() as Locale;
  const renderedAt = useRenderedAt();
  const { state, submit } = useSubmit("/api/contact");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit({ website: "", renderedAt, name, email, phone, message, locale });
  }

  if (state.status === "done") {
    return (
      <p className="bg-paper-warm px-6 py-8 text-[0.9375rem] leading-relaxed text-ink">
        {t("sent")}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative flex flex-col gap-6">
      <BotTrap renderedAt={renderedAt} />
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={tr("name")}>
          {({ id }) => (
            <TextInput
              id={id}
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <Field label={tr("phone")} optional>
          {({ id }) => (
            <TextInput
              id={id}
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          )}
        </Field>
      </div>
      <Field label={tr("email")}>
        {({ id }) => (
          <TextInput
            id={id}
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </Field>
      <Field label={t("message")}>
        {({ id }) => (
          <TextArea
            id={id}
            required
            minLength={10}
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        )}
      </Field>
      <FormError state={state} />
      <SubmitButton state={state}>{t("formTitle")}</SubmitButton>
    </form>
  );
}

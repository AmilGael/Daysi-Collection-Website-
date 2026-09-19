"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { translate, type GarmentStyle } from "@/content";
import type { Cart } from "@/lib/cart";
import type { Estimate } from "@/lib/pricing";
import { Link, useRouter, type Locale } from "@/i18n/routing";
import { whatsappLink } from "@/lib/whatsapp";
import { buttonClass } from "./ui";
import { ChoiceGroup, Checkbox, Field, TextArea, TextInput } from "./form";
import { EstimateSummary } from "./estimate-summary";

type ContactMethod = "whatsapp" | "phone" | "email";

/**
 * The cart, and the till.
 *
 * Every change posts to the server and the server sends back the re-priced
 * basket, so what the client sees is always what the server would charge.
 * Nothing here adds up a total on its own.
 *
 * The till only ever leads to Stripe. With card payments off there is no
 * form at all, only the total and the way to reach Daysi on WhatsApp, since
 * an order nobody can pay for is not an order.
 */
export function CartView({
  initialCart,
  initialEstimate,
  styles,
  viewer,
  paymentsEnabled,
}: {
  initialCart: Cart;
  initialEstimate: Estimate | null;
  styles: readonly GarmentStyle[];
  viewer: { name: string; email: string } | null;
  paymentsEnabled: boolean;
}) {
  const t = useTranslations("cart");
  const tr = useTranslations("request");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [cart, setCart] = useState(initialCart);
  const [estimate, setEstimate] = useState(initialEstimate);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState(viewer?.name ?? "");
  const [email, setEmail] = useState(viewer?.email ?? "");
  const [phone, setPhone] = useState("");
  const [preferredContact, setPreferredContact] = useState<ContactMethod>("whatsapp");
  const [notes, setNotes] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only the email is required: with no phone typed, WhatsApp or a call is
  // not reachable, whatever the pills above say, so the order falls back to
  // email until a number is given.
  const contactMethod: ContactMethod = phone.trim() ? preferredContact : "email";

  async function change(body: unknown) {
    setBusy(true);
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const result = (await response.json()) as { cart: Cart; estimate: Estimate | null };
        setCart(result.cart);
        setEstimate(result.estimate);
        setError(null);
      } else if (response.status === 409) {
        setError(t("soldOut"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim() ? name : undefined,
          email,
          phone: phone.trim() ? phone : undefined,
          preferredContact: contactMethod,
          notes,
          locale,
          acceptedTerms: true,
        }),
      });

      // Every refusal leaves the cart as it was, so the client can try again.
      if (!response.ok) {
        setError(
          response.status === 409
            ? t("soldOut")
            : response.status === 502
              ? t("checkoutUnavailable")
              : response.status === 503
                ? t("paymentsOff")
                : tc("somethingWentWrong"),
        );
        return;
      }

      const result = (await response.json()) as { reference: string; checkoutUrl?: string };
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      // Nothing was due now, so there was nothing to pay: the order is
      // already Daysi's, and the thank-you page gives the client its number.
      router.push(`/checkout/thank-you?reference=${encodeURIComponent(result.reference)}`);
    } catch {
      setError(tc("somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  }

  if (cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-6 border border-dashed border-line px-8 py-16">
        <p className="text-lead text-ink-soft">{t("empty")}</p>
        <Link href="/collection" className={buttonClass({ size: "small" })}>
          {t("browse")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-14 lg:grid-cols-[1fr_24rem] lg:gap-16">
      <div className="flex flex-col border-t border-line">
        {cart.lines.map((line, index) => {
          const style = styles.find((candidate) => candidate.slug === line.styleSlug);
          const photo = style?.photos.find((item) => item.isPrimary) ?? style?.photos[0];

          return (
            <div
              key={`${line.styleSlug}-${line.sizeId}-${line.customize}`}
              className="grid grid-cols-[5rem_1fr] gap-5 border-b border-line py-6 sm:grid-cols-[6rem_1fr_auto]"
            >
              <div className="relative aspect-3/4 overflow-hidden bg-paper-warm">
                {photo ? (
                  <Image
                    src={photo.src}
                    alt={translate(photo.alt, locale)}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <h3 className="font-display text-[1.0625rem]">
                  {style ? translate(style.name, locale) : line.styleSlug}
                </h3>
                <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
                  {tc("size")} {line.sizeId.toUpperCase()}
                  {line.customize ? ` / ${tc("customization")}` : ""}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <label className="flex items-center gap-2 text-[0.8125rem] text-ink-faint">
                    {t("quantity")}
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={line.quantity}
                      disabled={busy}
                      onChange={(event) =>
                        change({
                          action: "setQuantity",
                          index,
                          quantity: Number(event.target.value),
                        })
                      }
                      className="w-16 rounded-[2px] border border-line bg-paper px-2 py-1.5 text-center tabular-nums text-ink"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => change({ action: "remove", index })}
                    className="link-underline text-[0.8125rem] text-ink-faint"
                  >
                    {t("remove")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
        {estimate ? <EstimateSummary estimate={estimate} /> : null}

        {paymentsEnabled ? (
          <form onSubmit={placeOrder} className="flex flex-col gap-5 border-t border-line pt-6">
            <h2 className="text-heading">{t("yourDetails")}</h2>

            <Field label={tr("email")}>
              {({ id }) => (
                <TextInput
                  id={id}
                  required
                  type="email"
                  autoComplete="email"
                  readOnly={viewer !== null}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={viewer ? "text-ink-faint" : undefined}
                />
              )}
            </Field>
            <Field label={tr("name")} optional>
              {({ id }) => (
                <TextInput
                  id={id}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </Field>
            <Field label={tr("phone")} optional hint={tr("whatsappHint")}>
              {({ id, describedBy }) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              )}
            </Field>

            {phone.trim() ? (
              <ChoiceGroup
                legend={tr("preferredContact")}
                value={preferredContact}
                onChange={setPreferredContact}
                options={[
                  { value: "whatsapp", label: tc("whatsapp") },
                  { value: "phone", label: tc("phone") },
                  { value: "email", label: tc("email") },
                ]}
              />
            ) : null}

            <Field label={tr("notes")} optional>
              {({ id }) => (
                <TextArea
                  id={id}
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              )}
            </Field>

            <Checkbox checked={acceptedTerms} onChange={setAcceptedTerms}>
              {tr.rich("terms", {
                link: (chunks) => (
                  <Link href="/terms" className="link-underline">
                    {chunks}
                  </Link>
                ),
              })}
            </Checkbox>

            {error ? (
              <p role="alert" className="bg-paper-warm px-4 py-3 text-[0.875rem]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !acceptedTerms}
              className="inline-flex items-center justify-center rounded-[2px] bg-ink px-8 py-4 text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-paper transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t("payNow")}
            </button>

            {/* The client is told what the checkout accepts before pressing anything. */}
            <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("paymentMethods")}</p>
          </form>
        ) : (
          <div className="flex flex-col gap-5 border-t border-line pt-6">
            <p className="text-[0.875rem] leading-relaxed text-ink-soft">{t("paymentsOff")}</p>
            <a
              href={whatsappLink(
                locale === "es" ? "Hola Daysi, quisiera hacer un pedido." : "Hi Daysi, I'd like to place an order.",
              )}
              target="_blank"
              rel="noreferrer noopener"
              className={buttonClass({ className: "w-full" })}
            >
              {tc("whatsapp")}
            </a>
          </div>
        )}
      </aside>
    </div>
  );
}

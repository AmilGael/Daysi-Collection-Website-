"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { translate, type GarmentStyle } from "@/content";
import type { Cart } from "@/lib/cart";
import type { Estimate } from "@/lib/pricing";
import { Link, type Locale } from "@/i18n/routing";
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

  const [cart, setCart] = useState(initialCart);
  const [estimate, setEstimate] = useState(initialEstimate);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState(viewer?.name ?? "");
  const [email, setEmail] = useState(viewer?.email ?? "");
  const [phone, setPhone] = useState("");
  const [preferredContact, setPreferredContact] = useState<ContactMethod>("whatsapp");
  const [notes, setNotes] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          name,
          email,
          phone,
          preferredContact,
          notes,
          locale,
          acceptedTerms: true,
        }),
      });

      if (!response.ok) {
        setError(tc("somethingWentWrong"));
        return;
      }

      const result = (await response.json()) as { reference: string; checkoutUrl?: string };
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setPlaced(result.reference);
      setCart({ lines: [] });
      setEstimate(null);
    } catch {
      setError(tc("somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  }

  if (placed) {
    return (
      <div className="flex max-w-2xl flex-col gap-6 bg-paper-warm p-8 sm:p-12">
        <h2 className="text-title">{t("placedTitle")}</h2>
        <p className="text-lead text-ink-soft">{t("placedLead", { reference: placed })}</p>
        <Link href="/account/orders" className={buttonClass({ size: "small", className: "w-fit" })}>
          {t("seeOrders")}
        </Link>
      </div>
    );
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

        <form onSubmit={placeOrder} className="flex flex-col gap-5 border-t border-line pt-6">
          <h2 className="text-heading">{t("yourDetails")}</h2>

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
          <Field label={tr("phone")}>
            {({ id }) => (
              <TextInput
                id={id}
                required
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            )}
          </Field>

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
            {paymentsEnabled ? t("payNow") : t("placeOrder")}
          </button>

          {/* Either way the client is told how the money part works before
              pressing anything: what the checkout accepts, or that cards are
              not on yet and settling happens in person. */}
          <p className="text-[0.8125rem] leading-relaxed text-ink-faint">
            {paymentsEnabled ? t("paymentMethods") : t("paymentsOff")}
          </p>
        </form>
      </aside>
    </div>
  );
}

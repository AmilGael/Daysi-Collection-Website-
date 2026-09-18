"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent, type JSX } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { centsFromInput, formatMoney } from "@/lib/money";
import type { FabricChange } from "@/lib/office-validation";
import { buttonClass } from "@/components/ui";
import { ErrorText, Pending } from "./confirm-bar";
import { fabricAddWire, fabricKey, representativePrice, type ManagedFabric } from "./fabric-draft";
import { MoneyBox } from "./garment-sheet";
import { readAverageColor } from "./image-reads";
import { RetireButton } from "./retired-group";
import { useOfficeDraft } from "./use-office-draft";

const field =
  "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink";

/** The price range the four boxes used to enforce, now enforced on the one box. */
const MIN_CENTS = 100;
const MAX_CENTS = 500_000;

/**
 * One fabric already on the wall: its swatch, the one price it writes
 * (read-only here — a pair is repriced in Precios, not on this tab), and
 * Retirar for a bolt Daysi added herself. A coded fabric carries no
 * Retirar: only a custom one can leave the wall.
 */
export function FabricSheet({ row, locale }: { row: ManagedFabric; locale: Locale }): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<FabricChange>();
  const key = fabricKey(row.id);
  const entry = draft.pending(key);
  const retiring = entry?.change.wire.type === "retire";
  const price = representativePrice(row.prices);

  return (
    <div className={`flex flex-col gap-8 ${retiring ? "opacity-50" : ""}`}>
      {entry ? (
        <span className="flex items-center gap-3">
          <Pending confirming={entry.confirming} error={entry.error} count={entry.count} />
          <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">
            {t("dropChanges")}
          </button>
        </span>
      ) : null}

      <span className="relative block aspect-square w-full overflow-hidden border border-line">
        <Image src={row.swatchImage} alt="" fill sizes="(min-width: 640px) 26rem, 90vw" className="object-cover" />
      </span>

      <section className="flex flex-col gap-2">
        <h3 className="text-[0.9375rem] font-medium">{t("fabricPrice")}</h3>
        <p className="text-[0.9375rem] tabular-nums text-ink-soft">
          {price === null
            ? t("priceUnknown")
            : price.varies
              ? t("fabricPriceFrom", { price: formatMoney(price.cents, locale) })
              : formatMoney(price.cents, locale)}
        </p>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("fabricPriceHint")}</p>
      </section>

      {!retiring && row.custom ? (
        <span className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <RetireButton
            name={row.name}
            onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: row.id } })}
          />
        </span>
      ) : null}
    </div>
  );
}

/**
 * A fabric that does not exist yet: its photo, a Spanish name, and one price
 * written into all four category pairs at once (decided with Daysi on 14
 * September 2026), rather than the four boxes this sheet used to ask for.
 * Agregarla a los cambios stages one fabric-add with its file and closes;
 * the grid shows it as pending until she confirms.
 */
export function NewFabricSheet({ onDone }: { onDone(): void }): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<FabricChange>();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const staged = useRef(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [formError, setFormError] = useState<"invalid" | "upload-failed" | null>(null);

  // The preview belongs to this sheet until it stages; once staged, it lives
  // on in the draft entry's `meta`, so unmounting on close must not revoke it.
  useEffect(
    () => () => {
      if (!staged.current && previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || name.trim().length < 2) return;
    const cents = centsFromInput(price);
    if (cents === null || cents < MIN_CENTS || cents > MAX_CENTS) {
      setFormError("invalid");
      return;
    }
    setFormError(null);

    const averageColor = await readAverageColor(file);
    if (!averageColor) {
      setFormError("upload-failed");
      return;
    }

    const key = `fabric-add:${crypto.randomUUID()}`;
    const wire = fabricAddWire(key, name.trim(), "", averageColor, cents);
    staged.current = true;
    draft.stage(key, {
      wire,
      files: [file],
      withUploads: ([src]) => ({ ...wire, swatchImage: src ?? "" }),
      meta: preview ?? undefined,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="text-[0.9375rem] font-medium">{t("fabricSwatch")}</h3>
        <span className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(event) => {
              if (previewRef.current) URL.revokeObjectURL(previewRef.current);
              const file = event.target.files?.[0];
              const next = file ? URL.createObjectURL(file) : null;
              previewRef.current = next;
              setPreview(next);
            }}
            className="text-[0.8125rem] file:mr-3 file:cursor-pointer file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-[0.8125rem]"
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-12 w-12 border border-line object-cover" />
          ) : null}
        </span>
      </section>

      <label className="grid gap-1 text-[0.75rem] text-ink-faint">
        {t("fabricName")}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={40}
          required
          placeholder={t("fabricNamePlaceholder")}
          className={field}
        />
      </label>

      <section className="flex flex-col gap-2">
        <MoneyBox label={t("fabricPrice")} value={price} onChange={setPrice} />
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("fabricPriceHint")}</p>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClass({ size: "small", tone: "solid" })}>
          {t("fabricSave")}
        </button>
        {formError ? (
          <span role="alert" className="text-[0.8125rem] text-ink">
            <ErrorText code={formError} />
          </span>
        ) : null}
      </div>
      <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("fabricNote")}</p>
    </form>
  );
}

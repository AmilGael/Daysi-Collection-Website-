"use client";

import { useEffect, useRef, useState, type FormEvent, type JSX } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { centsFromInput, formatMoney } from "@/lib/money";
import type { CollectionChange } from "@/lib/office-validation";
import type { PhotoSlot } from "@/lib/photo-order";
import { buttonClass } from "@/components/ui";
import { Pending } from "./confirm-bar";
import {
  clearedPrice,
  inBox,
  overrideChange,
  overrideKey,
  ownPriceSwitched,
  unchanged,
  viewOf,
  type ManagedStyle,
  type NewPriceBoxes,
  type OverrideView,
  type SizeId,
  withCount,
} from "./garment-draft";
import { GarmentPhotos } from "./garment-photos";
import { GarmentWords } from "./garment-words";
import { RetireButton } from "./retired-group";
import { Switch } from "./switch";
import { UndoLink } from "./undo-link";
import { useOfficeDraft } from "./use-office-draft";

export type Picker = { readonly id: string; readonly label: string };
const SIZES: readonly SizeId[] = ["s", "m", "l"];
const field = "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink";

/**
 * How many pieces of one size are on the rack. Empty while the size has
 * never been counted; the first number she types makes it counted. Focus
 * selects what is there, so typing replaces it rather than adding digits.
 */
function PieceCount({
  size,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  size: SizeId;
  value: number | boolean;
  placeholder: string;
  disabled?: boolean;
  onChange(count: number): void;
}): JSX.Element {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4 border-b border-line text-[0.9375rem]">
      <span className="font-semibold uppercase">{size}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={typeof value === "number" ? value : ""}
        placeholder={placeholder}
        aria-label={size.toUpperCase()}
        disabled={disabled}
        onFocus={(event) => {
          const box = event.currentTarget;
          requestAnimationFrame(() => box.select());
        }}
        onChange={(event) => {
          const count = Number.parseInt(event.target.value, 10);
          if (Number.isInteger(count)) onChange(Math.min(99, Math.max(0, count)));
        }}
        className="w-24 border border-line bg-paper px-3 py-1.5 text-right tabular-nums text-ink placeholder:text-[0.75rem] placeholder:text-ink-faint focus:border-ink disabled:opacity-60"
      />
    </label>
  );
}

/**
 * A dollar amount typed in a box, the same box the Prices tab uses. Focus
 * selects what is there, a frame late so the tap that focused it on iOS
 * does not put the caret back.
 */
function MoneyBox({
  label,
  value,
  placeholder,
  disabled,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange(text: string): void;
  onBlur?(): void;
}): JSX.Element {
  return (
    <label className="grid gap-1 text-[0.75rem] text-ink-faint">
      {label}
      <span className="flex items-center border border-line bg-paper px-2 focus-within:border-ink">
        <span className="text-[0.8125rem] text-ink-faint">$</span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          onFocus={(event) => {
            const box = event.currentTarget;
            requestAnimationFrame(() => box.select());
          }}
          className="min-h-11 w-full bg-transparent py-2 pl-1 text-[0.9375rem] tabular-nums text-ink placeholder:text-ink-faint disabled:opacity-60"
        />
      </span>
    </label>
  );
}

/** The most a garment's own price may be, as everywhere else in the office. */
const MAX_CENTS = 500_000;

/**
 * One garment, everything about it: the photos, the words, the sizes, shown,
 * offered in the studio, retire and undo. Every control stages into the one
 * style:<id> override (or a text change), and the sheet's state is read back
 * from the draft, so closing and reopening shows exactly what is pending.
 */
export function GarmentSheet({
  row,
  locale,
  undoableTexts,
  translationEnabled,
}: {
  row: ManagedStyle;
  locale: Locale;
  undoableTexts: ReadonlySet<string>;
  translationEnabled: boolean;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<CollectionChange>();
  const key = overrideKey(row.id);
  const entry = draft.pending(key);
  const retiring = entry?.change.wire.type === "retire";
  const view = viewOf(row, entry?.change);
  // What she is typing in a price box, held only while the box has focus: a
  // number that is not a price yet stays in the box and off the draft.
  const [typing, setTyping] = useState<{ price?: string; extra?: string }>({});
  const own = view.ownPrice;

  function update(next: OverrideView) {
    if (unchanged(next, row)) draft.unstage(key);
    else draft.stage(key, overrideChange(row, next));
  }

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

      <section className="flex flex-col gap-3">
        <h3 className="text-[0.9375rem] font-medium">{t("photosTitle")}</h3>
        <GarmentPhotos slots={view.slots} disabled={retiring} onChange={(slots) => update({ ...view, slots })} />
      </section>

      <GarmentWords row={row} undoable={undoableTexts} translationEnabled={translationEnabled} />

      <section className="flex flex-col gap-2">
        <h3 className="text-[0.9375rem] font-medium">{t("sizesTitle")}</h3>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("sizesCountHint")}</p>
        <div className="flex flex-col">
          {SIZES.map((size) => (
            <PieceCount
              key={size}
              size={size}
              value={view.stock[size]}
              placeholder={t("sizeUncounted")}
              disabled={retiring}
              onChange={(count) => update(withCount(view, size, count))}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[0.9375rem] font-medium">{t("stylePrice")}</h3>
        <p className="text-[0.9375rem] tabular-nums text-ink-soft">
          {row.listPrice === null ? (
            t("priceUnknown")
          ) : (
            <>
              {formatMoney(row.listPrice, locale)}
              <span className="ml-2 text-[0.75rem] text-ink-faint">{t("stylePriceFromList")}</span>
            </>
          )}
        </p>
        <Switch
          label={t("ownPriceSwitch")}
          checked={own !== null}
          // Without a list entry the garment is off sale whatever it carries,
          // so there is nothing for an own price to replace.
          disabled={retiring || (own === null && row.listPrice === null)}
          onChange={(on) => {
            setTyping({});
            const start = row.ownPrice ?? (row.listPrice === null ? null : { fixedPrice: row.listPrice, customizationExtra: null });
            update({ ...view, ownPrice: on ? start : null });
          }}
        />
        {own !== null ? (
          <>
            <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("ownPriceNote")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyBox
                label={t("stylePrice")}
                value={typing.price ?? inBox(own.fixedPrice)}
                disabled={retiring}
                onChange={(text) => {
                  setTyping({ ...typing, price: text });
                  const cents = centsFromInput(text);
                  if (cents !== null && cents >= 100 && cents <= MAX_CENTS) update({ ...view, ownPrice: { ...own, fixedPrice: cents } });
                }}
                onBlur={() => setTyping({ ...typing, price: undefined })}
              />
              <MoneyBox
                label={t("pricesExtra")}
                value={typing.extra ?? (own.customizationExtra === null ? "" : inBox(own.customizationExtra))}
                // Left empty, the garment keeps the list's made-to-measure charge.
                placeholder={row.listExtra === null ? undefined : inBox(row.listExtra)}
                disabled={retiring}
                onChange={(text) => {
                  setTyping({ ...typing, extra: text });
                  const cents = text.trim() === "" ? null : centsFromInput(text);
                  if (text.trim() !== "" && (cents === null || cents > MAX_CENTS)) return;
                  update({ ...view, ownPrice: { ...own, customizationExtra: cents } });
                }}
                onBlur={() => setTyping({ ...typing, extra: undefined })}
              />
            </div>
          </>
        ) : null}
      </section>

      <section className="flex flex-col gap-1 border-t border-line pt-4">
        <Switch label={t("shownOnSite")} checked={view.isPublished} disabled={retiring} onChange={(on) => update({ ...view, isPublished: on })} />
        <Switch label={t("inStudio")} checked={view.inStudio} disabled={retiring} onChange={(on) => update({ ...view, inStudio: on })} />
      </section>

      {!retiring ? (
        <span className="flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <RetireButton
            name={row.name}
            onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: row.id } })}
          />
          {row.undoable && !entry ? <UndoLink kind="style-override" id={row.id} /> : null}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A garment that does not exist yet: the same sheet, empty, in Spanish
 * only. Agregar a los cambios stages one style-create with its files and
 * closes; the card list shows it as pending until she confirms.
 */
export function NewGarmentSheet({
  categories,
  fabrics,
  pricedPairs,
  locale,
  onDone,
}: {
  categories: readonly Picker[];
  fabrics: readonly Picker[];
  pricedPairs: Readonly<Record<string, { readonly fixedPrice: number; readonly customizationExtra: number }>>;
  locale: Locale;
  onDone(): void;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<CollectionChange>();
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");
  const [detail, setDetail] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [fabricId, setFabricId] = useState(fabrics[0]?.id ?? "");
  const [priceBoxes, setPriceBoxes] = useState<NewPriceBoxes>(clearedPrice);
  const { own: ownPrice, price, extra } = priceBoxes;
  const [stock, setStock] = useState<Record<SizeId, number>>({ s: 0, m: 0, l: 0 });
  const [inStudio, setInStudio] = useState(false);
  const [slots, setSlots] = useState<readonly PhotoSlot[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  // Previews chosen and then abandoned (the sheet closed without adding) are
  // released here; the ones that were staged belong to the draft's entry.
  const staged = useRef(false);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  useEffect(
    () => () => {
      if (staged.current) return;
      for (const slot of slotsRef.current) if (slot.kind === "file") URL.revokeObjectURL(slot.preview);
    },
    [],
  );

  const listed = pricedPairs[`${categoryId}--${fabricId}`];
  const needsPrice = listed === undefined;
  // A priced pair keeps its list price unless she gives this garment its own.
  const ownPriced = !needsPrice && ownPrice;

  // A file dropped by a move, a removal, or a fresh choice that bumped an
  // older one off the end releases its object URL right away, rather than
  // waiting for the sheet to close.
  function updateSlots(next: readonly PhotoSlot[]) {
    const kept = new Set(next.flatMap((slot) => (slot.kind === "file" ? [slot.preview] : [])));
    for (const slot of slots) {
      if (slot.kind === "file" && !kept.has(slot.preview)) URL.revokeObjectURL(slot.preview);
    }
    setSlots(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    const files = slots.flatMap((slot) => (slot.kind === "file" ? [slot.file] : []));
    if (files.length === 0) return setProblem(t("stylePhotoRequired"));
    if (!SIZES.some((size) => stock[size] > 0)) return setProblem(t("styleSizeRequired"));
    const cents = needsPrice || ownPriced ? centsFromInput(price) : null;
    if (needsPrice && !(cents !== null && cents > 0)) return setProblem(t("stylePriceRequired"));
    if (ownPriced && !(cents !== null && cents >= 100 && cents <= MAX_CENTS)) return setProblem(t("ownPriceRequired"));
    const extraCents = ownPriced && extra.trim() !== "" ? centsFromInput(extra) : null;
    if (ownPriced && extra.trim() !== "" && !(extraCents !== null && extraCents <= MAX_CENTS)) {
      return setProblem(t("ownPriceRequired"));
    }

    const key = `style-create:${crypto.randomUUID()}`;
    const wire: CollectionChange = {
      type: "style-create",
      key,
      name: name.trim(),
      color: color.trim(),
      description: description.trim(),
      detail: detail.trim(),
      categoryId,
      fabricId,
      sizes: stock,
      photos: [],
      inStudio,
      // Unpriced pair: the price goes on the list. Priced pair: this garment's own.
      ...(cents !== null ? { fixedPrice: cents } : {}),
      ...(extraCents !== null ? { customizationExtra: extraCents } : {}),
    };
    staged.current = true;
    draft.stage(key, {
      wire,
      files,
      withUploads: (srcs) => ({ ...wire, photos: [...srcs] }),
      meta: slots,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <p className="text-[0.875rem] leading-relaxed text-ink-faint">{t("styleAddLead")}</p>

      <section className="flex flex-col gap-3">
        <h3 className="text-[0.9375rem] font-medium">{t("photosTitle")}</h3>
        <GarmentPhotos slots={slots} max={8} onChange={updateSlots} />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-[0.9375rem] font-medium">{t("wordsTitle")}</h3>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("styleName")}
          <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} required placeholder={t("styleNamePlaceholder")} className={field} />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("styleColor")}
          <input value={color} onChange={(event) => setColor(event.target.value)} maxLength={80} placeholder={t("styleColorPlaceholder")} className={field} />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("styleDescription")}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={400} required rows={3} placeholder={t("styleDescriptionPlaceholder")} className={`${field} resize-none`} />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("styleDetail")}
          <textarea value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={400} rows={3} placeholder={t("styleDetailPlaceholder")} className={`${field} resize-none`} />
        </label>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("styleNote")}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("styleCategory")}
          <select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPriceBoxes(clearedPrice);
            }}
            className={field}
          >
            {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("styleFabric")}
          <select
            value={fabricId}
            onChange={(event) => {
              setFabricId(event.target.value);
              setPriceBoxes(clearedPrice);
            }}
            className={field}
          >
            {fabrics.map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.label}</option>)}
          </select>
        </label>
        <div className="flex flex-col gap-2 sm:col-span-2">
          {needsPrice ? (
            <MoneyBox label={t("stylePrice")} value={price} onChange={(text) => setPriceBoxes({ ...priceBoxes, price: text })} />
          ) : (
            <>
              <p className="grid gap-1 text-[0.75rem] text-ink-faint">
                {t("stylePrice")}
                <span className="py-2 text-[0.9375rem] tabular-nums text-ink-soft">
                  {formatMoney(listed.fixedPrice, locale)}
                  <span className="ml-2 text-[0.75rem] text-ink-faint">{t("stylePriceFromList")}</span>
                </span>
              </p>
              <Switch
                label={t("ownPriceSwitch")}
                checked={ownPrice}
                onChange={(on) => setPriceBoxes(ownPriceSwitched(on, listed.fixedPrice))}
              />
              {ownPrice ? (
                <>
                  <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("ownPriceNote")}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <MoneyBox label={t("stylePrice")} value={price} onChange={(text) => setPriceBoxes({ ...priceBoxes, price: text })} />
                    <MoneyBox
                      label={t("pricesExtra")}
                      value={extra}
                      // Left empty, the garment keeps the list's made-to-measure charge.
                      placeholder={inBox(listed.customizationExtra)}
                      onChange={(text) => setPriceBoxes({ ...priceBoxes, extra: text })}
                    />
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[0.9375rem] font-medium">{t("styleSizes")}</h3>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("sizesCountHint")}</p>
        <div className="flex flex-col">
          {SIZES.map((size) => (
            <PieceCount key={size} size={size} value={stock[size]} placeholder="0" onChange={(count) => setStock({ ...stock, [size]: count })} />
          ))}
        </div>
      </section>

      <section className="border-t border-line pt-4">
        <Switch label={t("inStudio")} checked={inStudio} onChange={setInStudio} />
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClass({ size: "small", tone: "solid" })}>
          {t("styleSave")}
        </button>
        {problem ? <span className="text-[0.8125rem] text-ink">{problem}</span> : null}
      </div>
    </form>
  );
}

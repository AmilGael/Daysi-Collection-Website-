"use client";

import { useEffect, useRef, useState, type FormEvent, type JSX } from "react";
import { useTranslations } from "next-intl";
import { centsFromInput } from "@/lib/money";
import type { PriceChange } from "@/lib/office-validation";
import { buttonClass } from "@/components/ui";
import { inBox } from "./garment-draft";
import { MoneyBox } from "./garment-sheet";
import { useOfficeDraft } from "./use-office-draft";

const field = "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink";
/** The most any price in the office may be. */
const MAX_CENTS = 500_000;
/** What rushing an alteration costs on most of the coded list; she can change it. */
const HOUSE_RUSH = 2000;

function validCents(text: string): number | null {
  const cents = centsFromInput(text);
  return cents !== null && cents <= MAX_CENTS ? cents : null;
}

/**
 * An alteration that is not on the list yet, typed in Spanish only. Agregar
 * a los cambios stages one alteration-add (with its photo, if she chose one,
 * uploaded at confirm) and closes; the Arreglos table shows it as pending
 * until she confirms.
 */
export function NewAlterationSheet({ onDone }: { onDone(): void }): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<PriceChange>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [rush, setRush] = useState(inBox(HOUSE_RUSH));
  const [turnaround, setTurnaround] = useState("");
  const [photo, setPhoto] = useState<{ readonly file: File; readonly preview: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The preview is only for this sheet; the draft keeps the file itself.
  const preview = useRef<string | null>(null);
  preview.current = photo?.preview ?? null;
  useEffect(
    () => () => {
      if (preview.current) URL.revokeObjectURL(preview.current);
    },
    [],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    if (name.trim().length < 2) return setProblem(t("serviceNameRequired"));
    const fixedPrice = validCents(price);
    const rushSurcharge = validCents(rush);
    if (fixedPrice === null || rushSurcharge === null) return setProblem(t("servicePriceRequired"));

    const key = `alteration-add:${crypto.randomUUID()}`;
    const wire: Extract<PriceChange, { type: "alteration-add" }> = {
      type: "alteration-add",
      key,
      name: name.trim(),
      description: description.trim(),
      fixedPrice,
      rushSurcharge,
      turnaround: turnaround.trim(),
    };
    draft.stage(
      key,
      photo
        ? { wire, files: [photo.file], withUploads: ([src]) => (src ? { ...wire, photo: src } : wire) }
        : { wire },
    );
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <p className="text-[0.875rem] leading-relaxed text-ink-faint">{t("serviceAddLead")}</p>

      <section className="flex flex-col gap-4">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("serviceName")}
          <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} required placeholder={t("alterationNamePlaceholder")} className={field} />
        </label>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("alterationDescription")}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={160} rows={2} placeholder={t("alterationDescriptionPlaceholder")} className={`${field} resize-none`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyBox label={t("pricesPrice")} value={price} onChange={setPrice} />
          <MoneyBox label={t("pricesRush")} value={rush} onChange={setRush} />
        </div>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("alterationTurnaround")}
          <input value={turnaround} onChange={(event) => setTurnaround(event.target.value)} maxLength={30} placeholder={t("alterationTurnaroundPlaceholder")} className={field} />
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("alterationPhoto")}
          <span className="flex items-center gap-3">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                if (photo) URL.revokeObjectURL(photo.preview);
                const file = event.target.files?.[0];
                setPhoto(file ? { file, preview: URL.createObjectURL(file) } : null);
              }}
              className="text-[0.8125rem] file:mr-3 file:cursor-pointer file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-[0.8125rem]"
            />
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.preview} alt="" className="h-12 w-12 border border-line object-cover" />
            ) : null}
          </span>
        </label>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("alterationPhotoNote")}</p>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClass({ size: "small", tone: "solid" })}>
          {t("serviceSave")}
        </button>
        {problem ? <span className="text-[0.8125rem] text-ink">{problem}</span> : null}
      </div>
    </form>
  );
}

/**
 * A session that is not on the list yet: a name, how long it runs, its fee
 * (which is also what holds the slot) and one line on what it is for.
 */
export function NewSessionSheet({ onDone }: { onDone(): void }): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<PriceChange>();
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [fee, setFee] = useState("");
  const [suitedFor, setSuitedFor] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    if (name.trim().length < 2) return setProblem(t("serviceNameRequired"));
    const length = Number(minutes);
    if (!Number.isInteger(length) || length < 15 || length > 180) return setProblem(t("sessionMinutesRange"));
    const cents = validCents(fee);
    if (cents === null) return setProblem(t("servicePriceRequired"));

    const key = `appointment-add:${crypto.randomUUID()}`;
    draft.stage(key, {
      wire: {
        type: "appointment-add",
        key,
        name: name.trim(),
        minutes: length,
        fee: cents,
        suitedFor: suitedFor.trim(),
      },
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <p className="text-[0.875rem] leading-relaxed text-ink-faint">{t("serviceAddLead")}</p>

      <section className="flex flex-col gap-4">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("serviceName")}
          <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} required placeholder={t("sessionNamePlaceholder")} className={field} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-[0.75rem] text-ink-faint">
            {t("sessionMinutes")}
            <input
              type="number"
              inputMode="numeric"
              min={15}
              max={180}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              className={`${field} min-h-11 tabular-nums`}
            />
          </label>
          <MoneyBox label={t("pricesFee")} value={fee} onChange={setFee} />
        </div>
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("sessionSuitedFor")}
          <input value={suitedFor} onChange={(event) => setSuitedFor(event.target.value)} maxLength={120} placeholder={t("sessionSuitedForPlaceholder")} className={field} />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={buttonClass({ size: "small", tone: "solid" })}>
          {t("serviceSave")}
        </button>
        {problem ? <span className="text-[0.8125rem] text-ink">{problem}</span> : null}
      </div>
    </form>
  );
}

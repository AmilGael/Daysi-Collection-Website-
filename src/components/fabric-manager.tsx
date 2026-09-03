"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { FabricChange } from "@/lib/office-validation";
import { ErrorText, Pending } from "./office/confirm-bar";
import { readAverageColor } from "./office/image-reads";
import { RetireButton, RetiredGroup } from "./office/retired-group";
import { useOfficeDraft } from "./office/use-office-draft";
import { buttonClass } from "./ui";

export type ManagedFabric = {
  readonly id: string;
  readonly name: string;
  readonly swatchImage: string;
  readonly custom?: boolean;
};

const CATEGORIES = ["dresses", "pants", "shirts", "heritage"] as const;

/**
 * The fabric wall. What is already on it, and the form that puts a new bolt
 * up: a name, the swatch photograph, and what a piece in it costs per garment
 * category — leave a category blank and the fabric is simply not offered
 * there. The swatch's average colour is read from the photo itself, in the
 * browser, so the design studio can tint its croquis without anyone picking
 * hex codes.
 */
export function FabricManager({
  fabrics,
  retired,
  categories,
}: {
  fabrics: readonly ManagedFabric[];
  retired: readonly ManagedFabric[];
  categories: readonly { readonly id: (typeof CATEGORIES)[number]; readonly label: string }[];
}) {
  const t = useTranslations("office");
  const draft = useOfficeDraft<FabricChange>();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<Record<string, string>>({});
  const selectedPreviewRef = useRef<string | null>(null);

  const [name, setName] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<"invalid" | "upload-failed" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingPreviews, setPendingPreviews] = useState<Record<string, string>>({});

  useEffect(() => { previewsRef.current = pendingPreviews; }, [pendingPreviews]);
  useEffect(() => {
    const liveKeys = new Set(draft.entries.map((entry) => entry.key));
    setPendingPreviews((current) => {
      const next = { ...current };
      let changed = false;
      for (const [key, url] of Object.entries(current)) {
        if (!liveKeys.has(key)) {
          URL.revokeObjectURL(url);
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [draft.entries]);
  useEffect(() => () => {
    for (const url of Object.values(previewsRef.current)) URL.revokeObjectURL(url);
    if (selectedPreviewRef.current) URL.revokeObjectURL(selectedPreviewRef.current);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || name.trim().length < 2) return;
    const priceBody: Record<string, number> = {};
    for (const category of CATEGORIES) {
      const entered = prices[category]?.trim() ?? "";
      if (!entered) continue;
      const value = parseFloat(entered);
      if (!Number.isFinite(value) || value < 1 || value > 5000) {
        setFormError("invalid");
        return;
      }
      priceBody[category] = Math.round(value * 100);
    }
    if (Object.keys(priceBody).length === 0) {
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
    const wire: FabricChange = {
      type: "fabric-add",
      key,
      name: name.trim(),
      swatchImage: "",
      averageColor,
      prices: priceBody,
    };
    const objectUrl = preview ?? URL.createObjectURL(file);
    selectedPreviewRef.current = null;
    setPendingPreviews((current) => ({ ...current, [key]: objectUrl }));
    draft.stage(key, {
      wire,
      files: [file],
      withUploads: ([src]) => ({ ...wire, swatchImage: src ?? "" }),
    });
    setName("");
    setPrices({});
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const pendingAdds = draft.entries.filter((entry) => entry.change.wire.type === "fabric-add");

  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-wrap gap-4">
        {fabrics.map((fabric) => {
          const key = `fabric:${fabric.id}`;
          const pending = draft.pending(key);
          const retiring = pending?.change.wire.type === "retire";
          return (
          <li key={fabric.id} className={`flex w-24 flex-col gap-2 ${retiring ? "opacity-50" : ""}`}>
            <span className="relative block aspect-square overflow-hidden border border-line">
              <Image src={fabric.swatchImage} alt="" fill sizes="6rem" className="object-cover" />
            </span>
            <span className="text-[0.6875rem] leading-snug text-ink-soft">
              {fabric.name}
              {fabric.custom ? (
                <span className="block text-ink-faint">{t("fabricYours")}</span>
              ) : null}
            </span>
            {pending ? (
              <>
                <Pending confirming={pending.confirming} error={pending.error} count={pending.count} />
                <button type="button" onClick={() => draft.unstage(key)} className="text-left text-xs underline underline-offset-4">
                  {t("removePending")}
                </button>
              </>
            ) : fabric.custom ? (
              <RetireButton
                name={fabric.name}
                onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: fabric.id } })}
              />
            ) : null}
          </li>
          );
        })}
        {pendingAdds.map((entry) => {
          const wire = entry.change.wire;
          if (wire.type !== "fabric-add") return null;
          const src = pendingPreviews[entry.key];
          return (
            <li key={entry.key} className="flex w-24 flex-col gap-2">
              <span className="relative block aspect-square overflow-hidden border border-line">
                {src ? <Image src={src} alt="" fill unoptimized sizes="6rem" className="object-cover" /> : null}
              </span>
              <span className="text-[0.6875rem] leading-snug text-ink-soft">{wire.name}</span>
              <Pending confirming={draft.pending(entry.key)?.confirming} error={entry.error} />
              <button type="button" onClick={() => draft.unstage(entry.key)} className="text-left text-xs underline underline-offset-4">
                {t("removePending")}
              </button>
            </li>
          );
        })}
      </ul>

      <RetiredGroup
        items={retired.map((fabric) => ({ id: fabric.id, name: fabric.name, photo: fabric.swatchImage }))}
        restoreKey={(id) => `fabric:${id}`}
        onRestore={(id) => {
          const key = `fabric:${id}`;
          draft.stage(key, { wire: { type: "restore", key, id } });
        }}
      />

      <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-5 border-t border-line pt-6">
        <p className="text-[0.9375rem] font-medium">{t("fabricAdd")}</p>

        <div className="flex flex-wrap items-end gap-5">
          <label className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
            {t("fabricName")}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              required
              placeholder={t("fabricNamePlaceholder")}
              className="w-56 border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
            {t("fabricSwatch")}
            <span className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(event) => {
                  if (selectedPreviewRef.current) URL.revokeObjectURL(selectedPreviewRef.current);
                  const file = event.target.files?.[0];
                  const nextPreview = file ? URL.createObjectURL(file) : null;
                  selectedPreviewRef.current = nextPreview;
                  setPreview(nextPreview);
                }}
                className="text-[0.8125rem] file:mr-3 file:cursor-pointer file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-[0.8125rem]"
              />
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-10 w-10 border border-line object-cover" />
              ) : null}
            </span>
          </label>
        </div>

        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-2 text-[0.75rem] text-ink-faint">{t("fabricPrices")}</legend>
          {categories.map(({ id: category, label }) => (
            <label key={category} className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
              {label}
              <span className="flex items-center border border-line bg-paper px-2">
                <span className="text-[0.8125rem] text-ink-faint">$</span>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  step="0.01"
                  value={prices[category] ?? ""}
                  onChange={(event) =>
                    setPrices((current) => ({ ...current, [category]: event.target.value }))
                  }
                  placeholder="–"
                  className="w-20 bg-transparent py-1.5 pl-1 text-right text-[0.875rem] tabular-nums text-ink"
                />
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            className={buttonClass({ size: "small", tone: "solid" })}
          >
            {t("fabricSave")}
          </button>
        </div>
        {formError ? (
          <p role="alert" className="text-[0.8125rem] text-ink">
            <ErrorText code={formError} />
          </p>
        ) : null}
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("fabricNote")}</p>
      </form>
    </div>
  );
}

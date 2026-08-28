"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonClass } from "./ui";

export type ManagedFabric = {
  readonly id: string;
  readonly name: string;
  readonly swatchImage: string;
  readonly custom: boolean;
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
  categories,
}: {
  fabrics: readonly ManagedFabric[];
  categories: readonly { readonly id: (typeof CATEGORIES)[number]; readonly label: string }[];
}) {
  const t = useTranslations("office");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  async function averageColorOf(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const context = canvas.getContext("2d");
    if (!context) return "#8a8a8a";
    context.drawImage(bitmap, 0, 0, 10, 10);
    const { data } = context.getImageData(0, 0, 10, 10);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
    }
    const pixels = data.length / 4;
    const hex = (value: number) =>
      Math.round(value / pixels)
        .toString(16)
        .padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || name.trim().length < 2) return;
    setState("saving");
    try {
      const upload = new FormData();
      upload.append("file", file);
      const uploaded = await fetch("/api/office/uploads", { method: "POST", body: upload });
      if (!uploaded.ok) throw new Error("upload-failed");
      const { src } = (await uploaded.json()) as { src: string };

      const priceBody: Record<string, number> = {};
      for (const category of CATEGORIES) {
        const value = parseFloat(prices[category] ?? "");
        if (Number.isFinite(value) && value > 0) {
          priceBody[category] = Math.round(value * 100);
        }
      }
      if (Object.keys(priceBody).length === 0) throw new Error("no-prices");

      const saved = await fetch("/api/office/fabrics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          swatchImage: src,
          averageColor: await averageColorOf(file),
          prices: priceBody,
        }),
      });
      if (!saved.ok) throw new Error("save-failed");

      setState("saved");
      setName("");
      setPrices({});
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-wrap gap-4">
        {fabrics.map((fabric) => (
          <li key={fabric.id} className="flex w-24 flex-col gap-2">
            <span className="relative block aspect-square overflow-hidden border border-line">
              <Image src={fabric.swatchImage} alt="" fill sizes="6rem" className="object-cover" />
            </span>
            <span className="text-[0.6875rem] leading-snug text-ink-soft">
              {fabric.name}
              {fabric.custom ? (
                <span className="block text-ink-faint">{t("fabricYours")}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

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
              className="w-56 border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
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
                  const file = event.target.files?.[0];
                  setPreview(file ? URL.createObjectURL(file) : null);
                  setState("idle");
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
                  min="0"
                  step="0.01"
                  value={prices[category] ?? ""}
                  onChange={(event) =>
                    setPrices((current) => ({ ...current, [category]: event.target.value }))
                  }
                  placeholder="—"
                  className="w-20 bg-transparent py-1.5 pl-1 text-right text-[0.875rem] tabular-nums text-ink focus:outline-none"
                />
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={state === "saving"}
            className={buttonClass({ size: "small", tone: "solid" })}
          >
            {state === "saving" ? t("saving") : t("fabricSave")}
          </button>
          {state === "saved" ? (
            <span className="text-[0.8125rem] text-marigold-deep">{t("fabricSaved")}</span>
          ) : null}
          {state === "failed" ? (
            <span className="text-[0.8125rem] text-ink">{t("updateFailed")}</span>
          ) : null}
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("fabricNote")}</p>
      </form>
    </div>
  );
}

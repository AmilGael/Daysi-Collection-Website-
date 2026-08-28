"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { translate, type Fabric, type PriceListEntry } from "@/content";
import type { Silhouette } from "@/content/silhouettes";
import { formatMoney } from "@/lib/money";
import { drawMockup, MOCKUP_HEIGHT, MOCKUP_WIDTH } from "@/lib/mockup";
import { Link, type Locale } from "@/i18n/routing";
import { buttonClass } from "./ui";

const TRIM_COLORS = [
  { id: "ink", value: "#14110d" },
  { id: "marigold", value: "#e8a302" },
  { id: "paper", value: "#fbf8f2" },
] as const;

/**
 * The design studio: pick a shape, lay a cloth over it, and see roughly what
 * the piece would look like — the idea Daysi described as superimposing her
 * fabrics onto a drawing before anything is cut.
 *
 * It renders to a canvas so the result can be downloaded as a real image and
 * sent back to Daysi with a request.
 */
export function DesignStudio({
  silhouettes,
  fabrics,
  priceList,
}: {
  silhouettes: readonly Silhouette[];
  fabrics: readonly Fabric[];
  priceList: readonly PriceListEntry[];
}) {
  const t = useTranslations("studio");
  const locale = useLocale() as Locale;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [silhouetteId, setSilhouetteId] = useState(silhouettes[0]?.id ?? "");
  const [fabricId, setFabricId] = useState(fabrics[0]?.id ?? "");
  const [printScale, setPrintScale] = useState(1);
  const [trimColor, setTrimColor] = useState<string>(TRIM_COLORS[0].value);

  const silhouette = silhouettes.find((option) => option.id === silhouetteId) ?? silhouettes[0];
  const fabric = fabrics.find((option) => option.id === fabricId) ?? fabrics[0];
  const price = priceList.find(
    (entry) => entry.categoryId === silhouette?.categoryId && entry.fabricId === fabric?.id,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !silhouette || !fabric) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = MOCKUP_WIDTH * ratio;
    canvas.height = MOCKUP_HEIGHT * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const swatch = new Image();
    swatch.src = fabric.swatchImage;

    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      drawMockup(context, {
        silhouette,
        fabric: swatch,
        printScale,
        trimColor,
        background: "#f2ebdd",
      });
    };

    if (swatch.complete) render();
    else swatch.addEventListener("load", render, { once: true });

    return () => {
      cancelled = true;
    };
  }, [silhouette, fabric, printScale, trimColor]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas || !silhouette || !fabric) return;
    const link = document.createElement("a");
    link.download = `daysi-collection-${silhouette.id}-${fabric.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  if (!silhouette || !fabric) return null;

  return (
    <div className="grid gap-12 lg:grid-cols-[24rem_1fr] lg:gap-16">
      <div className="flex flex-col gap-9">
        <Control label={t("silhouette")}>
          <div className="flex flex-col gap-2">
            {silhouettes.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === silhouetteId}
                onClick={() => setSilhouetteId(option.id)}
                className={`rounded-[2px] border px-4 py-3 text-left text-[0.9375rem] transition-colors ${
                  option.id === silhouetteId
                    ? "border-ink bg-ink text-paper"
                    : "border-line hover:border-ink/50"
                }`}
              >
                {translate(option.name, locale)}
              </button>
            ))}
          </div>
        </Control>

        <Control label={t("fabric")}>
          <div className="grid grid-cols-4 gap-2.5">
            {fabrics.map((option) => (
              <button
                key={option.id}
                type="button"
                title={translate(option.name, locale)}
                aria-label={translate(option.name, locale)}
                aria-pressed={option.id === fabricId}
                onClick={() => setFabricId(option.id)}
                className={`aspect-square overflow-hidden rounded-[2px] border-2 transition-[border-color,transform] active:brightness-95 ${
                  option.id === fabricId
                    ? "border-ink scale-95"
                    : "border-transparent hover:border-line"
                }`}
                style={{ backgroundColor: option.averageColor }}
              >
                {/* Decorative: the button already carries the fabric's name. */}
                <img
                  src={option.swatchImage}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
          <p className="text-[0.8125rem] leading-relaxed text-ink-faint">
            {translate(fabric.description, locale)}
          </p>
        </Control>

        <Control label={t("scale")}>
          <input
            type="range"
            min={0.5}
            max={2.2}
            step={0.05}
            value={printScale}
            onChange={(event) => setPrintScale(Number(event.target.value))}
            className="w-full accent-ink"
            aria-label={t("scale")}
          />
        </Control>

        <Control label={t("accent")}>
          <div className="flex gap-2.5">
            {TRIM_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                aria-label={color.id}
                aria-pressed={color.value === trimColor}
                onClick={() => setTrimColor(color.value)}
                className={`h-9 w-9 rounded-[2px] border-2 transition-transform ${
                  color.value === trimColor ? "border-ink scale-90" : "border-line"
                }`}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
        </Control>

        {price ? (
          <p className="border-t border-line pt-6 text-[0.9375rem] text-ink-soft">
            {t("estimateFor", {
              fabric: translate(fabric.name, locale).toLowerCase(),
              price: formatMoney(price.fixedPrice, locale),
            })}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={download} className={buttonClass({ size: "small" })}>
            {t("download")}
          </button>
          <Link
            href="/request?kind=commission"
            className={buttonClass({ size: "small", tone: "outline" })}
          >
            {t("sendToDaysi")}
          </Link>
        </div>
      </div>

      <figure className="flex flex-col gap-4">
        <div className="flex justify-center bg-paper-warm p-6 sm:p-10">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`${translate(silhouette.name, locale)} — ${translate(fabric.name, locale)}`}
            style={{ width: "100%", maxWidth: `${MOCKUP_WIDTH}px`, aspectRatio: `${MOCKUP_WIDTH} / ${MOCKUP_HEIGHT}` }}
          />
        </div>
        <figcaption className="max-w-xl text-[0.8125rem] leading-relaxed text-ink-faint">
          {t("disclaimer")}
        </figcaption>
      </figure>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-ink-faint">
        {label}
      </h2>
      {children}
    </div>
  );
}

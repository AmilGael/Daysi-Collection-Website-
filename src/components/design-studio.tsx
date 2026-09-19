"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { translate, type Cents, type Fabric, type PriceListEntry } from "@/content";
import type { Silhouette } from "@/content/silhouettes";
import { formatMoney } from "@/lib/money";
import { drawMockup, MOCKUP_HEIGHT, MOCKUP_WIDTH } from "@/lib/mockup";
import { whatsappLink } from "@/lib/whatsapp";
import { Link, type Locale } from "@/i18n/routing";
import {
  BotTrap,
  Checkbox,
  Field,
  FormError,
  SubmitButton,
  TextArea,
  TextInput,
  useRenderedAt,
  useSubmit,
  type SubmitState,
} from "./form";
import { MoreBox } from "./more-box";
import { buttonClass, ExternalButtonLink } from "./ui";

const TRIM_COLORS = [
  { id: "ink", value: "#14110d" },
  { id: "marigold", value: "#e8a302" },
  { id: "paper", value: "#fbf8f2" },
] as const;

const BACKGROUND = "#f2ebdd";

/**
 * The design studio: pick a shape, lay a cloth over it, and see roughly what
 * the piece would look like — the idea Daysi described as superimposing her
 * fabrics onto a drawing before anything is cut.
 *
 * It renders to a canvas so the result can be downloaded as a real image, or
 * sent to Daysi with the design fee: the picture travels with the request,
 * and the client pays the fee on Stripe's page before it reaches her.
 */
export function DesignStudio({
  silhouettes,
  fabrics,
  priceList,
  fee,
  paymentsEnabled,
}: {
  silhouettes: readonly Silhouette[];
  fabrics: readonly Fabric[];
  priceList: readonly PriceListEntry[];
  /** What sending a design costs, as `estimateDesign` charges it. */
  fee: Cents;
  paymentsEnabled: boolean;
}) {
  const t = useTranslations("studio");
  const tr = useTranslations("request");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedAt = useRenderedAt();
  const { state, submit } = useSubmit("/api/design-requests");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);

  const [silhouetteId, setSilhouetteId] = useState(silhouettes[0]?.id ?? "");
  const [fabricId, setFabricId] = useState(fabrics[0]?.id ?? "");
  const [printScale, setPrintScale] = useState(1);
  const [trimColor, setTrimColor] = useState<string>(TRIM_COLORS[0].value);

  const silhouette = silhouettes.find((option) => option.id === silhouetteId) ?? silhouettes[0];
  const fabric = fabrics.find((option) => option.id === fabricId) ?? fabrics[0];
  const price = priceList.find(
    (entry) => entry.categoryId === silhouette?.categoryId && entry.fabricId === fabric?.id,
  );

  // Not every cloth has a published price in every cut, but a person tailoring
  // a design deserves a number either way: the cheapest published price for
  // this garment shape stands in as a floor, said as "from".
  const categoryPrices = priceList
    .filter((entry) => entry.categoryId === silhouette?.categoryId)
    .map((entry) => entry.fixedPrice);
  const priceFloor = categoryPrices.length > 0 ? Math.min(...categoryPrices) : null;

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
        background: BACKGROUND,
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

  /**
   * The picture Daysi receives, drawn again at 600 × 820 on a canvas of its
   * own. The one on screen is scaled up for a sharp display, which would
   * quadruple the file for no gain in the email; this keeps the upload far
   * under the server's image limit on any device.
   */
  async function exportMockup(): Promise<string> {
    if (!silhouette || !fabric) throw new Error("Nothing to draw.");
    const canvas = document.createElement("canvas");
    canvas.width = MOCKUP_WIDTH;
    canvas.height = MOCKUP_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2D context.");

    const swatch = new Image();
    swatch.src = fabric.swatchImage;
    await swatch.decode();
    drawMockup(context, { silhouette, fabric: swatch, printScale, trimColor, background: BACKGROUND });
    return canvas.toDataURL("image/png");
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!silhouette || !fabric) return;

    setExportFailed(false);
    setPreparing(true);
    const mockupDataUrl = await exportMockup().catch(() => null);
    setPreparing(false);
    if (!mockupDataUrl) {
      setExportFailed(true);
      return;
    }

    const result = await submit({
      website: "",
      renderedAt,
      email,
      name: name.trim() ? name : undefined,
      phone: phone.trim() ? phone : undefined,
      notes,
      silhouetteId: silhouette.id,
      fabricId: fabric.id,
      trimColor,
      printScale,
      mockupDataUrl,
      locale,
      acceptedTerms: true,
    });

    // The design reaches Daysi once the fee is paid, so the client goes
    // straight on to Stripe's page.
    if (result?.checkoutUrl) window.location.assign(result.checkoutUrl);
  }

  const shownState: SubmitState = exportFailed
    ? { status: "error", message: tc("somethingWentWrong") }
    : state;

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
        ) : priceFloor !== null ? (
          <p className="border-t border-line pt-6 text-[0.9375rem] text-ink-soft">
            {t("estimateFrom", {
              fabric: translate(fabric.name, locale).toLowerCase(),
              price: formatMoney(priceFloor, locale),
            })}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={download}
            className={buttonClass({ size: "small", tone: "outline" })}
          >
            {t("download")}
          </button>
        </div>

        <section className="flex flex-col gap-5 border-t border-line pt-8">
          <h2 className="text-heading">{t("sendToDaysi")}</h2>
          {paymentsEnabled ? (
            <form onSubmit={send} className="relative flex flex-col gap-5">
              <BotTrap renderedAt={renderedAt} />
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
              <Field label={tr("phone")} optional tip={tr("whatsappHint")}>
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
              <MoreBox value={notes}>
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
              </MoreBox>

              <Checkbox checked={acceptedTerms} onChange={setAcceptedTerms}>
                {tr.rich("terms", {
                  link: (chunks) => (
                    <Link href="/terms" className="link-underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </Checkbox>

              <FormError state={shownState} />

              {/* Held while the picture is drawn and once the payment page is
                  on its way, so a second press cannot send the design, and
                  its fee, twice. */}
              <SubmitButton
                state={state}
                disabled={!acceptedTerms || preparing || state.status === "done"}
              >
                {t("sendFee", { price: formatMoney(fee, locale) })}
              </SubmitButton>
              <p className="text-[0.8125rem] leading-relaxed text-ink-faint">{t("feeNote")}</p>
            </form>
          ) : (
            <>
              <p className="text-[0.875rem] leading-relaxed text-ink-soft">{t("paymentsOff")}</p>
              <ExternalButtonLink
                href={whatsappLink(
                  locale === "es"
                    ? "Hola Daysi, le quiero mandar un diseño del taller."
                    : "Hi Daysi, I'd like to send you a design from the studio.",
                )}
                size="small"
                className="w-fit"
              >
                {tc("whatsapp")}
              </ExternalButtonLink>
            </>
          )}
        </section>
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

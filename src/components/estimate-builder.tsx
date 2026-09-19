"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  translate,
  type AlterationService,
  type AppointmentType,
  type DesignCategory,
  type Fabric,
  type PriceListEntry,
} from "@/content";
import { formatMoney } from "@/lib/money";
import type { Estimate } from "@/lib/pricing";
import { handoffHref } from "@/lib/estimate-handoff";
import { Link, useRouter, type Locale } from "@/i18n/routing";
import { buttonClass } from "./ui";
import { ChoiceGroup, Field, Select } from "./form";
import { EstimateSummary } from "./estimate-summary";

/** "ready-made" is offered only as a way to the collection: every piece there
 *  is priced and bought on its own page, so it is never estimated here. */
type Kind = "commission" | "alteration" | "appointment";

/**
 * The estimate page. A client picks what they want and sees the written total,
 * the tax, and what is due before anything starts — the thing Daysi said she
 * spends most of her time explaining one message at a time.
 *
 * Every figure comes back from the server. Nothing is added up in the browser.
 */
export function EstimateBuilder({
  categories,
  fabrics,
  alterations,
  appointmentTypes,
  priceList,
  paymentsEnabled,
}: {
  categories: readonly DesignCategory[];
  fabrics: readonly Fabric[];
  alterations: readonly AlterationService[];
  appointmentTypes: readonly AppointmentType[];
  priceList: readonly PriceListEntry[];
  paymentsEnabled: boolean;
}) {
  const t = useTranslations("prices");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;

  const router = useRouter();
  const [kind, setKind] = useState<Kind>("commission");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [fabricId, setFabricId] = useState(fabrics[0]?.id ?? "");
  const [alterationIds, setAlterationIds] = useState<string[]>([]);
  const [rush, setRush] = useState(false);
  const [appointmentTypeId, setAppointmentTypeId] = useState(appointmentTypes[0]?.id ?? "");

  const [estimate, setEstimate] = useState<Estimate | null>(null);

  /**
   * Only the combinations the price list actually holds are offered, so the
   * builder can never ask for a price that does not exist.
   */
  const fabricsForCategory = useMemo(
    () =>
      fabrics.filter((fabric) =>
        priceList.some((entry) => entry.categoryId === categoryId && entry.fabricId === fabric.id),
      ),
    [fabrics, priceList, categoryId],
  );

  // Changing the garment can strand a cloth that is not priced for it.
  useEffect(() => {
    if (!fabricsForCategory.some((fabric) => fabric.id === fabricId)) {
      setFabricId(fabricsForCategory[0]?.id ?? "");
    }
  }, [fabricsForCategory, fabricId]);

  useEffect(() => {
    const body =
      kind === "commission"
        ? { kind, categoryId, fabricId, customize: true }
        : kind === "alteration"
          ? { kind, alterationIds, rush }
          : { kind, appointmentTypeId };

    if (kind === "alteration" && alterationIds.length === 0) {
      setEstimate(null);
      return;
    }

    const controller = new AbortController();
    fetch("/api/estimates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: { estimate: Estimate } | null) => setEstimate(result?.estimate ?? null))
      .catch(() => {
        /* An aborted request is the expected case while the choice is changing. */
      });

    return () => controller.abort();
  }, [
    kind,
    categoryId,
    fabricId,
    alterationIds,
    rush,
    appointmentTypeId,
  ]);

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_26rem] lg:gap-16">
      <div className="flex flex-col gap-8">
        <ChoiceGroup
          legend={t("estimateKind")}
          value={kind}
          onChange={(next) => (next === "ready-made" ? router.push("/collection") : setKind(next))}
          options={[
            { value: "ready-made" as const, label: t("kindReadyMade") },
            { value: "commission", label: t("kindCommission") },
            { value: "alteration", label: t("kindAlteration") },
            { value: "appointment", label: t("kindAppointment") },
          ]}
        />

        {kind === "commission" ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t("chooseGarment")}>
              {({ id }) => (
                <Select
                  id={id}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {translate(category.name, locale)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t("chooseFabric")}>
              {({ id }) => (
                <Select
                  id={id}
                  value={fabricId}
                  onChange={(event) => setFabricId(event.target.value)}
                >
                  {fabricsForCategory.map((fabric) => (
                    <option key={fabric.id} value={fabric.id}>
                      {translate(fabric.name, locale)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        ) : null}

        {kind === "alteration" ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-[0.8125rem] font-medium">
              {t("chooseAlterations")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {alterations.map((alteration) => {
                const checked = alterationIds.includes(alteration.id);
                return (
                  <label
                    key={alteration.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-[2px] border p-3.5 text-[0.875rem] transition-colors ${
                      checked ? "border-ink" : "border-line hover:border-ink/40"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setAlterationIds((current) =>
                            event.target.checked
                              ? [...current, alteration.id]
                              : current.filter((id) => id !== alteration.id),
                          )
                        }
                        className="h-4 w-4 shrink-0 accent-ink"
                      />
                      {translate(alteration.name, locale)}
                    </span>
                    <span className="tabular-nums text-ink-faint">
                      {formatMoney(alteration.fixedPrice, locale)}
                    </span>
                  </label>
                );
              })}
            </div>
            <label className="mt-2 flex items-center gap-3 text-[0.875rem]">
              <input
                type="checkbox"
                checked={rush}
                onChange={(event) => setRush(event.target.checked)}
                className="h-4 w-4 accent-ink"
              />
              {t("rush")}
            </label>
          </fieldset>
        ) : null}

        {kind === "appointment" ? (
          <ChoiceGroup
            legend={t("kindAppointment")}
            columns
            value={appointmentTypeId}
            onChange={setAppointmentTypeId}
            options={appointmentTypes.map((type) => ({
              value: type.id,
              label: translate(type.name, locale),
              description: formatMoney(type.fee, locale),
            }))}
          />
        ) : null}

        <p className="max-w-xl text-[0.8125rem] leading-relaxed text-ink-faint">
          {t("taxNote")}
        </p>
      </div>

      <aside className="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
        {estimate ? (
          <>
            <EstimateSummary estimate={estimate} />
            <Link
              href={handoffHref(
                kind === "appointment"
                  ? { kind, appointmentTypeId }
                  : kind === "alteration"
                    ? { kind, alterationIds, rush }
                    : { kind, categoryId, fabricId },
              )}
              className={buttonClass({ className: "w-full" })}
            >
              {t("sendEstimate")}
            </Link>
            {!paymentsEnabled && estimate.dueNow > 0 ? (
              <p className="text-[0.8125rem] leading-relaxed text-ink-faint">
                {t("paymentsOff")}
              </p>
            ) : null}
          </>
        ) : (
          <p className="border border-dashed border-line px-6 py-10 text-center text-[0.875rem] text-ink-faint">
            {t("noEstimate")}
          </p>
        )}
      </aside>
    </div>
  );
}

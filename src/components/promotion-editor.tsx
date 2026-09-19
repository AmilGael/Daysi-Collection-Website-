"use client";

import { useCallback, useState, type FormEvent, type JSX } from "react";
import { useLocale, useTranslations } from "next-intl";
import { translate, type Promotion, type PromotionScope } from "@/content";
import type { Locale } from "@/i18n/routing";
import { centsFromInput } from "@/lib/money";
import type { ShopfrontChange } from "@/lib/office-validation";
import { LEAST_AMOUNT, MOST_AMOUNT, MOST_PERCENT, promotionBadge } from "@/lib/promotions";
import { ChoiceGroup } from "./form";
import { Pending } from "./office/confirm-bar";
import { MoneyBox } from "./office/garment-sheet";
import { RetireButton, RetiredGroup } from "./office/retired-group";
import {
  formatDay,
  promotionKeyFor,
  promotionWireOf,
  scopeFromChoice,
  type ManagedPromotion,
  type ScopeOption,
} from "./office/shopfront-draft";
import { Switch } from "./office/switch";
import { UndoLink } from "./office/undo-link";
import { useOfficeDraft } from "./office/use-office-draft";
import { Tag, buttonClass } from "./ui";

const field = "w-full border border-line bg-paper px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-ink";

/**
 * The promotions on the shop window: each one's name, what it takes off,
 * what it reaches and when, a switch to turn it off and on, Retirar and
 * Deshacer; then the add form. This is already the body of one Sheet
 * (opened from the Promociones card), so adding one swaps the list for the
 * form in place — a second, nested Sheet would register its own Escape and
 * back-gesture handlers on top of the outer one's, and either would close
 * both and drop her back to the four cards. Everything stages into the
 * tab's draft and reaches the site at Confirmar cambios. No codes: a
 * promotion lowers every garment in its reach by itself.
 */
export function PromotionEditor({
  promotions,
  retired,
  categories,
  styles,
  today,
}: {
  promotions: readonly ManagedPromotion[];
  retired: readonly Promotion[];
  categories: readonly ScopeOption[];
  styles: readonly ScopeOption[];
  /** The atelier's day on the server, so the page and the browser agree on what is running. */
  today: string;
}): JSX.Element {
  const t = useTranslations("office");
  const locale = useLocale() as Locale;
  const draft = useOfficeDraft<ShopfrontChange>();
  const [adding, setAdding] = useState(false);
  const backToList = useCallback(() => setAdding(false), []);

  const scopeName = (scope: PromotionScope): string => {
    switch (scope.type) {
      case "all":
        return t("promoScopeAll");
      case "category":
        return categories.find((category) => category.id === scope.categoryId)?.name ?? scope.categoryId;
      case "style":
        return styles.find((style) => style.id === scope.styleId)?.name ?? scope.styleId;
    }
  };

  const datesOf = (promotion: Pick<Promotion, "startsAt" | "endsAt">): string => {
    const from = promotion.startsAt ? formatDay(promotion.startsAt, locale) : null;
    const to = promotion.endsAt ? formatDay(promotion.endsAt, locale) : null;
    if (from && to) return t("promoDatesBoth", { from, to });
    if (from) return t("promoDatesFrom", { from });
    if (to) return t("promoDatesTo", { to });
    return t("promoDatesNone");
  };

  const statusOf = (promotion: Promotion, active: boolean): string => {
    if (!active) return t("promoOff");
    if (promotion.startsAt && today < promotion.startsAt) return t("promoUpcoming");
    if (promotion.endsAt && today > promotion.endsAt) return t("promoEnded");
    return t("promoRunning");
  };

  // Added in this draft, not on the list until she confirms.
  const pendingAdds = draft.entries.flatMap((entry) =>
    entry.change.wire.type === "promotion" && entry.change.wire.id === undefined
      ? [{ key: entry.key, wire: entry.change.wire }]
      : [],
  );

  if (adding) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <button type="button" onClick={backToList} className="w-fit text-[0.8125rem] underline underline-offset-4">
          {t("promoBack")}
        </button>
        <NewPromotionForm
          categories={categories}
          styles={styles.filter((style) => !style.retired)}
          onDone={backToList}
        />
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <p className="text-[0.875rem] leading-relaxed text-ink-faint">{t("promoLead")}</p>
      <ul className="flex flex-col border-t border-line">
        {promotions.length === 0 && pendingAdds.length === 0 ? (
          <li className="border-b border-line py-4 text-[0.875rem] text-ink-faint">{t("promoEmpty")}</li>
        ) : null}
        {promotions.map((promotion) => {
          const key = promotionKeyFor(promotion.id);
          const pending = draft.pending(key);
          const wire = pending?.change.wire;
          const retiring = wire?.type === "retire";
          const active = wire?.type === "promotion" ? wire.active : promotion.active;
          const label = translate(promotion.label, locale);
          return (
            <li
              key={promotion.id}
              className={`flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line py-3 ${retiring ? "opacity-50" : ""}`}
            >
              <div className="flex min-w-56 flex-1 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-3 text-[0.9375rem]">
                  {label}
                  <Tag tone="marigold">{promotionBadge(promotion, locale)}</Tag>
                </p>
                <p className="text-[0.75rem] text-ink-faint">
                  {[scopeName(promotion.scope), datesOf(promotion), statusOf(promotion, active)].join(" · ")}
                </p>
              </div>
              <div className="w-32">
                <Switch
                  checked={active}
                  disabled={retiring}
                  label={t("promoActive")}
                  onChange={(next) => {
                    if (next === promotion.active) draft.unstage(key);
                    else draft.stage(key, { wire: promotionWireOf(promotion, next) });
                  }}
                />
              </div>
              <div className="flex min-w-24 items-center justify-end gap-3">
                {pending ? (
                  <>
                    <Pending confirming={pending.confirming} error={pending.error} count={pending.count} />
                    <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">
                      {t("removePending")}
                    </button>
                  </>
                ) : (
                  <>
                    <RetireButton
                      name={label}
                      onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: promotion.id } })}
                    />
                    {promotion.undoable ? <UndoLink kind="promotion" id={promotion.id} /> : null}
                  </>
                )}
              </div>
            </li>
          );
        })}
        {pendingAdds.map(({ key, wire }) => {
          const pending = draft.pending(key);
          return (
            <li key={key} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line py-3">
              <div className="flex min-w-56 flex-1 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-3 text-[0.9375rem]">
                  {wire.label}
                  <Tag tone="marigold">{promotionBadge(wire, locale)}</Tag>
                </p>
                <p className="text-[0.75rem] text-ink-faint">
                  {[scopeName(wire.scope), datesOf(wire)].join(" · ")}
                </p>
              </div>
              <div className="flex min-w-24 items-center justify-end gap-3">
                <Pending confirming={pending?.confirming} error={pending?.error} count={pending?.count} />
                <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">
                  {t("removePending")}
                </button>
              </div>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-12 w-full items-center gap-3 border-b border-dashed border-line-strong py-3 text-left text-[0.875rem] text-ink-soft hover:text-ink"
          >
            <span aria-hidden className="text-xl leading-none">+</span>
            {t("promoAdd")}
          </button>
        </li>
      </ul>

      <RetiredGroup
        items={retired.map((promotion) => ({ id: promotion.id, name: translate(promotion.label, locale) }))}
        restoreKey={promotionKeyFor}
        onRestore={(id) => draft.stage(promotionKeyFor(id), { wire: { type: "restore", key: promotionKeyFor(id), id } })}
      />
    </div>
  );
}

/**
 * A promotion that is not on the window yet, named in Spanish: what it takes
 * off (a percent or a set amount), what it reaches, and optionally from and
 * until when. Agregar a los cambios stages it and closes; the list shows it
 * as pending until she confirms.
 */
function NewPromotionForm({
  categories,
  styles,
  onDone,
}: {
  categories: readonly ScopeOption[];
  styles: readonly ScopeOption[];
  onDone(): void;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<ShopfrontChange>();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<Promotion["kind"]>("percent");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [scope, setScope] = useState("all");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [active, setActive] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);
    if (label.trim().length < 2) return setProblem(t("promoLabelRequired"));
    let value: number;
    if (kind === "percent") {
      const typed = percent.trim().replace(/\s*%$/, "");
      value = /^\d{1,2}$/.test(typed) ? Number(typed) : 0;
      if (value < 1 || value > MOST_PERCENT) return setProblem(t("promoPercentRange"));
    } else {
      const cents = centsFromInput(amount);
      if (cents === null || cents < LEAST_AMOUNT || cents > MOST_AMOUNT) return setProblem(t("promoAmountRange"));
      value = cents;
    }
    if (startsAt && endsAt && endsAt < startsAt) return setProblem(t("promoDatesOrder"));

    const key = `promotion:${crypto.randomUUID()}`;
    draft.stage(key, {
      wire: {
        type: "promotion",
        key,
        label: label.trim(),
        kind,
        value,
        scope: scopeFromChoice(scope),
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        active,
      },
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <p className="text-[0.875rem] leading-relaxed text-ink-faint">{t("promoAddLead")}</p>

      <section className="flex flex-col gap-5">
        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("promoLabel")}
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            minLength={2}
            maxLength={60}
            required
            placeholder={t("promoLabelPlaceholder")}
            className={field}
          />
        </label>

        <ChoiceGroup
          legend={t("promoKind")}
          options={[
            { value: "percent", label: t("promoKindPercent") },
            { value: "amount", label: t("promoKindAmount") },
          ]}
          value={kind}
          onChange={setKind}
        />

        {kind === "percent" ? (
          <label className="grid gap-1 text-[0.75rem] text-ink-faint">
            {t("promoPercent")}
            <span className="flex w-32 items-center border border-line bg-paper px-2 focus-within:border-ink">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
                placeholder="15"
                className="min-h-11 w-full bg-transparent py-1.5 pr-1 text-right text-[0.9375rem] tabular-nums"
              />
              <span className="text-[0.8125rem] text-ink-faint">%</span>
            </span>
          </label>
        ) : (
          <MoneyBox label={t("promoAmount")} value={amount} placeholder="20.00" onChange={setAmount} />
        )}

        <label className="grid gap-1 text-[0.75rem] text-ink-faint">
          {t("promoScope")}
          <select value={scope} onChange={(event) => setScope(event.target.value)} className={`${field} min-h-11`}>
            <option value="all">{t("promoScopeAll")}</option>
            <optgroup label={t("promoScopeCategories")}>
              {categories.map((category) => (
                <option key={category.id} value={`category:${category.id}`}>
                  {category.name}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("promoScopeGarments")}>
              {styles.map((style) => (
                <option key={style.id} value={`style:${style.id}`}>
                  {style.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-[0.75rem] text-ink-faint">
            {t("promoStarts")}
            <input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className={`${field} min-h-11`} />
          </label>
          <label className="grid gap-1 text-[0.75rem] text-ink-faint">
            {t("promoEnds")}
            <input
              type="date"
              value={endsAt}
              min={startsAt || undefined}
              onChange={(event) => setEndsAt(event.target.value)}
              className={`${field} min-h-11`}
            />
          </label>
        </div>

        <Switch checked={active} onChange={setActive} label={t("promoActive")} />
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

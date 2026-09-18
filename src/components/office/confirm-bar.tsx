"use client";

import { useTranslations } from "next-intl";
import type { JSX, ReactNode } from "react";
import { buttonClass } from "@/components/ui";
import type { DraftStatus } from "./draft-reducer";

export function ErrorText({ code, count }: { code: string; count?: number }) {
  const t = useTranslations("office");
  const key = `error.${code}` as Parameters<typeof t.has>[0];
  return <>{t.has(key) ? t(key, { count: count ?? 0 }) : t("updateFailed")}</>;
}

/**
 * Always on the page, since 14 September 2026. With nothing staged it reads
 * "Sin cambios" with a greyed Confirmar and no Descartar, in the same place
 * it will be when something is: a button she can always see is one she
 * never has to look for.
 *
 * `fixed`, not scroll-linked: rendered through a portal to `document.body`
 * (see `use-office-draft.tsx`), so it is the same full-width, edge-to-edge
 * bar on every tab, regardless of which flex parent staged it. The `.shell`
 * row inside keeps its content lined up with the rest of the page.
 *
 * It sits at z-[60]: above the sheet (z-50), which is above the site header
 * that pins to the top (z-40), so Confirmar cambios is tappable whether a
 * sheet is open or not.
 */
export function ConfirmBar({
  count,
  status,
  error,
  onConfirm,
  onDiscard,
}: {
  count: number;
  status: DraftStatus;
  error?: string;
  onConfirm(): void;
  onDiscard(): void;
}): JSX.Element {
  const t = useTranslations("office");
  const idle = count === 0;

  return (
    <div
      role="region"
      aria-label={t("confirmBarLabel")}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-paper shadow-[0_-12px_32px_-20px_rgb(20_17_13/0.35)]"
    >
      <div className="shell flex min-h-16 items-center justify-between gap-4 py-3">
        <div>
          <p aria-live="polite" className={`text-sm font-semibold ${idle ? "text-ink-faint" : ""}`}>
            {idle ? t("noChanges") : t("changesPending", { count })}
          </p>
          {status === "failed" && error ? (
            <p className="mt-1 text-[0.8125rem] text-ink"><ErrorText code={error} /></p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {idle ? null : (
            <button
              type="button"
              onClick={onDiscard}
              disabled={status === "confirming"}
              className={buttonClass({ tone: "outline", size: "small" })}
            >
              {t("discardChanges")}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={idle || status === "confirming"}
            className={buttonClass({ tone: "solid", size: "small" })}
          >
            {status === "confirming" ? t("confirming") : t("confirmChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Pending({
  confirming,
  error,
  count,
  label,
}: {
  confirming?: boolean;
  error?: string;
  count?: number;
  label?: ReactNode;
}): JSX.Element {
  const t = useTranslations("office");
  return (
    <span className={`text-[0.6875rem] font-semibold uppercase tracking-wider ${error ? "text-ink" : "text-marigold"}`}>
      {confirming ? t("confirming") : label ?? t("pendingMark")}
      {error ? <> · <ErrorText code={error} count={count} /></> : null}
    </span>
  );
}

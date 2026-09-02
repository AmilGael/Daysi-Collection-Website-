"use client";

import { useTranslations } from "next-intl";
import type { JSX } from "react";
import type { DraftStatus } from "./draft-reducer";

function ErrorText({ code }: { code: string }) {
  const t = useTranslations("office");
  const key = `error.${code}` as Parameters<typeof t.has>[0];
  return <>{t.has(key) ? t(key) : t("updateFailed")}</>;
}

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
}): JSX.Element | null {
  const t = useTranslations("office");
  if (count === 0) return null;

  return (
    <div
      role="status"
      className="sticky bottom-0 z-30 mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-paper/95 py-3 backdrop-blur-md"
    >
      <div>
        <p className="text-sm font-semibold">{t("changesPending", { count })}</p>
        {status === "failed" && error ? (
          <p className="mt-1 text-[0.8125rem] text-ink"><ErrorText code={error} /></p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDiscard}
          disabled={status === "confirming"}
          className="border border-ink px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {t("discardChanges")}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={status === "confirming"}
          className="bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
        >
          {status === "confirming" ? t("confirming") : t("confirmChanges")}
        </button>
      </div>
    </div>
  );
}

export function Pending({ confirming, error }: { confirming?: boolean; error?: string }): JSX.Element {
  const t = useTranslations("office");
  return (
    <span className={`text-[0.6875rem] font-semibold uppercase tracking-wider ${error ? "text-ink" : "text-marigold"}`}>
      {confirming ? t("confirming") : t("pendingMark")}
      {error ? <> · <ErrorText code={error} /></> : null}
    </span>
  );
}

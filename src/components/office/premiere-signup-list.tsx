"use client";

import { useTranslations } from "next-intl";
import type { StoredRequest } from "@/lib/request-store";
import type { WorkChange } from "@/lib/office-validation";
import { Pending } from "./confirm-bar";
import { RetireButton, RetiredGroup } from "./retired-group";
import { useOfficeDraft } from "./use-office-draft";

export function PremiereSignupList({
  records,
  emptyMessage,
}: {
  records: readonly StoredRequest[];
  emptyMessage: string;
}) {
  const t = useTranslations("office");
  const draft = useOfficeDraft<WorkChange>();

  if (records.length === 0) {
    return (
      <p className="border border-dashed border-line px-6 py-14 text-center text-[0.9375rem] text-ink-faint">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="flex flex-col border-t border-line">
      {records.map((record) => {
        const key = `request:${record.reference}`;
        const pending = draft.pending(key);
        const retiring = pending?.change.wire.type === "retire";
        return (
          <li
            key={record.reference}
            className={`flex flex-wrap items-baseline justify-between gap-4 border-b border-line py-3 text-[0.875rem] ${retiring ? "opacity-50" : ""}`}
          >
            <span className="break-all">{record.client.email}</span>
            <span className="shrink-0 text-[0.75rem] text-ink-faint">
              {String(record.details.Season ?? "")}
            </span>
            {pending ? (
              <span className="flex flex-wrap items-center gap-3">
                <Pending confirming={pending.confirming} error={pending.error} count={pending.count} />
                <button type="button" onClick={() => draft.unstage(key)} className="text-xs underline underline-offset-4">
                  {t("removePending")}
                </button>
              </span>
            ) : (
              <RetireButton
                name={record.reference}
                prompt={t("retireRequestConfirm", { name: record.reference })}
                onConfirm={() => draft.stage(key, { wire: { type: "retire", key, id: record.reference } })}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function WorkRetiredGroup({
  records,
}: {
  records: readonly (StoredRequest & { retired: boolean })[];
}) {
  const draft = useOfficeDraft<WorkChange>();
  return (
    <RetiredGroup
      items={records.map((record) => ({
        id: record.reference,
        name: `${record.reference} · ${record.client.name || record.client.email}`,
      }))}
      restoreKey={(id) => `request:${id}`}
      onRestore={(id) => {
        const key = `request:${id}`;
        draft.stage(key, { wire: { type: "restore", key, id } });
      }}
    />
  );
}

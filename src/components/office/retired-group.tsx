"use client";

import Image from "next/image";
import { useEffect, useState, type JSX } from "react";
import { useTranslations } from "next-intl";
import { Pending } from "./confirm-bar";
import { useOfficeDraft } from "./use-office-draft";

export type RetiredItem = {
  readonly id: string;
  readonly name: string;
  readonly photo?: string;
};

export function RetiredGroup({
  items,
  restoreKey,
  onRestore,
}: {
  items: readonly RetiredItem[];
  restoreKey(id: string): string;
  onRestore(id: string): void;
}): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<unknown>();

  return (
    <details className="border-t border-line pt-5">
      <summary className="cursor-pointer text-sm font-semibold">
        {t("retiredGroup", { count: items.length })}
      </summary>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-faint">{t("retiredEmpty")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {items.map((item) => {
            const pending = draft.pending(restoreKey(item.id));
            return (
              <li key={item.id} className="flex min-h-12 items-center gap-3 py-2">
                {item.photo ? (
                  <Image
                    src={item.photo}
                    alt=""
                    width={48}
                    height={48}
                    sizes="3rem"
                    className="h-12 w-12 object-cover"
                  />
                ) : null}
                <span className="min-w-0 flex-1 text-sm">{item.name}</span>
                {pending ? (
                  <Pending confirming={pending.confirming} error={pending.error} />
                ) : (
                  <button
                    type="button"
                    onClick={() => onRestore(item.id)}
                    className="text-xs font-semibold underline underline-offset-4"
                  >
                    {t("restore")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}

export function RetireButton({
  name,
  onConfirm,
}: {
  name: string;
  onConfirm(): void;
}): JSX.Element {
  const t = useTranslations("office");
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!asking) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAsking(false);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [asking]);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-xs font-semibold underline underline-offset-4"
      >
        {t("retire")}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      <span>{t("retireConfirm", { name })}</span>
      <button
        type="button"
        onClick={() => {
          onConfirm();
          setAsking(false);
        }}
        className="font-semibold underline underline-offset-4"
      >
        {t("retireYes")}
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="font-semibold underline underline-offset-4"
      >
        {t("retireNo")}
      </button>
    </span>
  );
}

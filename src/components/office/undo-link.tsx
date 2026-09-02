"use client";

import { useState, useTransition, type JSX } from "react";
import { useTranslations } from "next-intl";
import { readPreviousChange } from "@/app/[locale]/office/actions";
import type { OfficeChange, UndoKind } from "@/lib/office-validation";
import { ErrorText } from "./confirm-bar";
import { useOfficeDraft } from "./use-office-draft";

export function UndoLink({ kind, id }: { kind: UndoKind; id: string }): JSX.Element {
  const t = useTranslations("office");
  const draft = useOfficeDraft<OfficeChange>();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function undo() {
    startTransition(async () => {
      const result = await readPreviousChange({ kind, id });
      if (!result.ok) {
        setError(result.error);
      } else if (!result.change) {
        setError("nothing-to-undo");
      } else {
        setError(null);
        draft.stage(result.change.key, { wire: result.change });
      }
    });
  }

  return (
    <span className="text-xs">
      <button
        type="button"
        onClick={undo}
        disabled={pending}
        className="underline disabled:opacity-60"
      >
        {pending ? t("undoPending") : t("undo")}
      </button>
      {error ? <span className="ml-2"><ErrorText code={error} /></span> : null}
    </span>
  );
}

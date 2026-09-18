"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ShopfrontChange } from "@/lib/office-validation";
import { Pending } from "./office/confirm-bar";
import { Switch } from "./office/switch";
import { UndoLink } from "./office/undo-link";
import { useOfficeDraft } from "./office/use-office-draft";

const KEY = "helper:site";

/**
 * Whether the public "¿Preguntas?" panel shows itself. Shown by default —
 * this switch exists only for Daysi to hide it, for quiet or because there
 * is no key yet for it to answer with, in which case she cannot turn it on
 * at all.
 */
export function HelperSwitch({
  initialVisible,
  undoable,
  disabled,
}: {
  initialVisible: boolean;
  undoable: boolean;
  disabled: boolean;
}) {
  const t = useTranslations("office");
  const draft = useOfficeDraft<ShopfrontChange>();
  const [visible, setVisible] = useState(initialVisible);
  const pending = draft.pending(KEY);

  useEffect(() => {
    if (draft.count === 0) setVisible(initialVisible);
  }, [draft.count, initialVisible]);

  useEffect(() => {
    const wire = pending?.change.wire;
    if (wire?.type === "helper" && wire.visible !== visible) setVisible(wire.visible);
  }, [pending?.change.wire, visible]);

  return (
    <div className="flex max-w-xl flex-col gap-2">
      <Switch
        // Without the key the panel never shows itself, whatever this
        // record says (`helperEnabled` gates it in `layout.tsx`), so the
        // switch has to draw off rather than show a "visible" it cannot
        // deliver on.
        checked={visible && !disabled}
        disabled={disabled}
        label={t("helperVisibleLabel")}
        onChange={(next) => {
          setVisible(next);
          if (next === initialVisible) draft.unstage(KEY);
          else draft.stage(KEY, { wire: { type: "helper", key: KEY, visible: next } });
        }}
      />
      {disabled ? <p className="text-[0.8125rem] text-ink-faint">{t("helperNeedsKey")}</p> : null}
      <div className="flex items-center gap-3">
        {pending ? <Pending confirming={pending.confirming} error={pending.error} count={pending.count} /> : null}
        {undoable && !pending && !disabled ? <UndoLink kind="helper" id="site" /> : null}
      </div>
    </div>
  );
}

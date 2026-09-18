"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ShopfrontChange } from "@/lib/office-validation";
import { Pending } from "./office/confirm-bar";
import { NOTICE_KEY } from "./office/shopfront-draft";
import { Switch } from "./office/switch";
import { UndoLink } from "./office/undo-link";
import { useOfficeDraft } from "./office/use-office-draft";

/**
 * The one line Daysi can pin to the site herself — vacation dates, a delayed
 * week, a premiere reminder. Saving with the switch off takes it down
 * without losing the wording. Lives in the Aviso sheet, opened from its card
 * on the Vitrina grid.
 */
export function NoticeEditor({
  initialMessage,
  initialVisible,
  undoable,
}: {
  initialMessage: string;
  initialVisible: boolean;
  undoable: boolean;
}) {
  const t = useTranslations("office");
  const draft = useOfficeDraft<ShopfrontChange>();
  const [message, setMessage] = useState(initialMessage);
  const [visible, setVisible] = useState(initialVisible);
  const pending = draft.pending(NOTICE_KEY);

  useEffect(() => {
    if (draft.count === 0) {
      setMessage(initialMessage);
      setVisible(initialVisible);
    }
  }, [draft.count, initialMessage, initialVisible]);

  useEffect(() => {
    const wire = pending?.change.wire;
    if (wire?.type === "notice" && (wire.message !== message || wire.visible !== visible)) {
      setMessage(wire.message);
      setVisible(wire.visible);
    }
  }, [pending?.change.wire, message, visible]);

  function stage(nextMessage: string, nextVisible: boolean) {
    if (nextMessage === initialMessage && nextVisible === initialVisible) {
      draft.unstage(NOTICE_KEY);
      return;
    }
    draft.stage(NOTICE_KEY, {
      wire: { type: "notice", key: NOTICE_KEY, message: nextMessage, visible: nextVisible },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[0.875rem] leading-relaxed text-ink-faint">{t("noticeLead")}</p>
      <textarea
        value={message}
        onChange={(event) => {
          const nextMessage = event.target.value;
          setMessage(nextMessage);
          stage(nextMessage, visible);
        }}
        rows={2}
        maxLength={200}
        placeholder={t("noticePlaceholder")}
        className="w-full resize-none border border-line bg-paper px-4 py-3 text-[0.9375rem] leading-relaxed placeholder:text-ink-faint focus:border-ink"
      />
      <Switch
        checked={visible}
        onChange={(next) => {
          setVisible(next);
          stage(message, next);
        }}
        label={t("noticeVisible")}
      />
      <div className="flex flex-wrap items-center gap-5">
        {pending ? <Pending confirming={pending.confirming} error={pending.error} count={pending.count} /> : null}
        {undoable && !pending ? <UndoLink kind="notice" id="site" /> : null}
      </div>
    </div>
  );
}

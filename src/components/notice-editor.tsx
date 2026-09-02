"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ShopfrontChange } from "@/lib/office-validation";
import { Pending } from "./office/confirm-bar";
import { UndoLink } from "./office/undo-link";
import { useOfficeDraft } from "./office/use-office-draft";

/**
 * The one line Daysi can pin to the site herself — vacation dates, a delayed
 * week, a premiere reminder. Saving with the box unchecked takes it down
 * without losing the wording.
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
  const key = "notice:site";
  const pending = draft.pending(key);

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
      draft.unstage(key);
      return;
    }
    draft.stage(key, {
      wire: { type: "notice", key, message: nextMessage, visible: nextVisible },
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
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
      <div className="flex flex-wrap items-center gap-5">
        <label className="flex cursor-pointer items-center gap-2 text-[0.875rem]">
          <input
            type="checkbox"
            checked={visible}
            onChange={(event) => {
              const nextVisible = event.target.checked;
              setVisible(nextVisible);
              stage(message, nextVisible);
            }}
            className="h-4 w-4 accent-ink"
          />
          {t("noticeVisible")}
        </label>
        {pending ? <Pending confirming={pending.confirming} error={pending.error} count={pending.count} /> : null}
        {undoable && !pending ? <UndoLink kind="notice" id="site" /> : null}
      </div>
    </div>
  );
}

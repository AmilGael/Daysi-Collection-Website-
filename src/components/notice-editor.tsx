"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { buttonClass } from "./ui";
import { postOffice, type SaveState } from "./office-client";

/**
 * The one line Daysi can pin to the site herself — vacation dates, a delayed
 * week, a premiere reminder. Saving with the box unchecked takes it down
 * without losing the wording.
 */
export function NoticeEditor({
  initialMessage,
  initialVisible,
}: {
  initialMessage: string;
  initialVisible: boolean;
}) {
  const t = useTranslations("office");
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage);
  const [visible, setVisible] = useState(initialVisible);
  const [state, setState] = useState<SaveState>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    try {
      await postOffice("/api/office/notice", "PUT", { message, visible });
      setState("saved");
      router.refresh();
    } catch {
      setState("failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <textarea
        value={message}
        onChange={(event) => {
          setMessage(event.target.value);
          setState("idle");
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
              setVisible(event.target.checked);
              setState("idle");
            }}
            className="h-4 w-4 accent-ink"
          />
          {t("noticeVisible")}
        </label>
        <button
          type="submit"
          disabled={state === "saving"}
          className={buttonClass({ size: "small", tone: "solid" })}
        >
          {state === "saving" ? t("saving") : t("saveNotice")}
        </button>
        {state === "saved" ? (
          <span className="text-[0.8125rem] text-ink-faint">{t("saved")}</span>
        ) : null}
        {state === "failed" ? (
          <span className="text-[0.8125rem] text-ink">{t("updateFailed")}</span>
        ) : null}
      </div>
    </form>
  );
}

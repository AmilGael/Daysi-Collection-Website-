import { currentNotice } from "@/lib/live-catalog";

/**
 * The line Daysi pins from her office, shown where a visitor decides to order
 * or book. Renders nothing at all unless a notice is set and visible, so the
 * page owes it no space.
 */
export function SiteNoticeBar() {
  const notice = currentNotice();
  if (!notice) return null;

  return (
    <aside className="border-b border-line bg-marigold/15">
      <p className="shell py-3 text-center text-[0.8125rem] leading-relaxed text-ink">
        {notice.message}
      </p>
    </aside>
  );
}

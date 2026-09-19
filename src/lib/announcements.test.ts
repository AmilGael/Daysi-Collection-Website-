import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Announcements are kept like promotions: one line per save, the newest
 * per id wins, retiring is its own record. The site used to have a single
 * notice, shown on the home page and the booking page; its text comes over
 * as the first announcement, on those same two pages, until Daysi saves it.
 */

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-announcements-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const oldNotice = (message: string, visible: boolean) =>
  appendFileSync(
    path.join(dir, "site-notice.jsonl"),
    `${JSON.stringify({ message, visible, updatedAt: "2026-09-10T12:00:00.000Z" })}\n`,
  );

describe("the announcements Daysi manages", () => {
  it("are none on a new site", async () => {
    const { manageableAnnouncements, liveAnnouncements } = await import("./announcements");
    expect(manageableAnnouncements()).toEqual([]);
    expect(liveAnnouncements()).toEqual([]);
  });

  it("keep the newest save of each, and show only the ones switched on", async () => {
    const { saveAnnouncement, manageableAnnouncements, liveAnnouncements } = await import("./announcements");
    await saveAnnouncement({ id: "ann-a", message: { es: "Cerrado", en: "Closed" }, pages: ["home"], visible: true });
    await saveAnnouncement({ id: "ann-b", message: { es: "Rebajas", en: "Sale" }, pages: "all", visible: false });
    await saveAnnouncement({ id: "ann-a", message: { es: "Cerrado lunes", en: "Closed Monday" }, pages: ["home"], visible: true });

    expect(manageableAnnouncements().map((a) => [a.id, a.message.es, a.retired])).toEqual([
      ["ann-a", "Cerrado lunes", false],
      ["ann-b", "Rebajas", false],
    ]);
    expect(liveAnnouncements().map((a) => a.id)).toEqual(["ann-a"]);
  });

  it("drop a retired one from the site and keep it for Restaurar", async () => {
    const { saveAnnouncement, manageableAnnouncements, liveAnnouncements } = await import("./announcements");
    const { setRetired } = await import("./retired");
    await saveAnnouncement({ id: "ann-a", message: { es: "Cerrado", en: "Closed" }, pages: "all", visible: true });
    await setRetired("announcement", "ann-a", true);

    expect(liveAnnouncements()).toEqual([]);
    expect(manageableAnnouncements()).toMatchObject([{ id: "ann-a", retired: true }]);
  });

  it("bring the old notice over as the first, on the home and booking pages", async () => {
    oldNotice("Vacaciones del 25 al 30", true);
    const { manageableAnnouncements, liveAnnouncements } = await import("./announcements");

    expect(manageableAnnouncements()).toEqual([
      {
        id: "site",
        message: { es: "Vacaciones del 25 al 30", en: "Vacaciones del 25 al 30" },
        pages: ["home", "appointments"],
        visible: true,
        updatedAt: "2026-09-10T12:00:00.000Z",
        retired: false,
      },
    ]);
    expect(liveAnnouncements().map((a) => a.id)).toEqual(["site"]);
  });

  it("leave an empty old notice behind, and a hidden one hidden", async () => {
    oldNotice("", true);
    const empty = await import("./announcements");
    expect(empty.manageableAnnouncements()).toEqual([]);

    vi.resetModules();
    oldNotice("Pedidos con retraso", false);
    const hidden = await import("./announcements");
    expect(hidden.manageableAnnouncements()).toMatchObject([{ id: "site", visible: false }]);
    expect(hidden.liveAnnouncements()).toEqual([]);
  });

  it("stop reading the old notice once Daysi has saved it as an announcement", async () => {
    oldNotice("Vacaciones", true);
    const { saveAnnouncement, manageableAnnouncements } = await import("./announcements");
    await saveAnnouncement({ id: "site", message: { es: "Vacaciones", en: "Holidays" }, pages: "all", visible: true });

    expect(manageableAnnouncements()).toMatchObject([{ id: "site", message: { en: "Holidays" }, pages: "all" }]);
  });

  it("keep every version of one for the English and for undo", async () => {
    const { saveAnnouncement, announcementVersions } = await import("./announcements");
    await saveAnnouncement({ id: "ann-a", message: { es: "Uno", en: "One" }, pages: ["home"], visible: true });
    await saveAnnouncement({ id: "ann-a", message: { es: "Dos", en: "Two" }, pages: ["home"], visible: true });
    expect(announcementVersions("ann-a").map((a) => a.message.en)).toEqual(["One", "Two"]);
  });
});

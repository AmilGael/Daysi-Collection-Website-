import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DAY_IDS, applyHours, type HoursOverride } from "./live-hours";
import type { BusinessInfo } from "@/content/types";

const coded: BusinessInfo["hours"] = [
  { day: { en: "Monday", es: "Lunes" }, opens: "10:00", closes: "18:00" },
  { day: { en: "Tuesday", es: "Martes" }, opens: "10:00", closes: "18:00" },
  { day: { en: "Wednesday", es: "Miércoles" }, opens: "10:00", closes: "18:00" },
  { day: { en: "Thursday", es: "Jueves" }, opens: "10:00", closes: "18:00" },
  { day: { en: "Friday", es: "Viernes" }, opens: "10:00", closes: "16:00" },
  { day: { en: "Saturday", es: "Sábado" }, opens: "11:00", closes: "15:00" },
  { day: { en: "Sunday", es: "Domingo" }, opens: "", closes: null },
];

function override(patch: Partial<HoursOverride>): HoursOverride {
  return {
    day: "mon",
    opens: "09:00",
    closes: "17:00",
    updatedAt: "2026-09-03T00:00:00.000Z",
    ...patch,
  };
}

describe("DAY_IDS", () => {
  it("is Monday first, matching the coded hours array", () => {
    expect(DAY_IDS).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(DAY_IDS).toHaveLength(coded.length);
  });
});

describe("applyHours", () => {
  it("leaves the coded hours alone when there are no overrides", () => {
    expect(applyHours(coded, [])).toEqual([...coded]);
  });

  it("replaces one day's times and leaves the others", () => {
    const merged = applyHours(coded, [override({})]);
    expect(merged[0]).toMatchObject({ opens: "09:00", closes: "17:00" });
    expect(merged[1]).toEqual(coded[1]);
  });

  it("keeps the coded day names, which she never renames", () => {
    const merged = applyHours(coded, [override({})]);
    expect(merged[0]!.day).toEqual(coded[0]!.day);
  });

  it("writes a closed day the way the catalog writes one", () => {
    const merged = applyHours(coded, [override({ day: "sat", opens: "", closes: "" })]);
    expect(merged[5]).toMatchObject({ opens: "", closes: null });
  });

  it("opens a day the catalog had closed", () => {
    const merged = applyHours(coded, [override({ day: "sun", opens: "12:00", closes: "16:00" })]);
    expect(merged[6]).toMatchObject({ opens: "12:00", closes: "16:00" });
  });

  it("takes the newest record for a day", () => {
    const merged = applyHours(coded, [
      override({ opens: "08:00", closes: "12:00" }),
      override({ opens: "09:30", closes: "17:30" }),
    ]);
    expect(merged[0]).toMatchObject({ opens: "09:30", closes: "17:30" });
  });

  it("ignores an override naming a day that is not there", () => {
    expect(applyHours(coded, [override({ day: "xxx" as never })])).toEqual([...coded]);
  });
});

describe("who reads the hours", () => {
  it("is nobody but live-hours itself", () => {
    const roots = ["src/app", "src/components", "src/lib"];
    const offenders: string[] = [];

    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
          // Two files are allowed the coded hours, and only two. This module,
          // which is what puts her hours over them; and the undo registry,
          // whose baseline for a day IS the shipped value, because undoing a
          // first edit has to land back on what the site came with.
          const allowed = [
            path.join("src", "lib", "live-hours.ts"),
            path.join("src", "lib", "office-history.ts"),
          ];
          if (allowed.some((suffix) => full.endsWith(suffix))) continue;
          if (/business\.hours/.test(fs.readFileSync(full, "utf8"))) offenders.push(full);
        }
      }
    };

    for (const root of roots) walk(path.join(process.cwd(), root));
    expect(offenders).toEqual([]);
  });
});

describe("the two copies of the day list", () => {
  it("still agree", () => {
    // office-validation.ts cannot import this module: it is reachable from
    // client components, and live-hours pulls in the filesystem-backed record
    // store. So the seven ids are written twice on purpose. If they ever drift,
    // a day she edits in the office would fail validation with no clue why.
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/office-validation.ts"),
      "utf8",
    );
    const match = /const DAY_IDS = \[([^\]]+)\]/.exec(source);
    expect(match).not.toBeNull();
    const theirs = [...match![1]!.matchAll(/"([a-z]+)"/g)].map((found) => found[1]);
    expect(theirs).toEqual([...DAY_IDS]);
  });
});

import { describe, expect, it } from "vitest";
import { closedOn, coversDate, datesInClosure, type Closure } from "./closures";

const closure: Closure = {
  id: "clo-1",
  from: "2026-12-24",
  to: "2027-01-02",
  note: "Navidad",
  updatedAt: "2026-09-03T00:00:00.000Z",
};

describe("coversDate", () => {
  it("covers the first day", () => {
    expect(coversDate(closure, "2026-12-24")).toBe(true);
  });

  it("covers the last day", () => {
    expect(coversDate(closure, "2027-01-02")).toBe(true);
  });

  it("covers a day in the middle, across the year boundary", () => {
    expect(coversDate(closure, "2026-12-31")).toBe(true);
  });

  it("does not cover the day before or the day after", () => {
    expect(coversDate(closure, "2026-12-23")).toBe(false);
    expect(coversDate(closure, "2027-01-03")).toBe(false);
  });

  it("handles a single closed day written as the same date twice", () => {
    const one = { ...closure, from: "2026-11-05", to: "2026-11-05" };
    expect(coversDate(one, "2026-11-05")).toBe(true);
    expect(coversDate(one, "2026-11-06")).toBe(false);
  });
});

describe("closedOn", () => {
  it("is true when any closure covers the date", () => {
    expect(closedOn([closure], "2026-12-25")).toBe(true);
  });

  it("is false when none do", () => {
    expect(closedOn([closure], "2026-06-01")).toBe(false);
    expect(closedOn([], "2026-12-25")).toBe(false);
  });
});

describe("datesInClosure", () => {
  it("lists every date the range covers, inclusive", () => {
    const dates = datesInClosure({ ...closure, from: "2026-12-30", to: "2027-01-01" });
    expect(dates).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });

  it("lists one date for a single closed day", () => {
    expect(datesInClosure({ ...closure, from: "2026-11-05", to: "2026-11-05" }))
      .toEqual(["2026-11-05"]);
  });

  it("lists nothing when the range is backwards", () => {
    expect(datesInClosure({ ...closure, from: "2026-11-05", to: "2026-11-01" })).toEqual([]);
  });
});

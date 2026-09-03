import { describe, expect, it } from "vitest";
import type { GarmentStyle, PriceListEntry } from "@/content/types";
import { stylesUsingEntry, stylesUsingFabric } from "./in-use";

const style = (id: string, priceEntryId: string): GarmentStyle => ({
  id,
  slug: id,
  name: { en: id, es: id },
  categoryId: priceEntryId.split("--")[0] ?? "dresses",
  priceEntryId,
  color: { en: "Blue", es: "Azul" },
  description: { en: "Description", es: "Descripción" },
  detail: { en: "Detail", es: "Detalle" },
  sizes: [],
  photos: [],
  customizationAvailable: true,
  isPublished: true,
});

const entry = (id: string, fabricId: string): PriceListEntry => ({
  id,
  categoryId: id.split("--")[0] ?? "dresses",
  fabricId,
  fixedPrice: 100,
  customizationExtra: 0,
  customizationNote: { en: "", es: "" },
  effectiveDate: "2026-09-03",
});

describe("styles in use", () => {
  const styles = [
    style("one", "dresses--wax-print"),
    style("two", "dresses--wax-print"),
    style("three", "shirts--wax-print"),
    style("four", "pants--missing-fabric"),
  ];
  const entries = [
    entry("dresses--wax-print", "wax-print"),
    entry("shirts--wax-print", "wax-print"),
  ];

  it("counts styles pricing through one entry", () => {
    expect(stylesUsingEntry(styles, "dresses--wax-print")).toBe(2);
  });

  it("counts every entry for one fabric", () => {
    expect(stylesUsingFabric(styles, entries, "wax-print")).toBe(3);
    expect(stylesUsingFabric(styles, entries, "unknown")).toBe(0);
  });

  it("falls back to the entry id shape when the entry is missing", () => {
    expect(stylesUsingFabric(styles, entries, "missing-fabric")).toBe(1);
  });
});

import { appointmentsOnDates, appointmentsOutsideHours } from "./in-use";
import type { StoredRequest } from "./request-store";

function appointment(date: string, startTime: string, minutes = 60): StoredRequest {
  return {
    reference: `APT-${date}-${startTime}`,
    kind: "appointment",
    submittedAt: "2026-09-03T12:00:00.000Z",
    locale: "es",
    client: { name: "Ana", email: "ana@example.com" },
    details: { date, startTime, minutes },
    status: "new",
  } as StoredRequest;
}

describe("appointmentsOnDates", () => {
  it("counts the appointments falling on any of the dates", () => {
    const booked = [appointment("2026-12-24", "11:00"), appointment("2026-12-28", "11:00")];
    expect(appointmentsOnDates(booked, ["2026-12-24", "2026-12-25"])).toBe(1);
  });

  it("counts nothing when the days are free", () => {
    expect(appointmentsOnDates([appointment("2026-12-24", "11:00")], ["2026-12-26"])).toBe(0);
  });

  it("ignores an appointment already closed out", () => {
    const done = { ...appointment("2026-12-24", "11:00"), status: "closed" } as StoredRequest;
    expect(appointmentsOnDates([done], ["2026-12-24"])).toBe(0);
  });
});

describe("appointmentsOutsideHours", () => {
  const today = "2026-10-01";

  it("counts a booking that starts before the new opening time", () => {
    // 2026-10-05 is a Monday.
    expect(appointmentsOutsideHours([appointment("2026-10-05", "09:00")], "mon", "10:00", "18:00", today)).toBe(1);
  });

  it("counts a booking that would run past the new closing time", () => {
    expect(appointmentsOutsideHours([appointment("2026-10-05", "17:30")], "mon", "10:00", "18:00", today)).toBe(1);
  });

  it("counts nothing when the booking still fits", () => {
    expect(appointmentsOutsideHours([appointment("2026-10-05", "11:00")], "mon", "10:00", "18:00", today)).toBe(0);
  });

  it("counts every booking when the day is being closed", () => {
    expect(appointmentsOutsideHours([appointment("2026-10-05", "11:00")], "mon", "", "", today)).toBe(1);
  });

  it("ignores a booking on a different weekday", () => {
    // 2026-10-06 is a Tuesday.
    expect(appointmentsOutsideHours([appointment("2026-10-06", "09:00")], "mon", "10:00", "18:00", today)).toBe(0);
  });

  it("ignores a booking already in the past, which cannot be stranded", () => {
    expect(appointmentsOutsideHours([appointment("2026-09-28", "09:00")], "mon", "10:00", "18:00", today)).toBe(0);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * A booking deposit's reference (kind "appointment") reaches the same
 * cancelled page as an order's checkout. "order {reference} has been
 * cancelled" is wrong for a client who never bought a garment, so the page
 * looks the record up and swaps in booking copy and a way back to
 * `/appointments` — falling back to the order copy and home for anything
 * else. No DOM here, so the agreement is checked in the source, the way the
 * sign-in page's is.
 */
const source = readFileSync(
  path.join(process.cwd(), "src/app/[locale]/checkout/[outcome]/page.tsx"),
  "utf8",
);

const checkoutMessages = (bundle: { checkout: object }) => bundle.checkout as Record<string, string>;

describe("the cancelled checkout page's booking copy", () => {
  it("looks the reference up with the existing store reader", () => {
    expect(source).toContain('import { findRequest } from "@/lib/request-store"');
    expect(source).toContain('findRequest(reference)?.kind === "appointment"');
  });

  it("picks the booking lead only for a cancelled appointment, falling back to the order copy", () => {
    expect(source).toContain(
      'const leadKey = cancelledBooking ? "cancelledBookingLead" : `${copy}Lead`;',
    );
  });

  it("sends a cancelled booking back to /appointments, everyone else home", () => {
    expect(source).toContain('const backHref = cancelledBooking ? "/appointments" : "/";');
    expect(source).toContain("<ButtonLink href={backHref}");
    // The button's own label is unchanged either way.
    expect(source).toContain('{t("backHome")}');
  });

  it("has the booking lead in both languages, naming the reference", () => {
    for (const bundle of [es, en] as const) {
      const copy = checkoutMessages(bundle);
      expect(copy.cancelledBookingLead).toContain("{reference}");
    }
    expect(checkoutMessages(es).cancelledBookingLead).toBe(
      "No se cobró nada y la reserva {reference} quedó cancelada. Puede elegir otra hora cuando quiera.",
    );
    expect(checkoutMessages(en).cancelledBookingLead).toBe(
      "Nothing was charged and booking {reference} was cancelled. You can choose another time whenever you like.",
    );
  });
});

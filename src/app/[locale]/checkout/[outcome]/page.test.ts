import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * A booking deposit's reference (kind "appointment") and a studio design's
 * fee (kind "design") reach the same cancelled page as an order's checkout.
 * "order {reference} has been cancelled" is wrong for a client who never
 * bought a garment, so the page looks the record up and swaps in its own
 * copy and a way back — `/appointments` for a booking, `/design-studio` for
 * a design — falling back to the order copy and home for anything else. No
 * DOM here, so the agreement is checked in the source, the way the sign-in
 * page's is.
 */
const source = readFileSync(
  path.join(process.cwd(), "src/app/[locale]/checkout/[outcome]/page.tsx"),
  "utf8",
);

const checkoutMessages = (bundle: { checkout: object }) => bundle.checkout as Record<string, string>;

describe("the cancelled checkout page's booking copy", () => {
  it("looks the reference up with the existing store reader", () => {
    expect(source).toContain('import { findRequest } from "@/lib/request-store"');
    expect(source).toContain("findRequest(reference)?.kind");
    expect(source).toContain('const cancelledBooking = cancelledKind === "appointment";');
    expect(source).toContain('const cancelledDesign = cancelledKind === "design";');
  });

  it("picks the booking or design lead for its own kind, falling back to the order copy", () => {
    expect(source).toContain('? "cancelledBookingLead"');
    expect(source).toContain('? "cancelledDesignLead"');
    expect(source).toContain(": `${copy}Lead`;");
  });

  it("sends a cancelled booking back to /appointments, a design to the studio, everyone else home", () => {
    expect(source).toContain(
      'const backHref = cancelledBooking ? "/appointments" : cancelledDesign ? "/design-studio" : "/";',
    );
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

  it("has the design lead in both languages, naming the reference", () => {
    expect(checkoutMessages(es).cancelledDesignLead).toBe(
      "No se cobró nada y el diseño {reference} no se envió. Puede volver al estudio cuando quiera.",
    );
    expect(checkoutMessages(en).cancelledDesignLead).toBe(
      "Nothing was charged and design {reference} was not sent. You can go back to the studio whenever you like.",
    );
  });
});

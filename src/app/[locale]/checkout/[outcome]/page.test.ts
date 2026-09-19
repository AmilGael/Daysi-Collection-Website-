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

/**
 * A client who has just paid and has not yet given Daysi a measurement gets
 * one line pointing at their own card — a guest who never signed in counts
 * as unmeasured too, since there is no card to check. Never shown outside
 * the paid state, and never carrying a measurement or an address itself.
 */
describe("the thank-you page's save-measurements nudge", () => {
  it("checks the viewer's card only once the payment is confirmed as paid", () => {
    expect(source).toContain('import { currentViewer } from "@/lib/auth/session"');
    expect(source).toContain('import { cardForAccount, measuredCount } from "@/lib/client-cards"');
    expect(source).toContain('if (state === "paid") {');
    expect(source).toContain("const viewer = await currentViewer();");
    expect(source).toContain("ask = !viewer || measuredCount(cardForAccount(viewer.account)) === 0;");
  });

  it("renders the nudge as a text link to the details page", () => {
    expect(source).toContain('import { ButtonLink, TextLink } from "@/components/ui"');
    expect(source).toContain('{ask ? <TextLink href="/account/details">{t("saveMeasures")}</TextLink> : null}');
  });

  it("has the nudge copy in both languages, with no measurement or address in it", () => {
    expect(checkoutMessages(es).saveMeasures).toBe(
      "¿Nos deja sus medidas? Guárdelas en su cuenta y Daysi las tiene para la próxima.",
    );
    expect(checkoutMessages(en).saveMeasures).toBe(
      "Leave us your measurements? Save them in your account and Daysi has them for next time.",
    );
  });
});

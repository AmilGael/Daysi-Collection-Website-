import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { designFee } from "@/content";
import { formatMoney } from "@/lib/money";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * "Enviarle esta idea a Daysi" used to be a bare link to the request form
 * that carried nothing. It is a form now: the picture on the canvas goes to
 * Daysi with the $20 design fee, paid on Stripe's page first. No DOM here, so
 * the wiring is checked in the source, the way the request form's is.
 */
const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");
const studio = read("src/components/design-studio.tsx");
const page = read("src/app/[locale]/design-studio/page.tsx");
const officeList = read("src/components/office-request-list.tsx");

describe("sending a design from the studio", () => {
  it("posts the design, then follows the payment page", () => {
    expect(studio).toContain('useSubmit("/api/design-requests")');
    expect(studio).toContain("if (result?.checkoutUrl) window.location.assign(result.checkoutUrl);");
    expect(studio).not.toContain("/request?kind=commission");
  });

  it("sends a picture drawn at 600 × 820 on a canvas of its own, not the scaled one on screen", () => {
    expect(studio).toContain('document.createElement("canvas")');
    expect(studio).toContain("canvas.width = MOCKUP_WIDTH;");
    expect(studio).toContain("canvas.height = MOCKUP_HEIGHT;");
    expect(studio).toContain("mockupDataUrl,");
  });

  it("keeps the download", () => {
    expect(studio).toContain("onClick={download}");
    expect(studio).toContain('{t("download")}');
  });

  it("asks a guest only for an email, with the WhatsApp hint on the phone", () => {
    expect(studio).toMatch(/<Field label=\{tr\("email"\)\}>[\s\S]*?required[\s\S]*?type="email"/);
    expect(studio).toContain('<Field label={tr("name")} optional>');
    expect(studio).toContain('<Field label={tr("phone")} optional hint={tr("whatsappHint")}>');
    expect(studio).toContain("<BotTrap renderedAt={renderedAt} />");
  });

  it("names the fee on the button, says it is credited, and shows a note instead when payments are off", () => {
    expect(studio).toContain('t("sendFee", { price: formatMoney(fee, locale) })');
    expect(studio).toContain('{t("feeNote")}');
    expect(studio).toContain("{paymentsEnabled ? (");
    expect(studio).toContain('{t("paymentsOff")}');
    expect(page).toContain("fee={estimateDesign().dueNow}");
    expect(page).toContain("paymentsEnabled={paymentsEnabled}");
  });

  it("reads, in Spanish, exactly as Daysi asked", () => {
    expect(es.studio.sendFee.replace("{price}", formatMoney(designFee, "es"))).toBe(
      "Enviar y pagar la tarifa de diseño de $20",
    );
    expect(es.studio.feeNote).toBe(
      "Se paga ahora y se descuenta de su pedido si lo hace en los próximos treinta días.",
    );
    expect(en.studio.sendFee.replace("{price}", formatMoney(designFee, "en"))).toBe(
      "Send and pay the $20 design fee",
    );
    expect(es.account.kind.design).toBe("Diseño del taller");
  });
});

describe("the photo in the Hub", () => {
  it("shows a request's photo through the owner-only route", () => {
    expect(officeList).toContain("record.photoFile ?");
    expect(officeList).toContain("/api/office/photos/");
  });

  /** The route knows the request came from the office by its Referer. */
  it("does not strip the Referer the owner guard reads", () => {
    expect(officeList).not.toMatch(/rel="[^"]*noreferrer/);
  });
});

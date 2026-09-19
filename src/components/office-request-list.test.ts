import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * A noted order Daysi has staged from "+ Anotar un pedido" but not yet
 * confirmed used to vanish from the Hub until Confirmar cambios: nothing in
 * Pedidos y arreglos showed it was there, unlike a pending add on Precios or
 * Galería. No DOM in these tests, so the agreement is checked in the source.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/office-request-list.tsx"), "utf8");
const hubPage = readFileSync(path.join(process.cwd(), "src/app/[locale]/office/page.tsx"), "utf8");

describe("a noted order pending in Pedidos y arreglos", () => {
  it("lists staged order notes ahead of the confirmed records in each group, with the Pending mark", () => {
    expect(source).toContain("{staged.map(renderPending)}\n                  {inGroup.map(renderRecord)}");
    expect(source).toContain('entry.change.wire.type === "order-note"');
    expect(source).toContain("<Pending confirming={draft.pending(entry.key)?.confirming} error={entry.error} count={entry.count} />");
  });

  it("unstages just that one note through Quitar, the same key it was staged under", () => {
    expect(source).toContain("onClick={() => draft.unstage(entry.key)}");
    expect(source).toContain('{to("removePending")}');
  });

  it("still shows the empty message when nothing is pending and nothing has come in", () => {
    expect(source).toContain("records.length === 0 && pendingNotes.length === 0");
  });

  it("is offered to the Trabajo list only, never Citas or Mensajes", () => {
    expect(hubPage.match(/showOrderNotes/g)).toHaveLength(1);
    expect(hubPage).toMatch(/records=\{withUndoable\(work\)\}[\s\S]*?emptyMessage=\{t\("noWork"\)\}\s*showOrderNotes/);
  });
});

describe("where Daysi starts one, and where what came in sits", () => {
  it("puts a box per kind above the list, then the work grouped by kind below", () => {
    const boxes = source.indexOf("NOTED_KINDS.map((kind)");
    const groups = source.indexOf("WORK_GROUPS.map((kind)");
    expect(boxes).toBeGreaterThan(-1);
    expect(groups).toBeGreaterThan(boxes);
    expect(source).toContain('const WORK_GROUPS = ["order", "alteration", "commission", "design"] as const;');
  });

  it("names every group and every box in both languages", () => {
    for (const kind of ["order", "alteration", "commission", "design"] as const) {
      expect(es.office.workGroup[kind]).toBeTruthy();
      expect(en.office.workGroup[kind]).toBeTruthy();
    }
    for (const kind of ["order", "alteration", "commission"] as const) {
      expect(es.office.addNote[kind]).toBeTruthy();
      expect(en.office.addNote[kind]).toBeTruthy();
    }
  });
});

describe("charging a client from an order", () => {
  it("offers the charge only when Stripe is on, and never on a change still pending", () => {
    expect(source).toContain("{paymentsEnabled && !pending && !retiring ? <ChargePanel record={record} locale={locale} /> : null}");
    expect(hubPage).toContain("paymentsEnabled={paymentsEnabled}");
  });

  it("sends it three ways: WhatsApp with a phone, email with an address, or the link to paste", () => {
    expect(source).toContain('{to("chargeWhatsapp")}');
    expect(source).toContain('"/api/office/charge/email"');
    expect(source).toContain("navigator.clipboard.writeText(url)");
  });
});

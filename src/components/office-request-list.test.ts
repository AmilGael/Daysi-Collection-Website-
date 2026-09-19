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
  /**
   * One box, not one per kind: the sheet already asks which kind it is, and
   * three boxes stacked on a phone pushed the work itself off the screen.
   */
  it("puts one box above the list, then the work grouped by kind below", () => {
    expect(source).not.toContain("NOTED_KINDS.map((kind)");
    expect(source.match(/<OrderNoteCard /g)).toHaveLength(1);
    const box = source.indexOf("<OrderNoteCard ");
    const groups = source.indexOf("WORK_GROUPS.map((kind)");
    expect(groups).toBeGreaterThan(box);
    expect(source).toContain('const WORK_GROUPS = ["order", "alteration", "commission", "design"] as const;');
  });

  it("names every group, and the one box, in both languages", () => {
    for (const kind of ["order", "alteration", "commission", "design"] as const) {
      expect(es.office.workGroup[kind]).toBeTruthy();
      expect(en.office.workGroup[kind]).toBeTruthy();
    }
    expect(es.office.addNoteAny).toBe("Anotar un pedido, arreglo o pieza a medida");
    expect(en.office.addNoteAny).toBe("Note an order, alteration or made-to-measure piece");
  });

  /**
   * Citas and Mensajes said "nothing yet" in a rectangle; Pedidos y arreglos
   * said it as a bare line under the box, which read as if something were
   * missing. Every list now draws the same one.
   */
  it("says there are no orders yet in the same rectangle the other lists use", () => {
    expect(source.match(/<EmptyBox message=\{emptyMessage\} \/>/g)).toHaveLength(2);
    expect(source).not.toContain('<p className="text-[0.9375rem] text-ink-faint">{emptyMessage}</p>');
    expect(es.office.noWork).toBe("Todavía no hay pedidos.");
    expect(en.office.noWork).toBe("No orders yet.");
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

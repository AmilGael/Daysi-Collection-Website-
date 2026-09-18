import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A noted order Daysi has staged from "+ Anotar un pedido" but not yet
 * confirmed used to vanish from the Hub until Confirmar cambios: nothing in
 * Pedidos y arreglos showed it was there, unlike a pending add on Precios or
 * Galería. No DOM in these tests, so the agreement is checked in the source.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/office-request-list.tsx"), "utf8");
const hubPage = readFileSync(path.join(process.cwd(), "src/app/[locale]/office/page.tsx"), "utf8");

describe("a noted order pending in Pedidos y arreglos", () => {
  it("lists staged order notes ahead of the confirmed records, with the Pending mark", () => {
    const pendingBlock = source.indexOf("pendingNotes.map");
    const recordsBlock = source.indexOf("records.map");
    expect(pendingBlock).toBeGreaterThan(-1);
    expect(recordsBlock).toBeGreaterThan(pendingBlock);
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
    expect(hubPage).toContain(
      '<OfficeRequestList records={withUndoable(work)} locale={language} emptyMessage={t("noWork")} showOrderNotes />',
    );
  });
});

import { describe, expect, it } from "vitest";
import { filterRows, revealOnDone, saveWire, sheetProblems, stagedChange, visibleProblems } from "./client-draft";

const row = (over = {}) => ({ key: "cli_a", cardId: "cli_a", name: "Rosa Pérez", email: "rosa@example.com", phone: "(718) 555-0101", hasAccount: false, measuredCount: 1, orderCount: 2, paidTotal: 0, archived: false, orders: [], card: { id: "cli_a", name: "Rosa Pérez", email: "rosa@example.com", phone: "(718) 555-0101", measurements: { waist: { value: 80, unit: "cm", by: "client", at: "2026-09-01T00:00:00Z" } }, updatedAt: "2026-09-01T00:00:00Z", updatedBy: "client" }, ...over });

describe("finding a client", () => {
  it("matches a name without its accents, a phone by its digits, and an email", () => {
    const rows = [row(), row({ key: "e:x@example.com", cardId: undefined, card: undefined, name: "Carmen", email: "x@example.com", phone: undefined })];
    expect(filterRows(rows, "perez").map((r) => r.key)).toEqual(["cli_a"]);
    expect(filterRows(rows, "555 0101").map((r) => r.key)).toEqual(["cli_a"]);
    expect(filterRows(rows, "x@exa").map((r) => r.key)).toEqual(["e:x@example.com"]);
    expect(filterRows(rows, "")).toHaveLength(2);
  });
});

describe("what Listo stages", () => {
  it("sends only the measurements she changed, null for one she removed", () => {
    const wire = saveWire(row(), { name: "Rosa Pérez", email: "rosa@example.com", phone: "(718) 555-0101", unit: "cm", values: { waist: "80", hips: "100" }, removed: new Set(["bust"]), ownerNote: "" });
    expect(wire).toMatchObject({ type: "client-save", key: "client:cli_a", cardId: "cli_a", measurements: { hips: { value: 100, unit: "cm" }, bust: null } });
    expect(wire.type === "client-save" && "waist" in wire.measurements).toBe(false);
  });

  it("makes a card for a row that has none, keyed by a fresh id", () => {
    const wire = saveWire(row({ key: "p:7185550101", cardId: undefined, card: undefined, email: undefined }), { name: "Rosa", email: "", phone: "7185550101", unit: "cm", values: {}, removed: new Set(), ownerNote: "" });
    expect(wire).toMatchObject({ type: "client-save", name: "Rosa", phone: "7185550101" });
    expect(wire.type === "client-save" && wire.cardId).toBeUndefined();
    expect(wire.key).toMatch(/^client:new-/);
  });
});

describe("what the sheet leaves out of the draft", () => {
  const form = (over = {}) => ({ name: "Rosa Pérez", email: "rosa@example.com", phone: "(718) 555-0101", unit: "cm" as const, values: {}, removed: new Set<string>(), ownerNote: "", ...over });

  it("stages nothing when she opened a sheet and changed nothing", () => {
    expect(stagedChange(row(), form())).toBeNull();
    const orderOnly = row({ key: "p:7185550101", cardId: undefined, card: undefined, email: undefined });
    expect(stagedChange(orderOnly, form({ email: "", key: "client:new-1" }))).toBeNull();
  });

  it("never stages what the server would refuse, and keeps the saved name under a too-short one", () => {
    const wire = saveWire(row(), form({ name: "R", email: "not an email", values: { hips: "900", bust: "abc" } }));
    expect(wire).toMatchObject({ type: "client-save", name: "Rosa Pérez", measurements: {} });
    expect(wire.type === "client-save" && wire.email).toBeUndefined();
    expect(sheetProblems(form({ name: "R", email: "not an email", values: { hips: "900", bust: "abc" } }))).toEqual(
      expect.arrayContaining(["name", "email", "hips", "bust"]),
    );
  });

  it("does not stage a new client until they have a name", () => {
    expect(stagedChange({ key: "client:new-2", name: "" }, form({ name: "", email: "", phone: "", key: "client:new-2", values: { waist: "70" } }))).toBeNull();
    expect(stagedChange({ key: "client:new-2", name: "" }, form({ name: "Ana", email: "", phone: "", key: "client:new-2" }))).toMatchObject({
      type: "client-save",
      key: "client:new-2",
      name: "Ana",
    });
  });

  it("keeps a number in the unit it was typed in, whatever the switch shows now", () => {
    const wire = saveWire(row(), form({ unit: "in", values: { hips: "100" }, units: { hips: "cm" } }));
    expect(wire).toMatchObject({ measurements: { hips: { value: 100, unit: "cm" } } });
  });

  it("clears her note with null, and a removed address the same way", () => {
    const card = { ...row().card, ownerNote: "Prefiere los sábados", address: { line1: "1 Main St", city: "Bronx", state: "NY", zip: "10451" } };
    const wire = saveWire(row({ card }), form({ ownerNote: " ", address: null }));
    expect(wire).toMatchObject({ ownerNote: null, address: null });
    const same = saveWire(row({ card }), form({ ownerNote: "Prefiere los sábados", address: { line1: "1 Main St", line2: "", city: "Bronx", state: "NY", zip: "10451" } }));
    expect(same.type === "client-save" && ("ownerNote" in same || "address" in same)).toBe(false);
  });

  it("sends an email only when it is new, however it was capitalised", () => {
    const same = saveWire(row(), form({ email: "Rosa@Example.com" }));
    expect(same.type === "client-save" && same.email).toBeUndefined();
    expect(saveWire(row(), form({ email: "rosa.p@example.com" }))).toMatchObject({ email: "rosa.p@example.com" });
  });
});

describe("when the sheet points out a problem", () => {
  const form = (over = {}) => ({ name: "Rosa Pérez", email: "rosa@example.com", phone: "", unit: "cm" as const, values: {}, removed: new Set<string>(), ownerNote: "", ...over });

  it("marks nothing while she is still typing, and a field once she has left it", () => {
    const typing = form({ email: "r", values: { waist: "8" } });
    const problems = sheetProblems(typing);
    expect(problems).toEqual(expect.arrayContaining(["email", "waist"]));
    expect([...visibleProblems(problems, new Set())]).toEqual([]);
    expect([...visibleProblems(problems, new Set(["waist"]))]).toEqual(["waist"]);
  });

  it("marks every problem the first time she taps Listo and holds the sheet open, then lets her go", () => {
    const typing = form({ email: "r", values: { waist: "8" } });
    const shown = revealOnDone(typing, new Set(["waist"]), false);
    expect(shown && [...visibleProblems(sheetProblems(typing), shown)].sort()).toEqual(["email", "waist"]);
    expect(revealOnDone(typing, shown!, true)).toBeNull();
    expect(revealOnDone(form(), new Set(), false)).toBeNull();
  });

  it("holds Listo once even when the problem is already marked: tapping Listo is what left the box", () => {
    const typing = form({ values: { waist: "8" } });
    expect(revealOnDone(typing, new Set(["waist"]), false)).toEqual(new Set(["waist"]));
  });

  it("lets an empty new client close without a word about the missing name", () => {
    expect(revealOnDone(form({ name: "", email: "", key: "client:new-3" }), new Set(), false)).toBeNull();
    expect(revealOnDone(form({ name: "", email: "", phone: "7185550101", key: "client:new-3" }), new Set(), false)).toEqual(
      new Set(["name"]),
    );
  });
});

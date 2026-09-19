import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { normalizePhone } from "@/lib/office-validation";

/**
 * A phone typed by hand or pasted from WhatsApp used to reach the schema
 * unclean and get refused there, which blocked the whole batch of staged
 * changes, not just this one note. The sheet now cleans and checks it before
 * ever staging a change, the same way the schema does on the server. No DOM
 * in these tests, so the form behaviour is checked in the source, and the
 * cleaning itself is checked directly.
 */
const source = readFileSync(path.join(process.cwd(), "src/components/office/order-note-sheet.tsx"), "utf8");

describe("the order-note sheet's phone", () => {
  it("cleans the phone with the same normaliser the schema uses, before it ever stages a change", () => {
    expect(source).toContain('import { normalizePhone, type WorkChange } from "@/lib/office-validation"');
    expect(source).toContain("const cleanPhone = normalizePhone(phone).trim();");
    expect(source).toContain("cleanPhone.length < 7 || cleanPhone.length > 30");
    expect(source).toContain("return setProblem(t(\"orderNotePhoneInvalid\"));");
    expect(source).toContain("...(cleanPhone ? { phone: cleanPhone } : {}),");
  });

  it("cleans a WhatsApp-style number the way the schema will read it", () => {
    expect(normalizePhone("\u200E917\u2011555\u20110100")).toBe("917-555-0100");
  });

  it("carries the phone-invalid message in both languages", () => {
    expect(es.office.orderNotePhoneInvalid).toBeTruthy();
    expect(en.office.orderNotePhoneInvalid).toBeTruthy();
  });
});

describe("the order-note sheet's date", () => {
  it("offers an optional Fecha bounded to 2020-01-01 through today, blank meaning today", () => {
    expect(source).toContain('const [date, setDate] = useState("");');
    expect(source).toContain('type="date"');
    expect(source).toContain('min="2020-01-01"');
    expect(source).toContain("max={today}");
    expect(source).toContain("...(date ? { date } : {}),");
  });

  it("carries the Fecha label in both languages", () => {
    expect(es.office.orderNoteDate).toBeTruthy();
    expect(en.office.orderNoteDate).toBeTruthy();
  });
});

describe("the order-note sheet's payment", () => {
  it("asks paid, charge by card (only with Stripe on) or later, and stages charge only for the card", () => {
    expect(source).toContain('type Payment = "paid" | "charge" | "later";');
    expect(source).toContain('...(paymentsEnabled ? [{ value: "charge" as Payment');
    expect(source).toContain('paid: payment === "paid",');
    expect(source).toContain('...(payment === "charge" ? { charge: true } : {}),');
  });
});

describe("the one add box", () => {
  it("names itself for every kind, and opens on the kind it is given", () => {
    const opener = source.slice(source.indexOf("export function OrderNoteCard("), source.indexOf("function OrderNoteForm("));
    expect(opener.match(/t\("addNoteAny"\)/g)).toHaveLength(2);
    expect(opener).not.toContain("addNote.${kind}");
    expect(opener).toContain("initialKind={kind}");
  });
});

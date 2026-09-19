import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoredRequest } from "./request-store";

/**
 * When Daysi hears about a request. A record that still has a card payment in
 * front of it is stored but not announced: the announcement comes from Stripe's
 * confirmation, never from the act of filling in the form, so nobody can put an
 * "order" in her inbox by getting as far as the payment page and stopping.
 */

let dir: string;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-notify-"));
  process.env.DATA_DIR = dir;
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("OWNER_EMAIL", "daysi@example.com");
  fetchMock = vi.fn(async () => ({ ok: true }) as Response);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const record = (overrides: Partial<StoredRequest> = {}): StoredRequest => ({
  reference: "ORD-1",
  kind: "order",
  submittedAt: "2026-09-06T12:00:00.000Z",
  locale: "en",
  client: { name: "Ana", email: "ana@example.com" },
  details: { Pieces: ["Amapola · S × 1"] },
  estimate: {
    lines: [],
    subtotal: 10500,
    salesTax: 0,
    total: 10500,
    dueNow: 10500,
    dueOnCollection: 0,
    dueNowReason: { en: "Due now", es: "A pagar ahora" },
  },
  status: "new",
  ...overrides,
});

const storedLines = (): StoredRequest[] =>
  readFileSync(path.join(dir, "order.jsonl"), "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as StoredRequest);

describe("recordRequest", () => {
  it("stores and tells Daysi about a request with nothing to pay first", async () => {
    const { recordRequest } = await import("./notify");

    expect(await recordRequest(record())).toBe(true);

    expect(storedLines()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stores a request waiting on a card payment without telling Daysi yet", async () => {
    const { recordRequest } = await import("./notify");

    expect(await recordRequest(record({ awaitingPayment: true }))).toBe(true);

    expect(storedLines()).toMatchObject([{ reference: "ORD-1", awaitingPayment: true }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports failure when a request waiting on payment could not be stored", async () => {
    // Nothing else will ever announce it: the webhook looks the reference up in
    // the store, and a record that is not there is a payment for nobody.
    // A plain file where the data directory should be: nothing can be created under it.
    writeFileSync(path.join(dir, "blocker"), "");
    process.env.DATA_DIR = path.join(dir, "blocker", "data");
    const { recordRequest } = await import("./notify");

    expect(await recordRequest(record({ awaitingPayment: true }))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("summarise", () => {
  it("tells Daysi there is no phone when the client left none, so she knows to reply by email", async () => {
    const { summarise } = await import("./notify");

    expect(summarise(record())).toContain("No phone given");
  });

  it("prints the phone instead of the note when the client left one", async () => {
    const { summarise } = await import("./notify");

    const text = summarise(record({ client: { name: "Ana", email: "ana@example.com", phone: "9175550100" } }));

    expect(text).toContain("Phone:     9175550100");
    expect(text).not.toContain("No phone given");
  });

  // The owner summary's other labels (Name, Email, Phone…) are English, so a
  // guest who left no name reads "No name given" rather than the Spanish
  // "Sin nombre" — and no blank after "Name:" either.
  it("tells Daysi there is no name when the guest left one, in the same language as the rest", async () => {
    const { summarise } = await import("./notify");

    const text = summarise(record({ client: { name: "", email: "ana@example.com" } }));

    expect(text).toContain("Name:      No name given");
  });
});

describe("greeting a guest who left no name", () => {
  it("opens the receipt with a bare greeting when there is no name", async () => {
    const { receiptMessage } = await import("./notify");

    const { text } = receiptMessage(record({ locale: "es", client: { name: "", email: "ana@example.com" } }));

    expect(text.startsWith("Hola,\n")).toBe(true);
  });

  it("still greets a client by name when one was given", async () => {
    const { receiptMessage } = await import("./notify");

    const { text } = receiptMessage(record({ locale: "es" }));

    expect(text.startsWith("Hola Ana,\n")).toBe(true);
  });

  it("opens the failed-payment message with a bare greeting when there is no name", async () => {
    const { notifyClientPaymentFailed } = await import("./notify");

    await notifyClientPaymentFailed(
      record({
        locale: "en",
        status: "closed",
        source: "stripe",
        paymentFailed: true,
        client: { name: "", email: "ana@example.com" },
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { text: string };
    expect(body.text.startsWith("Hello,")).toBe(true);
  });

  it("puts the client's email in the owner subject's name slot when there is no name", async () => {
    const { notifyOwner } = await import("./notify");

    await notifyOwner(record({ client: { name: "", email: "ana@example.com" } }));

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { subject: string };
    expect(body.subject).toContain("ana@example.com");
    expect(body.subject).not.toContain("  ");
  });
});

describe("notifyOwner", () => {
  it("says in the subject and the body that a card payment came in", async () => {
    const { notifyOwner } = await import("./notify");

    await notifyOwner(record({ status: "paid", source: "stripe" }));

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      subject: string;
      text: string;
    };
    expect(body.subject).toContain("PAID");
    expect(body.text).toContain("Paid by card");
    expect(body.text).toContain("$105");
  });

  it("says the money came by bank transfer when it did", async () => {
    const { notifyOwner } = await import("./notify");

    await notifyOwner(record({ status: "paid", source: "stripe", paidVia: "bank" }));

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      subject: string;
      text: string;
    };
    expect(body.subject).toContain("PAID");
    expect(body.text).toContain("Paid by bank transfer");
    expect(body.text).not.toContain("Paid by card");
  });

  it("tells Daysi that a bank payment was refused, and that nothing came in", async () => {
    const { notifyOwner } = await import("./notify");

    await notifyOwner(record({ status: "closed", source: "stripe", paymentFailed: true }));

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      subject: string;
      text: string;
    };
    expect(body.subject).toContain("REFUSED");
    expect(body.subject).not.toContain("PAID");
    expect(body.text).toContain("refused");
    expect(body.text).toContain("$105");
  });

  it("does not head a refusal PAID, even on a row whose status says paid", async () => {
    // The refusal line carries Daysi's own Pagado forward. Reading the status
    // alone would send her a letter headed PAID about money that bounced.
    const { notifyOwner } = await import("./notify");

    await notifyOwner(record({ status: "paid", source: "stripe", paymentFailed: true }));

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      subject: string;
      text: string;
    };
    expect(body.subject).not.toContain("PAID");
    expect(body.subject).toContain("REFUSED");
    expect(body.text).not.toContain("confirmed by Stripe");
    expect(body.text).toContain("refused");
  });

  it("does not claim a payment for a request that was not paid", async () => {
    const { notifyOwner } = await import("./notify");

    await notifyOwner(record());

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      subject: string;
      text: string;
    };
    expect(body.subject).not.toContain("PAID");
    expect(body.text).not.toContain("Paid by card");
  });
});

/**
 * The picture is the point of a design request, and an alteration photo is
 * what Daysi would otherwise have to ask for: both travel with her email. A
 * file that has gone missing costs the attachment, never the message.
 */
describe("notifyOwner and the stored photo", () => {
  type Sent = { subject: string; text: string; attachments?: { filename: string; content: string }[] };
  const sent = () => JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Sent;

  it("attaches the stored photo to Daysi's email as base64", async () => {
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    mkdirSync(path.join(dir, "photos"), { recursive: true });
    writeFileSync(path.join(dir, "photos", "ALT-1.jpeg"), bytes);
    const { notifyOwner } = await import("./notify");

    await notifyOwner(record({ reference: "ALT-1", kind: "alteration", photoFile: "ALT-1.jpeg" }));

    expect(sent().attachments).toEqual([
      { filename: "ALT-1.jpeg", content: Buffer.from(bytes).toString("base64") },
    ]);
  });

  it("sends the email without the attachment when the file is missing", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { notifyOwner } = await import("./notify");

    await notifyOwner(record({ reference: "ALT-1", kind: "alteration", photoFile: "ALT-1.jpeg" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent().attachments).toBeUndefined();
    expect(sent().subject).toContain("ALT-1");
    quiet.mockRestore();
  });

  it("attaches nothing to a request that came with no photo", async () => {
    const { notifyOwner } = await import("./notify");

    await notifyOwner(record());

    expect(sent().attachments).toBeUndefined();
  });

  it("names a studio design in the subject", async () => {
    const { notifyOwner } = await import("./notify");

    await notifyOwner(record({ reference: "DSN-1", kind: "design", status: "paid", source: "stripe" }));

    expect(sent().subject).toContain("Design request");
    expect(sent().subject).toContain("PAID");
  });
});

describe("notifyClientPaymentFailed", () => {
  it("tells the client, in their own language, that the bank refused the payment", async () => {
    const { notifyClientPaymentFailed } = await import("./notify");

    await notifyClientPaymentFailed(
      record({ locale: "es", status: "closed", source: "stripe", paymentFailed: true }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      to: string[];
      reply_to?: string;
      subject: string;
      text: string;
    };
    expect(body.to).toEqual(["ana@example.com"]);
    // The letter invites a reply, so it has to reach Daysi and not no-reply@.
    expect(body.reply_to).toBe("daysi@example.com");
    expect(body.subject).toContain("ORD-1");
    expect(body.text).toContain("Su banco no envió el pago");
    expect(body.text).not.toMatch(/\bbank\b/i);
  });

  it("writes in English to an English-speaking client", async () => {
    const { notifyClientPaymentFailed } = await import("./notify");

    await notifyClientPaymentFailed(record({ locale: "en", status: "closed", source: "stripe", paymentFailed: true }));

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { text: string };
    expect(body.text).toContain("bank");
    expect(body.text).toContain("ORD-1");
  });
});

describe("notifyClientPaid", () => {
  const twoLines = [
    { label: { en: "Amapola dress", es: "Vestido Amapola" }, amount: 10500, unitAmount: 10500, taxBasis: "clothing" as const },
    {
      label: { en: "Made to your measurements", es: "Hecho a su medida" },
      amount: 4000,
      unitAmount: 2000,
      taxBasis: "clothing" as const,
    },
  ];

  it("sends the client every line, the total, tarjeta, the reference, a WhatsApp link and the orders page, in Spanish", async () => {
    const { notifyClientPaid } = await import("./notify");

    await notifyClientPaid(
      record({
        locale: "es",
        status: "paid",
        source: "stripe",
        estimate: {
          lines: twoLines,
          subtotal: 14500,
          salesTax: 0,
          total: 14500,
          dueNow: 14500,
          dueOnCollection: 0,
          dueNowReason: { en: "Paid in full.", es: "Pagado por completo." },
        },
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      to: string[];
      reply_to?: string;
      subject: string;
      text: string;
    };
    expect(body.to).toEqual(["ana@example.com"]);
    // The receipt invites a reply, so it has to reach Daysi and not no-reply@.
    expect(body.reply_to).toBe("daysi@example.com");
    expect(body.subject).toBe("Su recibo · ORD-1");
    expect(body.text).toContain("Vestido Amapola × 1: $105");
    expect(body.text).toContain("Hecho a su medida × 2: $40");
    expect(body.text).toContain("Total: $145");
    expect(body.text).toContain("tarjeta");
    expect(body.text).toContain("ORD-1");
    expect(body.text).toContain("wa.me/");
    expect(body.text).toContain("/es/account/orders");
  });

  it("prints a line's note after its label, translated to the record's locale", async () => {
    const { receiptMessage } = await import("./notify");

    const { text } = receiptMessage(
      record({
        locale: "es",
        estimate: {
          lines: [
            {
              label: { en: "Amapola dress", es: "Vestido Amapola" },
              note: { en: "Size M", es: "Talla M" },
              amount: 10500,
              unitAmount: 10500,
              taxBasis: "clothing",
            },
          ],
          subtotal: 10500,
          salesTax: 0,
          total: 10500,
          dueNow: 10500,
          dueOnCollection: 0,
          dueNowReason: { en: "Due now", es: "A pagar ahora" },
        },
      }),
    );

    expect(text).toContain("Vestido Amapola (Talla M) × 1: $105");
  });

  it("prints what a promoted line came to before the promotion, in the record's locale", async () => {
    const { receiptMessage } = await import("./notify");
    // Two $295 sets at 65 % off: $103.25 a piece.
    const promoted = (locale: "es" | "en") =>
      record({
        locale,
        estimate: {
          lines: [
            {
              label: { en: "Sirena shirt dress", es: "Vestido camisero Sirena" },
              note: { en: "Size M · 2 pieces", es: "Talla M · 2 piezas" },
              amount: 20650,
              unitAmount: 10325,
              listAmount: 59000,
              listUnitAmount: 29500,
              taxBasis: "clothing",
            },
          ],
          subtotal: 20650,
          salesTax: 0,
          total: 20650,
          dueNow: 20650,
          dueOnCollection: 0,
          dueNowReason: { en: "Due now", es: "A pagar ahora" },
        },
      });

    expect(receiptMessage(promoted("es")).text).toContain(
      "Vestido camisero Sirena (Talla M · 2 piezas) × 2: $206.50 (antes $590)",
    );
    expect(receiptMessage(promoted("en")).text).toContain(
      "Sirena shirt dress (Size M · 2 pieces) × 2: $206.50 (was $590)",
    );
  });

  it("counts the pieces on a promoted line by its list figures, whatever the lowered piece comes to", async () => {
    const { receiptMessage } = await import("./notify");
    const { text } = receiptMessage(
      record({
        locale: "en",
        estimate: {
          lines: [
            {
              label: { en: "Amapola dress", es: "Vestido Amapola" },
              amount: 0,
              unitAmount: 0,
              listAmount: 21000,
              listUnitAmount: 10500,
              taxBasis: "clothing",
            },
          ],
          subtotal: 0,
          salesTax: 0,
          total: 0,
          dueNow: 0,
          dueOnCollection: 0,
          dueNowReason: { en: "Nothing due", es: "Nada que pagar" },
        },
      }),
    );
    expect(text).toContain("Amapola dress × 2: $0 (was $210)");
  });

  it("says the deposit was paid by banco and what is still due on collection", async () => {
    const { notifyClientPaid } = await import("./notify");

    await notifyClientPaid(
      record({
        locale: "es",
        status: "paid",
        source: "stripe",
        paidVia: "bank",
        estimate: {
          lines: [{ label: { en: "Wedding gown", es: "Vestido de novia" }, amount: 20000, taxBasis: "clothing" }],
          subtotal: 20000,
          salesTax: 1775,
          total: 21775,
          dueNow: 10888,
          dueOnCollection: 10887,
          dueNowReason: { en: "Half now.", es: "La mitad ahora." },
        },
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { text: string };
    expect(body.text).toContain("banco");
    expect(body.text).toContain("Pendiente al recoger: $108.87");
  });

  it("writes an English subject and body for an English-speaking client", async () => {
    const { notifyClientPaid } = await import("./notify");

    await notifyClientPaid(record({ locale: "en", status: "paid", source: "stripe" }));

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { subject: string; text: string };
    expect(body.subject).toBe("Your receipt · ORD-1");
    expect(body.text).toContain("Paid now (card)");
  });

  it("leaves out the tax line when nothing on the order was taxed", async () => {
    const { notifyClientPaid } = await import("./notify");

    await notifyClientPaid(
      record({
        status: "paid",
        source: "stripe",
        estimate: {
          lines: [{ label: { en: "Consultation", es: "Consulta" }, amount: 5000, taxBasis: "service" }],
          subtotal: 5000,
          salesTax: 0,
          total: 5000,
          dueNow: 5000,
          dueOnCollection: 0,
          dueNowReason: { en: "Paid in full.", es: "Pagado por completo." },
        },
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { text: string };
    expect(body.text).not.toContain("Tax:");
    expect(body.text).not.toContain("Impuesto:");
  });

  it("tells the client the day and time when what's next is an appointment", async () => {
    const { notifyClientPaid } = await import("./notify");

    await notifyClientPaid(
      record({
        kind: "appointment",
        locale: "es",
        status: "paid",
        source: "stripe",
        details: { date: "2026-10-02", startTime: "14:00" },
        estimate: {
          lines: [{ label: { en: "Consultation", es: "Consulta" }, amount: 5000, taxBasis: "service" }],
          subtotal: 5000,
          salesTax: 0,
          total: 5000,
          dueNow: 5000,
          dueOnCollection: 0,
          dueNowReason: { en: "Should not appear.", es: "No debería aparecer." },
        },
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { text: string };
    expect(body.text).toContain("Su cita es el");
    expect(body.text).toContain("14:00");
    expect(body.text).not.toContain("No debería aparecer");
  });

  it("tells a design's client that Daysi will write back with a quote, in their language", async () => {
    const { receiptMessage } = await import("./notify");
    const design = (locale: "es" | "en") =>
      record({
        reference: "DSN-1",
        kind: "design",
        locale,
        status: "paid",
        source: "stripe",
        estimate: {
          lines: [{ label: { en: "Design fee", es: "Tarifa de diseño" }, amount: 2000, taxBasis: "service" }],
          subtotal: 2000,
          salesTax: 0,
          total: 2000,
          dueNow: 2000,
          dueOnCollection: 0,
          dueNowReason: { en: "Should not appear.", es: "No debería aparecer." },
        },
      });

    const es = receiptMessage(design("es")).text;
    expect(es).toContain("Daysi revisa su diseño y le escribe con una cotización.");
    expect(es).not.toContain("No debería aparecer");
    expect(receiptMessage(design("en")).text).toContain(
      "Daysi will look at your design and write to you with a quote.",
    );
  });

  it("does not send a receipt when email is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { notifyClientPaid } = await import("./notify");

    await notifyClientPaid(record({ status: "paid", source: "stripe" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

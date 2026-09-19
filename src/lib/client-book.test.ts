import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * The client book: everyone Daysi has served, worked out fresh from client
 * cards, accounts and the latest line of every order ever written. Grouping follows a
 * strict order (a card's email or phone, then an order's email, then an
 * order's phone, then an order's name) and an order alone never bridges an
 * email to a phone, because a family can share one line.
 */

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "book-"));
  process.env.DATA_DIR = dir;
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const order = (over: Record<string, unknown>) => ({
  reference: "ORD-1",
  kind: "order",
  submittedAt: "2026-09-10T12:00:00Z",
  locale: "es",
  status: "paid",
  client: { name: "Ana", email: "ana@example.com" },
  details: {},
  estimate: { total: 12000, lines: [] },
  ...over,
});

describe("the client book", () => {
  it("has one row per email, however many orders", async () => {
    const { appendRecord } = await import("./records");
    await appendRecord("order", order({ reference: "ORD-1" }));
    await appendRecord(
      "order",
      order({
        reference: "ORD-2",
        submittedAt: "2026-09-15T12:00:00Z",
        client: { name: "Ana", email: "ANA@example.com" },
      }),
    );
    const { clientBook } = await import("./client-book");
    const rows = clientBook();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: "e:ana@example.com",
      orderCount: 2,
      paidTotal: 24000,
      lastVisit: "2026-09-15T12:00:00Z",
    });
  });

  it("groups a phone-only walk-in by phone and a name-only one by name", async () => {
    const { appendRecord } = await import("./records");
    await appendRecord(
      "alteration",
      order({ reference: "ALT-1", kind: "alteration", client: { name: "Rosa", email: "", phone: "(718) 555-0101" } }),
    );
    await appendRecord(
      "alteration",
      order({ reference: "ALT-2", kind: "alteration", client: { name: "Rosa P", email: "", phone: "+1 718 555 0101" } }),
    );
    await appendRecord(
      "commission",
      order({ reference: "COM-1", kind: "commission", client: { name: "Doña Carmen ", email: "" } }),
    );
    const { clientBook } = await import("./client-book");
    const keys = clientBook()
      .map((row) => row.key)
      .sort();
    expect(keys).toEqual(["n:doña carmen", "p:7185550101"]);
  });

  it("never lets an order join an email to a phone on its own", async () => {
    const { appendRecord } = await import("./records");
    await appendRecord(
      "order",
      order({ reference: "ORD-1", client: { name: "Mamá", email: "mama@example.com", phone: "7185550101" } }),
    );
    await appendRecord(
      "alteration",
      order({ reference: "ALT-1", kind: "alteration", client: { name: "Hija", email: "", phone: "7185550101" } }),
    );
    const { clientBook } = await import("./client-book");
    expect(clientBook()).toHaveLength(2);
  });

  it("lets a card with both an email and a phone join them", async () => {
    const { appendRecord } = await import("./records");
    await appendRecord(
      "alteration",
      order({ reference: "ALT-1", kind: "alteration", client: { name: "Rosa", email: "", phone: "7185550101" } }),
    );
    await appendRecord("order", order({ reference: "ORD-1", client: { name: "Rosa", email: "rosa@example.com" } }));
    await appendRecord("client-cards", {
      id: "cli_r",
      name: "Rosa",
      email: "rosa@example.com",
      phone: "718-555-0101",
      measurements: {},
      updatedAt: "2026-09-16T00:00:00Z",
      updatedBy: "office",
    });
    const { clientBook } = await import("./client-book");
    const rows = clientBook();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "cli_r", cardId: "cli_r", orderCount: 2 });
  });

  it("does not guess when two cards share a phone", async () => {
    const { appendRecord } = await import("./records");
    await appendRecord("client-cards", {
      id: "cli_m",
      name: "Mamá",
      phone: "7185550101",
      measurements: {},
      updatedAt: "2026-09-16T00:00:00Z",
      updatedBy: "office",
    });
    await appendRecord("client-cards", {
      id: "cli_h",
      name: "Hija",
      phone: "7185550101",
      measurements: {},
      updatedAt: "2026-09-16T00:00:00Z",
      updatedBy: "office",
    });
    await appendRecord(
      "alteration",
      order({ reference: "ALT-1", kind: "alteration", client: { name: "?", email: "", phone: "7185550101" } }),
    );
    const { clientBook } = await import("./client-book");
    expect(clientBook().map((row) => row.key).sort()).toEqual(["cli_h", "cli_m", "p:7185550101"]);
  });

  /**
   * A card Daysi writes on a name-only row has no email and no phone to be
   * found by, so it is found by the same name the row was: otherwise the
   * book would show the card and the orders as two clients, and every
   * reopen and save would add another.
   */
  it("files name-only orders under a card with no email or phone that has their name", async () => {
    const { appendRecord } = await import("./records");
    await appendRecord("client-cards", {
      id: "cli_c",
      name: "Doña Carmen",
      measurements: {},
      updatedAt: "2026-09-16T00:00:00Z",
      updatedBy: "office",
    });
    await appendRecord(
      "commission",
      order({ reference: "COM-1", kind: "commission", client: { name: "doña carmen", email: "" } }),
    );
    await appendRecord(
      "alteration",
      order({ reference: "ALT-1", kind: "alteration", client: { name: " Doña   Carmen ", email: "" } }),
    );
    const { clientBook } = await import("./client-book");
    const rows = clientBook();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "cli_c", cardId: "cli_c", name: "Doña Carmen", orderCount: 2 });
  });

  it("does not guess when two cards with no email or phone share a name", async () => {
    const { appendRecord } = await import("./records");
    for (const id of ["cli_c1", "cli_c2"]) {
      await appendRecord("client-cards", {
        id,
        name: "Carmen",
        measurements: {},
        updatedAt: "2026-09-16T00:00:00Z",
        updatedBy: "office",
      });
    }
    await appendRecord(
      "commission",
      order({ reference: "COM-1", kind: "commission", client: { name: "Carmen", email: "" } }),
    );
    const { clientBook } = await import("./client-book");
    expect(clientBook().map((row) => row.key).sort()).toEqual(["cli_c1", "cli_c2", "n:carmen"]);
  });

  it("joins by name only for a card with no way to reach them", async () => {
    const { appendRecord } = await import("./records");
    await appendRecord("client-cards", {
      id: "cli_r",
      name: "Rosa",
      phone: "7185550101",
      measurements: {},
      updatedAt: "2026-09-16T00:00:00Z",
      updatedBy: "office",
    });
    await appendRecord(
      "alteration",
      order({ reference: "ALT-1", kind: "alteration", client: { name: "Rosa", email: "" } }),
    );
    const { clientBook } = await import("./client-book");
    const rows = clientBook();
    expect(rows.map((row) => row.key).sort()).toEqual(["cli_r", "n:rosa"]);
    expect(rows.find((row) => row.key === "cli_r")?.orderCount).toBe(0);
  });

  it("keeps a client whose only order was retired or closed", async () => {
    const { appendRecord } = await import("./records");
    await appendRecord("order", order({ reference: "ORD-9" }));
    await appendRecord("order", order({ reference: "ORD-9", status: "closed", source: "office" }));
    const { setRetired } = await import("./retired");
    await setRetired("request", "ORD-9", true);
    const { clientBook } = await import("./client-book");
    const rows = clientBook();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.orderCount).toBe(0);
  });

  it("leaves out an abandoned card checkout, a contact message and a premiere sign-up", async () => {
    const { appendRecord } = await import("./records");
    await appendRecord(
      "order",
      order({ reference: "ORD-A", status: "new", awaitingPayment: true, submittedAt: "2020-01-01T00:00:00Z" }),
    );
    await appendRecord("contact", order({ reference: "CON-1", kind: "contact", client: { name: "X", email: "x@example.com" } }));
    await appendRecord(
      "premiere-signup",
      order({ reference: "PRE-1", kind: "premiere-signup", client: { name: "Y", email: "y@example.com" } }),
    );
    const { clientBook } = await import("./client-book");
    expect(clientBook()).toEqual([]);
  });

  it("lists an account holder with no orders yet, and marks who has an account", async () => {
    const { appendRecord } = await import("./records");
    await appendRecord("accounts", { id: "acc_1", email: "new@example.com", name: "Nueva", locale: "es", createdAt: "2026-09-18T00:00:00Z" });
    const { clientBook } = await import("./client-book");
    expect(clientBook()[0]).toMatchObject({ key: "e:new@example.com", name: "Nueva", hasAccount: true, orderCount: 0 });
  });

  /**
   * Daysi's own sign-in (and her helper's) is an account like any other, so
   * the book listed her as a client with "0 pedidos". An owner address is
   * a client only when an order or a card says so.
   */
  it("leaves the owner's own accounts out, unless an order or a card puts them in", async () => {
    vi.stubEnv("OWNER_EMAIL", "Daysi@Example.com, help@example.com");
    const { appendRecord } = await import("./records");
    await appendRecord("accounts", { id: "acc_d", email: "daysi@example.com", name: "Daysi", locale: "es", createdAt: "2026-09-01T00:00:00Z" });
    await appendRecord("accounts", { id: "acc_h", email: "HELP@example.com ", name: "Ayuda", locale: "es", createdAt: "2026-09-01T00:00:00Z" });
    await appendRecord("accounts", { id: "acc_1", email: "new@example.com", name: "Nueva", locale: "es", createdAt: "2026-09-18T00:00:00Z" });
    await appendRecord("order", order({ reference: "ORD-H", client: { name: "Ayuda", email: "help@example.com" } }));
    const { clientBook } = await import("./client-book");
    const rows = clientBook();
    expect(rows.map((row) => row.key).sort()).toEqual(["e:help@example.com", "e:new@example.com"]);
    expect(rows.find((row) => row.key === "e:help@example.com")).toMatchObject({ hasAccount: true, orderCount: 1 });
  });

  it("skips a request line with no client instead of failing the whole book", async () => {
    const { appendRecord } = await import("./records");
    await appendRecord("order", order({ reference: "ORD-1" }));
    const { client: _client, ...broken } = order({ reference: "ORD-2" });
    await appendRecord("order", broken);
    const { clientBook } = await import("./client-book");
    const rows = clientBook();
    expect(rows.map((row) => row.key)).toEqual(["e:ana@example.com"]);
    expect(rows[0]?.orderCount).toBe(1);
  });
});

describe("the Hub picker", () => {
  it("offers only active rows, with what it fills in", async () => {
    const { appendRecord } = await import("./records");
    await appendRecord("client-cards", {
      id: "cli_a",
      name: "Ana",
      email: "ana@example.com",
      phone: "7185550101",
      measurements: {},
      archived: true,
      updatedAt: "2026-09-16T00:00:00Z",
      updatedBy: "office",
    });
    await appendRecord("order", order({ reference: "ORD-1", client: { name: "Bea", email: "bea@example.com" } }));
    const { clientBook, bookPickerEntries } = await import("./client-book");
    const entries = bookPickerEntries(clientBook());
    expect(entries).toEqual([{ key: "e:bea@example.com", name: "Bea", phone: "", email: "bea@example.com" }]);
  });
});

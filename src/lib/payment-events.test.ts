import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type Stripe from "stripe";
import type { StoredRequest, StoredRequestKind } from "./request-store";

/**
 * What Stripe's confirmation is allowed to do to a record. The webhook is the
 * only place money changes a status, so the guards here are the ones standing
 * between a retried delivery and a wrong number in the books.
 */

let dir: string;

beforeEach(() => {
  vi.resetModules();
  dir = mkdtempSync(path.join(tmpdir(), "daysi-payments-"));
  process.env.DATA_DIR = dir;
  process.env.AUTH_SECRET = "test-signing-key";
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

const record = (
  overrides: Partial<StoredRequest> & Pick<StoredRequest, "reference" | "kind">,
): StoredRequest => ({
  submittedAt: "2026-09-03T12:00:00.000Z",
  locale: "en",
  client: { name: "Ana", email: "ana@example.com" },
  details: {},
  status: "new",
  ...overrides,
});

/**
 * What the dispatcher hands a mark. Both facts come off the Stripe event, so
 * the marks never have to guess the method or the month from the record.
 */
const paidNow = { via: "card" as const, at: "2026-09-09T12:00:00.000Z" };

const lines = (kind: StoredRequestKind): StoredRequest[] =>
  readFileSync(path.join(dir, `${kind}.jsonl`), "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as StoredRequest);

/**
 * Hand-built events carry only the fields `applyPaymentEvent` reads. A real
 * `Stripe.Checkout.Session` has dozens of required fields the function never
 * looks at, so one cast here is cheaper than a full fixture.
 */
type SessionEventType =
  | "checkout.session.completed"
  | "checkout.session.async_payment_succeeded"
  | "checkout.session.async_payment_failed"
  | "checkout.session.expired";

const sessionEvent = (
  type: SessionEventType,
  session: {
    reference?: string;
    clientReferenceId?: string;
    payment_status?: Stripe.Checkout.Session.PaymentStatus;
  } = {},
  created = Math.floor(Date.parse("2026-09-09T12:00:00.000Z") / 1000),
): Stripe.Event =>
  ({
    type,
    created,
    data: {
      object: {
        metadata: session.reference ? { reference: session.reference } : {},
        client_reference_id: session.clientReferenceId ?? null,
        payment_status: session.payment_status ?? "paid",
      },
    },
  }) as unknown as Stripe.Event;

const chargeEvent = (charge: { reference?: string; refunded: boolean }): Stripe.Event =>
  ({
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_1",
        metadata: charge.reference ? { reference: charge.reference } : {},
        refunded: charge.refunded,
      },
    },
  }) as unknown as Stripe.Event;

describe("markPaid", () => {
  it("marks the order paid and says the line came from Stripe", async () => {
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
      notifyClientPaymentFailed: vi.fn(async () => undefined),
    }));
    const { saveRequest, findRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order" }));
    expect(await markPaid("ORD-1", paidNow)).toBe("marked");

    expect(findRequest("ORD-1")).toMatchObject({ status: "paid", source: "stripe" });
    expect(lines("order")).toHaveLength(2);
  });

  it("finds a commission even though orders are looked at first", async () => {
    const { saveRequest, findRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order" }));
    await saveRequest(record({ reference: "COM-1", kind: "commission" }));

    expect(await markPaid("COM-1", paidNow)).toBe("marked");
    expect(findRequest("COM-1")?.status).toBe("paid");
    expect(findRequest("ORD-1")?.status).toBe("new");
  });

  it("writes nothing for a reference it does not recognise", async () => {
    const { saveRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order" }));
    expect(await markPaid("ORD-nobody", paidNow)).toBe("unknown");
    expect(lines("order")).toHaveLength(1);
  });

  it("does not repeat itself when Stripe delivers the same payment twice", async () => {
    const { saveRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order" }));
    await markPaid("ORD-1", paidNow);
    expect(await markPaid("ORD-1", paidNow)).toBe("already-paid");
    expect(lines("order")).toHaveLength(2);
  });

  it("leaves a correction the office made after the payment alone", async () => {
    // Daysi refunds the card in Stripe and closes the order here. A retry of the
    // original delivery must not put the money back.
    const { saveRequest, findRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order" }));
    await markPaid("ORD-1", paidNow);
    await saveRequest(
      record({ reference: "ORD-1", kind: "order", status: "closed", source: "office" }),
    );

    expect(await markPaid("ORD-1", paidNow)).toBe("already-paid");
    expect(findRequest("ORD-1")?.status).toBe("closed");
    expect(lines("order")).toHaveLength(3);
  });
});

describe("markPaid tells Daysi", () => {
  it("announces the order once Stripe confirms, and only once", async () => {
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
    }));
    const { saveRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");
    const { notifyOwner } = await import("./notify");

    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    expect(notifyOwner).not.toHaveBeenCalled();

    await markPaid("ORD-1", paidNow);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "ORD-1", status: "paid", source: "stripe" }),
    );

    await markPaid("ORD-1", paidNow);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("drops the waiting mark from the paid line", async () => {
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
    }));
    const { saveRequest, findRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await markPaid("ORD-1", paidNow);

    expect(findRequest("ORD-1")).not.toHaveProperty("awaitingPayment");
  });

  it("tells the client once, not on a retry", async () => {
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
    }));
    const { saveRequest } = await import("./request-store");
    const { markPaid } = await import("./payment-events");
    const { notifyClientPaid } = await import("./notify");

    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));

    await markPaid("ORD-1", paidNow);
    expect(notifyClientPaid).toHaveBeenCalledTimes(1);
    expect(notifyClientPaid).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "ORD-1", status: "paid", source: "stripe" }),
    );

    await markPaid("ORD-1", paidNow);
    expect(notifyClientPaid).toHaveBeenCalledTimes(1);
  });
});

describe("markExpired", () => {
  it("closes a booking whose payment page ran out, so it leaves the calendar and the books", async () => {
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
    }));
    const { saveRequest, findRequest } = await import("./request-store");
    const { markExpired } = await import("./payment-events");

    await saveRequest(
      record({ reference: "CIT-1", kind: "appointment", status: "scheduled", awaitingPayment: true }),
    );
    expect(await markExpired("CIT-1")).toBe("closed");

    expect(findRequest("CIT-1")).toMatchObject({ status: "closed", source: "stripe" });
    expect(findRequest("CIT-1")).not.toHaveProperty("awaitingPayment");
    expect(lines("appointment")).toHaveLength(2);
  });

  it("leaves a paid order alone when Stripe reports its session expired afterwards", async () => {
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
    }));
    const { saveRequest, findRequest } = await import("./request-store");
    const { markPaid, markExpired } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await markPaid("ORD-1", paidNow);
    expect(await markExpired("ORD-1")).toBe("not-waiting");

    expect(findRequest("ORD-1")?.status).toBe("paid");
    expect(lines("order")).toHaveLength(2);
  });

  it("leaves a record the office has already handled alone", async () => {
    // Daysi took cash and marked it herself; the dead payment page is not news.
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
    }));
    const { saveRequest, findRequest } = await import("./request-store");
    const { markExpired } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await saveRequest(
      record({ reference: "ORD-1", kind: "order", awaitingPayment: true, status: "answered", source: "office" }),
    );
    expect(await markExpired("ORD-1")).toBe("not-waiting");

    expect(findRequest("ORD-1")?.status).toBe("answered");
    expect(lines("order")).toHaveLength(2);
  });

  it("writes nothing for a reference it does not recognise", async () => {
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
    }));
    const { markExpired } = await import("./payment-events");
    expect(await markExpired("ORD-nobody")).toBe("unknown");
  });
});

describe("markRefunded", () => {
  it("writes the refund Stripe reports on top of the paid order", async () => {
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
    }));
    const { saveRequest, findRequest } = await import("./request-store");
    const { markPaid, markRefunded } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await markPaid("ORD-1", paidNow);
    expect(await markRefunded("ORD-1")).toBe("refunded");

    expect(findRequest("ORD-1")).toMatchObject({ status: "refunded", source: "stripe" });
    expect(lines("order")).toHaveLength(3);
  });

  it("does not repeat itself when Stripe delivers the refund twice", async () => {
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
    }));
    const { saveRequest } = await import("./request-store");
    const { markPaid, markRefunded } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order" }));
    await markPaid("ORD-1", paidNow);
    await markRefunded("ORD-1");
    expect(await markRefunded("ORD-1")).toBe("already-refunded");
    expect(lines("order")).toHaveLength(3);
  });

  it("does not put the money back when the payment event is retried after the refund", async () => {
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
    }));
    const { saveRequest, findRequest } = await import("./request-store");
    const { markPaid, markRefunded } = await import("./payment-events");

    await saveRequest(record({ reference: "ORD-1", kind: "order" }));
    await markPaid("ORD-1", paidNow);
    await markRefunded("ORD-1");
    expect(await markPaid("ORD-1", paidNow)).toBe("already-paid");
    expect(findRequest("ORD-1")?.status).toBe("refunded");
  });

  it("writes nothing for a reference it does not recognise", async () => {
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
    }));
    const { markRefunded } = await import("./payment-events");
    expect(await markRefunded("ORD-nobody")).toBe("unknown");
  });
});

/**
 * The webhook hands every verified event here. `checkout.session.completed`
 * says the client finished the page, not that the money is in: for a bank
 * payment it arrives days before the funds, so only `payment_status` and the
 * two async events are allowed to move money.
 */
describe("applyPaymentEvent", () => {
  async function setup() {
    vi.doMock("./notify", () => ({
      notifyOwner: vi.fn(async () => undefined),
      notifyClientPaid: vi.fn(async () => undefined),
      notifyClientPaymentFailed: vi.fn(async () => undefined),
    }));
    const { saveRequest, findRequest } = await import("./request-store");
    const { applyPaymentEvent } = await import("./payment-events");
    const { notifyOwner, notifyClientPaymentFailed } = await import("./notify");
    return { saveRequest, findRequest, applyPaymentEvent, notifyOwner, notifyClientPaymentFailed };
  }

  it("notes that the money came by card, and when, on a completed page", async () => {
    const { saveRequest, findRequest, applyPaymentEvent } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));

    await applyPaymentEvent(sessionEvent("checkout.session.completed", { reference: "ORD-1" }));
    const paid = findRequest("ORD-1");
    expect(paid).toMatchObject({ status: "paid", paidVia: "card" });
    expect(typeof paid?.paidAt).toBe("string");
  });

  it("treats a session that needed no payment as paid", async () => {
    const { saveRequest, findRequest, applyPaymentEvent } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));

    expect(
      await applyPaymentEvent(
        sessionEvent("checkout.session.completed", { reference: "ORD-1", payment_status: "no_payment_required" }),
      ),
    ).toBe("marked");
    expect(findRequest("ORD-1")?.status).toBe("paid");
  });

  it("brings a retired row back when its money arrives, so the payment is seen", async () => {
    const { saveRequest, applyPaymentEvent, notifyOwner } = await setup();
    const { retiredSet, setRetired } = await import("./retired");
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await setRetired("request", "ORD-1", true);

    expect(
      await applyPaymentEvent(sessionEvent("checkout.session.completed", { reference: "ORD-1" })),
    ).toBe("marked");
    expect(retiredSet("request").has("ORD-1")).toBe(false);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("marks an order paid when the session completed with the money in", async () => {
    const { saveRequest, findRequest, applyPaymentEvent, notifyOwner } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));

    expect(
      await applyPaymentEvent(sessionEvent("checkout.session.completed", { reference: "ORD-1" })),
    ).toBe("marked");
    expect(findRequest("ORD-1")).toMatchObject({ status: "paid", source: "stripe" });
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("writes down that the bank is sending the money when the page completes unpaid, without calling it received", async () => {
    const { saveRequest, findRequest, applyPaymentEvent, notifyOwner } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));

    expect(
      await applyPaymentEvent(
        sessionEvent("checkout.session.completed", { reference: "ORD-1", payment_status: "unpaid" }),
      ),
    ).toBe("bank-pending");
    expect(findRequest("ORD-1")).toMatchObject({ status: "new", awaitingPayment: "bank", source: "stripe" });
    expect(lines("order")).toHaveLength(2);
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("writes the bank's promise once, however often Stripe repeats the completed page", async () => {
    const { saveRequest, applyPaymentEvent } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    const unpaid = sessionEvent("checkout.session.completed", { reference: "ORD-1", payment_status: "unpaid" });

    await applyPaymentEvent(unpaid);
    expect(await applyPaymentEvent(unpaid)).toBe("already-pending");
    expect(lines("order")).toHaveLength(2);
  });

  it("marks the order paid, and tells Daysi, when the bank payment lands later", async () => {
    const { saveRequest, findRequest, applyPaymentEvent, notifyOwner } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await applyPaymentEvent(
      sessionEvent("checkout.session.completed", { reference: "ORD-1", payment_status: "unpaid" }),
    );

    expect(
      await applyPaymentEvent(
        sessionEvent("checkout.session.async_payment_succeeded", { reference: "ORD-1" }),
      ),
    ).toBe("marked");
    expect(findRequest("ORD-1")).toMatchObject({ status: "paid", source: "stripe", paidVia: "bank" });
    expect(findRequest("ORD-1")).not.toHaveProperty("awaitingPayment");
    expect(lines("order")).toHaveLength(3);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("says the money came by bank even when the bank's answer arrives before the completed page", async () => {
    // Stripe does not promise an order. Reading the method off the record
    // would call this a card payment, which is not what Daysi must reconcile.
    const { saveRequest, findRequest, applyPaymentEvent } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));

    await applyPaymentEvent(
      sessionEvent("checkout.session.async_payment_succeeded", { reference: "ORD-1" }),
    );
    expect(findRequest("ORD-1")).toMatchObject({ status: "paid", paidVia: "bank" });
  });

  it("dates the money by the event's own time, not by when the delivery was handled", async () => {
    // A delivery Stripe retries across a month boundary must not move the
    // money into the wrong month of the earnings trend.
    const { saveRequest, findRequest, applyPaymentEvent } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));

    await applyPaymentEvent(
      sessionEvent(
        "checkout.session.async_payment_succeeded",
        { reference: "ORD-1" },
        Math.floor(Date.parse("2026-09-30T22:00:00.000Z") / 1000),
      ),
    );
    expect(findRequest("ORD-1")?.paidAt).toBe("2026-09-30T22:00:00.000Z");
  });

  it("does not repeat itself when the completed event is retried after the bank payment landed", async () => {
    const { saveRequest, applyPaymentEvent, notifyOwner } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await applyPaymentEvent(
      sessionEvent("checkout.session.async_payment_succeeded", { reference: "ORD-1" }),
    );

    expect(
      await applyPaymentEvent(sessionEvent("checkout.session.completed", { reference: "ORD-1" })),
    ).toBe("already-paid");
    expect(lines("order")).toHaveLength(2);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("leaves the order open, marked refused, and tells both Daysi and the client when the bank payment bounces", async () => {
    // The client still owes the money, so the row has to stay in the books
    // for her to chase. Closing it would say the matter was over.
    const { saveRequest, findRequest, applyPaymentEvent, notifyOwner, notifyClientPaymentFailed } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await applyPaymentEvent(
      sessionEvent("checkout.session.completed", { reference: "ORD-1", payment_status: "unpaid" }),
    );

    expect(
      await applyPaymentEvent(
        sessionEvent("checkout.session.async_payment_failed", { reference: "ORD-1", payment_status: "unpaid" }),
      ),
    ).toBe("failed");
    expect(findRequest("ORD-1")).toMatchObject({ status: "new", source: "stripe", paymentFailed: true });
    expect(findRequest("ORD-1")).not.toHaveProperty("awaitingPayment");
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(notifyOwner).toHaveBeenCalledWith(expect.objectContaining({ paymentFailed: true }));
    expect(notifyClientPaymentFailed).toHaveBeenCalledTimes(1);
  });

  it("keeps the status Daysi set when the bank payment bounces on a record she has handled", async () => {
    const { saveRequest, findRequest, applyPaymentEvent, notifyOwner } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await applyPaymentEvent(
      sessionEvent("checkout.session.completed", { reference: "ORD-1", payment_status: "unpaid" }),
    );
    await saveRequest(
      record({ reference: "ORD-1", kind: "order", awaitingPayment: "bank", status: "answered", source: "office" }),
    );

    expect(
      await applyPaymentEvent(
        sessionEvent("checkout.session.async_payment_failed", { reference: "ORD-1", payment_status: "unpaid" }),
      ),
    ).toBe("failed");
    expect(findRequest("ORD-1")).toMatchObject({ status: "answered", source: "stripe", paymentFailed: true });
    expect(findRequest("ORD-1")).not.toHaveProperty("awaitingPayment");
    expect(lines("order")).toHaveLength(4);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("keeps her status even when she changed it before the bank made its promise", async () => {
    // The bank-pending line is written by Stripe on top of hers, so a rule
    // that reads only the newest line would not see that she had been here.
    const { saveRequest, findRequest, applyPaymentEvent } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await saveRequest(
      record({ reference: "ORD-1", kind: "order", awaitingPayment: true, status: "answered", source: "office" }),
    );
    await applyPaymentEvent(
      sessionEvent("checkout.session.completed", { reference: "ORD-1", payment_status: "unpaid" }),
    );

    await applyPaymentEvent(
      sessionEvent("checkout.session.async_payment_failed", { reference: "ORD-1", payment_status: "unpaid" }),
    );
    expect(findRequest("ORD-1")).toMatchObject({ status: "answered", paymentFailed: true });
  });

  it("records the refusal and tells her even on a row she had marked paid by hand", async () => {
    // Her own Pagado is not proof the money arrived; only Stripe's line is.
    // Believing it would leave the books counting money that never came.
    const { saveRequest, findRequest, applyPaymentEvent, notifyOwner, notifyClientPaymentFailed } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await applyPaymentEvent(
      sessionEvent("checkout.session.completed", { reference: "ORD-1", payment_status: "unpaid" }),
    );
    await saveRequest(
      record({ reference: "ORD-1", kind: "order", awaitingPayment: "bank", status: "paid", source: "office" }),
    );

    expect(
      await applyPaymentEvent(
        sessionEvent("checkout.session.async_payment_failed", { reference: "ORD-1", payment_status: "unpaid" }),
      ),
    ).toBe("failed");
    expect(findRequest("ORD-1")).toMatchObject({ paymentFailed: true });
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(notifyClientPaymentFailed).toHaveBeenCalledTimes(1);
  });

  it("leaves a record she has already settled alone when the refusal arrives", async () => {
    // Writing a refusal onto a refunded row would claim money was given back
    // that never came in, and Libros would hide the row either way.
    const { saveRequest, findRequest, applyPaymentEvent, notifyOwner } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: "bank", status: "refunded", source: "office" }));

    expect(
      await applyPaymentEvent(
        sessionEvent("checkout.session.async_payment_failed", { reference: "ORD-1", payment_status: "unpaid" }),
      ),
    ).toBe("not-waiting");
    expect(findRequest("ORD-1")?.status).toBe("refunded");
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("does not promise the bank again after a refusal, even once the office has moved the row on", async () => {
    // Stripe re-delivers for up to three days. The refusal is a fact about
    // this reference, so a repeated completed page must not re-arm the wait.
    const { saveRequest, findRequest, applyPaymentEvent } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    const unpaid = sessionEvent("checkout.session.completed", { reference: "ORD-1", payment_status: "unpaid" });
    await applyPaymentEvent(unpaid);
    await applyPaymentEvent(
      sessionEvent("checkout.session.async_payment_failed", { reference: "ORD-1", payment_status: "unpaid" }),
    );
    await saveRequest(record({ reference: "ORD-1", kind: "order", status: "answered", source: "office" }));

    expect(await applyPaymentEvent(unpaid)).toBe("not-waiting");
    expect(findRequest("ORD-1")).not.toHaveProperty("awaitingPayment");
  });

  it("does not put a refund back on top of a status she set after it", async () => {
    const { saveRequest, findRequest, applyPaymentEvent } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await applyPaymentEvent(sessionEvent("checkout.session.completed", { reference: "ORD-1" }));
    const refund = chargeEvent({ reference: "ORD-1", refunded: true });
    await applyPaymentEvent(refund);
    await saveRequest(record({ reference: "ORD-1", kind: "order", status: "closed", source: "office" }));

    expect(await applyPaymentEvent(refund)).toBe("already-refunded");
    expect(findRequest("ORD-1")?.status).toBe("closed");
  });

  it("brings a retired row back when its payment is refused, so the refusal can be seen", async () => {
    const { saveRequest, applyPaymentEvent } = await setup();
    const { retiredSet, setRetired } = await import("./retired");
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await applyPaymentEvent(
      sessionEvent("checkout.session.completed", { reference: "ORD-1", payment_status: "unpaid" }),
    );
    await setRetired("request", "ORD-1", true);

    await applyPaymentEvent(
      sessionEvent("checkout.session.async_payment_failed", { reference: "ORD-1", payment_status: "unpaid" }),
    );
    expect(retiredSet("request").has("ORD-1")).toBe(false);
  });

  it("does not tell anyone twice when the failure is delivered again", async () => {
    const { saveRequest, applyPaymentEvent, notifyOwner, notifyClientPaymentFailed } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    const failed = sessionEvent("checkout.session.async_payment_failed", { reference: "ORD-1", payment_status: "unpaid" });

    await applyPaymentEvent(failed);
    expect(await applyPaymentEvent(failed)).toBe("not-waiting");
    expect(lines("order")).toHaveLength(2);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(notifyClientPaymentFailed).toHaveBeenCalledTimes(1);
  });

  it("does not close an order Stripe already paid when a failure arrives late", async () => {
    const { saveRequest, findRequest, applyPaymentEvent } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await applyPaymentEvent(
      sessionEvent("checkout.session.async_payment_succeeded", { reference: "ORD-1" }),
    );

    expect(
      await applyPaymentEvent(
        sessionEvent("checkout.session.async_payment_failed", { reference: "ORD-1", payment_status: "unpaid" }),
      ),
    ).toBe("not-waiting");
    expect(findRequest("ORD-1")?.status).toBe("paid");
  });

  it("falls back to the client reference when the session carries no metadata", async () => {
    const { saveRequest, findRequest, applyPaymentEvent } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));

    expect(
      await applyPaymentEvent(
        sessionEvent("checkout.session.completed", { clientReferenceId: "ORD-1" }),
      ),
    ).toBe("marked");
    expect(findRequest("ORD-1")?.status).toBe("paid");
  });

  it("does nothing with a session that names no order", async () => {
    // What Stripe's own `stripe trigger` fixtures look like.
    const { applyPaymentEvent } = await setup();
    expect(await applyPaymentEvent(sessionEvent("checkout.session.completed"))).toBe("no-reference");
    expect(() => lines("order")).toThrow();
  });

  it("warns, and writes nothing, for a reference it does not recognise", async () => {
    const { applyPaymentEvent } = await setup();
    expect(
      await applyPaymentEvent(sessionEvent("checkout.session.completed", { reference: "ORD-nobody" })),
    ).toBe("unknown");
  });

  it("ignores an event it was not written for", async () => {
    const { applyPaymentEvent } = await setup();
    const event = { type: "payment_intent.created", data: { object: {} } } as unknown as Stripe.Event;
    expect(await applyPaymentEvent(event)).toBe("ignored");
  });

  it("still closes an abandoned payment page", async () => {
    const { saveRequest, findRequest, applyPaymentEvent } = await setup();
    await saveRequest(
      record({ reference: "CIT-1", kind: "appointment", status: "scheduled", awaitingPayment: true }),
    );

    expect(
      await applyPaymentEvent(
        sessionEvent("checkout.session.expired", { reference: "CIT-1", payment_status: "unpaid" }),
      ),
    ).toBe("closed");
    expect(findRequest("CIT-1")?.status).toBe("closed");
  });

  it("still writes a full refund, and only logs a partial one", async () => {
    const { saveRequest, findRequest, applyPaymentEvent } = await setup();
    await saveRequest(record({ reference: "ORD-1", kind: "order", awaitingPayment: true }));
    await applyPaymentEvent(sessionEvent("checkout.session.completed", { reference: "ORD-1" }));

    expect(await applyPaymentEvent(chargeEvent({ reference: "ORD-1", refunded: false }))).toBe(
      "partial-refund",
    );
    expect(findRequest("ORD-1")?.status).toBe("paid");

    expect(await applyPaymentEvent(chargeEvent({ reference: "ORD-1", refunded: true }))).toBe(
      "refunded",
    );
    expect(findRequest("ORD-1")?.status).toBe("refunded");
  });
});

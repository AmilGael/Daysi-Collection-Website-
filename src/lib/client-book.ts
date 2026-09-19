import { listAccounts } from "./auth/accounts";
import { listClientCards, measuredCount, phoneDigits, type ClientCard } from "./client-cards";
import { loadLedger } from "./earnings";
import {
  currentRecords,
  listRequests,
  unfinishedCheckout,
  type StoredRequest,
  type StoredRequestKind,
} from "./request-store";

/**
 * Everyone Daysi has served, worked out on every read and never stored.
 *
 * A row exists from a client's first order and never goes away: it is found
 * in the full history of every order line ever written, which nothing
 * deletes, so retiring, closing, refunding or undoing an order leaves its
 * client in the book. Only the figures (orders, paid, last visit) come from
 * the live ledger, so they are always right and never need syncing.
 *
 * Who is the same person, in order: a card's email or phone, then an
 * order's email, then an order's phone, then an order's name. An order
 * never joins an email to a phone by itself, because a family can share one
 * phone; only a card Daysi or the client saved with both does. A phone two
 * cards share is ambiguous and joins neither.
 *
 * A card with neither an email nor a phone (Daysi's card for a client she
 * only knows by name) is found by that name, as a name-only order is, so
 * saving the card on a name-only row files that row's orders under it. Two
 * such cards with one name are ambiguous and join neither, like a phone.
 */

const CLIENT_KINDS = ["order", "alteration", "commission", "appointment", "design"] as const satisfies readonly StoredRequestKind[];

export type BookOrder = {
  readonly reference: string;
  readonly kind: string;
  readonly submittedAt: string;
  readonly total: number;
  readonly status: string;
};

export type BookRow = {
  readonly key: string;
  readonly cardId?: string;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly hasAccount: boolean;
  readonly measuredCount: number;
  readonly lastVisit?: string;
  readonly orderCount: number;
  readonly paidTotal: number;
  readonly archived: boolean;
  readonly orders: readonly BookOrder[];
  readonly card?: ClientCard;
};

type Draft = {
  key: string;
  card?: ClientCard;
  name: string;
  email?: string;
  phone?: string;
  hasAccount: boolean;
  lastVisit?: string;
  references: Set<string>;
};

const normalEmail = (email: string | undefined) => (email ?? "").trim().toLowerCase();
const normalName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export function clientBook(): BookRow[] {
  const rows = new Map<string, Draft>();
  const byEmail = new Map<string, Draft>();
  const byCardPhone = new Map<string, Draft | null>();
  const byCardName = new Map<string, Draft | null>();

  for (const card of listClientCards()) {
    const row: Draft = {
      key: card.id,
      card,
      name: card.name,
      email: card.email,
      phone: card.phone,
      hasAccount: Boolean(card.accountId),
      references: new Set(),
    };
    rows.set(row.key, row);
    if (card.email) byEmail.set(card.email, row);
    const digits = card.phone ? phoneDigits(card.phone) : "";
    if (digits.length >= 7) byCardPhone.set(digits, byCardPhone.has(digits) ? null : row);
    if (!card.email && !card.phone) {
      const name = normalName(card.name);
      if (name) byCardName.set(name, byCardName.has(name) ? null : row);
    }
  }

  const rowFor = (key: string, seed: Omit<Draft, "key" | "references" | "hasAccount">): Draft => {
    let row = rows.get(key);
    if (!row) {
      row = { key, hasAccount: false, references: new Set(), ...seed };
      rows.set(key, row);
    }
    return row;
  };

  for (const account of listAccounts()) {
    const email = normalEmail(account.email);
    const row = byEmail.get(email) ?? rowFor(`e:${email}`, { name: account.name, email });
    byEmail.set(email, row);
    row.hasAccount = true;
    if (!row.name) row.name = account.name;
  }

  const history: StoredRequest[] = CLIENT_KINDS.flatMap((kind) => currentRecords(listRequests(kind)));
  for (const record of history) {
    if (unfinishedCheckout(record)) continue;
    const { name, email: rawEmail, phone } = record.client;
    const email = normalEmail(rawEmail);
    const digits = phone ? phoneDigits(phone) : "";
    let row: Draft;
    if (email) {
      row = byEmail.get(email) ?? rowFor(`e:${email}`, { name, email });
      byEmail.set(email, row);
    } else if (digits.length >= 7) {
      row = byCardPhone.get(digits) ?? rowFor(`p:${digits}`, { name, phone });
    } else {
      row = byCardName.get(normalName(name)) ?? rowFor(`n:${normalName(name)}`, { name });
    }
    row.references.add(record.reference);
    if (!row.card) {
      // Newest contact details win on a row nobody has written a card for.
      if (!row.lastVisit || record.submittedAt > row.lastVisit) {
        if (name) row.name = name;
        if (phone) row.phone = phone;
      }
    }
    if (!row.lastVisit || record.submittedAt > row.lastVisit) row.lastVisit = record.submittedAt;
  }

  const ledger = new Map(loadLedger().map((record) => [record.reference, record]));

  return [...rows.values()]
    .map((row): BookRow => {
      const orders = [...row.references]
        .map((reference) => ledger.get(reference))
        .filter((record): record is StoredRequest => record !== undefined)
        .map((record) => ({
          reference: record.reference,
          kind: record.kind,
          submittedAt: record.submittedAt,
          total: record.estimate?.total ?? 0,
          status: record.status,
        }))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      const paidTotal = orders
        .filter((order) => order.status === "paid" && !ledger.get(order.reference)?.paymentFailed)
        .reduce((sum, order) => sum + order.total, 0);
      return {
        key: row.key,
        ...(row.card ? { cardId: row.card.id, card: row.card } : {}),
        name: row.name,
        ...(row.email ? { email: row.email } : {}),
        ...(row.phone ? { phone: row.phone } : {}),
        hasAccount: row.hasAccount,
        measuredCount: measuredCount(row.card),
        ...(row.lastVisit ? { lastVisit: row.lastVisit } : {}),
        orderCount: orders.length,
        paidTotal,
        archived: Boolean(row.card?.archived),
        orders,
      };
    })
    .sort((a, b) => (b.lastVisit ?? b.card?.updatedAt ?? "").localeCompare(a.lastVisit ?? a.card?.updatedAt ?? ""));
}

/** One row as the Hub's "who is this for" picker offers it: only what it fills in. */
export type PickerEntry = { readonly key: string; readonly name: string; readonly phone: string; readonly email: string };

/** The Hub's "who is this for" picker: active rows, only what it fills in. */
export function bookPickerEntries(rows: readonly BookRow[]): PickerEntry[] {
  return rows
    .filter((row) => !row.archived)
    .map((row) => ({ key: row.key, name: row.name, phone: row.phone ?? "", email: row.email ?? "" }));
}

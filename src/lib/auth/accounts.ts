import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../env";
import { appendRecord, latestBy, readRecords } from "../records";

/**
 * Who can sign in, and how.
 *
 * There are no passwords anywhere in this system. A client asks for a link,
 * the link arrives in their email, and clicking it signs them in. That removes
 * the single largest liability a small business site can carry — a database of
 * password hashes belonging to people who reuse passwords — and it removes the
 * reset flow, which is where most hand-rolled auth actually breaks.
 *
 * Nothing secret is ever stored in the clear: sign-in links and session
 * cookies are random tokens, and only their SHA-256 hash is written down. A
 * copy of this store discloses no way to sign in as anybody.
 */

export type Role = "client" | "owner";

export type Account = {
  readonly id: string;
  /** Normalised: lowercased and trimmed. The natural key for an account. */
  readonly email: string;
  readonly name: string;
  readonly locale: "es" | "en";
  readonly createdAt: string;
};

const TOKEN_BYTES = 32;

export function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Compares two hashes without leaking, through timing, how much of the value
 * matched. Lengths are compared first because timingSafeEqual throws on a
 * mismatch, and a hash of the wrong length is already wrong.
 */
export function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Daysi is whoever signs in with the address her notifications go to. The role
 * is derived on every read rather than stored on the account, so there is no
 * field an attacker could ever flip to promote themselves — and no way to
 * grant the office to a second person by accident.
 */
export function roleFor(account: Account): Role {
  const owner = env.ownerEmail ? normaliseEmail(env.ownerEmail) : null;
  return owner !== null && account.email === owner ? "owner" : "client";
}

export async function findAccountByEmail(email: string): Promise<Account | null> {
  const wanted = normaliseEmail(email);
  const accounts = await listAccounts();
  return accounts.find((account) => account.email === wanted) ?? null;
}

export async function findAccountById(id: string): Promise<Account | null> {
  const accounts = await listAccounts();
  return accounts.find((account) => account.id === id) ?? null;
}

export async function listAccounts(): Promise<Account[]> {
  const records = readRecords<Account>("accounts");
  return latestBy(records, (account) => account.email);
}

/**
 * Finds the account for an address, creating it on first sign-in. Signing in
 * IS signing up: asking a client to pick a flow before they can see their own
 * order is friction that buys nothing.
 */
export async function findOrCreateAccount(input: {
  email: string;
  name?: string;
  locale: "es" | "en";
}): Promise<Account> {
  const email = normaliseEmail(input.email);
  const existing = await findAccountByEmail(email);
  if (existing) {
    // A later order can teach us a name we did not have at sign-up.
    if (!existing.name && input.name) {
      const updated = { ...existing, name: input.name };
      await appendRecord("accounts", updated);
      return updated;
    }
    return existing;
  }

  const account: Account = {
    id: `acc_${randomBytes(12).toString("base64url")}`,
    email,
    name: input.name?.trim() ?? "",
    locale: input.locale,
    createdAt: new Date().toISOString(),
  };
  await appendRecord("accounts", account);
  return account;
}

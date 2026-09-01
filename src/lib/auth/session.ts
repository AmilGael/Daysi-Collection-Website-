import { cookies } from "next/headers";
import { isProduction } from "../env";
import { appendSignedRecord, latestBy, readSignedRecords } from "../records";
import {
  findAccountById,
  hashToken,
  hashesMatch,
  newToken,
  roleFor,
  type Account,
  type Role,
} from "./accounts";

/**
 * Sessions.
 *
 * The cookie holds a random token and nothing else — no account id, no role,
 * no expiry a client could edit. Everything about the session is looked up
 * server-side from the token's hash, so a forged or altered cookie resolves to
 * no session rather than to a session someone else's.
 *
 * Every session line is signed under AUTH_SECRET and carries the account's
 * email. Without the signature a line is ignored, so a copy of the volume,
 * or an intruder appending to it, cannot mint a session; and the email pins
 * which account the id meant at sign-in, so an appended account record cannot
 * re-point a client's session at the owner's address.
 *
 * SameSite=Lax is the deliberate choice: Strict would break the sign-in link,
 * because arriving from an email client counts as cross-site and the cookie
 * would not be sent. Lax still refuses to attach the cookie to any cross-site
 * POST, and every state-changing route additionally checks the request origin.
 * The two together are what replaces a CSRF token.
 */

const COOKIE_NAME = "daysi_session";
const SESSION_DAYS = 30;

type SessionRecord = {
  readonly tokenHash: string;
  readonly accountId: string;
  /** Normalised address of the account at sign-in; must still match on read. */
  readonly email: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revoked: boolean;
};

export type Viewer = {
  readonly account: Account;
  readonly role: Role;
};

function expiryFrom(now: Date): string {
  return new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function liveSessions(): Promise<SessionRecord[]> {
  const records = readSignedRecords<SessionRecord>("sessions");
  // A revocation is final. Without this, re-appending the original, validly
  // signed line after a sign-out would bring the session back.
  const revoked = new Set(records.filter((session) => session.revoked).map((s) => s.tokenHash));
  const now = Date.now();
  return latestBy(records, (session) => session.tokenHash).filter(
    (session) =>
      !session.revoked &&
      !revoked.has(session.tokenHash) &&
      new Date(session.expiresAt).getTime() > now,
  );
}

/**
 * Issues a session for an account and writes the cookie. Called only after a
 * sign-in link has been proved; there is no other way to mint one.
 */
export async function startSession(account: Account): Promise<void> {
  const token = newToken();
  const now = new Date();

  await appendSignedRecord("sessions", {
    tokenHash: hashToken(token),
    accountId: account.id,
    email: account.email,
    createdAt: now.toISOString(),
    expiresAt: expiryFrom(now),
    revoked: false,
  } satisfies SessionRecord);

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;

  if (token) {
    const hash = hashToken(token);
    const session = (await liveSessions()).find((candidate) =>
      hashesMatch(candidate.tokenHash, hash),
    );
    // Revoking server-side matters: deleting only the cookie would leave a
    // copied token working until it expired.
    if (session) await appendSignedRecord("sessions", { ...session, revoked: true });
  }

  jar.delete(COOKIE_NAME);
}

/** The signed-in account, or null. Safe to call from any server component. */
export async function currentViewer(): Promise<Viewer | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const hash = hashToken(token);
  const session = (await liveSessions()).find((candidate) =>
    hashesMatch(candidate.tokenHash, hash),
  );
  if (!session) return null;

  const account = await findAccountById(session.accountId);
  if (!account) return null;
  if (account.email !== session.email) return null;

  return { account, role: roleFor(account) };
}

/**
 * The viewer, or a thrown redirect to sign in. Every private page starts with
 * one of these two calls, so "who is allowed here" is never an `if` a page can
 * forget to write.
 */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await currentViewer();
  if (!viewer) throw new Error("unauthenticated");
  return viewer;
}

export async function requireOwner(): Promise<Viewer> {
  const viewer = await currentViewer();
  if (!viewer || viewer.role !== "owner") throw new Error("unauthorised");
  return viewer;
}

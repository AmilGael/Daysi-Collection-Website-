import { emailEnabled, env, isProduction } from "../env";
import { sendEmail } from "../notify";
import { appendSignedRecord, latestBy, readSignedRecords } from "../records";
import { findOrCreateAccount, hashToken, hashesMatch, newToken, normaliseEmail } from "./accounts";

/**
 * The sign-in link.
 *
 * A link is a bearer credential that travels through email, so it is treated
 * like one: short-lived, single-use, stored only as a hash, bound to the
 * address it was sent to, and signed under AUTH_SECRET so a line appended to
 * the volume by anyone but this server is not a link at all. Clicking an old link, a link that has already been
 * used, or a link someone typed by hand all fail the same way.
 */

const LINK_MINUTES = 15;

type LinkRecord = {
  readonly tokenHash: string;
  readonly email: string;
  readonly locale: "es" | "en";
  readonly expiresAt: string;
  readonly usedAt: string | null;
};

const COPY = {
  es: {
    subject: "Su enlace para entrar · Daysi Collection",
    body: (url: string) =>
      [
        "Hola,",
        "",
        "Toque este enlace para entrar a su cuenta de Daysi Collection:",
        url,
        "",
        `El enlace vale ${LINK_MINUTES} minutos y sirve una sola vez.`,
        "Si usted no lo pidió, puede ignorar este correo — no pasa nada.",
      ].join("\n"),
  },
  en: {
    subject: "Your sign-in link · Daysi Collection",
    body: (url: string) =>
      [
        "Hello,",
        "",
        "Tap this link to sign in to your Daysi Collection account:",
        url,
        "",
        `The link lasts ${LINK_MINUTES} minutes and works once.`,
        "If you did not ask for it, you can ignore this email — nothing happens.",
      ].join("\n"),
  },
} as const;

/**
 * Creates a link and sends it. Returns nothing about whether the address is
 * already known: the route that calls this answers identically either way, so
 * the form cannot be used to discover who Daysi's clients are.
 */
export async function sendSignInLink(email: string, locale: "es" | "en"): Promise<void> {
  const token = newToken();
  const address = normaliseEmail(email);

  await appendSignedRecord("sign-in-links", {
    tokenHash: hashToken(token),
    email: address,
    locale,
    expiresAt: new Date(Date.now() + LINK_MINUTES * 60 * 1000).toISOString(),
    usedAt: null,
  } satisfies LinkRecord);

  const url = `${env.siteUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const copy = COPY[locale];

  if (!emailEnabled) {
    // Without a mail key there is no way to receive the link, so development
    // prints it. Production refuses instead of logging a live credential.
    if (isProduction) {
      console.error("[auth] Sign-in requested but no mail provider is configured.");
      return;
    }
    console.info(`\n[auth] Sign-in link for ${address}:\n${url}\n`);
    return;
  }

  await sendEmail({ to: address, subject: copy.subject, text: copy.body(url) });
}

/**
 * Spends a link. Returns the account it belongs to, or null for anything that
 * is expired, already used, or simply not a link we issued.
 */
export async function consumeSignInLink(token: string) {
  const hash = hashToken(token);
  const links = latestBy(
    readSignedRecords<LinkRecord>("sign-in-links"),
    (link) => link.tokenHash,
  );

  const link = links.find((candidate) => hashesMatch(candidate.tokenHash, hash));
  if (!link) return null;
  if (link.usedAt !== null) return null;
  if (new Date(link.expiresAt).getTime() <= Date.now()) return null;

  // Burn it before issuing the session, so a link raced twice can only win once.
  await appendSignedRecord("sign-in-links", { ...link, usedAt: new Date().toISOString() });

  return findOrCreateAccount({ email: link.email, locale: link.locale });
}

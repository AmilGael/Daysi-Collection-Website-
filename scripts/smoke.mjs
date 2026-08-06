/**
 * Checks a running site end to end over HTTP.
 *
 * This exists because of a real failure: the middleware was handed a rebuilt
 * request object, next-intl swallowed the resulting error in a try/catch, and
 * every redirect quietly stopped working. Type checks passed, tests passed, and
 * every locale-prefixed page still returned 200 — but the bare "/" that people
 * actually type returned a 404. Only a real request finds that.
 *
 *   npm run dev          # in one terminal
 *   npm run smoke        # in another
 */

const BASE = process.env.SMOKE_URL ?? "http://localhost:3000";

const LOCALES = ["es", "en"];

const PAGES = [
  "",
  "/collection",
  "/collection/flor-de-sol",
  "/premieres",
  "/services",
  "/alterations",
  "/prices",
  "/design-studio",
  "/appointments",
  "/request",
  "/atelier",
  "/contact",
  "/terms",
  "/privacy",
];

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `  ${detail}` : ""}`);
}

async function check(name, run) {
  try {
    const { ok, detail } = await run();
    record(name, ok, detail);
  } catch (error) {
    record(name, false, String(error));
  }
}

// The front door. Somebody typing the bare address has to land somewhere.
await check("/ redirects into a locale", async () => {
  const response = await fetch(BASE, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  return {
    ok: response.status === 307 && location.endsWith("/es"),
    detail: `${response.status} -> ${location || "(none)"}`,
  };
});

await check("an unprefixed page redirects into a locale", async () => {
  const response = await fetch(`${BASE}/collection`, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  return {
    ok: response.status === 307 && location.endsWith("/es/collection"),
    detail: `${response.status} -> ${location || "(none)"}`,
  };
});

await check("an English browser is sent to /en", async () => {
  const response = await fetch(BASE, {
    redirect: "manual",
    headers: { "accept-language": "en-US,en;q=0.9" },
  });
  const location = response.headers.get("location") ?? "";
  return { ok: location.endsWith("/en"), detail: location || "(none)" };
});

for (const locale of LOCALES) {
  for (const page of PAGES) {
    const path = `/${locale}${page}`;
    await check(`${path} renders`, async () => {
      const response = await fetch(`${BASE}${path}`);
      return { ok: response.status === 200, detail: String(response.status) };
    });
  }
}

// A nonce in the policy that no script carries would block every script on the
// page in production, where 'unsafe-eval' is not there to paper over it.
await check("the CSP nonce matches the rendered scripts", async () => {
  const response = await fetch(`${BASE}/es`);
  const policy = response.headers.get("content-security-policy") ?? "";
  const html = await response.text();
  const inPolicy = /nonce-([a-f0-9]+)/.exec(policy)?.[1];
  const inHtml = /nonce="([a-f0-9]+)"/.exec(html)?.[1];
  const unnonced = (html.match(/<script(?![^>]*nonce)[^>]*>/g) ?? []).length;
  return {
    ok: Boolean(inPolicy) && inPolicy === inHtml && unnonced === 0,
    detail: `policy=${inPolicy ?? "none"} html=${inHtml ?? "none"} unnonced=${unnonced}`,
  };
});

await check("a cross-origin request is refused", async () => {
  const response = await fetch(`${BASE}/api/requests`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.invalid" },
    body: "{}",
  });
  return { ok: response.status === 403, detail: String(response.status) };
});

await check("the estimate endpoint prices a real garment", async () => {
  const response = await fetch(`${BASE}/api/estimates`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({
      kind: "ready-made",
      styleSlug: "flor-de-sol",
      sizeId: "m",
      customize: false,
    }),
  });
  const body = await response.json().catch(() => null);
  return {
    ok: response.status === 200 && body?.estimate?.subtotal === 32500,
    detail: `${response.status} subtotal=${body?.estimate?.subtotal ?? "none"}`,
  };
});

const failed = results.filter((result) => !result.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} passed against ${BASE}`,
);
process.exit(failed.length === 0 ? 0 : 1);

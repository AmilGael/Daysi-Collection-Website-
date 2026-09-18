/**
 * Checks a running site end to end over HTTP.
 *
 * This exists because of a real failure: the proxy was handed a rebuilt
 * request object, next-intl swallowed the resulting error in a try/catch, and
 * every redirect quietly stopped working. Type checks passed, tests passed, and
 * every locale-prefixed page still returned 200 — but the bare "/" that people
 * actually type returned a 404. Only a real request finds that.
 *
 *   npm run dev          # in one terminal
 *   npm run smoke        # in another
 */

import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const BASE = process.env.SMOKE_URL ?? "http://localhost:3000";
const base = new URL(BASE);

/**
 * The two hosts the www redirect is checked with.
 *
 * `localhost` cannot stand in for the apex. Strip `www.` from
 * `www.localhost:3000` and you land on the address the server is itself bound
 * to, and Next answers with a *relative* Location — which a browser resolves
 * against `www.` again, i.e. a redirect loop. That is an artefact of testing
 * against localhost, not a fault in the redirect: in production the apex is
 * never the address the container listens on. `localtest.me` resolves to
 * 127.0.0.1, so it reaches the same server while keeping the two hosts
 * genuinely different, the way `daysiscollectioninc.com` and its `www.` are.
 */
const APEX_HOST =
  base.hostname === "localhost"
    ? `localtest.me${base.port ? `:${base.port}` : ""}`
    : base.host;
const WWW_HOST = `www.${APEX_HOST}`;

/**
 * A GET carrying a Host header of our choosing.
 *
 * `fetch` cannot do this and does not say so: `host` is a forbidden header
 * name in the fetch standard, and undici drops it without complaint. The
 * request still goes out — as `localhost` — and still passes, having proved
 * nothing at all. Hence one level down, to node:http.
 */
function getWithHost(path, hostHeader) {
  const target = new URL(path, BASE);
  const send = target.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const request = send(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        method: "GET",
        headers: { Host: hostHeader },
        // TLS is negotiated with the host we dialled, not the one we claim to
        // be, or a real deployment would refuse the handshake.
        servername: target.hostname,
      },
      (response) => {
        response.resume();
        resolve({
          status: response.statusCode,
          location: response.headers.location ?? "",
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

const LOCALES = ["es", "en"];

const PAGES = [
  "",
  "/collection",
  "/collection/medallon",
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
  "/cart",
  "/sign-in",
];

/** Pages that must never render to somebody who is not signed in. */
const PRIVATE = [
  "/account",
  "/account/orders",
  "/office",
  "/office/collection",
  "/office/gallery",
  "/office/premieres",
  "/office/fabrics",
  "/office/prices",
  "/office/shopfront",
  "/office/books",
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

/**
 * One host, so there is one cookie jar. This runs before locale routing in
 * the proxy, and it is the only behaviour here that turns on the Host header
 * rather than the URL, so it is the only one the checks above cannot see.
 *
 * Three things at once: 308 rather than 301 or 302, because that is the
 * redirect that promises a POSTed form survives as a POST; the port intact,
 * which is the bug the proxy's own comment is about — `nextUrl` carries the
 * container's internal port, and a host set without clearing it first sent
 * people to a port nothing answers on; and the path carried over, since a
 * client following a link into www should arrive where she was going.
 */
await check("a www request is sent to the bare host", async () => {
  const { status, location } = await getWithHost("/es/contact", WWW_HOST);
  // Resolved the way the browser would: against the www address it asked for.
  // A relative Location resolves straight back onto www, which is a loop, and
  // this is where that would show up.
  const resolved = location ? new URL(location, `${base.protocol}//${WWW_HOST}`) : null;
  return {
    ok:
      status === 308 &&
      resolved?.host === APEX_HOST &&
      resolved?.pathname === "/es/contact",
    detail: `${status} -> ${location || "(none)"}`,
  };
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

for (const path of PRIVATE) {
  await check(`${path} is not reachable signed out`, async () => {
    const response = await fetch(`${BASE}/es${path}`, { redirect: "manual" });
    const location = response.headers.get("location") ?? "";
    const ok =
      // Signed out: either bounced to sign-in, or simply not there.
      (response.status === 307 && location.includes("/sign-in")) || response.status === 404;
    return { ok, detail: `${response.status} ${location}` };
  });
}

// Trabajo folded into Hub on 14 September 2026; the old address must land
// on the office rather than 404 for anyone who bookmarked it.
await check("the old Trabajo address redirects into the office", async () => {
  const response = await fetch(`${BASE}/es/office/work`, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  return {
    ok: response.status === 308 && location.endsWith("/es/office"),
    detail: `${response.status} -> ${location || "(none)"}`,
  };
});

await check("the cart starts empty and prices nothing", async () => {
  const response = await fetch(`${BASE}/api/cart`);
  const body = await response.json().catch(() => null);
  return {
    ok: response.status === 200 && body?.count === 0 && body?.estimate === null,
    detail: `${response.status} count=${body?.count}`,
  };
});

await check("the cart refuses a garment that does not exist", async () => {
  const response = await fetch(`${BASE}/api/cart`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ action: "add", styleSlug: "free-dress", sizeId: "m", customize: false }),
  });
  return { ok: response.status === 400, detail: String(response.status) };
});

await check("signing in is a POST from this origin only", async () => {
  const response = await fetch(`${BASE}/api/auth/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.invalid" },
    body: JSON.stringify({ email: "someone@example.com", locale: "es", renderedAt: 0 }),
  });
  return { ok: response.status === 403, detail: String(response.status) };
});

await check("a forged sign-in link is refused", async () => {
  const response = await fetch(`${BASE}/api/auth/verify?token=not-a-real-token`, {
    redirect: "manual",
  });
  const location = response.headers.get("location") ?? "";
  // Bounced back to sign-in with an error, and carrying no session cookie.
  const setCookie = response.headers.get("set-cookie") ?? "";
  return {
    ok: location.includes("/sign-in") && !setCookie.includes("daysi_session"),
    detail: `${response.status} ${location}`,
  };
});

/**
 * Nothing from the private store may ever reach a rendered page.
 *
 * This exists because it once did: React's development build records the value
 * of everything a Server Component awaits, and an awaited readFile put the
 * whole sessions and orders file into the HTML of the account page — one
 * client's session hashes visible to another. Reads are synchronous now, and
 * this is what keeps them that way.
 */
const MUST_NEVER_APPEAR = ["tokenHash", "sign-in-links", "expiresAt"];

for (const path of ["", "/collection", "/cart", "/sign-in"]) {
  await check(`/es${path} leaks nothing from the store`, async () => {
    const html = await (await fetch(`${BASE}/es${path}`)).text();
    const found = MUST_NEVER_APPEAR.filter((needle) => html.includes(needle));
    return { ok: found.length === 0, detail: found.join(", ") || "clean" };
  });
}

/**
 * Daysi's number reaches clients through a button and never as type.
 *
 * She asked for that in those words, and a convention alone would not hold it:
 * the digits are one careless `{business.whatsapp}` away from being printed
 * under her name forever. So the pages are read as a visitor gets them, every
 * `wa.me` href is cut out — that is where the number belongs — and the digits
 * must not survive anywhere in what is left, in any of the shapes a person
 * writes a phone number.
 */
const WHATSAPP_SHAPES = [
  "19176887260",
  "9176887260",
  "917 688 7260",
  "917-688-7260",
  "(917) 688-7260",
  "+1 917 688 7260",
];

for (const path of ["/contact", "", "/terms", "/request"]) {
  await check(`/es${path} shows her number to no one`, async () => {
    const html = await (await fetch(`${BASE}/es${path}`)).text();
    // The link is the one legitimate home for the digits; everything else is a leak.
    const withoutLinks = html.replaceAll(/https:\/\/wa\.me\/[0-9]+/g, "");
    const found = WHATSAPP_SHAPES.filter((shape) => withoutLinks.includes(shape));
    return { ok: found.length === 0, detail: found.join(", ") || "not shown" };
  });
}

await check("the contact page still opens WhatsApp", async () => {
  const html = await (await fetch(`${BASE}/es/contact`)).text();
  return {
    ok: html.includes("https://wa.me/19176887260"),
    detail: html.includes("wa.me") ? "link present" : "no wa.me link at all",
  };
});

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

/**
 * The garment named here has to be one that exists. It was `flor-de-sol` until
 * that style and its invented linen were deleted, and this check went on
 * failing for a while afterwards because nothing else referenced the slug.
 *
 * The figure is `dresses--medallon-print` in content/price-list.ts. Pinning it
 * rather than accepting any number is the point: an endpoint that answers 200
 * with the wrong garment's price is the failure worth catching, and repricing
 * a garment is a deliberate act that can update one line here.
 */
await check("the estimate endpoint prices a real garment", async () => {
  const response = await fetch(`${BASE}/api/estimates`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({
      kind: "ready-made",
      styleSlug: "medallon",
      sizeId: "m",
      customize: false,
    }),
  });
  const body = await response.json().catch(() => null);
  return {
    ok: response.status === 200 && body?.estimate?.subtotal === 24000,
    detail: `${response.status} subtotal=${body?.estimate?.subtotal ?? "none"}`,
  };
});

const failed = results.filter((result) => !result.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} passed against ${BASE}`,
);
process.exit(failed.length === 0 ? 0 : 1);

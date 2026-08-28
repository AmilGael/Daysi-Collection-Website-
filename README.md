# Daysi Collection Inc.

The bilingual website and client workflow tools for Daysi Fernández's atelier in
the Bronx: custom garments, alterations at published prices, and small-run
heritage pieces.

Built from PRD v1.3 and the project ERD.

## Running it

```bash
npm install
npm run dev
```

Then open **http://localhost:3000** — it redirects to `/es`, or to `/en` if the
browser asks for English. Both are the same site. If 3000 is taken, `PORT=3001
npm run dev` works too: everything that builds an absolute link (sign-in links,
the QR code) follows the assigned port in development.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server (port 3000, or `PORT`) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Pricing and security tests |
| `npm run smoke` | Checks a running server over HTTP (see below) |
| `npm run typecheck` | TypeScript, no emit |

`npm run smoke` needs a server already running. It exists because routing can
break in a way nothing else catches: next-intl reads `request.nextUrl` inside a
`try/catch` that falls back to doing nothing, so handing it the wrong request
object makes every redirect silently disappear. Types passed, unit tests passed,
and every locale-prefixed page still returned 200 — but the bare `/` that people
actually type returned a 404. Only a real request finds that, so run it before
any deploy.

No environment variables are needed to run it. Copy `.env.example` to
`.env.local` when you are ready to turn on card payments or email notifications.

## The pages

| Route | What it is |
| --- | --- |
| `/` | The story: hero, trust strip, atelier, services, collection, prices, alterations, next premiere, Google Business |
| `/collection` | The gallery, filtered by design and by size, with fixed prices |
| `/gallery` | Eighteen years of finished work — runway, commissions, bridal, accessories, press |
| `/collection/[slug]` | One piece: photography, sizes, customisation, running price |
| `/premieres` | Limited-edition premieres and the sign-up list |
| `/services` | Custom garments, alterations, ready-made |
| `/alterations` | The published alterations price list |
| `/prices` | The whole price list, plus the estimate builder |
| `/design-studio` | Lay a cloth over a silhouette and see a mockup |
| `/appointments` | Book a 30-minute or one-hour session against real availability |
| `/request` | Alteration, order or commission request |
| `/atelier` | Daysi's story, craft and heritage |
| `/contact` | WhatsApp, hours, service area, QR code, contact form |
| `/sign-in` | Ask for a sign-in link — no password anywhere |
| `/account`, `/account/orders` | A client's own orders, alterations and sessions |
| `/cart` | The basket and the till |
| `/office` | Daysi's back office: earnings, the collection and its photos, fabrics, the price list, the books, a site notice, orders, sessions, messages |
| `/terms`, `/privacy` | Terms of service and privacy notice |
| `/checkout/thank-you`, `/checkout/cancelled` | Where Stripe returns the client |

The one workflow that has to work end to end (PRD 6.4) is: open the site in
either language → filter the gallery by design and size → see a fixed price →
submit a request → Daysi is notified with everything she needs. Submit a request
at `/es/request`, then sign in as the owner address and it is waiting in
`/es/office`.

## How it is put together

```
src/
├── content/          The data model, one file per group of ERD entities
│   ├── types.ts        DesignCategory, Size, Fabric, PriceListEntry, GarmentStyle…
│   ├── catalog.ts      Categories, sizes, fabrics
│   ├── price-list.ts   THE price list, plus alterations and session types
│   ├── styles.ts       The gallery
│   ├── premieres.ts    Premieres and the three services
│   ├── silhouettes.ts  Croquis paths for the design studio
│   ├── business.ts     Hours, contact, Google Business
│   └── index.ts        Lookups — everything the pages read goes through here
├── lib/              Logic, none of it in a component
│   ├── pricing.ts      The estimate engine. Every amount is produced here
│   ├── money.ts        Cents, never floats
│   ├── validation.ts   One zod schema per form
│   ├── availability.ts Session slots from opening hours minus what is booked
│   ├── payments.ts     Stripe Checkout sessions and webhook verification
│   ├── security.ts     Origin check, upload checks, reference numbers
│   ├── rate-limit.ts   Fixed-window limiter
│   ├── records.ts      The append-only store every collection shares
│   ├── request-store.ts Where a submission lands, and who may read it
│   ├── auth/           Accounts, sessions, sign-in links — no passwords
│   ├── cart.ts         The signed cart cookie: what, never how much
│   ├── earnings.ts     Cleared money and owed money, kept apart
│   ├── books.ts        The sales file for her accountant, QuickBooks-shaped
│   ├── live-catalog.ts What Daysi has changed about the collection
│   ├── live-pricing.ts What Daysi has changed about the prices and fabrics
│   ├── live-gallery.ts The portfolio seed plus what she has added to it
│   ├── office-validation.ts The shapes the office endpoints accept
│   ├── notify.ts       Email to Daysi, request delivery
│   ├── whatsapp.ts     Pre-filled WhatsApp links (client-safe)
│   └── mockup.ts       Canvas drawing for the design studio
├── messages/         en.json and es.json — every string on the site
├── components/       Presentation only
└── app/[locale]/     Pages, plus app/api for the route handlers
```

Two rules hold the shape:

1. **One price list.** Nothing anywhere hard-codes a dollar figure. Every price
   resolves back to `content/price-list.ts`, so changing a price changes the
   gallery, the price page, the estimate builder and the checkout together.
2. **Prices are produced on the server.** A browser says *what* it wants; the
   server decides what that costs. There is no code path that accepts an amount
   from a client.

## Accounts

**There are no passwords.** A client gives an email, a link arrives, clicking it
signs them in. That removes the largest liability a small site can carry — a
table of password hashes belonging to people who reuse passwords — and removes
the reset flow, which is where hand-rolled auth usually breaks. Signing in is
also signing up; asking someone to choose a flow before they can see their own
order is friction that buys nothing.

Links are single-use, last fifteen minutes, and are stored only as a SHA-256
hash. Session cookies are random tokens, also stored only as a hash, `httpOnly`
and `SameSite=Lax`. A copy of the whole store discloses no way to sign in as
anybody. Without a mail key, development prints the link to the console;
production refuses to print it rather than log a live credential.

**Daysi's office is not a role anyone can be given.** The owner is whoever signs
in with `OWNER_EMAIL`, derived on every read. There is no field on an account
to flip, so a client cannot promote themselves and a second owner cannot be
created by accident. A client who guesses `/office` gets a 404, not a 403 — a
403 confirms there is something there.

**The cart holds what you chose, never what it costs.** It lives in the client's
own cookie so a guest can fill one without an account, and it is HMAC-signed —
but the signature is belt-and-braces: prices come from the published list on
every read, so a tampered cookie can at worst ask for a different garment, never
for a cheaper one. A line naming a garment that does not exist is dropped, so
tampering shrinks the basket rather than discounting it.

**An order belongs to the signed-in account**, not to whatever address was typed
in the form. Verified live: signed in as one client and typing another address
into the email field files the order against the signed-in account, not the
typed one.

## Security

Money is involved, so the boundaries are explicit.

**Card data never reaches this application.** Payments go through Stripe
Checkout, hosted on Stripe's own domain. The browser talks to Stripe directly;
this server only ever sends an amount it calculated and a reference number. That
keeps the application out of the scope that handling card numbers would put it
in, and Apple Pay and Google Pay come with Checkout — the tap-to-pay Daysi asked
for, with no second integration.

**Amounts cannot be tampered with.** `lib/pricing.ts` is the only thing that
produces a number, it reads from the published price list, and every route
re-prices the submission it receives. A request that names a price is ignored;
a garment and cloth pair with no published price is refused rather than guessed.

**Every state-changing request is checked before any work happens**, in this
order: same-origin, rate limit, schema, bot signals. Nothing touches disk or
sends mail until a submission has passed all four.

- *Same origin* — `Origin`, falling back to `Referer`, must match `SITE_URL`.
  Combined with there being no cookie-based authentication anywhere, that closes
  cross-site request forgery without a token round trip.
- *Rate limit* — a fixed window per caller per endpoint (6 requests an hour, 4
  bookings, 5 messages). It exists so one script cannot fill Daysi's inbox.
- *Schema* — one zod schema per form, every string length-capped. Handlers only
  ever see a shape they asked for.
- *Bot signals* — a field kept out of the visual and accessibility trees, and a
  minimum time on the form. Both are checked server-side, and a caught bot gets
  a normal-looking response so it does not learn to retry.

**Uploads are verified by their bytes, not their label.** A photo's first bytes
have to agree with the MIME type it claims; 4 MB cap; JPEG, PNG and WebP only.
A file that fails is dropped and the request still goes through.

**Webhooks are verified before they are parsed.** The Stripe webhook reads the
raw body, checks the signature, and refuses everything if
`STRIPE_WEBHOOK_SECRET` is not set. A forged "payment succeeded" cannot mark an
order paid.

**Content-Security-Policy is nonce-based**, set per request in `middleware.ts`
with `strict-dynamic`. Scripts are limited to this origin and Stripe; frames to
Stripe and the Google map; connections to this origin and Stripe. Plus
`X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, HSTS, and a
locked-down permissions policy.

**Client data stays put.** Submissions are written to a gitignored `.data/`
directory with owner-only permissions (`700` / `600`). Photos are stored beside
the record so one can be deleted on its own. Nothing personal is logged.

The old dev-only `/inbox` is gone: `/office` is the real thing, behind the
owner's sign-in.

## Before launch

**Set `AUTH_SECRET`.** The app refuses to sign with a fallback key in
production, so this is a hard requirement, not a nice-to-have.

**Set `OWNER_EMAIL` to Daysi's real address.** Without it nobody gets the
office, and with the wrong one somebody else does.

**The file-backed store is a seam, not a database.** `lib/request-store.ts`
writes newline-delimited JSON. The pages and route handlers only call
`saveRequest` and `listRequests`, so moving to Postgres, Sanity or Airtable
touches that one file. It works as-is on a single instance; it will not survive
horizontal scaling.

## Placeholder content

Everything below is real content structure with stand-in values, waiting on the
items still outstanding in PRD Section 15.1:

- **Photography.** There is none left that Daysi did not take or sit for. Every
  style, every fabric swatch, both premiere covers, the home hero, the atelier,
  the owner portraits and the twenty-eight gallery works are hers, in
  `public/images/real/`, `public/images/gallery/` and `public/brand/`. The
  generated stand-ins are deleted, and a test in `content/catalog.test.ts`
  states the rule that keeps them out: the atelier offers no cloth it cannot
  show you. The workshop video still `daysi-sewing` is 464px — replace it with
  a frame from a higher-quality export when one exists.

- **The logo** is hers, knocked out of the white paper it was drawn on into
  `public/brand/`. It is a raster trace, so it is soft at very large sizes; a
  vector from whoever drew it would render crisper and is worth asking for.
- **Phone number and email.** The phone uses the reserved 555-01xx range, which
  cannot dial a real person. Set the real ones in `content/business.ts`.
- **Address.** Neighbourhood only, on purpose — the atelier is a private home
  and the full address is sent when a session is confirmed.
- **Google Business Profile.** `googleProfileVerified` in `content/business.ts`
  is `false`, so the site shows a short note instead of a star rating. Flip it
  to `true` once her real listing is connected, and the rating and review count
  come from it.
- **Prices.** Structurally complete and internally consistent, built from the
  July 8 collection notes and the rates discussed in the meetings. The coded
  figures live in `content/price-list.ts`, but Daysi confirms and corrects them
  herself now: the office (`/office`) has an editable price list, and her
  changes land as append-only overrides in `.data/` that every quote on the
  site reads (see `lib/live-pricing.ts`). The same office lets her drop new
  photos onto a piece, add fabrics (swatch photo + per-category prices) to the
  design studio, set stock and visibility per style, pin a site notice, and
  work the request inbox. Uploads land in the gitignored `public/uploads/`.
- **Sales tax.** New York exempts clothing under $110 per item; above that it is
  taxed in full. The rate and threshold are constants at the top of
  `lib/pricing.ts`, and the same `isTaxable` rule stamps the tax code on every
  line of the bookkeeping export, so an invoice and a tax return cannot
  disagree. Confirm both with Daysi's accountant.

## Her story, in her words

The biography copy — `home.storyTitle`, `storyLead`, `storyBody`, `promise`, and
`atelier.craftBody` / `heritageBody` — is drawn from the bio Daysi supplied, and
the quotations in it are hers verbatim. Do not paraphrase them back into
invented atmosphere: the placeholder copy this replaced had her learning to cut
in Santo Domingo, which is the wrong country. She is Honduran, and Garífuna.

The facts the copy rests on: she began sewing at twelve; her father worked a
spinning wheel; the Garífuna are a minority people with their own culture in
Honduras, and that is where the styles, patterns and textiles come from; she
cuts for women of every shape and size; she is a wife, mother, daughter and
sister. The Spanish is an idiomatic rendering rather than a literal one — PRD 7.1
item 3 asks that it read naturally and that **Daysi reviews it herself**, which
has not happened yet.

## Outside services

Every integration here is optional and switches off cleanly when its key is
missing (`lib/env.ts`), so the site runs whole with none of them configured.
Two were considered and deliberately answered differently, because the PRD
(Section 15) commits Daysi to a total ongoing cost of roughly the price of a
domain name — about $12 a year, with nothing else recurring.

- **Stripe** — in use. Per-transaction fees only, no subscription, so it keeps
  that promise. Card data never touches this application; see Security.
- **QuickBooks** — served by an export rather than a subscription. QuickBooks
  Online is about $35 a month, which alone is thirty-five times the yearly
  figure Daysi is being asked to sign off on. The office instead writes the
  artefact bookkeeping actually needs: a line-item sales file in the shape
  QuickBooks' invoice importer expects, which Excel, Google Sheets and any
  accountant read just as happily. See `lib/books.ts`. If she ever does
  subscribe, a live sync is a small addition on top of the same ledger — the
  normalising work is already done.
- **Shopify** — deliberately not integrated. At about $39 a month it would
  duplicate a storefront she already owns outright (gallery, cart, Stripe
  checkout, fixed prices, and the stock controls in the office), and running
  two inventories over garments cut in runs of twelve is how the same piece
  gets sold twice. If she later sells on another channel, the thing to build is
  a one-way product feed out of `live-catalog.ts`, not a second store.

## Editing content

Everything Daysi changes day to day is in `src/content/`, in plain TypeScript
with both languages side by side:

- add a style → `styles.ts`
- change a price → `price-list.ts`
- add a premiere → `premieres.ts`
- change hours or contact → `business.ts`

Missing a translation is a type error rather than a blank space on the page.

When she should be editing this herself rather than a developer doing it, the
`content/` modules map one-to-one onto Sanity document types or Airtable
tables — that was the point of writing them this way.

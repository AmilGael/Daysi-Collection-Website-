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
browser asks for English. Both are the same site.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
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
| `/terms`, `/privacy` | Terms of service and privacy notice |
| `/checkout/thank-you`, `/checkout/cancelled` | Where Stripe returns the client |
| `/inbox` | Every submission, newest first — **development only** |

The one workflow that has to work end to end (PRD 6.4) is: open the site in
either language → filter the gallery by design and size → see a fixed price →
submit a request → Daysi is notified with everything she needs. Submit a request
at `/es/request` and it appears at `/es/inbox`.

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
│   ├── request-store.ts Where a submission lands
│   ├── notify.ts       Email to Daysi, WhatsApp links
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

`/inbox` shows client contact details and has no login, so it refuses to render
outside development. Before it is useful in production it needs real
authentication — or the requests should simply be read from Daysi's email.

## Two things to swap before launch

**`/inbox` needs authentication or removal.** See above.

**The file-backed store is a seam, not a database.** `lib/request-store.ts`
writes newline-delimited JSON. The pages and route handlers only call
`saveRequest` and `listRequests`, so moving to Postgres, Sanity or Airtable
touches that one file. It works as-is on a single instance; it will not survive
horizontal scaling.

## Placeholder content

Everything below is real content structure with stand-in values, waiting on the
items still outstanding in PRD Section 15.1:

- **Photography.** Generated to stand in for Daysi's own pieces while her
  shoot is produced. Consistent framing and lighting throughout, so replacing
  them one at a time will not break the look. Swap the files in
  `public/images/` and the paths in `content/styles.ts`.
- **Phone number and email.** The phone uses the reserved 555-01xx range, which
  cannot dial a real person. Set the real ones in `content/business.ts`.
- **Address.** Neighbourhood only, on purpose — the atelier is a private home
  and the full address is sent when a session is confirmed.
- **Google Business Profile.** `googleProfileVerified` in `content/business.ts`
  is `false`, so the site shows a short note instead of a star rating. Flip it
  to `true` once her real listing is connected, and the rating and review count
  come from it.
- **Prices.** Structurally complete and internally consistent, built from the
  July 8 collection notes and the rates discussed in the meetings. Confirm each
  figure with Daysi before launch — they all live in `content/price-list.ts`.
- **Sales tax.** New York exempts clothing under $110 per item; above that it is
  taxed in full. The rate and threshold are constants at the top of
  `lib/pricing.ts`. Confirm both with Daysi's accountant.

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

# Next session: what is left after office steps 1 to 3

## Context

As of 2026-09-03 the site is live, patched and guarded (CVE-2025-55182 closed, secrets rotated, `npm run deploy` gated by audit, typecheck and tests, Dependabot and a weekly CI cron on `main`). The office rebuild's first three steps are merged: tabbed routes in the header bar (PR #17, #18), a draft with one confirm bar per tab and retire/restore for garments and photos (PR #20), and retire/restore for fabrics, prices and every request kind plus staged undo (PR #21). Steps 1 and 2 are deployed; **step 3 (PR #21) is merged but not yet deployed.**

Two working practices proved out and should continue: Codex CLI as the implementer (`codex exec -s workspace-write -c approval_policy=never`, briefs by file, the controller commits per task because the sandbox cannot write `.git`), with Claude sonnet task reviews and one opus whole-branch review; and one spec (`docs/superpowers/specs/2026-09-02-office-hub-design.md`) amended per step rather than rewritten. Plain-language status lives in `docs/next-steps.md` and must be kept current.

Everything below is ordered by value to Daysi and by risk of a date passing.

## 0. Ship step 3 (first ten minutes, user runs the deploy)

- From `main`: `npm run deploy`, then `SMOKE_URL=https://daysiscollectioninc.com npm run smoke`.
- Signed in as Daysi on production: retire and restore one gallery photo, try to retire a price a garment uses (expect the refusal with the count), change a size and press Deshacer, confirm.
- Update `docs/next-steps.md` "Office steps 2 and 3: done" to say deployed.

## 1. The premieres date bomb (one short task, before October)

`src/content/premieres.ts:24` releases the autumn premiere on 2026-10-06; `upcomingPremiere()` returns undefined the day after, and the premieres page loses its hero, sign-up box and piece list while the home page presents an expired season as "next". Smallest safe fix: make both pages degrade to a "next premiere coming" state when there is no upcoming premiere (copy in both bundles, no em dashes), with a test that pins a date past the release. Adding the next season's entry is Daysi's content decision, not a code fix. One PR.

## 2. Office polish left behind by the reviews (one PR, half a day)

Small, contained, all already scoped in the review outputs recorded in memory:

- Tab strip scrolls the active tab into view on a phone after a tap near the right end (`src/components/office/office-tabs.tsx`, a `scrollIntoView({ inline: "nearest" })` effect on the active link).
- Gallery button labels `gallerySave` / `gallerySaved` still say "Agregar al trabajo" after the heading became "La galería" (both bundles).
- `draft-reducer.ts` `settled`: a change staged during a confirm is marked failed because its key is absent from the results; narrow `settled` to the keys that were sent.
- Gallery and fabric add forms: `createImageBitmap` / `averageColorOf` rejections are unhandled; wrap and show the existing `error.upload-failed` text.
- Shopfront: the provider wraps only the notice, so its bar is not pinned like the other tabs; wrap the whole tab content.
- Deshacer on requests whose second line came from Stripe (`paid`) offers a revert to unpaid that moves money in the books; either filter `request-status` history to lines the office wrote, or add one manual sentence. Decide with the user.
- Record-level undo drops photos added in the same override as a stock tick; at minimum a manual sentence, or make the style-override baseline carry `addedPhotos`.
- `retiredSet` is re-read many times per Work render; a per-request memo (React `cache`) on `retiredSet`.
- The `retired:*` undo kinds are exposed through `readPreviousChange` with no caller; either wire them or drop them from `UNDO_KINDS`.
- The manual's font finding: extend the per-file `overused-font` wildcard in `.impeccable/config.json` to `docs/manual-del-taller.html` only with the user's explicit yes.

## 3. Office step 4: text overrides (about a day, own spec amendment and plan)

The one genuinely new layer from the original design: a `text-overrides` collection keyed by content id holding an ES/EN pair, merged in `applyOverrides` and the gallery/fabric assemblers, so a garment name, description, detail, colour and a gallery caption can be fixed from the office without a deploy. Editing goes through the same draft and confirm bar; undo comes free from the per-stream registry (add a `text-override` stream). Also fixes the monolingual problem: everything Daysi adds gets an ES and an EN field, with the other language pre-filled from the one she typed so nothing is blank. Follow the step 2/3 process: amendment 3 in the spec, Plan agent, executable plan, Codex implementer, reviews.

## 4. Office steps 5 and 6 (later)

- Shopfront tab: hours, holidays, closures and contact facts as forms (today `business.ts` and `availability.ts` drive them from code); a closed day must remove its slots from `availableDays`.
- Premieres editor (season name, dates, pieces), the alterations menu (add or retire a service), session lengths and booking rules.

## 5. Stripe (user-driven, code already complete)

Daysi opens the Stripe account herself; test keys first (`sk_test_`, a webhook on `checkout.session.completed` at `https://daysiscollectioninc.com/api/stripe/webhook`, its `whsec_`), both set in one `fly secrets set` on `daysicollectioninc`, one test purchase with `4242 4242 4242 4242`, then live keys with a separate live webhook and a new `whsec_`. Steps are written in `docs/next-steps.md` and the artifact guide linked there. Nothing to build unless the test purchase surfaces a bug.

## 6. Operations still owed

- Delete the old Google OAuth client secret and the old Resend key in their dashboards (the new ones are live and proven).
- Email forwarding to Daysi's own inbox waits on her clicking the Cloudflare destination verification; then edit both routing rules.
- DMARC from quarantine to reject after a clean month (about 2026-10-01).
- Confirm `fly scale count 1` stays the rule; never a second machine while the store is a single file.

## 7. next-intl advisories (Dependabot, two medium alerts, closes only with the 4.x migration)

Seen on 2026-09-03 when pushing `office-polish`. Both are on `next-intl`, pinned at 3.26.5; every 3.x release is in the vulnerable range and the first patched release is 4.9.2 (`latest` is 4.14.2), so there is no same-line bump. They do not block `npm run deploy`, whose audit gate is `--audit-level=high`.

- GHSA-8f24-v5vv-gm5j (CVE-2026-40299): open redirect in the middleware when `localePrefix` is `as-needed`. `src/i18n/routing.ts` sets `always`, so the stated precondition is not met here; treat as not exploitable as configured, but do not lower the confidence past that without reading the fix.
- GHSA-4c35-wcg5-mm9h: prototype pollution through `experimental.messages.precompile` with attacker-controlled catalog keys. That option is 4.x-only and is not set; the catalogs are the two bundles in the repo, not user input.

What closes them: the next-intl 4.x migration that was deferred (breaking changes in `next-intl/middleware`, the navigation helpers and `getRequestConfig`; read the 4.0 upgrade notes first). Own PR, after item 2 and before or alongside item 3, because step 4's text overrides touch the same message plumbing and should not be written twice. Verification: typecheck, tests, build, the smoke run, and a browser pass of both locales including the `/` to `/es` redirect and a bad-locale 404. Until then, Dependabot will keep the two alerts open and its weekly PR will propose the major bump; close that PR rather than merging it blind.

## Process notes for whoever picks this up

- Never run `fly deploy` directly; `npm run deploy` is the gate. The auto-mode classifier blocks `fly deploy`, `fly secrets set` and `npm run smoke` for the agent; the user runs those.
- Do not run `next build` while the dev server is up; both write `.next`. A dev server started right after a production build issues one hot-update that can bounce the tab to `/es`; reload and continue.
- The browser pane honours the site's HSTS header for `localhost`, so same-origin `fetch` from the page upgrades to https and fails; verify with `curl` from the shell or JS-driven clicks, not page fetches.
- Local owner sign-in: no Resend key locally, so the sign-in link prints to the dev server log; the owner address is in `.env.local`.

## Verification for the next session's first PRs

- Item 1: a test with a clock past 2026-10-06 renders the fallback on both pages; smoke unchanged.
- Item 2: typecheck, tests (289 today), build; browser: the strip scrolls the active tab into view at 375px; a photo added mid-confirm is not marked failed; a corrupt image shows the upload-failed text; the shopfront bar pins.
- Every PR: CI green, one opus whole-branch review, `npm run deploy` by the user, one production click-through as Daysi.

# Where the build is, and what is left

Short words. No jargon. Read top to bottom.

## What is done (as of 2 September 2026, night)

- **Site is live** at daysiscollectioninc.com on Fly. Email works (sign-in links arrive). Google sign-in works.
- **Miner attack fixed.** A bot got in through an old Next.js bug. We patched Next, rotated the three leaked keys, and proved the disk was clean. A guard now stops any deploy that has a known bad package. Dependabot watches for new ones.
- **Deploy is one command.** From the `main` branch: `npm run deploy`. It checks packages, types and tests first. Never run `fly deploy` by hand.
- **Office has tabs.** Hoy, Trabajo, Colección, Galería, Telas, Precios, Vitrina, Libros. The tabs sit in the top bar when Daysi is in the office. On a phone they scroll sideways.
- **Account button is a ring** so it does not look like the cart.
- **Manual for Daysi** (`docs/manual-del-taller.html`) names the tab for each task.

## What is being built now: step 2 of the office

Goal: Daysi changes things, sees them marked as "pendiente", then presses **Confirmar cambios**. Nothing saves before that. **Descartar** throws the changes away.

Order of work (each one is a small commit):

1. The door for saves: a helper that checks it is Daysi, from this site, with a valid body. One place, reused by every tab.
2. The draft: a small piece of code that holds pending changes and a bar at the bottom with Confirmar / Descartar. Tests for it.
3. Retire and restore for garments and gallery photos (nothing is ever deleted; a line says "retired", a later line can say "back").
4. Colección tab: full list, add a garment, tick sizes, publish or hide, retire, restore. All through the draft and the confirm bar.
5. Galería tab: same idea for photos.
6. Precios, Telas, Vitrina, Trabajo tabs: same confirm bar.
7. Old save routes removed; tests updated; manual gets a short "cómo confirmar" note.
8. Push, review, merge, `npm run deploy`, click through once as Daysi.

## Step 3 after that

- Retire and restore for fabrics, prices and orders. A retired appointment frees its time slot.
- Undo: put back the last change (the disk already keeps every old version).

## Stripe: what has to happen for card payments

Cards are the only thing the site does not do yet. The code is done; the keys are missing.

1. **Daysi opens the Stripe account herself.** It must be in her name, with her bank for payouts. Do not open it for her.
2. In Stripe, get the **test** keys first. The secret key starts with `sk_test_`.
3. In Stripe, add a **webhook** pointing at `https://daysiscollectioninc.com/api/stripe/webhook`, listening for `checkout.session.completed`. Stripe gives a signing secret that starts with `whsec_`.
4. Put both on Fly, in one command (paste your own values):

```bash
fly secrets set -a daysicollectioninc STRIPE_SECRET_KEY="sk_test_..." STRIPE_WEBHOOK_SECRET="whsec_..."
```

5. Buy one thing on the site with Stripe's test card `4242 4242 4242 4242`. The order should show as paid in the office.
6. When that works, repeat steps 2 to 4 with the **live** keys (`sk_live_`) and a **new** live webhook with its **own** `whsec_`. Never reuse the test one.
7. Step-by-step guide with pictures: https://claude.ai/code/artifact/386f58d9-cea6-4106-a080-a4e194585df5

## Small things still owed

- Delete the old Google secret and the old Resend key in their dashboards (new ones are already live).
- The autumn premiere ends on 6 October 2026. After that day the premieres page goes empty. Add the next season or make the page say "coming soon" before then.
- Email forwarding to Daysi's own inbox waits on her clicking the Cloudflare verification email.
- DMARC can go from quarantine to reject after a clean month.

## How to hand this to another helper

Point them at three files: this one, `docs/superpowers/specs/2026-09-02-office-hub-design.md` (the design, with the amendment at the end), and `docs/superpowers/plans/` (the task lists). Tell them: never run `fly deploy` by hand, never scale past one machine, and Daysi must confirm before anything saves.

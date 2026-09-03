# Where the build is, and what is left

Short words. No jargon. Read top to bottom.

## What is done (as of 3 September 2026)

- **Site is live** at daysiscollectioninc.com on Fly. Email works (sign-in links arrive). Google sign-in works.
- **Miner attack fixed.** A bot got in through an old Next.js bug. We patched Next, rotated the three leaked keys, and proved the disk was clean. A guard now stops any deploy that has a known bad package. Dependabot watches for new ones.
- **Deploy is one command.** From the `main` branch: `npm run deploy`. It checks packages, types and tests first. Never run `fly deploy` by hand.
- **Office has tabs.** Hoy, Trabajo, Colección, Galería, Telas, Precios, Vitrina, Libros. The tabs sit in the top bar when Daysi is in the office. On a phone they scroll sideways.
- **Account button is a ring** so it does not look like the cart.
- **Manual for Daysi** (`docs/manual-del-taller.html`) names the tab for each task.

## Office steps 2 and 3: done

Daysi changes things, sees them marked "pendiente", then presses **Confirmar cambios**. Nothing saves before that. **Descartar** throws the changes away.

What she can do now:

- Every office tab has one bar at the bottom for confirming or discarding.
- **Retirar / Restaurar** on garments, gallery photos, her own fabric rolls, prices, and everything in Trabajo (orders, alterations, commissions, appointments, messages, sign-ups). A retired piece leaves the site at once and sits under "Retirados" until she restores it. Nothing is ever deleted.
- A fabric or price that a garment on the site still uses cannot be retired; the row says how many garments use it. Retire the garment first.
- A retired appointment frees its hour and leaves the books and the client's account. Restore puts all three back.
- **Deshacer** on any row she has changed (except a card payment Stripe wrote). It puts the earlier version in the list as "pendiente"; she still presses Confirmar. Deshacer twice is a redo.
- The manual has a "Deshacer un cambio" section and the Retirar notes.

Steps 2 and 3 are deployed and live (2 September 2026).

## Office step 4: words, built and awaiting deploy

Fixing a typo used to mean a deploy. Now every garment name, colour, description and detail, and every gallery caption, is hers to correct from the office.

- **Editar textos** on any garment row or gallery photo opens two boxes, Español and Inglés, filled with what the site shows now.
- The two languages are separate. Correcting the Spanish leaves a good English translation alone.
- Emptying a box brings back the words the piece shipped with, so there is a way out of a mistake without remembering what it said.
- **Deshacer** works on each box on its own, staged into the confirm bar like every other change.
- Adding a garment or a photo now asks for both languages. The English copies the Spanish as she types, and stops copying the moment she writes in the English box.
- The manual has a new section 05, "Corregir las palabras de una prenda o una foto"; the later sections moved down one number.

Built on branch `office-step-4`. Not deployed yet.

- **Polish (branch office-polish):** the tab strip follows the active tab on a phone; a photo the browser cannot read says so instead of hanging; the Vitrina bar pins like the others; a change she makes while confirming is not marked failed; Deshacer keeps added photos, and never offers a payment that Stripe wrote (older status lines offer it again only after she changes them).

## What could come next (not started)

- Shopfront: hours, holidays and the premiere season as forms instead of code.
- Text overrides: fix a garment's description from the office instead of a deploy.

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
- The autumn premiere ends on 6 October 2026. The pages now say the next premiere is coming after that day (live since 2 September 2026); adding the next season is still Daysi's call.
- Pictures load faster since 2 September 2026: they are WebP now and stay cached across deploys.
- Email forwarding to Daysi's own inbox waits on her clicking the Cloudflare verification email.
- DMARC can go from quarantine to reject after a clean month.

## How to hand this to another helper

Point them at three files: this one, `docs/superpowers/specs/2026-09-02-office-hub-design.md` (the design, with the amendment at the end), and `docs/superpowers/plans/` (the task lists). Tell them: never run `fly deploy` by hand, never scale past one machine, and Daysi must confirm before anything saves.

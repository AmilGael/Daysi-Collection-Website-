# Where the build is, and what is left

Short words. No jargon. Read top to bottom.

## What is done (as of 3 September 2026)

- **Site is live** at daysiscollectioninc.com on Fly. Email works (sign-in links arrive). Google sign-in works.
- **Miner attack fixed.** A bot got in through an old Next.js bug. We patched Next, rotated the three leaked keys, and proved the disk was clean. A guard now stops any deploy that has a known bad package. Dependabot watches for new ones.
- **Deploy is one command.** From the `main` branch: `npm run deploy`. It checks packages, types and tests first. Never run `fly deploy` by hand.
- **Office has tabs.** Hoy, Trabajo, Colección, Galería, Telas, Precios, Vitrina, Libros. The tabs sit in the top bar when Daysi is in the office. On a phone they scroll sideways.
- **Account button is a ring** so it does not look like the cart.
- **Manual for Daysi** (`docs/manual-del-taller.html`) names the tab for each task.

## Step 2 of the office: done, waiting to ship

Daysi changes things, sees them marked "pendiente", then presses **Confirmar cambios**. Nothing saves before that. **Descartar** throws the changes away. Leaving a tab with pending changes asks once.

What is in it:

- Every office tab (Colección, Galería, Telas, Precios, Vitrina, Trabajo) has one bar at the bottom for confirming or discarding.
- Garments and gallery photos can be added, **retired** and **restored**. A retired piece leaves the site at once; it sits under "Retirados" until she restores it. Nothing is ever deleted.
- Photos upload only when she confirms, so a discarded draft uploads nothing.
- The old save routes are gone; one guarded action per tab does all the saving.
- The manual explains the bar under "Cómo entrar" and the Retirar/Restaurar steps.

To ship it: merge the pull request "Office: nothing saves until she confirms", then from `main`:

```bash
npm run deploy
```

Then sign in as Daysi once, change a size, confirm, and check the garment page shows it.

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

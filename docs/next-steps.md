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

**Where a correction does not reach yet.** The words layer covers the collection pages, the gallery and the office. Four places still read the coded catalog directly, so a corrected name does not appear in them: the browser tab title and meta description on a garment page, the cart line, the Stripe checkout line, and the request email. The premieres page is the same. This is an older seam, not something this change introduced, and it affects garments Daysi added in exactly the same way. Worth its own small pass.

Built on branch `office-step-4`. Not deployed yet.

- **Polish (branch office-polish):** the tab strip follows the active tab on a phone; a photo the browser cannot read says so instead of hanging; the Vitrina bar pins like the others; a change she makes while confirming is not marked failed; Deshacer keeps added photos, and never offers a payment that Stripe wrote (older status lines offer it again only after she changes them).

## What could come next (not started)

- Shopfront: hours, holidays and the premiere season as forms instead of code.
- Text overrides: fix a garment's description from the office instead of a deploy.

## Stripe: what has to happen for card payments

Cards are the only thing the site does not do yet. The code is done; the keys are missing.

The test purchase happens on the helper's own computer first, so the live site is never
pretending to take money. A real visitor buying something during a test would get a checkout
that charges nothing.

1. **Daysi opens the Stripe account herself.** It must be in her name, with her bank for
   payouts. Do not open it for her. While she is in there: set the name that shows on a card
   statement (DAYSI COLLECTION), turn on the receipt email for successful payments, and
   **leave Tax switched off**. The site works out New York sales tax itself and it is already
   inside the amount charged. Switching Stripe's on would charge it twice.
2. **The helper tests on their own computer, with their own practice Stripe account.** Daysi's
   account is only ever used for real money. Nothing on the live site changes while this is
   happening.
3. Install Stripe's command line tool and sign in to the practice account:

```bash
brew install stripe/stripe-cli/stripe && stripe login
```

4. Start the site in one terminal, and Stripe's listener in another:

```bash
npm run dev
```

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

5. The listener prints a secret starting with `whsec_`. Put it in `.env.local` next to the
   practice key, along with the site address:

```
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_...the one the listener printed"
SITE_URL="http://localhost:3000"
```

   **Then stop the site and start it again.** Keys are read once when it starts, so nothing
   happens until it is restarted. This is the step that most often looks broken.

6. Buy the Amapola shirt in size S with Stripe's test card `4242 4242 4242 4242`, any future
   expiry date, any three digits. The charge should read **exactly $105.00**, the listener
   should show `checkout.session.completed`, and the order should show as **Pagado** in
   Trabajo. Any other amount means something added tax twice.

   Buy it on the site. A fake payment made from inside Stripe's own tools has no order number
   attached, so nothing will change and that is correct.

7. When that works, take Daysi's **real** keys. In her Stripe account, add a webhook pointing
   at `https://daysiscollectioninc.com/api/stripe/webhook`, listening for
   `checkout.session.completed`. It gives its **own** signing secret. Never reuse the practice
   one, and never put a practice key on the live site.

8. Put both on Fly, in one command (paste your own values):

```bash
fly secrets set -a daysicollectioninc STRIPE_SECRET_KEY="sk_live_..." STRIPE_WEBHOOK_SECRET="whsec_..."
```

9. Buy one small real thing with a real card, check it says Pagado, then give the money back in
   Stripe.

**If she gives money back.** A refund is done in Stripe. The site does not hear about it, so
the order still says Pagado. Open Trabajo, set that order to **Cerrado**, and press Confirmar.
Otherwise the money still counts as received in Libros. The order number is written on the
charge in Stripe, so it is easy to find the right row.

10. Step-by-step guide with pictures: https://claude.ai/code/artifact/386f58d9-cea6-4106-a080-a4e194585df5

## Small things still owed

- Delete the old Google secret and the old Resend key in their dashboards (new ones are already live).
- The autumn premiere ends on 6 October 2026. The pages now say the next premiere is coming after that day (live since 2 September 2026); adding the next season is still Daysi's call.
- Pictures load faster since 2 September 2026: they are WebP now and stay cached across deploys.
- Email forwarding to Daysi's own inbox waits on her clicking the Cloudflare verification email.
- DMARC can go from quarantine to reject after a clean month.

## How to hand this to another helper

Point them at three files: this one, `docs/superpowers/specs/2026-09-02-office-hub-design.md` (the design, with the amendment at the end), and `docs/superpowers/plans/` (the task lists). Tell them: never run `fly deploy` by hand, never scale past one machine, and Daysi must confirm before anything saves.

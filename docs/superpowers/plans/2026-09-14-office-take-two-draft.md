# Office, take two: draft direction and open questions

**Status: draft, 14 September 2026. Nothing here is built. It waits on the nine answers at the end.**

Gamaliel walked the office on 14 September and found it a picture of what it could be rather than the simple thing Daysi needs. This document checks each of his observations against the code as it runs today (verified locally, signed in as the owner, on a desktop and a phone viewport), proposes the shape the office should take, and lists the questions whose answers change what gets built.

## 1. What was said, and what is actually there

| You said | What the code does today | So |
| --- | --- | --- |
| She cannot upload or replace the collection's pictures | Every garment row has "Agregar una foto". It uploads, then a browser pop-up asks "¿Usar esta foto como portada?". But the photos the site shipped with can never be removed, replaced or reordered: the office can only add on top and pick a cover (`StyleOverride` carries `addedPhotos` and `coverSrc`, nothing else). She also cannot see a garment's photos, only a 3 rem thumbnail and "2 fotos". | Half right. Adding works; managing does not. Build full photo control. |
| She cannot add garments to the design studio | True. The studio paints a fabric onto five garment drawings that live in code (`src/content/silhouettes.ts`, hand-authored vector panels). No office screen touches them. Fabrics, by contrast, are already hers: the fabric wall feeds the studio. | Right. Needs a decision on what "adding a garment" means (question 5). |
| She cannot change a price and confirm with one button | Precios: typing in a box stages a change; a bar pins to the bottom reading "1 cambio sin confirmar" with Descartar and Confirmar cambios. Works on a phone. What is wrong is the presentation: about thirty rows with two boxes each, and on a phone a tap lands the cursor mid-number (typing 1 into 195.00 produced 1915.00). | The button exists. The boxes are the problem. |
| A confirm button bottom-right, and a warning on leaving the tab | Both live on every tab since 2 September (PR #20). The bar appears with one or more changes; a tap on another tab asks "Tiene cambios sin confirmar. ¿Salir de todos modos?"; closing the browser asks too. | Done. Question 7 asks whether the button should be visible all the time. |
| Hoy and Trabajo should be one tab | Two pages today. Hoy: four figures and six-month bars. Trabajo: orders and alterations, sessions, messages, the premiere list. | Agreed, and cheap. Question 1 for the name. |
| The Spanish/English boxes in Colección are crazy | "Editar textos" opens eight boxes per garment (four fields, two languages). The add-a-garment form is eight text boxes, three pickers, three size ticks and a file picker. | Agreed. Question 3 decides where English comes from. |
| The boxes in Telas | Add-a-bolt: name, swatch, then four price boxes, one per garment type. | Agreed. Question 9. |
| The price list for cloth is fine for now | Kept as a list. | Keep, with the phone typing fix. |

## 2. The shape I propose

One principle: **Daysi's office is a phone app.** Lists show; a sheet edits. One thing per screen. Spanish first. Photos big.

Tabs go from eight to seven:

- **Hoy** (or the name from question 1): the money figures, then what needs her (new orders, sessions this week, unread messages), then the premiere list. Trabajo folds in here.
- **Colección**: garment cards with the cover photo, name, price, sizes and shown/hidden. Tap a card and a sheet slides up: the photos, large (add, remove, drag to order, mark the cover); the words, in Spanish; sizes as on/off switches; shown/hidden; retirar. One "Listo" closes the sheet. The bar at the bottom confirms, exactly as today.
- **Galería**: a grid of photos with a "+" tile. Tap a photo for its sheet (caption, shown, retirar).
- **Telas**: a grid of swatches with a "+" tile. Tap a swatch for its sheet (name, swatch, and the garment types as a short list, each "se ofrece" with a price or "no se ofrece").
- **Precios**: the list stays. A tap selects the whole number and opens a number keypad; no more cursor in the middle of 195.00.
- **Vitrina** and **Libros**: unchanged.
- **Confirmar / Descartar** bar: unchanged on every tab. Question 7 may make it always visible.
- **Design studio**: per question 5.

Data changes are small: the garment override gains a photo order (which covers removal and reordering of shipped photos); the studio shapes gain an on/off and name override if question 5 chooses the pre-drawn set. Every existing record keeps working.

## 3. Nine questions

Answer each with a letter, or a word.

1. **The first tab's name.** (a) Hoy, keep it and put the work under it. (b) Taller. (c) Inicio. (d) Hub. I recommend (a): shortest, already in the manual.
2. **Phone or computer?** Does Daysi mostly open the office on her phone or on a computer? My guess is phone, and the design above assumes it.
3. **Where English comes from.** (a) Written automatically by a translation service; she never sees an English box; a "ver inglés" link shows it. A few dollars a month, needs an account. (b) English simply copies the Spanish; no boxes, no cost; English visitors read Spanish words until someone fixes them. (c) Keep both boxes, hide English behind a tap. I recommend (a).
4. **Photos on a garment.** Add, remove any photo including the shipped ones, drag to order, mark the cover. Is that everything, or does she also need to crop? I recommend the four verbs and no cropping; her phone's photo app crops.
5. **What "adding a garment to the design studio" means.** (a) We draw a set of about a dozen shapes once (dresses, skirts, pants, shirts, jackets, head wraps); she turns them on and off and names them; the price comes from the price list. (b) She uploads a photo of a garment and the studio shows the fabric beside it, not painted onto it. (c) Every new shape is drawn to order by a developer. I recommend (a), with (c) as the fallback for a shape not in the set.
6. **How a price is changed.** (a) Keep the list of boxes, fix phone typing. (b) Prices as plain text; tap one and a big number pad opens, one price at a time. I recommend (a); you said the list is fine for now.
7. **The confirm button.** (a) Appears only once something changed, as today. (b) Always at the bottom right, greyed until there is something to confirm. I recommend (b).
8. **A helper inside the office.** (a) Not now; make the screens simple enough not to need one. (b) A "¿Cómo hago…?" panel with the manual's steps, no AI. (c) An AI chat that answers from the manual; a small cost per question, needs an account. I recommend (a) now and (b) in the same release; (c) only if she still asks for help after a month with the new screens.
9. **Fabric prices.** Does a fabric really cost a different amount made into a dress, pants, a shirt or a heritage piece (four prices), or is it one price per fabric? If four, the sheet shows a short list with "no se ofrece" instead of four boxes.

## 4. Parked, not forgotten

Public-site items raised in the same walk, to plan separately:

- Terms and conditions shown before payment.
- Alterations on the home page as a collapsible list with every service and its price, instead of a scroll to the bottom.
- Emails when people finish (the sentence was cut off; to be captured).

## 5. One housekeeping item

There is a second full copy of the repository inside the project folder: `Daysi-Collection-Website-/Daysi-Collection-Website-/`, 756 MB, with its own `.git`, untracked, dated 9 September. Nothing uses it. It should be deleted, but not without the owner's say-so.

## 6. How the work would go

Each step is its own pull request, deployed as it lands, manual updated with it.

1. Merge Hoy and Trabajo; rename per question 1. Half a day.
2. Colección as cards and a sheet, with full photo control. The big one: two to three days.
3. Words: one language on every form, English per question 3. One day.
4. Telas as a grid and a sheet. One day.
5. Precios phone typing fix. Half a day.
6. Design studio shapes per question 5. Two days for (a).
7. Manual (`docs/manual-del-taller.html`) and `docs/next-steps.md` updated at each step.

Spec to follow at `docs/superpowers/specs/` once the questions are answered, as an amendment to `2026-09-02-office-hub-design.md`.

## Answers, 14 September 2026

1a Hoy · phone · 3a automatic translation · no cropping · 5a a drawn set of shapes · 6a keep the list · 7b bar always visible · 8a no helper · four fabric prices.

The design that follows from them is Amendment 4 of `docs/superpowers/specs/2026-09-02-office-hub-design.md`.

<!-- Produced by a 12-agent audit of this site against the scrollcraft taste
floor (github.com/nateherkai/scroll-craft), then judged through a client, a
craft and an engineering lens. Part A is implemented on the `premium-pass`
branch, except A10's logo mask, which is deferred — see the PR. Part B is not
implemented: it changes the site's visual identity and is Daysi's call. -->

# SPECIFICATION — Premium pass, Daysi Collection

Branch off `make-the-site-hers`. Every item below is CSS custom properties, class strings, or deletions. Nothing touches `src/lib/live-pricing.ts`, `src/lib/records.ts`, Stripe, auth, or any `api/` route. No new images, no paid service, no AI imagery.

**Verification gate for every item:** `npm run build` clean, `npx tsc --noEmit` clean, and a manual pass at 390px and 1440px in **both** `/en` and `/es` before the commit lands. Items marked **[MEASURE]** additionally require a computed-contrast check on the named element's own bounding box, not on a nearby region.

---

## PART A — ship now, no client approval

Ordered by impact-per-unit-of-risk. Items A1–A5 are pure defect repair. A6–A9 are craft corrections that cannot look like a redesign. A10 is the one visible change in Part A and is placed last in the sequence deliberately.

---

### A1. `.reveal` hides the entire site without JavaScript

**Risk: none. Impact: 81 routes currently render blank below the fold to a no-JS client.**

`src/app/globals.css:139-145` sets `opacity: 0` unconditionally. The comment at `src/components/reveal.tsx:11-13` claims a fallback exists; it does not — the guard at `reveal.tsx:21-24` catches a missing `IntersectionObserver`, not absent scripting.

Add to `globals.css`, immediately after the `.reveal` block:

```css
@media (scripting: none) {
  .reveal { opacity: 1; transform: none; }
}
```

And correct the wrong comment at `reveal.tsx:11-13`. Replace it with:

```
 * Without JavaScript this component never runs. The CSS would leave every
 * revealed section at opacity 0, so globals.css carries a `scripting: none`
 * block that unhides them. The guard below is for a browser that runs JS but
 * lacks IntersectionObserver — a different failure, handled separately.
```

Commit this alone, first.

---

### A2. Delete the false photography disclaimer

**Risk: none. Impact: removes an untrue sales objection printed under the whole catalogue, in both languages, on the one point the client cared about.**

`src/components/collection-gallery.tsx:148-150` renders `common.placeholderImagery`: *"Photography in progress. These images stand in for Daysi's own pieces while her shoot is produced."* This contradicts `src/content/styles.ts:9-11`, which is correct: every style is one of her own garments.

1. Delete the block at `collection-gallery.tsx:148-150`.
2. Delete the `placeholderImagery` key from `src/messages/en.json:51` and `src/messages/es.json:51`.
3. Grep `placeholderImagery` across `src/` and delete any remaining reference.

---

### A3. The focus system

**Risk: low (CSS + class strings). Impact: WCAG 2.4.7 failure on the checkout path and inside Daysi's own till.**

Three compounding faults, all verified:

- `globals.css:65-69` sets `outline: 2px solid var(--color-ink)`. On `site-footer.tsx:33` (`bg-ink`, present on all 81 routes), the hero, `PricePromise`, the atelier and premieres heroes, and the lightbox, that is **1.00:1**.
- `focus:outline-none` appears exactly **11 times** — `form.tsx:14`, `fabric-manager.tsx:141,184`, `gallery-manager.tsx:156,174`, `books-export.tsx:98,110`, `style-composer.tsx:194,253`, `price-manager.tsx:177`, `notice-editor.tsx:54`. Tailwind's utilities layer beats `@layer base`, so the base ring never renders on any input on the site.
- `price-manager.tsx:177` and `style-composer.tsx:194` are borderless inputs with **no replacement indicator at all**; their border lives on a parent `<span>` (`price-manager.tsx:161`) and `grep focus-within src/` returns nothing.

**A3.1 — two-stop accent token.** In `globals.css` `@theme`:

```css
  --color-focus: #825E07;
```

Then in `@layer base`, replace the block at `globals.css:65-69`:

```css
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
  border-radius: 1px;
}
```

And in `@layer components`:

```css
/* Dark grounds. The ring restates its own colour on the subtree, because a
   ring inherited from :root would be invisible here. */
.on-ink { --color-focus: #EFB01A; }
```

Measured: `#825E07` on `#fbf8f2` = **5.46:1**; `#EFB01A` on `#14110d` = **9.68:1**. Both clear the 3:1 required for a focus indicator with margin.

**A3.2 — apply `.on-ink` at exactly five sites:**

| file:line | element |
|---|---|
| `src/app/[locale]/page.tsx:52` | hero section |
| `src/app/[locale]/page.tsx:283` | PricePromise band |
| `src/app/[locale]/atelier/page.tsx:63` | craft/heritage band |
| `src/components/gallery-wall.tsx:133` | lightbox root |
| `src/components/site-header.tsx:87` | header, in the `isOverPhotograph` branch only |

Also add `.on-ink` to `src/components/site-footer.tsx:33`.

**A3.3 — delete all 11 `focus:outline-none`.** Do not convert them to `focus-visible:outline-none`. Delete them outright and keep whatever `focus:border-ink` already accompanies them as an additional resting cue.

**A3.4 — the two bare wrappers.** `price-manager.tsx:161`, currently:

```
className="flex items-center border border-line bg-paper px-2"
```

becomes:

```
className="flex items-center border border-line bg-paper px-2 focus-within:border-ink"
```

Apply the identical treatment to the wrapper around `style-composer.tsx:194`.

---

### A4. "Saved" and "Error" stop sharing a swatch, and the error stops failing contrast

**Risk: none. Impact: a customer who mistypes a phone number in the booking or alterations form currently gets an error at 3.75:1, in the same yellow-brown Daysi's dashboard uses for "saved".**

`src/components/form.tsx:50` renders every validation error on the site as `text-[0.8125rem] text-marigold-deep`. 13px is small text and needs 4.5:1; `#a97600` on `#fbf8f2` is **3.75:1**, and inside a `bg-paper-warm` panel **3.35:1**. The identical class is the success string at `price-manager.tsx:193`, `fabric-manager.tsx:200`, `gallery-manager.tsx:187`, `style-composer.tsx:241`, `collection-manager.tsx:107,117`.

**A4.1 — repoint `--color-marigold-deep` so it is text-capable.** In `globals.css` `@theme`:

```css
  --color-marigold-deep: #825E07;   /* was #a97600 */
```

Measured: 5.46:1 on `paper`, 4.99:1 on `paper-warm`. This is a single-token change; it fixes the four office success strings and the five `text-marigold-deep` status strings by token move alone. `--color-marigold` (`#e8a302`) is **not** touched here — that is a Part B decision.

Check the one place `marigold-deep` is a *hover fill* rather than text: `ui.tsx:24` `hover:bg-marigold-deep hover:text-paper`. `#fbf8f2` on `#825E07` = 6.52:1. Passes.

**A4.2 — a distinct alert hue.** In `globals.css` `@theme`:

```css
  --color-alert: #9c2f18;   /* 6.99:1 on paper, 6.25:1 on paper-warm */
```

`form.tsx:50` → `text-[0.8125rem] text-alert`.

Leave the office success strings on `text-marigold-deep`. After A4.1 they pass, and they are now a different hue from errors.

**A4.3 — control edges.** `form.tsx:14` is `border border-line bg-paper` inside `bg-paper-warm` panels (`request-form.tsx:143`, `alterations/page.tsx:68`). Measured, the field edge is **1.25:1** against its panel. Add to `@theme`:

```css
  --color-line-strong: #8e8471;   /* 3.48:1 on paper, 3.11:1 on paper-warm */
```

`form.tsx:14` → `border-line-strong` (keep `--color-line` for rules; do not change `globals.css:132` `.rule`).

Same line, the placeholder: `placeholder:text-ink-faint/60` composites to **2.48:1** and carries format hints on a booking form. → `placeholder:text-ink-faint` (5.56:1).

---

### A5. Name the dark ground — 28 alphas, 9 values, 3 contrast failures

**Risk: low. Impact: the footer column headings on every page, the legal and credit lines, and the premieres reveal/release dates all fail contrast today.**

Verified: `text-paper/NN` appears exactly 28 times across exactly 9 values (`/35`×2, `/40`×1, `/45`×4, `/50`×3, `/60`×3, `/65`×1, `/70`×8, `/75`×5, `/80`×1). Compositing paper over ink destroys the tint:

```
text-paper/45 → rgb(124,121,116)  S ≈ 3%   4.34:1  FAIL
text-paper/40 → rgb(112,109,105)  S ≈ 3%   3.68:1  FAIL
text-paper/35 → rgb(101, 98, 93)  S ≈ 4%   3.09:1  FAIL
```

Add to `@theme`:

```css
  --color-paper-soft:  #bab3a0;   /* 8.99:1 on ink — body on dark   */
  --color-paper-faint: #908b7f;   /* 5.51:1 on ink — labels on dark */
```

Then, mechanically, across all 28 sites:

| current | becomes |
|---|---|
| `text-paper/80`, `/75`, `/70`, `/65` | `text-paper-soft` |
| `text-paper/60`, `/50`, `/45`, `/40`, `/35` | `text-paper-faint` |

Known sites, all of which must be checked off: `site-footer.tsx:34,38,42,45,69,89,99`; `premieres/page.tsx:48,52,57,59,65`; `ui.tsx:25,127`; `page.tsx:68,196,202`; `atelier/page.tsx:37,39,67,75`; `gallery-wall.tsx:137`; `style-order-panel.tsx`; `language-switch`. Grep `text-paper/` after the pass and confirm zero remain.

**Do not** batch-convert `border-paper/NN` or `bg-paper/NN` in this item — those are borders and fills, not text, and `ui.tsx:26` `tone="ghost"` (`border-paper/45 text-paper`) depends on the border alpha. Leave them.

---

### A6. Motion — the curve, the press, and five real defects

**Risk: low. Impact: 25 of 39 transitions currently run an ease-in-out; nothing on the site has press feedback.**

**A6.1 — one place fixes 25 transitions.** In `globals.css` `@theme`, replace `--ease-soft` at `globals.css:36` and add two defaults:

```css
  --ease-soft: cubic-bezier(0.23, 1, 0.32, 1);
  --default-transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
  --default-transition-duration: 150ms;
```

Then `ui.tsx:15` `duration-300` → `duration-150`, and `form.tsx:237` `transition-all duration-300` → `transition-[background-color,border-color,color,transform] duration-150`.

**A6.2 — press feedback.** `grep 'active:'` returns 2 hits, both TypeScript prop names. There is none. Add to `buttonBase`, `ui.tsx:15`:

```
active:scale-[0.97]
```

and widen its transition property list to include `transform`. Then the six hand-rolled pressables: `site-header.tsx:166`, `gallery-wall.tsx:218`, `gallery-wall.tsx:242`, `form.tsx:237`, `account-menu.tsx:60`, `account-menu.tsx:77` — same class. Gallery tiles at `gallery-wall.tsx:105` take `active:scale-[0.99]` on the **wrapper**, not the image.

**Exception:** `design-studio.tsx:129` and `:173` already use `scale-95`/`scale-90` as their *selected* state. Use `active:brightness-95` there, not a scale.

**A6.3 — gate hover.** `grep '(hover: hover)'` returns zero. Tapping a gallery tile currently fires a 1.2s zoom and a caption veil that stick behind the lightbox opening simultaneously. Add to `@layer components`:

```css
@media (hover: none), (pointer: coarse) {
  .photo-hover { transform: none !important; }
  .photo-hover-veil { opacity: 0 !important; }
}
```

Apply `.photo-hover` to the transformed `<Image>` at `gallery-wall.tsx:115`, `style-card.tsx:38`, `page.tsx:192`; `.photo-hover-veil` to the hover-revealed caption at `gallery-wall.tsx:117-122`.

Same pass: `duration-[1.2s]` → `duration-[600ms]` at all three sites. Sweeping the home 3-up currently leaves three tiles mid-zoom and none resolved.

**A6.4 — stop animating forbidden properties.**

| file:line | current | replacement |
|---|---|---|
| `site-header.tsx:111` | `width: 0 → 100%` | `origin-left scale-x-0 → scale-x-100`, `transition-transform` |
| `gallery-wall.tsx:200` | `width: 0 → 100%` | same |
| `site-header.tsx:172` | `top: 0 → 0.375rem` | `translate-y-0 → translate-y-1.5` |
| `site-header.tsx:177` | `top: 0.75rem → 0.375rem` | `translate-y-3 → translate-y-1.5` |

**A6.5 — the sticky header.** `site-header.tsx:85` is `transition-all duration-500` on a `sticky` node that swaps `background-color`, `border-color`, `color` **and** `backdrop-filter: blur(12px)`. →

```
transition-[background-color,border-color,color] duration-300
```

Toggle `backdrop-blur-md` without transitioning it. Then the remaining `transition-all` at `page.tsx:192`, `design-studio.tsx:129`, `gallery-wall.tsx:200` get explicit property lists.

**A6.6 — overlays stop hard-cutting.** In `globals.css`:

```css
@keyframes surfaceIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: none; }
}
.surface-in { animation: surfaceIn 0.18s var(--ease-soft) both; }
```

`.surface-in` on the lightbox at `gallery-wall.tsx:133`. For the dropdown at `account-menu.tsx:85`, use a variant with `scale(0.95)` and `transform-origin: top right`.

**A6.7 — `scrollbar-gutter`.** `site-header.tsx:74` and `gallery-wall.tsx:62` both set `document.body.style.overflow = "hidden"`, which shifts the whole page ~15px sideways on every desktop menu and lightbox open. At `globals.css:40-43`, the `html` rule gains `scrollbar-gutter: stable;`.

**A6.8 — reduced motion is NOT changed.** See Rejected.

---

### A7. Browser surfaces

**Risk: none. Impact: `/office` and `/appointments` carry 3 `type="date"` and 4 `type="number"` inputs whose native chrome is currently undeclared, and every input on the site blinks the macOS default `#000` caret on a site whose own header comment forbids pure black.**

Three of six are already correct and stay: selection (`globals.css:71-74`), `tabular-nums` (27 sites), `accent-ink` (13 sites). Add the other three to `@layer base`:

```css
html {
  color-scheme: light;
  scrollbar-color: var(--color-line) var(--color-paper);
  scrollbar-width: thin;
}
body { caret-color: var(--color-marigold-deep); }
a, .underline { text-underline-offset: 0.18em; text-decoration-thickness: 1px; }
```

(`scrollbar-gutter: stable` from A6.7 goes in the same `html` rule.)

---

### A8. Type — tokens only, zero call-site migration

**Risk: low. Impact: seven `h2`s currently render at exactly 56px in the same face, ink and interval on every page below the hero; the site has no secondary. And the Spanish hero sets in three lines on a phone.**

Do **not** migrate the 253 hand-picked sizes. This item is `globals.css` plus one class swap.

**A8.1 — add the missing rung and the missing tracking.** In `@theme`, `globals.css:25-34`:

```css
  --text-display: clamp(2.75rem, 7vw, 6rem);
  --text-display--line-height: 0.95;
  --text-display--letter-spacing: -0.035em;

  --text-title: clamp(2rem, 4.2vw, 3.5rem);
  --text-title--line-height: 1.04;
  --text-title--letter-spacing: -0.025em;

  /* NEW rung. PageHeader h1 keeps --text-title; SectionHeading h2 drops here,
     which is what gives every interior page a visible primary. */
  --text-section: clamp(1.6rem, 2.8vw, 2.4rem);
  --text-section--line-height: 1.1;
  --text-section--letter-spacing: -0.02em;

  --text-heading: clamp(1.4rem, 2.2vw, 1.95rem);
  --text-heading--line-height: 1.18;
  --text-heading--letter-spacing: -0.015em;   /* was absent entirely */

  --text-lead: clamp(1.075rem, 1.5vw, 1.3rem);
  --text-lead--line-height: 1.55;
  --text-lead--letter-spacing: -0.006em;
```

**A8.2 —** `src/components/ui.tsx:135`: `text-title` → `text-section`.

**A8.3 — the Spanish hero step-down.** Measured at 390px in a 342px column with `text-balance` on: EN sets 2 lines / 84px, ES sets **3 lines / 125px**. 36px is the largest size at which the Spanish string holds two lines; 2.25rem is the safe step below. Tailwind v4 compiles `.text-display` to `font-size: var(--text-display)` against `:root`, and an unlayered `:root` rule beats a layered one, so this re-renders the hero with **zero component edits**:

```css
@media (max-width: 699px) {
  :root {
    --text-display: 2.25rem;
    --text-display--line-height: 1.0;
    --text-display--letter-spacing: -0.02em;
  }
}
```

**A8.4 — two base declarations that cover every heading and paragraph on the site.** Today 8 of 41 headings and 2 of ~200 paragraphs carry these. In `@layer base`, extend the existing `h1, h2, h3, h4` rule at `globals.css:56-62`:

```css
h1, h2, h3, h4 { text-wrap: balance; }
p, li, dd, blockquote { text-wrap: pretty; }
```

Then delete the eight per-element `text-balance` classes.

**A8.5 — measure, targeted not global.** Do **not** put `max-width` on bare `p` in `@layer base` — it clamps `cart-view.tsx`, the `office/page.tsx` stat cards, `request-list.tsx` rows, and every `<dd>` in the Alterations price list at `page.tsx:262-270`, silently. Instead:

- `ui.tsx:137` (`Prose`) already has `max-w-2xl`. Leave it.
- `atelier/page.tsx:67` and `:75` — add `max-w-[68ch]`. These are the real failure: **92ch at a 1023px viewport**, light-on-dark, in the 853–1023px window where the `lg` grid has collapsed but the shell is still 927px.
- `page.tsx:328`, `services/page.tsx:73`, `premieres/page.tsx:79`, `collection/[slug]/page.tsx:133` — same `max-w-[68ch]`.

**A8.6 — the monospace reference code.** `office-request-list.tsx:66` and `request-list.tsx:39` are the only unstyled system-stack type on the site. `font-mono text-[0.75rem]` → `text-[0.75rem] tabular-nums tracking-[0.08em]`.

**Footgun to grep for during any later work:** Tailwind 4.1.13 emits `letter-spacing: var(--tw-tracking, var(--text-title--letter-spacing))`. Adding any `tracking-*` class to a ramped element **silently deletes the ramp's tracking**.

---

### A9. Small deletions and one correctness bug

**Risk: none.**

**A9.1 — the nested numbering, and the orphan.** The home page 01–05 and atelier 01–04 sequences are coherent and stay. Two things are genuinely broken:

- `page.tsx:175` labels the Services band **02** while `page.tsx:196-198` labels the three photographs *inside it* **01/02/03** — two systems 250px apart. **Delete `page.tsx:196-198`.** (The numeral also measures 2.32:1 on `folded-shirt.jpg`, so this fixes a contrast failure at the same time.)
- `prices/page.tsx:115` carries `index="02"` on a page whose heading at `:107` has no index. **Delete the `index` prop at `prices/page.tsx:115`.**

Leave the `index` prop on `SectionHeading` (`ui.tsx:112,131-133`) in place; it is still used correctly.

**A9.2 — the trust strip is invisible on a phone.** Measured at 390px: `scrollWidth` **1235** against `clientWidth` **390**, in a container with `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden` (`page.tsx:92`). Three of five trust facts — including "In business since 2008" — are off-screen with no scrollbar, fade, or arrow. Change `page.tsx:92` so the strip is `flex-wrap` below `md` and `overflow-x-auto` from `md` up.

**A9.3 — the lightbox width/height pairing.** `gallery-wall.tsx:150-154` passes `width={open.width} height={open.height}` and overrides only one (`w-auto`, no `h-auto`). It survives on the UA `aspect-ratio` rule plus a `max-h-full` that only resolves because the parent at `:144` happens to carry `min-h-0 flex-1`. `works` comes from `liveGallery()`, which Daysi populates from `/office`, and her gallery originals run to 3414×5120, so the raw value is genuinely five thousand pixels.

```
className="max-h-full w-auto h-auto max-w-full object-contain"
```

**A9.4 — the one flat grey.** `fabric-manager.tsx:48` `return "#8a8a8a";` is the only fully achromatic value in the codebase and it renders as a swatch chip. → `return "#8e8471";` (the `line-strong` value).

Note for the engineer, because no audit caught it: `averageColor` is **persisted** by `api/office/fabrics/route.ts` and validated against `z.string().regex(/^#[0-9a-fA-F]{6}$/)`. `#8e8471` passes. Existing records keep the old value; that is acceptable — this is a fallback that fires only when a canvas context cannot be acquired.

**A9.5 — the style-card separator.** `style-card.tsx:54` `<span className="px-2 text-line">/</span>` — `line` is a hairline token doing text duty at 1.9:1. → `text-ink-faint`.

---

### A10. The logo stops freezing a hex into four PNGs

**Risk: low, and it deletes code. Impact: makes the mark track the token forever, removes a prop and a branch, deletes two files.**

The four brand PNGs are flat single-colour knockouts with clean alpha (`mark-ink.png` mean opaque RGB `#14110d`, `mark-paper.png` `#fbf9f3`). `logo.tsx:7-9` justifies two files on the grounds that a CSS `filter` would silt the artwork. That is correct about `filter:` and wrong about masking: on flat art the alpha channel **is** the art, and a mask recolours it exactly, anti-aliasing included.

Rename `public/brand/mark-paper.png` → `mark.png` and `logo-paper.png` → `logo.png` (either source file works; they are the same alpha). In `src/components/logo.tsx`:

```tsx
<span
  role="img"
  aria-label="Daysi Collection"
  className="aspect-[512/451] h-10 w-auto shrink-0 bg-current
             [mask-image:url(/brand/mark.png)] [mask-size:contain]
             [mask-repeat:no-repeat] [mask-position:center]
             [-webkit-mask-image:url(/brand/mark.png)]
             [-webkit-mask-size:contain] [-webkit-mask-repeat:no-repeat]"
/>
```

Then delete the `tone` prop from `Logo` and `DaisyMark`, delete `mark-ink.png` and `logo-ink.png`, and remove the `isOverPhotograph ? "paper" : "ink"` branch at `site-header.tsx:93`. Update the three call sites.

CSP note: `mask-image: url(/brand/mark.png)` is same-origin and covered by `img-src 'self'`.

**A10.1 —** while in `layout.tsx`: `grep themeColor src/` returns nothing. Add to the metadata export at `src/app/[locale]/layout.tsx:44-62`:

```ts
themeColor: "#fbf8f2",
```

(Update this value if Part B item B1 is approved.)

---

### A11. One email, no code

`public/images/real/frutera-capri.jpg` (898×1600) reads as a licensed campaign frame — Capri cliffs, bougainvillea, professional model, golden hour — not a photograph from a Bronx workroom. It is currently the **lead image of the lead style**. Given hard constraint 1, confirm with Daysi that she owns it and may publish it before it stays as the catalogue's first picture. This is a rights question, not a design question.

---

## PART B — needs the client's explicit approval

Each item states the question to put to her. Build each on a branch and show it to her **on her phone, in Spanish, side by side with the current site**, after Part A is already visible — so she is being asked about taste, not about whether anything improved.

---

### B1. The neutral ladder

Both the tokens audit and ROTATION independently found `globals.css:12-20` to be a line-by-line hit on taste.md's premium-consumer palette trap: all nine tokens inside a 34–42° hue band, `#fbf8f2` at 52.9% saturation, `#14110d` at 21.2%, `#a97600` brass to within a few units of canonical. Her stated palette is **yellow, white and black** (recorded at `globals.css:5-9`).

The judges split. RESTRAINT proposed holding hue at 40° and halving saturation; the craft judge killed that as "desaturated cream with a brass accent — the same family at lower volume," correctly noting taste.md's cream-and-brass hatch is closed because she named the opposite. ROTATION proposed a genuine rotation to a near-achromatic, faintly cool ladder. **Resolved in ROTATION's favour on the numbers, on a light ground only.**

`globals.css:12-19`:

```css
  --color-ink:        #101315;   /* was #14110d — h204 s14 l7 (was h34 s21 l6) */
  --color-ink-soft:   #383E42;   /* was #3f382e */
  --color-ink-faint:  #61686D;   /* was #6d6355 */
  --color-paper:      #F6F6F4;   /* was #fbf8f2 — S 53% → 8% */
  --color-paper-warm: #ECECE9;   /* was #f2ebdd */
  --color-paper-deep: #E0E0DC;   /* was #e8dfcc */
  --color-line:       #D4D5D1;   /* was #ded3bd */
  --color-line-strong: #7E8388;  /* replaces A4.3's #8e8471 */
```

Measured: ink/paper **17.24:1**, ink-soft/paper 10.03:1, ink-faint/paper 5.23:1, ink-faint/paper-warm 4.78:1, line-strong/paper 3.54:1, line-strong/paper-warm 3.23:1. Nothing regresses.

Downstream, in the same commit: `fabric-manager.tsx:48` → `"#7E8388"`; `--color-paper-soft`/`--color-paper-faint` from A5 must be re-derived against `#101315` and re-measured; `design-studio.tsx:13-15,73`, `mockup.ts:181`, `croquis.ts:237` updated; `layout.tsx` `themeColor` → `#F6F6F4`. `--color-alert` stays `#9c2f18` (6.09:1 on the new paper-warm).

ΔE00 from the current cream to `#F6F6F4` is **2.19**.

> **Ask her:** "The greys and creams behind your clothes are all slightly brown, which competes with your prints — may I make them properly neutral so the yellow and the fabric are the only colours on the page? It's the same brightness, nothing gets darker or lighter."

---

### B2. The marigold itself

Separate question, separate approval. `--color-marigold: #e8a302` sits at 98% saturation and leans orange. ROTATION's `#EFB01A` is lighter and closer to flag yellow, and its deep partner is already shipping in A4.1.

```css
  --color-marigold: #EFB01A;   /* was #e8a302 */
```

Check `ui.tsx:24` (`bg-marigold text-ink`) after the change: `#101315` on `#EFB01A` = **9.68:1** with B1, `#14110d` on `#EFB01A` = 9.4:1 without. Passes either way.

> **Ask her:** "Your yellow is currently a little orange — may I move it a shade toward the flag yellow, so it reads as yellow next to your marigold garments instead of competing with them?"

---

### B3. The hero un-scrim

**[MEASURE] — this item may not merge without the measurement below.**

`page.tsx:62` composites `from-ink/90 via-ink/45 to-transparent` across `inset-0`, plus a top band at `:63`. Measured: composite alpha **0.96** at the top-left corner, which contains nothing but a logo; the h1 renders at **7.92:1** against a 3:1 requirement with **37%** of the photograph's light surviving. On a phone the horizontal gradient has no breakpoint, so the copy spans the full frame while the gradient's right end sits at α **0.056** — the hero paragraph's line-ends measure **3.53:1** against the region mean and **1.54:1** against bright pixels. That is a live accessibility failure on the device most of her clients use, and Spanish pushes more of the sentence into the clear zone.

DEVICES found that `hero.jpg` has a flat yellow seamless in its left region and proposed painting that field and setting the type in ink. The craft judge endorsed the paint field as "the strongest single idea across all three proposals." The engineering judge and the practical judge both found DEVICES' own version **broken**: `page.tsx:72` stays `tone="marigold"` (`bg-marigold text-ink`), which on a yellow field is **1.16:1** — the Book-a-session button disappears. The craft judge additionally sampled the file on a 40px grid and found the flat field ends around x=25% at the copy block's actual height, while the copy column spans ~3–50% of the frame — so DEVICES measured the backdrop, not the copy's bounding box.

**Resolved:** take the paint field, but gate it on a measurement of the copy element's own rectangle, and fix the CTA.

1. Sample `public/images/real/hero.jpg` on a grid at the **copy block's** rendered bounding box at 390, 768 and 1440, in both locales (Spanish `heroTitle` is 37 chars to English's 27). If ink on the sampled region does not clear 4.5:1 across the full block at every breakpoint, **do not ship the ink-on-paint version** — ship variant (b) below instead.
2. Variant (a), if the measurement passes:

```css
@theme {
  --color-sun:      #ebb631;
  --color-sun-deep: #c38f33;
}
@layer components {
  .hero-field { background: linear-gradient(165deg, var(--color-sun) 0%, var(--color-sun-deep) 78%); }
  @media (min-width: 1024px) {
    .hero-photo {
      -webkit-mask-image: linear-gradient(to right, transparent 0 42%, #000 62%);
              mask-image: linear-gradient(to right, transparent 0 42%, #000 62%);
    }
  }
  @media (max-width: 1023px) {
    .hero-photo {
      -webkit-mask-image: linear-gradient(to top, transparent 0 32%, #000 50%);
              mask-image: linear-gradient(to top, transparent 0 32%, #000 50%);
    }
  }
}
```

   - `page.tsx:52` `bg-ink` → `hero-field`
   - `page.tsx:60` add `hero-photo`; `object-[72%_18%]` → `object-[34%_16%]` (the 72% is inert on desktop — measured horizontal overflow 0px at 1440×846 — and on a phone it crops the yellow away)
   - **Delete `page.tsx:62` and `page.tsx:63`**
   - `page.tsx:67` `text-paper` → `text-ink`; `:68` → `text-ink-soft`; `:75` `TextLink tone="paper"` → default ink
   - **`page.tsx:72` `tone="marigold"` → `tone="solid"`.** Non-negotiable. On the yellow field, marigold-on-yellow is 1.16:1.
   - **`site-header.tsx:87` must render the ink nav on `/`, not the paper one.** Ink on `#ebb631` is 10.12:1; paper on it is **1.95:1**.
   - Remove `.on-ink` from `page.tsx:52` (added in A3.2) — the hero is no longer a dark ground.

   Note the resolution bonus, which matters under hard constraint 4: `hero.jpg` is 1461px and `sizes="100vw"` stretches it to 131% at a 1920 viewport. Masked to the right ~58%, it renders at 1114 CSS px — native, with headroom to a 2519px viewport.

3. Variant (b), the fallback if the measurement fails — keep `bg-ink`, keep white type, but replace the full-frame band with a mask:

```css
@media (min-width: 1024px) {
  .hero-photo {
    -webkit-mask-image: linear-gradient(to right, transparent 0 42%, #000 62%);
            mask-image: linear-gradient(to right, transparent 0 42%, #000 62%);
  }
}
```

   Delete `page.tsx:62`, keep `:63`. h1 goes to 17.76:1, lead to 9.00:1, and the right 38% of the frame carries zero density. No CTA change, no header change.

> **Ask her:** "Right now we darken most of your hero photograph to make room for the white text — may I stop doing that, so the picture shows at full strength? Two versions: one keeps the white writing and just uncovers the right of the photo; the other puts black writing on the yellow wall your photographer already lit for it."

---

### B4. The remaining scrims and the double-dim

`atelier/page.tsx:32` is `from-ink/95 via-ink/60 to-ink/45` — the `to` stop is **not transparent**, so no pixel of that photograph is ever uncovered. Measured: the lead renders at **9.21:1** against a 4.5:1 requirement with **14%** of the photograph's light surviving. `globals.css:160-167` `.image-veil` floors at 0.05 and never clears, and `page.tsx:192` *also* sets `opacity-85` on the image at rest — so her service photographs are never shown at full strength except on hover, which never fires on a phone.

```css
.scrim-band {
  background: linear-gradient(to top,
    rgb(20 17 13 / 0.82) 0%, rgb(20 17 13 / 0.55) 24%,
    rgb(20 17 13 / 0.16) 44%, transparent 58%);
}
```

- `atelier/page.tsx:32` → `<div className="scrim-band absolute inset-0" />`; keep `:35`.
- `premieres/page.tsx:45` → same.
- `globals.css:161-166` `.image-veil` → `linear-gradient(to top, rgb(20 17 13 / 0.86) 0%, rgb(20 17 13 / 0.60) 18%, rgb(20 17 13 / 0.18) 34%, transparent 46%)`.
- `page.tsx:192` — delete `opacity-85` and its `opacity-100` hover partner; keep only the scale.

If B1 ships, update the triplets to `16 19 21`.

Measured after: atelier eyebrow 5.32:1 / h1 5.63:1 / lead 7.50:1, light kept 32→73%, 24→50%, 14→32%. Service tiles: `h3` clears 4.81:1 on the brightest tile, coverage 0.460 → 0.205.

> **Ask her:** "On the atelier page and the service tiles we're currently dimming your photographs even where there's no writing over them — may I lift that so the pictures show properly?"

---

### B5. Spacing rhythm

Every heading block on the site is pixel-symmetrical above and below, because they are uniform-gap flex columns: `page.tsx:130` 28/28, `ui.tsx:130` 20/20, `page.tsx:239` 28/28, `page.tsx:319` 24/24, `services/page.tsx:62` 24/24. taste.md calls getting this backwards "the single most common spacing error." The site's own `page-header.tsx:23` gets it right at a measured 128 top / 64 bottom.

**B5.1 — three named intervals** at `ui.tsx:130`, `page.tsx:130,239,319`, `services/page.tsx:62`: `gap-0` on the column, then label `mb-3` (12), h2→lead `mt-5` (20), lead→body `mt-4` (16), body→link `mt-8` (32).

**B5.2 — fluid section padding.** No spacing value on the site is fluid though every type size is a `clamp()`. Measured: 144/128/112/96 at 1440, flat 96 at 390 — a phone carries 75% of the desktop air, which is 192px of empty ground at every boundary on an 844px screen, eight times over.

```css
  --spacing-section:       clamp(3.5rem, 7vw, 8rem);
  --spacing-section-tight: clamp(2rem, 4vw, 4rem);
```

Apply `--spacing-section` everywhere `py-24 lg:py-32` currently sits, and `--spacing-section-tight` to the two single-sentence beats, `page.tsx:153` (BrandPromise) and `page.tsx:283` (PricePromise). Cuts ~640px off the phone scroll with desktop untouched, and gives the page a long-short-long-long-long-short-long pulse instead of one flat value ±20%.

> **Ask her:** "The page has the same amount of empty space everywhere, which makes it very long on a phone — may I tighten it so the whole page is about a screen-and-a-half shorter, without making anything smaller?"

---

### B6. Depth — grain and edge light

Zero of taste.md's five depth tools currently appear on any photograph, and there are four full-bleed `#14110d` grounds that will band on an 8-bit panel — worst case the lightbox, which is the full viewport behind a photograph.

```css
.grain { position: relative; }
.grain::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  opacity: 0.045; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
}
.photo-frame { position: relative; }
.photo-frame::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  box-shadow: inset 0 1px 0 rgb(251 248 242 / 0.10), inset 0 0 0 1px rgb(20 17 13 / 0.06);
}
```

`.grain` on `page.tsx:283`, `atelier/page.tsx:63`, `gallery-wall.tsx:133` (add `relative isolate` where absent). ~330 bytes inline, no request, no service, static so reduced motion is unaffected.

`.photo-frame` on the `aspect-*` wrappers at `page.tsx:118,265,309`, `atelier:51,81`, `alterations:70`. **Deliberately not on `style-card.tsx:29`** — the lookbook's no-chrome-on-a-hairline-grid is a real recorded decision and a frame would undo it.

**Ship gate:** grain forces a compositing layer on the largest surfaces on the site. If it does not visibly reduce banding on a real 8-bit panel, drop it and keep only `.photo-frame`.

> **Ask her:** "May I add a very faint film grain over the black areas — invisible up close, but it stops them looking blotchy on cheaper phone screens?"

---

### B7. The one scroll device

A front-to-back `clip-path` wipe on `collection/[slug]/page.tsx:74-86`, for the **two** photo pairs on the site that genuinely register: `ocelote-blouse.jpg` / `ocelote-blouse-back.jpg` and `laguna-shirt.jpg` / `laguna-shirt-back.jpg`, both 1200×1600 flat-lays from one setup.

Two absolutely-positioned `<Image>` in one `aspect-3/4` frame, the second with `clip-path: inset(0 0 calc((1 - var(--p)) * 100%) 0)`, `--p` from one rAF scroll handler in a single small client component. Gate behind an explicit `reveals: true` flag on the photo entry so the other ten styles keep the current stack. `clip-path` is relative to the border box; these are `fill` images in an aspect box, so the line-height shearing trap does not apply — but do not reuse the pattern on type. Under `prefers-reduced-motion`, render both frames stacked.

This ships **only after** all of Part A and B1–B5. It is the last item, not the first. It touches no pricing, no `StyleOrderPanel`, no cart.

> **Ask her:** "On the shirts you photographed front and back, may I make the back view slide into place as someone scrolls, instead of it being a second picture further down?"

---

## Rejected, and why

**ROTATION's `.wall` — the site-wide dark ground.** Killed by all three judges, decisively by the engineering judge on mechanism. Ground polarity is already encoded twice in `src/` and inverting the tokens double-inverts both: `ui.tsx:24` `bg-marigold text-ink` renders the hero's Book button at **1.6:1** inside `.wall` and only becomes readable on hover; `ui.tsx:26` `tone="ghost"` (`border-paper/45 text-paper`) breaks the other way in the `.paper` scope ROTATION creates at `page.tsx:290`; the `tone="paper"` prop system already *means* "I am on a dark ground" and every use of it inverts to invisible; and `bg-ink text-paper` is the site's **selected-state** pair at `booking-calendar.tsx:147`, `appointment-booking.tsx:184`, `form.tsx:106`, `style-order-panel.tsx:90`, `design-studio.tsx:109`, `books-export.tsx:79` — inside `.wall` the selected chip becomes the same polarity as the unselected ones, so the selected state stops existing on a size picker and a booking calendar. None of this fails the build or `tsc`. Additionally: every `/NN` opacity utility compiles with a hard-coded `:root` hex in its non-`@supports` branch, so any engine without `color-mix(in lab, …)` renders all 34 alphas at light values on black. And ROTATION's own §5 risk 1 concedes the catalogue grid does not unify on it — three cells punch out at 17:1, four bleed in — which is a regression on the page that sells. Rejected in full. Its token numbers survive, on a light ground, as B1.

**RESTRAINT's §2.1 palette "rotation".** Killed by the craft judge: holding hue at 40°, holding every lightness, and leaving `--color-marigold` untouched produces desaturated cream with a brass accent, which is the same family at lower volume, and taste.md's cream-and-brass escape hatch is closed because Daysi named yellow-white-black. Superseded by B1's genuine rotation.

**RESTRAINT's 253-call-site type migration.** Killed by the practical judge and seconded by the engineering judge: it collapses 13/14/15px into two rungs, which no customer perceives, in a diff running through `price-manager.tsx` and `cart-view.tsx`. Deferred indefinitely. The token work survives as A8.

**RESTRAINT's global `p { max-width: var(--measure-body) }`.** Killed by both the practical and engineering judges — it silently clamps `cart-view.tsx`, the `office/page.tsx` stat cards, `request-list.tsx` rows, and every `<dd>` in the Alterations price list at `page.tsx:262-270`, where full width is load-bearing. RESTRAINT names the risk itself and its proposed escape hatch is more work than the targeted fix. Replaced by A8.5's six named columns.

**RESTRAINT's reduced-motion increase (0.01ms → 240ms/180ms).** Killed by the practical judge: it overrides a user's explicit accessibility setting on a designer's judgment, for no business gain. taste.md's "fewer and gentler, not zero" is good general guidance, but this site's zero-form is already shipped and the only thing new motion would buy is polish for a user who asked for less of it. `globals.css:76-86` stays as it is.

**RESTRAINT's blanket deletion of section numbers.** Killed by the engineering judge on the facts: the home page runs a coherent 01–05 (`page.tsx:130,175,220,239,319`) and atelier runs 01–04. Only the nested collision and the orphan `02` are genuine defects. Narrowed to A9.1.

**DEVICES' entire scroll score** — `scroll-acts.tsx`, `kinetic-lines.tsx`, the kinetic hero, both pinned acts, the pan rail, the velocity-driven grain. Killed by all three judges. It puts roughly seven viewport-heights between the hero and the first buyable thing on a page whose job is booking a fitting; it asks a one-woman business with no maintenance budget to own ~155 lines of bespoke scroll orchestration forever; and DEVICES pre-writes its own rollback ("if bookings drop, the pan is the first thing to cut"). The craft judge added that the score reproduces the exact template — kinetic hero, pinned type act, panned rail, pinned close — that uniqueness.md was written to prevent, and that the grammar the content actually asks for (gallery/catalog: fixed label schema, museum captions) is the one DEVICES violates by using a gallery caption as a cue in a pinned argument act.

**DEVICES' beat 7, the 3.4vh pinned peak on the two 3414px frames of Daysi.** Killed separately and by name by all three judges: largest spend on the page, on the owner rather than the merchandise, the one real jank risk on low-end Android, and — the engineering judge's finding — it hardcodes `real/daysi-shift-wide.jpg` and copies cue text from `gallery.ts:117,130`, but `liveGallery()` honours an owner `gallery-visibility` hide, so if Daysi hides that work from `/office` it disappears from `/gallery` and keeps playing on her home page with a caption she no longer uses.

**DEVICES' C3 pan rail and its deletion of the Services section.** Killed by the engineering judge on accessibility: a `--p`-driven `translateX` rail has no scroll container, so items 2–6 are unreachable by keyboard and off-viewport for AT, and the two type cards carrying the service names sit where the transform is largest. It also deletes the home page's only three links to `/services`, and its reduced-motion fallback is a structurally different component with different content geometry.

**DEVICES' C4, merging Alterations into the price band.** Killed by the practical judge: the $35 hem is the volume business, not the $325 dress, and dissolving the standalone Alterations beat is an IA decision wearing a design proposal's clothes. It also removes five `liveAlterations()` price rows and `workroom.jpg` from the home page.

**The Inter → Archivo swap.** Rejected. The measured case is real (85 characters per line against Inter's 78, absorbing the ~20% Spanish penalty), but `tabular-nums` appears 27 times across an editable price manager, a booking calendar, a cart and an owner dashboard, which is squarely taste.md's own exemption. The audit also tested and **disproved** the usual pretext — none of Inter, Instrument Sans or Archivo clips accented capitals at 11px, and all three set `RESERVAR UNA CITA` within 4px. The measure problem is solved more precisely by A8.5. Geist specifically rejected: it is Vercel's face and reads as developer tooling, a costume in the other direction.

**A dark mode.** Rejected. Zero matches for `prefers-color-scheme` or `dark:` in `src/`. taste.md requires light-on-dark type compensated on three axes; the site fails that today on its one dark ground, and doubling the surface doubles the failure. A7 declares `color-scheme: light` instead.

**`scrub`, `count`, `tilt`, `magnet`, `drift`, custom cursors.** Rejected upstream by DEVICES itself and endorsed here. `scrub` needs footage that does not exist and cannot be made. `count` is a SaaS gesture on a Bronx dressmaker's page and the only verifiable figure is already in the copy. `tilt` and `magnet` undercut a page whose argument is that a real person will take your measurements. `drift` is refused by devices.md's own scoping rule — the home page has short overlapping acts, so grounds must be painted per section, which `page.tsx:91,153,172,218,283,307` already does.

**The `reveal` wipe on `daysi-portrait` / `daysi-portrait-standing` and on `sirena-model-front` / `sirena-subway`.** Rejected because the frames do not register — mid-wipe the body shows at two scales and visibly breaks. Only the ocelote and laguna flat-lay pairs register; that is B7. Related: `sirena-subway.jpg` is 578×1024 and cannot be used full-bleed under hard constraint 4.

**Structural refuse-list items deferred, not rejected:** the three geometrically identical image-left/text-right bands (`page.tsx:117,238,307` — note `lg:order-*` at `:239,265` does *not* flip the grid; measured x=96 on both), and the split header at `page-header.tsx:23-34` on every interior page. Both are real hits. Both require re-deciding page composition rather than tightening a number, and both will read better against the corrected palette and spacing than against the current ones. Schedule them as a third pass with a named grammar — gallery/catalog, which is what the content already is.

---

## Sequence

| Commit | Items | Approval |
|---|---|---|
| 1 | A1 | none |
| 2 | A2 | none |
| 3 | A3, A4 | none |
| 4 | A5 | none |
| 5 | A6, A7 | none |
| 6 | A8 | none |
| 7 | A9 | none |
| 8 | A10 | none |
| — | A11 | one email |
| 9 | B1, B2 | hers |
| 10 | B3 **[MEASURE]** | hers |
| 11 | B4 | hers |
| 12 | B5 | hers |
| 13 | B6 | hers, ship-gated |
| 14 | B7 | hers |

Commits 1–8 need nobody's permission, produce the majority of the measurable improvement, and are roughly 18–22 hours. Part B is roughly 14–20 hours once approved. Nothing on either list adds an ongoing cost, requires a photograph that does not exist, or touches pricing, auth, checkout, or the office write path.
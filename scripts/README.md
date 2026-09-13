# Scripts

Two kinds of thing live here: a one-time asset pipeline, and a measurement
harness for the wall.

The harness exists because of the project's central rule, stated in `AGENTS.md`
and `docs/DESIGN.md` §9: **measure the running app, do not read the source.**
Every bug these scripts have caught rendered convincingly, passed typecheck,
lint and the full test suite, and would have run on a wall for weeks.

## Setup

The measurement scripts need a browser driver, which is deliberately **not** a
dependency of this project — the wall ships five runtime packages and nothing
here belongs in that surface.

```bash
npm i -D playwright-core          # once, on the machine doing the measuring
npm run dev                       # the scripts measure a running server
```

Chrome is found automatically: `CHROME_PATH` if set, otherwise Playwright's
browser cache, otherwise the system Google Chrome. `Pillow` is needed for the
two Python scripts (`python3 -m pip install Pillow`).

---

## `measure-fit.mjs` — does it still fit?

```bash
node scripts/measure-fit.mjs [url]
```

Renders the slide at four viewports and reports header clearance, bottom air,
row height, strip width, the gap between the podium cards, and overflow count.

**Reach for it after changing any height, gap or type size.** This is the one
that catches what a single 1920×1080 check cannot.

The trap it exists for: the type and dimension tokens are `vw` and shrink with
the frame, but **the `--s-*` spacing scale is fixed px and does not**. Every
gap and padding holds its size while everything around it contracts, so a band
that merely *fits* at 1920 can overlap the header at 1600. Measured before this
was budgeted properly: **−15.8px of clearance at 1600×900**, on a layout that
looked perfect at 1920.

`clearance` must be positive at every size. Aim for ≥10px at the smallest size
you care about; under ~5px is a heading waiting to be overlapped by a font that
loads a step heavier.

## `measure-figures.mjs` — does the widest rupee figure still fit?

```bash
node scripts/measure-figures.mjs [url]
```

Writes the widest figure the wall is sized for into every figure element,
measures what the string genuinely needs against the box that has to hold it,
and puts the original text back. No stress fixture required — it measures the
running layout at whatever data happens to be live.

**Reach for it after changing any figure's type size, any column width, or
`formatRupees`.**

The trap it exists for: `en-IN` groups by lakh and crore, so a figure gains
separators faster than it gains digits — `₹2,42,546` is 9 glyphs, `₹10,00,000`
is 10, `₹1,00,00,000` is 12. The board is tuned against a cohort whose leader is
on ₹2.4L, so **a third of the width a figure can eventually need is never
exercised on screen**. Measured before this existed: `/podium`'s leader figure
at 56px needed 350px in a 312px column and overflowed 38px into the gaps either
side of first place, at every viewport, with nothing reporting it.

Two things it does *not* do, both deliberate. It does not measure
`scrollWidth` — that returns `max(clientWidth, content width)`, so an element
already as wide as its container reports the container's width whatever is in
it, and every figure comes back with exactly zero slack, which reads as "fits
perfectly" and means "measured nothing". And it does not claim an unbounded
guarantee: twelve glyphs is the bound, ten crore is the first thirteen-glyph
figure, and `lib/format.test.ts` pins where that line is.

## `measure-frame.mjs` — the full report for one slide

```bash
node scripts/measure-frame.mjs [url] [screenshot.png] [--reduce-motion]
node scripts/measure-frame.mjs http://localhost:3000/weekly weekly.png
```

Dumps JSON: viewport and scroll extent, every element leaving the frame, the
header and dial, podium-card geometry and **resolved fill luminance**, idle timeline
names and durations, mark sizes, `.tv-pill` count, strip rows, and which font
faces actually loaded.

**Reach for it after any change to geometry, colour or motion.** It answers
what a DOM assertion cannot: did anything leave the frame, do the three podium
cards genuinely step in size, did `color-mix()` resolve to three *distinct*
greens, are the three marks really on different idle timelines.

Two notes earned the hard way:

- It forces `deviceScaleFactor: 1`. A persistent browser profile can carry a
  scale factor from a previous session — one was serving a 5760×3240 viewport
  at DPR 0.33, which makes every `vw` token read three times too large and
  silently invalidates the whole report.
- Luminance parsing handles `color(srgb …)` as well as `rgb(…)`, because
  `color-mix()` resolves to the former in Chrome. A parser that only knew
  `rgb()` reported 0.0001 for a mid-green and made a correct ramp look broken.

## `logo-legibility.py` — how small can a mark go?

```bash
python3 scripts/logo-legibility.py [out.png]
```

Renders every prepared logo in a circle at 40 / 48 / 64 / 81 / 100px.

**Reach for it when mark sizes change or new logos arrive.** It settles the one
question reasoning does not: at what diameter does a logo stop being a logo?

First run put the threshold near 50px — below it the wordmarks stop resolving
into anything. The strip's mark went 40px → 48px on that evidence. Remember
that *recognisable* is the bar, not *readable*: the venture name is printed
beside every mark, and at six metres a 48px mark subtends about 14 arcminutes —
enough for colour and silhouette, not for a word.

A logo faint at *every* size is an artwork problem, not a framing one.

## `render-podium.mjs` — the three blocks on `/podium`

```bash
node scripts/render-podium.mjs
```

Renders `/podium`'s three blocks as one lit 3D image and writes
`public/podium/blocks.png` and the generated module `lib/podiumBlocks.ts`.
**Re-run it after changing any block's size, colour, the camera or the view,
and commit both outputs with the change.**

No dependencies: it ray-marches signed distance fields and encodes the PNG
itself, because this machine has neither Blender nor numpy and the wall ships
five runtime packages. About thirteen seconds.

**Reach for it when the podium's form changes.** Type, spacing and everything
live still belong to CSS — the image is only the lit form.

Three things it is easy to get wrong:

- **The camera must stay off-axis.** The image plane is parallel to the fronts
  and the frustum is shifted down, which is what a tilt-shift lens does: every
  front face projects to an exact rectangle, and that is what lets the venture
  name and its figure sit on the image as ordinary flat type. Pitch the camera
  and the type rakes, on a wall read at six metres.
- **The manifest is the only authority on where the blocks are.** It is
  computed by the same projection that rendered them. `components/Podium.tsx`
  reads it and re-derives nothing.
- **Lighting is done in linear light**, sRGB in and sRGB out. Shading straight
  in sRGB produces the muddy mid-tones that make a render look like a gradient.

The floor is a shadow catcher and nothing else — it contributes alpha, never
colour — so the page's own gradient shows through and no seam can appear
between a rendered floor and a CSS one. The cast shadow is deliberately faint
and the contact occlusion carries the weight: this page runs from `#1a0f2e` to
`#0e0719`, and darkening that returns a muddy blob rather than a shadow.

## `prepare-logos.py` — the asset pipeline

```bash
python3 scripts/prepare-logos.py
```

Masks every source logo in `public/assets/Circle logos/` to a disc and writes
`public/logos/<TEAM_ID>.png` at 512×512 RGBA, **transparent outside the
circle**. Re-run it when the source folder changes and paste its output into
`LOGOS` in `config.ts`.

This is the reverse of what it used to do. The old sources were arbitrary
rectangles, so it squared each one onto its own background colour and a
circular frame could then be filled rather than the artwork cropped. The
sources are now circles and both boards draw discs — `/podium` clips to one and
`/weekly` stands them on a green panel — so a baked-in background would put a
white or black square corner behind a disc on a green field.

The sources are only mostly uniform: JPG and PNG, on white, on black and on
transparency, and two are not square (`Team 15` is 841×1280). So the circle is
found rather than assumed — alpha bounding box where there is real
transparency, otherwise the corners give the background colour and the box is
everything far enough from it. A box covering nearly the whole frame means the
reading failed, and the full frame is used instead of a bad crop. Full
reasoning is in the script's docstring.

## `dev-feed.mjs`, `dev-churn.mjs`

Local fixtures for development. Not part of the verification harness.

`dev-feed.mjs` writes `public/mock/{feed,cohort}.csv`, which `next dev` serves at
`/mock/…`. Point the wall at them with environment variables — **never by editing
`config.ts`**, which is tracked and has already produced one committed-then-reverted
fixture URL:

```bash
# .env.local, gitignored by the `.env*` rule
NEXT_PUBLIC_FEED_CSV_URL=/mock/feed.csv
NEXT_PUBLIC_COHORT_CSV_URL=/mock/cohort.csv
```

Restart `next dev` after changing either — `NEXT_PUBLIC_` values are inlined at
build time, not read per request.

---

# Open items

### ~~1. The team-number → workbook-ID mapping is unverified~~ — RESOLVED, 12 Aug 2026

Source logos are named `Team 17`, not `SLE-C417`, and `prepare-logos.py` assumes
team *N* is workbook `SLE-C4NN`. This could not previously be checked, because
the mock feed carries invented venture names.

**It has now been checked against the live `TV_Feed`, and it holds.** All 24
numbered logos were read against the published venture names and every one
agrees — Team 1 is Dosa Crisps (`SLE-C401`), Team 15 is CHAKHA NA?
(`SLE-C415`), Team 34 is In Between Sips by Kaappitalism (`SLE-C434`), and so
on through all 24. The method was a labelled contact sheet: render each source
beside the venture name its assumed workbook publishes, and read the wordmarks.

Re-run that check if a source folder ever arrives with different numbering.

### ~~2. `SLE-C412` is too pale to read at any size~~ — MOOT

`SLE-C412` (Xoco) is not in the new circular set — no `Team 12` file was
supplied — so it falls back to the coloured initial and the pale artwork is no
longer on the wall. If a `Team 12` logo arrives later, check it at 100px before
adding it: the previous one was pale grey type on white *in the source*, which
no framing or sizing downstream can fix.

### 3. Two source logos cannot be assigned to a team

`Unhinged Logo.png` and `PHOTO-2026-08-12-15-37-13.jpg` (which is **ROLLIN**)
carry no team number, and neither venture name appears in `TV_Feed`. The only
unnamed non-spare workbooks are `SLE-C422` and `SLE-C435`, so they are almost
certainly those two — but nothing says which is which, and guessing is a coin
flip on a public wall.

Both are deliberately not emitted, and both teams show the coloured initial.
To place them, rename the files `Team 22.png` / `Team 35.png` and re-run.

### ~~4. Four fallback discs are the same colour as `/weekly`'s green panel~~ — RESOLVED

The panel was removed. The marks now float as discs on the page's white, where every tint
reads, and the mint hairline that was propping them up went with it. Kept below for the
record, because the collision itself is still real and would return if any surface on this
wall is ever painted `--deep-forest-green` behind a mark.

`VentureLogo`'s six identity tints include `--deep-forest-green`, which is
*exactly* the card's logo panel, and `--deep-teal`, which is close to it. Teams
without artwork that hash to those get a disc that does not read as a disc —
only the white initial and the mint hairline show.

Measured: `SLE-C411` Moh, `SLE-C417` Postcards and `SLE-C435` on
`--deep-forest-green`; `SLE-C432` Lowkey Livin on `--deep-teal`. Four of the
sixteen visible fallbacks.

They are legible — the letter and ring carry it — so this is a design question,
not a fault. Fixing it means either dropping those two tints from the set, or
using a different tint set on the green panel, which costs the rule that a
venture keeps one colour across both slides.

### 5. Podium venture names: serif or sans — unanswered

The design system is explicit that display and headings are `--font-serif`
while body and UI are `--font-sans`, and the slide headings now follow it. The
podium's **venture names** are currently sans. The pre-rewrite design had them
in serif, and they are the most display-like text on the frame after the
heading.

Both readings are defensible and the question was raised but never answered.
Decide it before the next typography pass, or the two boards will drift.

---

## `measure-crown.mjs` — is the crown there, gold, and unclipped?

```bash
node scripts/measure-crown.mjs [url]
```

Reports the crown's layout box, its painted box, the fill it actually resolved
to, every clipping ancestor between it and the frame, and whether it collides
with the rank numeral. Writes `/tmp/crown-lead.png` and `/tmp/crown-slide.png`.

Three traps behind it. An `<svg>` with `height: auto` can lay out at
`95x0` and still pass every DOM assertion. `fill: var(--crown-ink)` falls back
to **black** — not to an error — if the token is undeclared on the surface in
play, which on Deep Aubergine is a crown-shaped hole. And
`getBoundingClientRect` returns the *axis-aligned* box of a rotated element, so
a 95x74 crown at −24° reports 117x106; read that as the width and every
clearance below it is wrong by 23%. The script prints `offsetWidth` beside the
rect for exactly that reason.

## `measure-crown-fit.mjs` — is it still attached to the right venture?

```bash
node scripts/measure-crown-fit.mjs [url]
```

The crown overhangs its disc to the **left**, and the place to its left is rank
2. Everything on this slide is `vw`, so the question at 1366 is not whether the
crown fits but whether it has reached into the silver mark. Prints the clear air
between the two at four viewports; it must never go negative.

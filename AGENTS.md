<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# BYOB Campus TV Wall

Two pages displayed on TVs across Mesa campus during BYOB Cohort 2026, driven from a
laptop over HDMI. The wall rotates between its own two slides every thirty seconds; if it
also sits inside a wider campus slideshow, that outer rotation is someone else's.

**This is a display system, not a dashboard.** Nobody interacts with it. It runs
unattended for weeks. The bar: on a wall nobody is actively watching, a bug that renders
convincingly can run for weeks.

The design is in `docs/DESIGN.md`. Read it before any slice of work.

## Commands

```bash
npm run dev          # local dev
npm run typecheck    # tsc --noEmit
npm run test         # vitest run
npm run build        # next build
```

## Non-negotiable

- **No backend.** No API routes, no serverless functions, no database, no auth. Two
  public published-CSV URLs, fetched from the browser. If a change needs a server, stop.
- **This project never writes to `BYOB_MASTER`.** It reads two published CSVs over plain
  HTTP with no credentials. There is no token, no service account, no Apps Script here.
- **Never hardcode a hex.** `app/forge-tokens.css` is the only file that may contain
  one. It is imported **last and unlayered** from `globals.css`, and both halves of that
  matter — move it above `mesa-tv.css` and the wall silently reverts to a white page with
  purple parts on it.

  This replaced the identical rule naming `.claude/skills/mesa-design/colors_and_type.css`,
  which is Mesa's parent green brand. Forge C1 is its purple re-skin
  (`mesa_forge_design_system/design_system.md`), so the palette changed and the
  discipline did not: one file owns colour, everything else reads a token.
  `colors_and_type.css` is still imported for type, spacing, radii and shadows.

- **Two surfaces, and a component must not name a colour.** Read `--surface`,
  `--ink`, `--ink-muted`, `--accent`, `--hairline` and let the surface decide what
  they mean.

  This is not tidiness. Every light accent that carries on Deep Aubergine dies on
  Lavender Mist and the deep purples do the exact reverse — gold goes 8.59:1 → 1.61:1,
  royal purple 1.39:1 → 10.01:1. A shared accent palette is invisible on half the
  rotation. Worse, a token that is a *surface* in one place and *ink* in another cannot
  survive the flip at all: `--deep-teal` is "deepest brand surface", and three things
  used it as ink. On the dark slide they painted text in the page colour and measured
  **1.00:1**. Fixed in §5 of `forge-tokens.css`; do not reintroduce the pattern.
  `VentureLogo`'s six mark tints were the same bug in a component, fixed the same
  way in §2a.

  **Both slides are `.surface-dark` today**, and this rule used to add that
  `/weekly` is `.surface-light` and that the rotation carries the Forge deck's own
  dark/light rhythm. That half was a brand argument rather than a correctness one
  and it was overruled deliberately: on Lavender Mist every one of thirty-nine
  venture marks needed a white ground to have an edge, and the venture names
  measured 4.61:1 against the page. On Deep Aubergine the marks *are* the light
  and the names measure 12.01:1. What it costs is the flip — two dark slides
  thirty seconds apart do not announce the rotation the way a dark-to-light cut
  did, and the layouts have to carry that now.

  **The machinery above stays, and stays exercised.** `.surface-light` is fully
  defined, every token still resolves on it, and nothing in either page tree
  names a colour — which is what keeps this one line to change back, and what
  makes the paragraph above still binding rather than historical.
- **No borrowed artwork, and the test is who drew it.** `LOGOS` in `config.ts`
  is empty, so every mark on the wall is `VentureLogo`'s two-letter monogram on
  a tinted disc. It listed all 39 for a while and every one of those files was
  the *previous* cohort's logo, renamed — `VBC101` wearing Dosa Crisps' mark. A
  monogram says "this venture has not drawn a mark yet"; borrowed artwork says
  something false about who a team is. Adding a real logo is one commit: the
  file in `public/logos/` and the id in that list, together.

  **`public/podium/blocks.png` is not an exception to this.** It is an image
  and this project drew it: the geometry, the palette, the camera and the
  lights are parameters in `scripts/render-podium.mjs`, the output is
  reproducible from them, and it claims to be nobody's mark. The rule is about
  a venture wearing a logo that is not its own. `public/lottie/ganesha.json`
  *is* the exception, and it carries its notice.

- **Nothing moves at rest, on either slide.** Not one of the thirty-nine cards,
  not the list of seven, not the three podium marks, not a masthead or a
  numeral. No sweeps and no dance; those went with the metals. The only motion
  either page can produce is an *arrival* — the crown landing when a slide
  mounts, and an overtake — and both are things that happened.

  `/podium`'s top three idled for a while: a bob, a glance on a `rotateY`, a
  tilt, on three timelines so they could never fall into lockstep. It was
  removed, asked for back, and **removed again after the crown arrived**, for a
  reason that is mechanical rather than aesthetic and that binds anything
  proposing to idle a mark again:

  > The glance is a `rotateY` of up to 34° under the 900px `perspective` on
  > `.tv-pod-mark-band`, and a perspective transform displaces an **off-centre
  > child differently from the element's own centre**. The crown sits well off
  > centre, on the disc's upper-left rim. So every glance swung it out of
  > contact with the head it was sitting on and back again, seventeen seconds
  > apart, on a wall nobody is watching closely enough to catch it. A crown
  > cannot be welded to a rotation whose centre it does not share.

  The bob alone would have survived; the glance could not. Bring the idle back
  and the crown has to come off, or be re-solved — those are the only two
  options, and the first one costs more than the idle is worth.

  **The crown is motion and it is not an exception**, which is worth being exact
  about because the next ornament will claim it is. `components/Crown.tsx` drops
  onto rank 1 and *stops* — one run, on mount, `animation: … both` with no
  iteration count. What this rule bans is motion **at rest**, and a thing that
  is over 1.4 seconds after the slide arrives is not at rest, it is an entrance.

  **The stage arriving is the same kind of thing.** `/podium`'s marks, names,
  figures and numerals fade in over the three blocks when the slide mounts —
  `tv-stage-in`, once, `both`, no iteration count, 3 · 2 · 1 — done by the time
  the crown lands, and then still. **The blocks themselves never move**, and
  that is no longer even a decision: they are one rendered image, so there is
  nothing to animate and nothing whose measured rect an overtake could catch
  mid-flight. The three CSS podiums that preceded this each had to argue the
  point. Nothing on the stage loops.

  **`/weekly`'s day mark is the third arrival, and it is the first one that
  fires on something other than a slide mount.** The two chevrons beside a
  day figure fade up bottom-to-top, 90ms apart, 380ms each — once, `both`, no
  iteration count — and they do it on exactly two occasions: the slide arriving,
  and *that team's* `todayRevenue` going up. Nothing else, and never at rest.

  The second trigger is the interesting one, and it is why this is an arrival
  rather than an ornament: a sale landing **is** a thing that happened, in the
  same sense an overtake is. The board's whole discipline is that movement means
  something changed hands, and this moves precisely when money did. It is also
  the first motion on this wall that is not about rank — a team can sell ₹40,000
  and not pass anybody, and until now the wall had no way to say so.

  **Both triggers are decided in `WeeklyGrid`, and a card is never allowed to
  decide for itself.** That is not tidiness; it is the whole correctness
  argument. A card is remounted whenever it crosses a row boundary, for any
  reason including being *pushed down* by somebody else's sale — so an animation
  on the card's own mount would announce a sale on the one card that had not
  made one, convincingly, with nothing to report it. `.tv-card-detail` already
  carries that scar. The grid compares two polls, and it compares with `>`
  rather than `!==`: midnight takes thirty-nine day figures to zero at once, and
  that is the loudest non-event on the wall. `render.test.tsx` pins all of it,
  including that the board is still afterwards.

  What it costs is the quiet board between polls being interrupted by up to
  thirty-nine cascades at once on arrival. That is the entrance, it is over in
  486ms, and it is the same trade `/podium` made with `tv-stage-in`. **A fourth
  arrival is a new argument, not an extension of this one** — and an idle
  version of this one is not an arrival at all.

  **And then one ornament did loop, so this rule is narrower than it reads.**
  The line above used to end by saying the board is completely still thirty
  seconds later, and that a twinkle, a sheen or a pulse does not get in on the
  crown's precedent and has to make its own argument. The crown's two glints
  are that argument, and they did not win it on the merits — they were asked
  for directly, after being built the other way first. Six positions on the
  crown fire **two at a time**, in three pairs that take it in turns: a pair
  strikes every six seconds, 0.36s between its two sparks, and never in the
  place the last one did. The rule is now: *nothing moves at rest except the
  crown's glint*, and the exception is one object, on one slide, twinkling
  twice at a time on an eighteen-second cycle.

  What it costs is stated rather than argued away. **The board is no longer
  still thirty seconds later**, which was the property that mattered and the
  one `render.test.tsx` pinned; that test now checks the narrower claim that
  the marks, numerals and rows are still, and says so. Every ornament after
  this one will cite the glint rather than the crown, because a looping
  precedent is a far cheaper thing to argue from than a one-shot one — so the
  budget is the count, and the count is **six positions, two lit**. A spark on
  every stone, or one on a `/weekly` card, is not an extension of this decision.
  Nor is putting the six on one beat: that is a crown flashing all over at once,
  and it is the same six elements.

  Where they can go is a measured constraint, not a taste one. A spark only
  reads where it breaks the silhouette against Deep Aubergine — drawn inside
  the metal it is pale gold on gold, and the mark's Lavender Mist disc sits
  behind the crown's lower right, so a pale warm spark there has nothing to be
  brighter than. Two positions were photographed and thrown away for exactly
  that. The five ball tips and the base band's lower-left corner are the whole
  of the usable set.

  The period is the part to defend. 720ms of spark, and six seconds between
  strikes, is an object catching the light; the same spark on a one-second
  cycle is a blinking fault light on a wall nobody is watching. **Lengthen it
  before shortening it.** Eighteen against the slide's thirty is also not a
  rounding — five strikes fit, A · B · C · A · B, so no pair repeats back to
  back, which is the failure three pairs exist to prevent.
- **Gold is back, as exactly one object.** `--forge-metal-gold` sat unread from
  the deletion of the plinths until the crown, kept on §5's stated condition
  that if it returned it would "arrive as one decision in one place". The crown
  is that decision: one glyph, one rank, one slide, no plinth and no sweep. The
  budget is spent — a second gold thing is a new argument, not an extension of
  this one. Components read `--crown-ink`, never the metal token, because gold
  measures 8.59:1 on Deep Aubergine and **1.61:1 on Lavender Mist**, so the
  light surface answers with Royal Purple instead.

  **And on 12 September 2026 the plinths came back — as a render.**
  `/podium`'s three places stand on blocks that are one image,
  `public/podium/blocks.png`, drawn by `scripts/render-podium.mjs`. Asked for
  directly, with nine reference podiums, as "more graphical and colourful ...
  how Airbnb or Duolingo would design it".

  **Five attempts at building them in CSS came first, and all five failed the
  same way**: metal plinths, gradient slabs, cylinders, 3D boxes, leaning 3D
  boxes. The references are rendered illustrations — real lights, soft
  shadows, ambient occlusion, material — and CSS 3D gives the geometry with
  none of the materials, so the result signals "three dimensional" and cannot
  pay it off. That is worse than staying flat. **Anything proposing to rebuild
  these blocks in CSS is proposing the sixth attempt.**

  The gold exemption is untouched: the crown is still the one gold object, and
  silver and bronze are still read by nothing.

  Three things this costs, stated rather than argued away:

  - **The blocks' colour is baked**, which is the one thing the hex rule
    exists to prevent. Changing it is a script edit and a re-render, not a
    token edit, and it cannot follow a surface flip. Everything printed *on*
    the blocks still reads a token and still flips. §7 of `forge-tokens.css`
    records the ramps.
  - **`lib/podiumBlocks.ts` is generated**, and it is what says where the
    blocks are. Nothing may re-derive those numbers; a second opinion about
    where a top face projects to is how a mark ends up hovering off its
    platform at one viewport and looking right at another.
  - **The render's camera must stay off-axis.** It is what makes every block's
    front face an exact rectangle, which is what lets the venture name and its
    figure be ordinary flat type. Pitching the camera rakes the type, and this
    wall is read at six metres. That was the fault that killed the fifth CSS
    attempt, and it is available to a renderer too.

- **One looping Lottie is on the wall, for three days, and it is the borrowed
  artwork exception too.** `components/Ganesha.tsx` puts an 80px Ganesha in the
  bottom-left corner of both slides from **14 to 16 September 2026** and renders
  `null` the other 362 days. It loops, which the rule above says an ornament does
  not get to do on the crown's precedent — so it makes its own argument, and the
  argument is in that file rather than here.

  The short form: the motion rule protects *the board*, where movement means a
  rank changed hands. This carries no figure, sits outside the board, and is
  bounded by a date rather than by someone remembering. That last part is the
  condition, not a detail — the ornament's correct state is **absent**, and
  absence is the one state no polling loop arrives at on its own. `isFestival`
  in `lib/schedule.ts` owns the window; `GANESH_UNTIL_ISO` is the **17th**,
  exclusive, because naming the last day gives two days instead of three and
  looks exactly like a wall configured that way.

  It is also the only artwork here this project did not draw, which the `LOGOS`
  rule below otherwise forbids — and the distinction that lets it in is the one
  that rule is actually about. A borrowed venture logo says something false
  about a team; a festival illustration is not claiming to be anyone's mark.
  `public/lottie/ganesha-NOTICE.txt` carries the author and licence beside the
  file, the way `Crown-NOTICE.txt` does. The JSON is the untouched download so
  it can go back into the LottieFiles editor; the maroon background layer and
  the two baked-in text layers are stripped at runtime, not in the file.

  **The crop must be measured on every frame, and the mooshika is why.** The
  ornament is a crop, because the idol occupies only part of a 1920x1080
  composition. The first crop was taken from six sampled frames — 0, 40, 90,
  140, 190, 217 — and Ganesha's vahana is on screen for none of them: it runs
  frames 46 to 83, about 1.2 seconds of the 7.3, and sat in the gap between two
  samples. So for those frames the corner showed a rat sliced through by the
  crop's bottom edge, twice a minute, while every measurement taken said the
  crop was right. Rendering convincingly and reporting nothing is this wall's
  stated failure mode, and a sampled measurement is how it got in.

  The fix is the shape of the crop, not the removal of the rat — **the rat was
  briefly stripped and that was wrong.** It is 928x794 rather than 928x720: the
  idol's width, extended down to clear the rat's lowest point at y 1064. The
  animal crosses the *whole* 1920 composition, so no affordable crop holds its
  path; it only has to hold its **vertical band**, and horizontally it enters
  and leaves at the edges exactly as it does in the artist's own frame. The box
  is 88px rather than 80 so the idol still renders at 78.5px inside the taller
  crop, and a taller crop is a narrower one — 102.9px wide against the old
  103px, so the footprint did not move. **104px is the width ceiling** in that
  gutter; check the width before changing the height.

  **If it should stop looping, that is one word** — `loop: false` on the
  `loadAnimation` call — and what remains is a figure that arrives once and
  holds, exactly as the crown does. **A second looping ornament is a new
  argument, not an extension of this one.**
- **No filler content.** Empty is a valid state. The wall being quiet is what makes it
  loud when something happens. No spinners, ever — first paint reads cached CSV.
- **There is no footer and there is no `as_of` stamp. This wall now cannot
  say that it has stopped.** The footers went on 11 September 2026 and took the
  stamp with them; the stamp returned to the right of the masthead on the 13th
  after a design review; it was removed again the same day, asked for directly
  and twice, with the case below put first and overruled.

  State the cost rather than arguing it away, because it is the largest single
  one on this wall. **This wall shows no error state, by design** — a failed
  fetch, a revoked sheet, a stalled consolidator or a sleeping laptop all keep
  the last good data and go on rendering perfectly healthy stale numbers for
  days, because a red banner on a screen nobody is watching helps nobody. The
  stamp was the only element on either slide that made that visible.
  `docs/DESIGN.md` §2 added it for exactly that reason and called it a
  deliberate exception to the brief's layout. **So a board frozen on Tuesday is
  now pixel-identical to a working one**, and nothing in the product will tell
  anybody. `Sync Status` in the master will, which is where a suspected freeze
  gets diagnosed now; what is gone is the passer-by who was not suspecting one.

  **The reason given does not survive contact and the decision stands anyway.**
  It was that the wall refreshes every ten minutes so the stamp is redundant. A
  fast cadence is what gives a stamp its teeth — `10:00` on a 4pm wall is
  obvious in a way no figure on this board can be — so if the cadence argument
  is ever what brings it back, it should be known that it is the wrong one in
  both directions. What carries the removal is the same thing that carried the
  footers: this is a display, and a line of provenance apparatus is furniture
  on a slide that is meant to be figures.

  **If it returns, it returns to one place.** `components/WallHeader.tsx` is
  what both slides get their masthead from, and that is the property to
  protect: the stamp drifted once into one slide and not the other, and a wall
  that stamps half of itself is no more use than one that stamps none of
  itself. `AsOf.tsx` and `.tv-mast-stamp` are in git at `b01eb5d`; it goes back
  as the last child of `.tv-mast-meta`, and it must render nothing before there
  is data, because empty is a valid state here and a stamp with no figures
  beside it states the provenance of nothing.

- **Neither board states its window now, and `/podium` is the one that lost
  it.** It carried `All time` beside its name until 13 September 2026; removal
  was asked for directly. `/weekly` never carried anything, because its day chip
  and its `Revenue since` caption already bound its window.

  What this costs is stated rather than argued away. The same venture reads
  ₹2,42,546 on one slide and ₹12,400 on the other thirty seconds later, and
  nothing on either slide now says why. The wall is back to relying on the
  argument the word was added to stop relying on — that the audience is
  thirty-nine teams who live the programme daily, so they know which board is
  which. That is a claim about the people in the corridor rather than about the
  board, and it is the one being made again.

  **The machinery stays and stays exercised.** `WallHeader`'s `scope` prop is
  still there, still typed, still styled as `.tv-mast-scope`, and
  `render.test.tsx` still pins that the prop is what decides — so no slide can
  come to carry the wrong one, and putting the word back is one prop on one
  line.

- **No trigger types beyond the 15 in the design.** The list was deliberately narrowed.
- **The rotation between the two slides is ours, and it is the only rotation logic
  here.** `components/Rotator.tsx`, thirty seconds a slide, by soft navigation. That
  reverses the original "external system" rule, which assumed the campus slideshow drove
  both URLs. It must never become a page reload: the TV runs fullscreen with nobody at
  the laptop, and a reload drops out of fullscreen for good. Nothing else about the
  rotation — ordering with the other Mesa slides, what else is in the loop — belongs
  here.

## Domain

- 42 workbooks, `SLE-C401`–`SLE-C442`. Team IDs come from `Team Links` col A, rows 6–47.
- **Logged (proof-backed) revenue is the only figure used.** `Daily Team Summary` col B,
  which is `SUMIFS('Daily Dump'!$N:$N, 'Daily Dump'!$D:$D, "Sale")`. Column N is already
  proof-gated upstream (proof = `Yes` AND units ≥ 1). Summing `Amount` (col I) instead
  would count unproven and zero-unit sales and silently disagree with every existing
  rollup. Verified revenue is not used anywhere in this project.
- Ranking: **logged revenue desc → units desc → team ID asc**, matching the admin
  dashboard's `compareTieBreak`. Rank is computed client-side, so the sort is the single
  authority on order.
- **Programme weeks are anchored 31 August 2026, and it must stay a Monday.** The
  31st is a Monday; 1 September, which this was briefly set to, is a Tuesday. An
  anchor on the wrong weekday reports nothing — the formula still returns a
  plausible small integer, it just rolls a week on the wrong day, and the two
  anchors agreed on 11 September. Written in three places that must move together:
  `TV_Feed!D2` (which decides the day `week_revenue` zeroes), `current_open_week`
  on `TV_Cohort` (which tells the wall that zeroing was a reset, not 39 overtakes),
  and `PROGRAMME_START_ISO` in `config.ts`.
- Mesa Flea: **25 October 2026**, 10:00 IST assumed — moved from 31 October, and it
  lives in `TV_Cohort` rather than in code, so the wall picked the change up on its
  next poll. The Cohort 2026 dates this line used to carry (20 July anchor, 13
  September Flea, 30 September capital repayment) belong to the previous arc; the
  repayment date has no Forge C1 equivalent recorded here and is not read by any
  code.
- A team with an empty `venture_name` **does** fire a trigger, like any other. This line
  previously claimed the opposite; `lib/overtake.ts` never enforced it, and the behaviour
  it describes is not the one we want — an unnamed team that overtakes has still overtaken.
  The card carries its Team ID rather than a blank, so the wall celebrates `SLE-C407` by
  name-or-ID rather than not at all. Decided in
  `docs/superpowers/specs/2026-08-12-weekly-card-grid.md` §3; the doc was corrected to
  match the code, not the other way round.
- **`/weekly` shows one of two contests, and `TV_Cohort`'s `challenge_mode` cell
  picks which.** `Yes` ranks and prints `challenge_revenue` under a `10-Day
  Challenge` heading with the day chip and the `Revenue since` caption; anything
  else ranks and prints `week_revenue` as `Weekly Leaderboard` with both of those
  gone. One cell, not two booleans — two have four states and only two mean
  anything. Not derived from the `challenge_*_iso` dates either: those say *when*
  and stay put through a switch-off, this says *whether*. Every unreadable value
  falls to week, because `week_revenue` is required and always real while
  `challenge_revenue` between challenges is whatever the consolidator last left
  there — guessing wrong towards challenge is ₹0 on 39 cards, rendered perfectly.
  `lib/board.ts` owns all of it, including folding the mode into the reset period
  so flipping the cell does not read as 39 overtakes.
- Currency: `Intl.NumberFormat('en-IN')` — `₹1,04,500`, not `₹104,500`.

## Traps that report nothing

All of these render convincingly and pass typecheck, lint and tests. Verify by reading
`getComputedStyle` / `getBoundingClientRect` back from a real browser at **1920×1080**,
not by reading source.

- **Tailwind v4 utilities lose to unlayered CSS.** The design system's `.overline`,
  `.small`, `.caption` and `h1`–`h4` each set a colour, so unlayered they beat every
  `text-*` utility. `globals.css` imports the system with `layer(components)` for this
  reason. Class rules in `mesa-tv.css` go inside its `@layer components` block.
- **`.overline` is also a real Tailwind utility** (`text-decoration-line: overline`), and
  utilities beat the components layer. `globals.css` carries an unlayered override.
  Before using any design-system class name, check it against `overline`, `underline`,
  `truncate`, `container`, `block`, `inline`, `table`, `grid`, `flex`, `hidden`,
  `visible`, `fixed`, `static`, `sticky`, `capitalize`, `uppercase`, `lowercase`,
  `italic`, `antialiased`.
- **A non-existent Tailwind step emits no rule and no warning.** `opacity-16` does
  nothing. Use a real step or an explicit arbitrary value, then confirm the computed one.
- **`corner-shape: squircle` at an unchanged radius makes a corner *squarer*.** A
  superellipse stands `0.159·√2·r` off the box corner where a circular arc stands
  `0.293·√2·r`, so it is 0.54 as deep at the same number — Apple's continuous corner
  needs the radius multiplied by ~1.85 to land where the old one was. Both corners on
  this wall carry the pair: `corner-shape` beside `--r-card` / `--r-pod-row`, both 26px
  standing in for the 14px circles they replaced, argued at `--r-card`. Move one without
  the other and the shape changes rather than the smoothing. Chrome has had the property
  since 139; the graceful fallback is a genuinely rounder corner, not a missing one.
- **Motion `layout` transforms are ignored by `<tr>`.** Reordering rows must use grid
  rows with ARIA table roles. Measured in the dashboard: 30 animation frames with the
  transform present and the row at exactly one position throughout.
- **A font without U+20B9 draws the rupee in a different font, and nothing says so.**
  Every figure on both slides begins `₹`. A face missing that codepoint does not
  fail — the browser silently falls to the next entry in the stack for that one
  glyph, so the digits are the chosen face and the rupee sign is Helvetica, at a
  different weight and width, on every number on the wall. Checked against the
  cmap before a face is bundled, never assumed. Shortlisted faces that **lack
  it**: Satoshi, Switzer, Outfit, Onest, Instrument Sans, Instrument Serif,
  Gabarito, Red Hat Display, Be Vietnam Pro, Chillax, Plein, Panchang, and **DM
  Serif Display, which this wall ships** — the first of those is the
  most-downloaded sans on Fontshare. Figtree, which draws every figure, carries
  it.

  **The masthead face is the one permitted exception and the scope is what makes
  it safe.** `--font-serif` has exactly one reader, `--t-tv-heading`, and that
  draws three strings — `BYOB Leaderboard`, `Weekly Leaderboard`, `10-Day
  Challenge` — every one of them a constant in this repo and none of them a
  figure. **A face without the rupee may never be given a second reader.** The
  moment `--font-serif` is put on anything that can carry a number, the check
  above applies to it in full.

  The same check covers venture names, which come from a spreadsheet this
  project does not control. `YŌKI` is on the board today and needs U+014C, which
  is why **Figtree ships whole rather than latin-subset**. The masthead face is
  subset, and the difference is the point: it draws headings that are constants
  in this repo, never a spreadsheet value.

- **Nothing on this wall is set in all caps by CSS any more, and the venture
  names are cased in code instead.** `text-transform: uppercase` used to sit on
  the masthead and on all three name rules, which made the board look consistent
  while hiding that the data is not: of the 41 names in the feed, **10 are
  written ALL CAPS in the sheet and 3 are lowercase**. Deleting the declarations
  alone would have put `BLUNNT` next to `snackerly`.

  `titleCase` in `lib/team.ts` owns it, and the rule is **per name, not per
  word**: a name containing both an uppercase and a lowercase letter is printed
  exactly as the sheet has it; anything else is lowercased with each word's
  first letter raised. That keeps `SoleMate`, `ATC (All Things Camphor)` and
  `The Chips n Dip Story` intact — all three are damaged by a per-word
  title-caser — while fixing `XOCO` and `aarambh`. All 41 names come out right
  with no exception list.

  It is applied in `nameOf`, which was already the shared funnel both boards
  use, so `/weekly` and `/podium` cannot come to disagree. **The team-ID
  fallback deliberately bypasses it**: `SLE-C407` has no lowercase, so the rule
  would read it as un-cased and print `Sle-c407`.

  **Every tracking value on a name was tuned for capitals and has come down
  with them** — `--track-card-name` 0.06 → 0.01em, both podium names likewise,
  `--track-tv-heading` to 0. Positive tracking opens up capitals; lowercase is
  already spaced by its own ascenders. Put a `text-transform` back and the
  tracking has to go back up with it.

- **A weight outside a variable font's axis is synthesised, not refused.** The
  browser smears the outlines into a fake bold, which closes the counters and
  turns `8` into a blob at six metres. Four faces here have had a different
  range — Bebas Neue was 400 only, Clash Display stopped at 700, DM Serif
  Display is 400 only, Figtree starts at 300 — and the trap springs when a token that
  was fine under the old face is left alone through a swap. A comment never
  caught it; `render.test.tsx` reads each `localFont` call's range out of
  `app/layout.tsx` and fails any type token that exceeds it.

- **Two faces, and adding a third is a design argument rather than a token.**
  The wall ran four for a while — serif masthead, sans for labels, a second sans
  for venture names, a display face for numerals — each scoped to one job and
  each locally defensible. It read as designed *at* rather than designed. Notion,
  Slack and Duolingo all ship one family and take hierarchy from weight, size,
  colour and shape; Duolingo's weekly leaderboard is very nearly this product.
  Hierarchy here is 700 for names and ranks, 800 for money, and `--ink` against
  `--ink-muted`. That ladder is the whole system.

- **`cache: 'no-store'` on both fetches.** Without it the browser HTTP cache serves one
  body for the life of a page that never manually reloads, and the wall freezes silently.
- **A revoked sheet returns an HTML login page with HTTP 200.** Status codes pass it;
  only the parsed-row gate catches it.

## Working style

Detective, not decorator: theory of the crime, then evidence, then fix. Surgical changes,
one at a time. Commit after every completed slice — git is the rollback path. The user is
non-technical but builds automations, and wants honest pushback over agreeableness.

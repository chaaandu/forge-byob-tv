import type { Metadata } from 'next'
import localFont from 'next/font/local'

import { Ganesha } from '@/components/Ganesha'
import { Rotator } from '@/components/Rotator'
import './globals.css'

/* ── Two faces, and the argument for two rather than four ──

   **Self-hosted, so the wall makes no runtime request to a font CDN.** That
   matters more here than in a normal app: this runs unattended for weeks, and a
   font request that fails silently falls back to Georgia or Helvetica on a
   screen nobody is watching closely enough to notice.

   **No const here may be named after a family `colors_and_type.css` already
   declares.** `next/font` derives its CSS family name from the const, and that
   file declares seven static `Manrope` rules and four `MesaSerif` ones. CSS
   family names match case-insensitively, so a collision merges the two sets and
   the browser picks between them by weight — fetching a static face as well as
   the variable one, or preferring a `local()` system font over the self-hosted
   file. Hence `wallBody` and `wallSerif` rather than anything named for Mesa.

   ── Why two ──

   This wall carried four families for a while — a serif masthead, a sans for
   labels, a second sans for venture names, a display face for every numeral —
   each scoped to one job and each argued for on its own terms. Every one of
   those arguments was locally correct and the board still read as a thing that
   had been designed at rather than designed.

   The reference that settled it is that **Notion, Slack and Duolingo all ship
   one family and take their hierarchy from weight, size, colour and shape.**
   Notion's product UI is a system stack; Slack ran on Lato for years; Duolingo's
   app body was Nunito. Duolingo's weekly leaderboard is very nearly this
   product — ranks, names, figures, a list, a podium — and it is one family.

   So the split this wall used to make in *type* is made in weight and colour
   instead, which is where the card was already making it. `--t-tv-card-name` is
   700 at `--fs-6` in muted ink; `--t-tv-card-week` is 800 at `--fs-4` in full
   ink; they sit one above the other on the same card. That was never ambiguous
   and never needed two faces to say it. */

/**
 * Figtree, and it is the voice of everything on both slides except the
 * masthead: every venture name, every rupee figure, every rank, every label,
 * the podium's numerals, the day count and the Flea countdown.
 *
 * **It carries U+20B9.** That is the gate, not a formality — a face missing the
 * rupee does not fail, it draws every `₹` on the wall in whatever answers next
 * in the stack, which is a Helvetica rupee against Figtree digits, twice a
 * minute, for weeks, reporting nothing. Four faces that were on the shortlist
 * fail it outright: Outfit, Onest, Instrument Sans and Gabarito.
 *
 * **And it fits, which two better-known faces do not.** Line boxes counted
 * across all forty-one names in the feed, in the real 148px card at
 * 15px/700/0.06em: 33 on one line, 8 on two, none needing a third. **Inter and
 * Rubik both need a third line** for `IN BETWEEN SIPS BY KAAPPITALISM` — so the
 * Notion-style answer, which was the obvious one to reach for, does not
 * actually fit this card without retuning a tracking value that has already
 * been retuned twice for that same name.
 *
 * **Shipped whole rather than subset**, unlike the serif below, and the
 * distinction is what each face draws. This one draws venture names, which come
 * from a spreadsheet this project does not control and which can be edited on
 * any given Tuesday. `YŌKI` is on the board today and needs U+014C. A
 * hand-picked subset would be a guess about strings nobody here owns.
 *
 * The axis is **300–900**, and 300 is also the fvar default — so a token asking
 * for 200 would be quietly clamped rather than honoured. `render.test.tsx`
 * checks every type token against the range declared right here.
 */
const wallBody = localFont({
  src: './fonts/Figtree-Variable.woff2',
  weight: '300 900',
  display: 'block',
  variable: '--font-wall-body',
})

/**
 * Newsreader, for the masthead and nothing else.
 *
 * **The brand book names it.** `mesa_forge_design_system/design_system.md` is
 * explicit — "Headers in New York (serif) for a classy editorial feel;
 * everything else in Manrope" — and its font note offers Newsreader and
 * Fraunces as the free stand-ins for New York. This is the first of those,
 * which makes it the one choice on this wall that is the brand book's rather
 * than a preference.
 *
 * It is the second family, and the only one, because a masthead is the one
 * place a display voice pays for itself: it is a single fixed line per slide
 * that never changes and never has to be compared to anything beside it.
 *
 * **Subset, unlike the body face, and that is deliberate rather than
 * inconsistent.** This face draws three strings — `BYOB LEADERBOARD`, `WEEKLY
 * LEADERBOARD`, `10-DAY CHALLENGE` — and all three are constants in this repo,
 * not spreadsheet values. So Latin-1 plus Latin Extended-A is a safe cut where
 * it would not be on the sans. It is still a *range* rather than the exact
 * glyphs in those three strings, because a heading can be reworded in a commit
 * and a subset cut to the letters of one sentence is a tofu waiting to happen.
 *
 * **The `opsz` axis is pinned at 40 and dropped from the file.** Newsreader
 * ships an optical-size axis spanning 6–72, and two live axes more than doubled
 * the file: 152KB subset, against 70KB with `opsz` instanced out. The masthead
 * renders at one size — `--fs-2`, 40px at 1920 — so a pinned optical size is
 * not a compromise here, it is the correct value baked in. It also means the
 * `font:` shorthand in `--t-tv-heading` is sufficient on its own, with no
 * `font-variation-settings` that a later shorthand could reset.
 *
 * **The axis stops at 800.** The masthead was 900 under the face this replaces;
 * ask a variable font for a weight outside its range and nothing fails, the
 * browser synthesises one by smearing the outlines. `render.test.tsx` fails on
 * a type token that asks this face for more than 800.
 */
const wallSerif = localFont({
  src: './fonts/Newsreader-Variable.woff2',
  weight: '200 800',
  display: 'block',
  variable: '--font-wall-serif',
})

export const metadata: Metadata = {
  title: 'BYOB Wall',
  description: 'Live leaderboard and Mesa Flea countdown for BYOB Cohort 2026.',
}

/**
 * `display: 'block'` on both faces, not the usual `swap`.
 *
 * On an interactive page `swap` is right — text should be readable immediately
 * even in a fallback face. This page is a fixed frame that nobody reads in the
 * first 100ms, and a swap would mean every rotation flashes Helvetica before
 * settling into Figtree. `block` holds the (very short) render until the real
 * face is there. The files are local, so the block period is a cache hit after
 * the first load of the day.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={[wallBody.variable, wallSerif.variable].join(' ')}>
      <body>
        {children}
        {/* Renders nothing. It is the wall's slideshow — thirty seconds a slide,
            by soft navigation, so the page never reloads and never drops out of
            fullscreen. Mounted here rather than in either page because it has to
            outlive both of them: a rotator inside `/weekly` would unmount at the
            moment it navigated away and never arm the swap back. */}
        <Rotator />
        {/* Ganesh Chaturthi, 14–16 September 2026, bottom-left of both slides.
            Renders nothing for the other 362 days.

            **Here rather than in either page, and for the load-bearing half of
            `Rotator`'s reason rather than the obvious one.** A looping animation
            mounted inside `/weekly` would be destroyed and rebuilt every thirty
            seconds — 877KB re-parsed and a fresh SVG tree written, twice a
            minute, forever — and the loop would restart from frame 0 on every
            rotation, so the idol would perform the same first second of its
            animation and never reach the rest of it. Mounted here it survives
            the soft navigation the way the rotator itself does, and simply
            keeps going while the board changes underneath it. */}
        <Ganesha />
      </body>
    </html>
  )
}

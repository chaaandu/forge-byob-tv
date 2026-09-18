import type { Metadata } from 'next'
import localFont from 'next/font/local'

import { Ganesha } from '@/components/Ganesha'
import { Rotator } from '@/components/Rotator'
import './globals.css'

/* ── One face, and the argument that took it from four to two to one ──

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
   file. Hence `wallBody` rather than anything named for Mesa. `wallSerif` sat
   beside it until 13 September 2026 and is gone — see below.

   ── Why one ──

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
   and never needed two faces to say it.

   ── And then two became one ──

   The masthead was asked, on 13 September 2026, to be centred, larger, bold and
   in capitals. **DM Serif Display has one weight**, so "bold" was not a token
   edit — it was the face or nothing, and a synthetic 800 smears the outlines on
   a wall read at six metres. The heading is Figtree 900 now and the serif is
   deleted rather than left loaded: it was bundled with `display: 'block'`, so an
   unread face is a render this page waits on for nothing.

   The argument above survives it intact. The serif's defence was that a masthead
   should be the one thing on the frame speaking in a voice nothing else uses;
   all-caps had already spent most of it, since a display serif's character is in
   its lowercase. What is left is the reference the paragraph above names —
   Notion, Slack, Duolingo — which was one family all along.

   Two things this costs, stated rather than argued away:

   - **`AGENTS.md`'s rupee exception is no longer exercised.** The rule is that a
     face without U+20B9 silently draws every `₹` on the wall in the next face in
     the stack; the masthead was the one permitted exception, safe because
     `--font-serif` had exactly one reader and that reader drew three constants.
     Figtree carries the rupee, so the wall no longer ships a face that lacks it
     — which retires the exception rather than widening it. The *check* stays
     binding on any face added later.
   - **`--font-serif` still exists and still points at generics.** It is not
     deleted, because `colors_and_type.css` declares its own with a
     `fonts.gstatic.com` `src` behind a `local("New York")`, and this wall's
     unlayered declaration is what keeps that CDN unreachable. Nothing reads it;
     it is a blocker, not a face. */

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

/* `wallSerif` stood here: DM Serif Display, subset, `weight: '400'` — the whole
   family, Regular and Italic, no second weight to reach for. It drew the
   masthead and nothing else from 13 September 2026 until later the same day,
   when the masthead was asked to be bold. Its docblock carried two things worth
   keeping and both have moved: the synthetic-bold trap, which is now the whole
   subject of `render.test.tsx`'s axis guard, and the rupee exception, which is
   in the block at the top of this file. */

export const metadata: Metadata = {
  title: 'BYOB Wall',
  description: 'Live leaderboard and Mesa Flea countdown for BYOB Cohort 2026.',
}

/**
 * `display: 'block'` on the face, not the usual `swap`.
 *
 * On an interactive page `swap` is right — text should be readable immediately
 * even in a fallback face. This page is a fixed frame that nobody reads in the
 * first 100ms, and a swap would mean every rotation flashes Helvetica before
 * settling into Figtree. `block` holds the (very short) render until the real
 * face is there. The file is local, so the block period is a cache hit after
 * the first load of the day.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={wallBody.variable}>
      <body>
        {children}
        {/* Renders nothing. It is the wall's slideshow — thirty seconds a slide,
            by soft navigation, so the page never reloads and never drops out of
            fullscreen. Mounted here rather than in either page because it has to
            outlive both of them: a rotator inside `/daily` would unmount at the
            moment it navigated away and never arm the swap back. */}
        <Rotator />
        {/* Ganesh Chaturthi, 14–17 September 2026, bottom-left of both slides.
            Renders nothing for the other 361 days.

            **Here rather than in either page, and for the load-bearing half of
            `Rotator`'s reason rather than the obvious one.** A looping animation
            mounted inside `/daily` would be destroyed and rebuilt every thirty
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

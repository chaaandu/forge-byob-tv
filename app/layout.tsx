import type { Metadata } from 'next'
import localFont from 'next/font/local'

import { Ganesha } from '@/components/Ganesha'
import { Rotator } from '@/components/Rotator'
import './globals.css'

/* ── The three faces, and the two rules that apply to all of them ──

   **Self-hosted, so the wall makes no runtime request to a font CDN.** That
   matters more here than in a normal app: this runs unattended for weeks, and a
   font request that fails silently falls back to Georgia or Helvetica on a
   screen nobody is watching closely enough to notice.

   **No const below may be named after a family `colors_and_type.css` already
   declares.** `next/font` derives its CSS family name from the const, and that
   file declares seven static `Manrope` rules and four `MesaSerif` ones. CSS
   family names match case-insensitively, so a collision merges the two sets and
   the browser picks between them by weight — fetching a static face as well as
   the variable one, or preferring a `local()` system font over the self-hosted
   file. Hence `wallBody` and `wallSerif` rather than anything named for Mesa. */

/**
 * Excon, and it replaces Manrope as the voice of both slides.
 *
 * **This is the largest brand departure in the project and it should be named
 * as one.** `design_system.md` gives Manrope every role but the header, and
 * this takes all of them away from it. Manrope is not in `app/fonts` any more
 * and nothing on either slide is set in it. What survives is the *shape* of the
 * rule — one sans owns every number, name and label — and the reason the rule
 * exists, which is that a wall read at six metres cannot afford a second
 * opinion about what a figure looks like.
 *
 * Why the swap is worth it, from the measurements that drove it:
 *
 * - **Manrope is a product-UI face.** It was drawn for 14-16px app interfaces.
 *   Its virtues go neutral at six metres and its metrics do not: cap height
 *   0.720em, so every px of type buys less read than it looks like it should.
 * - **Excon holds the geometry and gains the range.** Cap height 0.720em —
 *   identical, which is why the grid did not have to be re-tuned — and
 *   `₹2,42,546` sets 5% *narrower* at the podium's size. It reaches **900**
 *   where Manrope stops at 800, so the board has a weight above the one every
 *   figure already uses. Nothing spends that yet; it is headroom, deliberately.
 * - **Digit widths spread 32% against Manrope's 42%**, which matters on a board
 *   whose figures change under a poll.
 *
 * **It carries the rupee.** That is not a formality: it is the gate that
 * eliminated Satoshi, Switzer, Chillax, Plein and Panchang from this decision,
 * every one of which lacks U+20B9 outright. A face without it renders each `₹`
 * in whatever the next entry in the stack happens to be — a Helvetica rupee
 * against Excon digits, twice a minute, for weeks, with nothing reporting it.
 * Checked against the cmap of every candidate before any of this was written.
 *
 * **Shipped whole rather than subset**, unlike the 9.8KB latin cut Archivo
 * Black used to be. 30KB of woff2 against the 163KB *unconverted TTF* Manrope
 * was shipping, so there was no size argument for cutting it — and venture
 * names arrive from a spreadsheet that can be edited on any given Tuesday. A
 * hand-picked subset is a guess about strings this project does not control.
 * `YŌKI` is already on the board and already needs U+014C.
 */
const wallBody = localFont({
  src: './fonts/Excon-Variable.woff2',
  weight: '100 900',
  display: 'block',
  variable: '--font-wall-body',
})

/**
 * Zodiak, self-hosted, and it is the wall's only serif.
 *
 * It replaced Source Serif 4, which stood in for New York and **drew nothing**.
 * Measured with `getComputedStyle` over every element on both slides: the wall
 * rendered in two families, neither of them the serif. `--font-serif` had one
 * declaration and no reader — the serif ranks that used it went to a chip, and
 * the heading that used it went to Manrope — so 119KB of woff2 was preloaded
 * on every rotation to paint nothing.
 *
 * Rather than delete the serif, it changes hands and gets the job the brand
 * book always gave it. `mesa_forge_design_system/design_system.md` is explicit:
 * "Headers in New York (serif) for a classy editorial feel; everything else in
 * Manrope." The wall had dropped that half entirely and set its masthead in the
 * same face as its labels. Zodiak is the substitute the brand book itself
 * invites — it names Newsreader and Fraunces as free stand-ins for New York —
 * and it reaches 900, which is what a masthead over a thirty-nine card grid
 * needs and which neither New York nor Source Serif 4 can do.
 *
 * **The family-name hazard the old docblock was built around does not apply,
 * and that is worth stating rather than assuming.** `colors_and_type.css`
 * declares four `@font-face` rules for a family called `MesaSerif` whose `src`
 * begins `local("New York")`; CSS family matching is case-insensitive, so a
 * const named `mesaSerif` would have merged with them and let a machine with
 * New York installed set the heading in a different serif from a machine
 * without. `wallSerif` collides with nothing — not `MesaSerif`, not `Manrope`,
 * and not any face a Mac or a Windows laptop ships. The guarantee is the same
 * one, kept by a name that no longer has to pretend.
 */
const wallSerif = localFont({
  src: './fonts/Zodiak-Variable.woff2',
  weight: '100 900',
  display: 'block',
  variable: '--font-wall-serif',
})

/**
 * Satoshi, for venture names and nothing else.
 *
 * The names were in Excon and read **too sharp** — Excon's terminals are flat,
 * its apertures tight and its x-height the highest of anything measured here
 * (0.557em), which is what makes it good at a figure and hard at a word. A
 * venture's name is the one thing on the card that belongs to a person.
 *
 * **It does not carry the rupee, and that is genuinely fine here.** U+20B9 is
 * the gate that this project applies to any face that draws a figure — it is
 * why Switzer, Chillax, Plein and Panchang were all rejected — and Satoshi
 * fails it. It is safe anyway because the three tokens below it own are venture
 * names, and a venture name has no rupee in it.
 *
 * That is a claim about the data rather than about the font, so it is guarded
 * rather than trusted:
 *
 * - `--font-name` lists **Excon second**, so if a venture is ever *named* with
 *   a `₹` — "₹99 Store" is not a far-fetched student venture — the glyph is
 *   drawn by the wall's own sans instead of by Helvetica.
 * - `render.test.tsx` pins that only the three name tokens read `--font-name`.
 *   A figure token drifting onto this face is the failure mode, and it is the
 *   kind that renders convincingly and reports nothing.
 *
 * Fit was measured before it was chosen, across all forty-one names in the
 * feed, in the real 148px card at 15px/700/0.06em: 33 on one line, 8 on two,
 * **none needing a third**. Four faces that were on the shortlist do need one —
 * Synonym, Red Hat Display and Work Sans each break `IN BETWEEN SIPS BY
 * KAAPPITALISM`, and Be Vietnam Pro breaks `ATC (ALL THINGS CAMPHOR)` too.
 */
const wallName = localFont({
  src: './fonts/Satoshi-Variable.woff2',
  weight: '300 900',
  display: 'block',
  variable: '--font-wall-name',
})

/**
 * Clash Display, for every numeral on the wall.
 *
 * **This is the split the board was missing.** Until now the venture and the
 * money were the same face one weight apart, on a leaderboard whose entire job
 * is *who* and *how much*. Now the two are different species of type: names in
 * a soft geometric sans, figures in a display grotesk with actual character.
 *
 * It takes `--t-tv-card-rank` as well, which **retires Bebas Neue** — the
 * fourth face, whose stated reason for being bundled (`/podium`'s venture
 * names) had not existed for some time and which was drawing two digits in a
 * corner tag. One face now owns every number on both slides: the `₹` figures,
 * the ranks, the podium's 1/2/3, the day count and the Flea count.
 *
 * **It stops at 700, and that is load-bearing.** Bebas had the identical trap
 * and the identical note: ask a face for a weight it does not have and the
 * browser synthesises one by smearing the outlines, which closes the counters
 * and turns `8` into a blob at six metres. Every figure token that was `800`
 * is `700` here for that reason, and `render.test.tsx` fails if any token
 * reading `--font-numeral` asks for more than 700.
 *
 * Fit was the open question and it went the other way from the guess. Clash is
 * a wide face, but at 700 against the Excon 800 it replaces it is **narrower**
 * on the widest figure this wall can print, `₹9,99,99,999`:
 *
 *   card figure    129.1px → 111.7px   (box 168px)
 *   podium figure  245.1px → 209.8px   (block face 259px)
 *   list figure    212.8px → 189.2px   (column 253px)
 *
 * Its one genuine cost is at the rank tag, where the condensed face it replaces
 * was chosen precisely for being condensed — see `--t-tv-card-rank`.
 */
const wallNumeral = localFont({
  src: './fonts/ClashDisplay-Variable.woff2',
  weight: '200 700',
  display: 'block',
  variable: '--font-wall-numeral',
})

export const metadata: Metadata = {
  title: 'BYOB Wall',
  description: 'Live leaderboard and Mesa Flea countdown for BYOB Cohort 2026.',
}

/**
 * `display: 'block'` on every face, not the usual `swap`.
 *
 * On an interactive page `swap` is right — text should be readable immediately
 * even in a fallback face. This page is a fixed frame that nobody reads in the
 * first 100ms, and a swap would mean every rotation flashes Helvetica before
 * settling into Excon. `block` holds the (very short) render until the real
 * face is there. The files are local, so the block period is a cache hit after
 * the first load of the day.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={[
        wallBody.variable,
        wallSerif.variable,
        wallName.variable,
        wallNumeral.variable,
      ].join(' ')}
    >
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

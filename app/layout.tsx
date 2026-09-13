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
 * Bebas Neue, for the rank numerals and nothing else.
 *
 * **It is the third family now, and it is the one with the weakest claim to be
 * here.** This docblock used to open by warning that the wall carried four
 * faces and that a fifth should be argued for rather than assumed. Two of those
 * four drew nothing and have gone; the remaining question is this one.
 *
 * Its stated reason for being bundled was `/podium`'s venture names, and that
 * consumer no longer exists — `--t-stage-name` reads `--font-sans`. What it
 * draws today is `--t-tv-card-rank`: two digits in a corner tag on `/weekly`,
 * and the same figure in `/podium`'s list. One static weight, no real
 * lowercase, so it cannot grow into any other job, and it is the only thing on
 * either slide speaking in a voice nothing else uses — which is the exact
 * criticism this project made of the Impact masthead before replacing it.
 *
 * It stays for now because the numerals read and nothing is broken. If it goes,
 * it goes to whichever face the figures are already in, and the wall drops to
 * two.
 *
 * Bundled, not linked, for the same reason as the others: a
 * `fonts.googleapis.com` request is a runtime network dependency on a wall that
 * runs unattended for weeks.
 *
 * **One weight, and no real lowercase** — Bebas Neue maps lowercase to capitals
 * by design, which suits a name that was already being uppercased in CSS. It
 * also means every token that sets it must ask for 400: at 800 the browser
 * synthesises a fake bold by smearing the outlines, which on a condensed face
 * closes the counters and turns a name into a block at six metres.
 */
const condensed = localFont({
  src: './fonts/BebasNeue-Regular.woff2',
  weight: '400',
  display: 'block',
  variable: '--font-condensed',
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
        condensed.variable,
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

import type { Metadata } from 'next'
import localFont from 'next/font/local'

import { Ganesha } from '@/components/Ganesha'
import { Rotator } from '@/components/Rotator'
import './globals.css'

/**
 * All four faces are self-hosted, so the wall makes **no runtime request to a
 * font CDN**. That matters more here than in a normal app: this runs unattended for
 * weeks, and a font request that fails silently falls back to Georgia or
 * Helvetica on a screen nobody is watching closely enough to notice.
 *
 * Neither family may be named after the face it carries. `next/font` derives
 * its CSS family name from the const below, and `colors_and_type.css` already
 * declares seven static `Manrope` rules and four `MesaSerif` ones. CSS family
 * names match case-insensitively, so a collision merges the two sets and the
 * browser picks between them by weight — fetching a static face as well as the
 * variable one, or preferring a `local()` system font over the self-hosted
 * file. Hence `mesaBody` and `mesaSerifVariable`.
 */
const mesaBody = localFont({
  src: './fonts/MesaBody-Variable.ttf',
  weight: '200 800',
  display: 'block',
  variable: '--font-mesa-body',
})

/**
 * Source Serif 4, self-hosted, standing in for New York.
 *
 * **The generated family cannot be called `MesaSerif`, however much the design
 * language calls it that.** `next/font/local` derives its CSS family name from
 * this const — confirmed in the built stylesheet, which emits `mesaBody` and
 * this face, not the filenames — and `colors_and_type.css` already declares
 * four `@font-face` rules for a family named `MesaSerif` whose `src` begins
 * `local("New York")`. CSS family matching is case-insensitive, so a const
 * named `mesaSerif` would merge with those rules, and the browser would then
 * choose between a self-hosted Source Serif 4 and whatever New York the
 * machine happens to have. Every Mac has New York. Two TVs would set the same
 * heading in two different serifs and nobody would think to check.
 *
 * So the file is `MesaSerif-Variable.woff2` and the token is
 * `--font-mesa-serif` — the name the design language uses — while the family
 * this generates stays deliberately distinct from it.
 */
const mesaSerifVariable = localFont({
  src: './fonts/MesaSerif-Variable.woff2',
  weight: '200 900',
  display: 'block',
  variable: '--font-mesa-serif',
})

/**
 * Archivo Black, for `BYOB` in `/podium`'s masthead and nothing else.
 *
 * **A third family, added deliberately and scoped to one word.** The rule this
 * bends is a real one — two families is what keeps two TVs setting the same
 * frame identically — so this is not a general display face. It is a wordmark,
 * it appears once, and it is the only thing on either wall that uses it.
 *
 * It is *bundled*, not linked. The 9.8KB latin subset sits in `app/fonts/` next
 * to the other two with its OFL licence, because a `fonts.googleapis.com` link
 * would put a runtime network dependency on a wall that runs unattended for
 * weeks — and a font request that fails silently falls back to Helvetica on a
 * screen nobody is watching closely enough to notice.
 *
 * Single weight, and that is the point: Archivo Black *is* the 900. There is no
 * axis to set, so nothing here can accidentally render it lighter. It replaced
 * MesaSerif at 900, which was the heaviest thing this wall could previously
 * draw.
 *
 * The const is not named `archivoBlack` for the same reason `mesaBody` is not
 * named `Manrope`: `next/font/local` derives the CSS family name from it, and a
 * name matching a real family risks merging with any `local()` rule that shares
 * it.
 */
const displayBlack = localFont({
  src: './fonts/ArchivoBlack-Regular.woff2',
  weight: '400',
  display: 'block',
  variable: '--font-display-black',
})

/**
 * Bebas Neue, for venture names on `/podium` and nothing else.
 *
 * **The fourth family, and the point at which this needs saying out loud:** two
 * faces is what guarantees two TVs set the same frame identically, and this wall
 * now carries four. Each addition has been scoped to one job — Archivo Black to
 * the `BYOB` wordmark, this to venture names — and all four are bundled, so the
 * risk is bundle size rather than a CDN that might not answer. Together the two
 * additions are 18KB. But a fifth should be argued for rather than assumed.
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

/**
 * Fraunces Italic, digits only, for the rank numeral on `/weekly` and nothing
 * else.
 *
 * **The fifth family, which the note above says has to be argued for rather
 * than assumed.** The argument is that the board's thirty-nine numerals are the
 * one element on it that is pure apparatus, repeated thirty-nine times, and a
 * tabular sans numeral repeated thirty-nine times is a spreadsheet's row index.
 * A serif italic is unmistakably a *label on an object* rather than a cell
 * reference — the same move an editorial page makes with a folio.
 *
 * **It costs 7.2KB, because it is nine glyphs.** The subset is `U+30-39` and
 * nothing else: no letters, no punctuation, no currency. Every other family
 * here carries a full latin subset because every other family sets words. This
 * one can never be asked to set a word, which also means it cannot silently
 * become the face for anything else — a stray `var(--font-rank)` on prose
 * renders as fallback immediately and visibly rather than quietly succeeding.
 *
 * The variable axes survive the subset (`400..900`, optical size folded in at
 * the API), so the weight is a token rather than a second file.
 *
 * Bundled, not linked, for the reason all four above are: a
 * `fonts.googleapis.com` request is a runtime network dependency on a wall that
 * runs unattended for weeks, and a font request that fails silently falls back
 * to Georgia on a screen nobody is watching closely enough to notice.
 *
 * `style: 'italic'` is declared on the face rather than left to CSS. Without
 * it the browser would treat this as a roman and **synthesise** the slant when
 * asked for italic — which is exactly what the project's own serif does today,
 * since `MesaSerif-Variable.woff2` ships no italic at all. A synthetic oblique
 * of a serif is a sheared roman: the `1` keeps its upright serif, the bowls
 * skew instead of being redrawn, and it renders convincingly enough that
 * nobody checks. Measured before this was added: `font-style: italic` on
 * `--font-serif` produced glyphs at *identical* advance widths to the roman,
 * which is the signature of a synthesis rather than a face.
 */
const rankItalic = localFont({
  src: './fonts/Fraunces-Italic-Digits.woff2',
  weight: '400 900',
  style: 'italic',
  display: 'block',
  variable: '--font-rank-italic',
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
 * settling into Manrope. `block` holds the (very short) render until the real
 * face is there. The files are local, so the block period is a cache hit after
 * the first load of the day.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={[
        mesaBody.variable,
        mesaSerifVariable.variable,
        displayBlack.variable,
        condensed.variable,
        rankItalic.variable,
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

import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import './live.css'

/**
 * Archivo, and it is `/live`'s only face.
 *
 * ── Why a second face exists in this project at all ──
 *
 * `AGENTS.md` says the wall ships one face and that a second is a design
 * argument rather than a token. That rule is about **one surface**: four faces
 * on one frame read as designed-at rather than designed. `/live` is a
 * different surface with a different job — it is trying to look like a race
 * broadcast in someone's hand — and it also ships exactly one face. Nothing
 * on the wall reads this, and nothing here reads Figtree.
 *
 * ── Why this one ──
 *
 * **Two axes in one file.** Archivo is variable on weight (100–900) *and*
 * width (62–125%), so the condensed 900 of a standings graphic and the normal
 * 600 of a stat label are the same face, and the hierarchy the wall takes from
 * weight alone this page can take from weight *and* width. That is the whole
 * F1 voice, and it costs one request.
 *
 * **It carries U+20B9.** Checked against the cmap before bundling, which
 * `AGENTS.md` requires of any face that draws a figure and which every rupee
 * on this page depends on — a face without it draws `₹` in Helvetica and the
 * digits in Archivo, on every number, reporting nothing. It also carries
 * U+014C for `YŌKI`, which is why it ships whole rather than subset: venture
 * names come from a spreadsheet this project does not control.
 *
 * The const may not be named after any family `colors_and_type.css` declares
 * — `Manrope`, `MesaSerif` — for the reason `app/layout.tsx` records.
 */
const liveFace = localFont({
  src: './fonts/Archivo-Variable.woff2',
  weight: '100 900',
  // `swap`, not the wall's `block`. A phone on campus wi-fi should show the
  // standings in a fallback face rather than nothing at all; the wall's
  // reasoning — that a rotation must not flash Helvetica — has no phone
  // equivalent, because nobody is watching this from six metres.
  display: 'swap',
  variable: '--font-live',
})

export const metadata: Metadata = {
  title: 'BYOB Standings · Forge C1',
  description: 'Live team standings for BYOB, Mesa Forge C1.',
}

/**
 * `viewport-fit=cover`, so the page runs under the notch and the home bar and
 * `live.css` pads with `env(safe-area-inset-*)` instead. No `themeColor` here:
 * it would have to be a literal colour, and `app/forge-tokens.css` is the only
 * file allowed one — the page sets the meta from `--lv-page` at runtime.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <div className={liveFace.variable}>{children}</div>
}

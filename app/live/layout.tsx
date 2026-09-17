import type { Metadata, Viewport } from 'next'

import './live.css'

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
  return children
}

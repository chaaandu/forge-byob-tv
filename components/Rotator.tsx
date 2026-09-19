'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * The old wall's slideshow: `/old/daily` and `/old/podium`, thirty seconds each.
 *
 * ── These two are the previous design, kept at `/old/*` ──
 *
 * `/daily` and `/podium` now serve the static slides in `public/tv/`, which do
 * their own rotation in `wall.html` by swapping prefetched iframes. This
 * component rotates the React pages it always rotated; it simply follows them
 * to their new addresses. Pointing it at the bare paths would send the old
 * wall into the new slides and strand it there.
 *
 * This is the one piece of rotation logic in the project, and it exists because
 * the rotation moved in-house — see the note in AGENTS.md. If the campus
 * slideshow is ever pointed back at these two URLs, this component and that
 * external rotation will fight, and the symptom will be a slide that changes
 * early and at irregular intervals.
 *
 * ── Why a soft navigation, and not a reload ──
 *
 * The TV runs fullscreen with nobody at the laptop. `router.replace` swaps the
 * React tree **without replacing the document**, so fullscreen survives — true
 * both of an F11 fullscreen and of the JS `requestFullscreen` API, which exits
 * on any top-level navigation and cannot be re-entered without a user gesture.
 * A `location.href =` or a `<meta refresh>` would drop the wall to a windowed
 * browser within a minute of being set up, and stay that way for weeks.
 *
 * Both routes are prerendered static, so the swap costs one small RSC payload,
 * cached after the first time. `prefetch` pays even that before it is needed.
 *
 * **`replace`, not `push`.** `push` would grow the history stack by one entry
 * every thirty seconds — about two thousand a day on a page that never reloads.
 *
 * ── What the swap costs, and what it does not ──
 *
 * Each board fetches on mount, so the CSVs are now read about every thirty
 * seconds rather than every sixty. That is wasted cycles rather than a
 * correctness problem: the consolidator writes every ten minutes and Google
 * caches the published CSV for about five, so the extra reads return the same
 * bytes. `useWallData` is deliberately untouched by this.
 *
 * What does *not* reset is anything that matters. The board's last-known ranks,
 * the pending overtake queue and the raw CSV cache all live in localStorage, so
 * a remounted board re-reads them before the browser paints and detection picks
 * up exactly where it left off. A rank change that happens while a slide is off
 * screen is still detected the moment it comes back.
 */

/** One slide's time on screen. Equal for both, which is what keeps the swap below a lookup. */
const DWELL_MS = 30_000

export function Rotator() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    // **The freeze switch.** `?still` holds whichever slide is up, which is what
    // makes the slide measurable: `scripts/measure-fit.mjs` walks four viewport
    // sizes on one URL, and a page that navigates out from under it half way
    // through reports the other board's numbers without saying so.
    //
    // Read off `location` rather than through `useSearchParams`, which opts a
    // statically prerendered route into a Suspense boundary — a real cost to the
    // wall's first paint, in exchange for nothing this needs.
    if (new URLSearchParams(window.location.search).has('still')) return

    // The two slides, and the guard in one expression. The root layout also
    // wraps the 404 — there is no `app/page.tsx`, so `/` is one — and a rotator
    // running there would navigate away from the error an operator has to see to
    // know the wall is pointed at the wrong URL.
    const next = pathname === '/old/daily' ? '/old/podium' : pathname === '/old/podium' ? '/old/daily' : null
    if (next === null) return

    router.prefetch(next)
    // A timeout rather than an interval: this fires once, the navigation changes
    // `pathname`, and the effect re-runs to arm the next one. An interval would
    // hold a second, redundant firing behind a navigation that had already
    // happened.
    const timer = setTimeout(() => router.replace(next), DWELL_MS)
    return () => clearTimeout(timer)
  }, [pathname, router])

  return null
}

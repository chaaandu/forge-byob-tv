'use client'

import { useEffect, useState } from 'react'

/**
 * Is there room beside the board for a docked panel?
 *
 * **Width is not enough, because an iPad in landscape is 1180px wide.** It
 * would take the docked panel on width alone, and a docked panel is a
 * pointer's layout: it assumes hovering, clicking a row behind an open panel,
 * and arrow keys. A tablet has none of those, and the phone layout on an iPad
 * is a perfectly good page.
 *
 * So the test is width **and** a fine, hovering pointer — which a trackpad and
 * a mouse report and a finger does not. A 1280px laptop keeps the desktop
 * layout; a 1366px iPad Pro does not.
 *
 * `false` until the effect runs, which is also what the server renders: the
 * page is prerendered static, so the first paint cannot know the viewport.
 * The phone layout is therefore the one that appears for a frame on a desktop,
 * rather than the reverse — the safer direction, because it is a complete
 * layout rather than a two-column one missing its second column.
 */
export function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)')
    const sync = () => setDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return desktop
}

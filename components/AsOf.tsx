import type { Snapshot } from '@/lib/types'

/**
 * When the data underneath this wall was last refreshed, as written by the sheet.
 *
 * The wall deliberately shows no error state: a failed fetch keeps the last good
 * data, because a red banner on a screen nobody is watching helps nobody. The
 * cost of that is a wall which, if the sheet is unpublished or permanently
 * short, freezes on stale numbers that look perfectly healthy — for days.
 *
 * This is the one thing that makes that visible. Zero client logic, immune to
 * clock skew because the sheet writes the string, and small enough that it never
 * competes. It is the only element on either page not named in the brief's
 * layout, added deliberately for this reason.
 *
 * **Removed with the footers on 11 September 2026 and restored on the 13th**,
 * after a design review that asked what on this page could make it state
 * something false. The answer was two things and this is one of them: without
 * it, a board frozen on Tuesday is pixel-identical to a working one. It comes
 * back where `WallHeader` always said it would, at the right of the masthead.
 *
 * Renders nothing at all when there is no data yet. Empty is a valid state, and
 * a stamp with no figures beside it would be stating the provenance of nothing.
 */
export function AsOf({ snapshot }: { snapshot: Snapshot | null }) {
  const value = snapshot?.cohort.as_of ?? ''
  if (value === '') return null
  return <span className="tv-mast-stamp">Updated {value}</span>
}

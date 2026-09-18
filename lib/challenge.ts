/**
 * Which day of the current challenge it is. One pure function.
 *
 * It was two: `baselineLabel` derived the day the baseline was photographed —
 * `17 Aug` for a challenge opening on the 18th — for `/daily`'s legend to
 * caption the board with. The legend was removed and it went with it, along
 * with the `Intl.DateTimeFormat` it was the only consumer of.
 *
 * ── Why there is no timezone arithmetic here ──
 *
 * `challenge_start_iso` carries `+05:30`, so the instant it names **is** IST
 * midnight. Differencing two absolute instants therefore rolls the day at IST
 * midnight on a laptop set to any timezone at all — the same reason
 * `lib/countdown.ts` needs none either. `cohortInstant`'s refusal to parse an
 * offset-less string is what makes that true, and it is load-bearing: without
 * the offset the browser would parse the string in its own zone and every day
 * number on a non-IST machine would be off by one for half the day, correctly
 * formatted and completely wrong.
 *
 * The clock is a parameter rather than a call, so both functions stay pure and
 * a day boundary can be tested rather than waited for.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * `{ day, total }`, or `null` when the wall should say nothing.
 *
 * `null` covers four situations that all render identically and all mean the
 * same thing — *no claim to make*: the sheet has not published a window, the
 * challenge has not opened yet, and the challenge has closed. A wall between
 * challenges says nothing rather than counting a day that does not exist, which
 * is the convention the Flea countdown already follows once its event is over.
 */
export function challengeDay(
  start: Date | null,
  end: Date | null,
  now: number,
): { day: number; total: number } | null {
  if (start === null || end === null) return null
  const from = start.getTime()
  const to = end.getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null
  if (now < from || now > to) return null

  // `ceil`, because the window's last instant is 23:59:59 rather than the next
  // midnight: 13 days and 23:59:59 is a fourteen-day challenge. `round` would
  // agree at this length only by luck, and `floor` would say thirteen.
  const total = Math.ceil((to - from) / DAY_MS)
  const day = Math.floor((now - from) / DAY_MS) + 1
  // Clamped, so a window whose end is not a whole number of days past its start
  // cannot print "Day 15 of 14" in its final minutes.
  return { day: Math.min(day, total), total }
}

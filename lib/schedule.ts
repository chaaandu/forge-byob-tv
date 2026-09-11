import { EOD_FROM_HOUR_IST, GANESH_FROM_MS, GANESH_UNTIL_MS, IST_TIMEZONE } from '@/config'

/**
 * The only module in the project that asks what time it is.
 *
 * It is separate from `lib/overtake.ts` for one reason: that file is guarded by
 * a source scan that fails the build if `Date` appears in it, and rank detection
 * must stay that way. Putting the 6pm check there would have meant weakening the
 * guarantee that matters most.
 *
 * **The hour is read in Asia/Kolkata, never in the browser's locale.** The wall
 * runs from a laptop over HDMI, and a laptop that came back from a trip still
 * set to another timezone would open the end-of-day celebration in the middle of
 * the afternoon and look completely deliberate doing it. `Intl` is asked for the
 * hour in IST explicitly, so the machine's own setting cannot reach this.
 */

const IST_HOUR = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST_TIMEZONE,
  hour: '2-digit',
  hour12: false,
})

export function istHour(now: Date): number {
  return Number(IST_HOUR.format(now))
}

/**
 * Is the wall in its end-of-day state?
 *
 * 18:00 IST until midnight IST, every day. No sheet flag, no stored state, no
 * transition to miss: the answer is a function of the current instant, so a wall
 * that boots at 8pm is in the state immediately and one that runs through
 * midnight leaves it without anyone having to notice.
 */
export function isEndOfDay(now: Date): boolean {
  const hour = istHour(now)
  return hour >= EOD_FROM_HOUR_IST && hour <= 23
}

/**
 * Is the Ganesha ornament in its window?
 *
 * Half-open — `[from, until)` — which is what makes the two constants in
 * `config.ts` readable as the boundaries they are rather than as days. The
 * ornament appears the moment 14 September begins in IST and is gone the moment
 * the 17th does, on a wall nobody touches in between.
 *
 * **No `Intl` here, deliberately**, unlike `istHour` above. Both bounds are
 * already absolute instants carrying `+05:30`, so comparing epoch milliseconds
 * is timezone-independent by construction — the machine's own setting cannot
 * reach this any more than it can reach the hour check, and it gets there
 * without a formatter. Asking `Intl` for a date here would be the version that
 * *looks* more careful and is the one that can be wrong.
 */
export function isFestival(now: Date): boolean {
  const at = now.getTime()
  return at >= GANESH_FROM_MS && at < GANESH_UNTIL_MS
}

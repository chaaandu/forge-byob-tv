import {
  DAILY_CLOSE_HOUR_IST,
  EOD_FROM_HOUR_IST,
  GANESH_FROM_MS,
  GANESH_UNTIL_MS,
  IST_TIMEZONE,
} from '@/config'

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
 * `en-CA` is asked for a date because it formats one as `2026-09-18`.
 *
 * The key it builds is compared with `>=` and ordered by plain string sort in
 * `lib/daily.ts`, and a zero-padded year-month-day is the one arrangement where
 * that is the same thing as chronological order. Any other locale's ordering —
 * `18/09/2026`, `9/18/2026` — sorts the day of the month first and would put 30
 * September before 1 October, which on this board means a mark being read as
 * older than it is and a window silently spanning two days.
 */
const IST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Which daily window this instant falls in, as the IST date the window closed
 * on: `2026-09-18` means the window `10:00 on the 17th → 10:00 on the 18th`.
 *
 * This is the only thing in the project that knows where a day begins for
 * `/weekly`, and the answer is deliberately *not* midnight — see
 * `DAILY_CLOSE_HOUR_IST`.
 *
 * ── Before ten o'clock belongs to yesterday ──
 *
 * At 09:59 on the 18th the newest *finished* window still closed on the 17th, so
 * that is the key. At 10:00 it becomes the 18th. One boundary, read once, and
 * everything downstream — which mark gets taken, which period `detect` compares,
 * what the masthead says — follows from it rather than deciding for itself.
 *
 * ── The day is stepped by subtracting 24 hours, which is only safe here ──
 *
 * India has no daylight saving and has held `+05:30` since 1945, so every IST
 * day is exactly 86,400,000ms long and stepping back a day by arithmetic lands
 * at the same wall-clock time. The same line in a timezone that observes DST
 * would land an hour out twice a year — and on one of those two mornings it
 * would return the wrong date and the board would re-photograph a window it had
 * already closed.
 */
export function istWindowKey(now: Date): string {
  const closed =
    istHour(now) >= DAILY_CLOSE_HOUR_IST ? now : new Date(now.getTime() - 24 * 60 * 60 * 1_000)
  return IST_DATE.format(closed)
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
 * the 18th does, on a wall nobody touches in between.
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

/**
 * The calendar countdown's one brain: time-to-Flea in, display state out.
 *
 * Every threshold transition lives here and nowhere else — the component that
 * draws the calendar never compares a timestamp. Pure of the clock: `now`
 * arrives as an argument (defaulting to the real clock only at the call site's
 * convenience), which is what makes the four modes testable without faking a
 * global.
 *
 * The escalation, from far out to done:
 *
 *   days       ≥15 days out          "25"        calendar days, counted in IST
 *   daysHours  <15 days, ≥24 hours   "6D 4H"     floored, like a clock reads
 *   timer      <24 hours, not yet    "04:12:33"  live seconds
 *   live       during the event      "LIVE NOW"
 *   hidden     after it ends         ""          the slot goes quiet for good
 *
 * The far mode counts *calendar days*, in the sheet's timezone, where the near
 * mode floors elapsed time like a clock. On 12 August the Flea is "25 days
 * away" at breakfast and at midnight — the number a person would say — whereas
 * a 24-hour-block count would tick from 26 to 25 at 10:00, an hour nobody can
 * name. IST and never the browser's locale, for the same reason as
 * lib/schedule.ts: a laptop still set to another timezone must not shift the
 * day boundary.
 */

import {
  DAYS_ONLY_FROM_MS,
  FLEA_EVENT_DURATION_MS,
  IST_TIMEZONE,
  PODIUM_CLOCK_UNDER_MS,
  PODIUM_WEEKS_FROM_MS,
  PROGRAMME_START_MS,
  TIMER_UNDER_MS,
} from '@/config'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

export type CountdownMode = 'days' | 'daysHours' | 'timer' | 'live' | 'hidden'

export type CountdownState = {
  display: string
  mode: CountdownMode
  /** The headline figure: day count in the day modes, whole seconds left in
      timer mode, `null` where there is no number to speak of. */
  numeric: number | null
  /**
   * How far through the programme we are: 0 at the anchor, 1 at the Flea.
   *
   * The dial's only input. Elapsed *programme* time rather than a trailing
   * window, so a half-full ring means the cohort is half over. Clamped, so a
   * wall booted before the cohort opens shows an empty ring rather than an arc
   * running backwards.
   */
  progress: number
  /**
   * Milliseconds until the Flea opens; `0` once it has.
   *
   * Published rather than kept private because two boards now band the same
   * countdown at different thresholds, and the alternative — each of them
   * differencing the clock again — is exactly the second implementation this
   * module exists to prevent.
   */
  remainingMs: number
  /**
   * Whole calendar days remaining, counted in IST. `null` from the opening bell.
   *
   * The same figure the `days` mode displays, published in **every** mode. On 12
   * August the Flea is "25 days away" at breakfast and at midnight — the number
   * a person would say — whereas a count of 24-hour blocks would tick over at
   * 10:00, an hour nobody can name.
   */
  daysRemaining: number | null
  /**
   * `daysRemaining` in whole weeks, rounded to **nearest**.
   *
   * Nearest is what the approved design asks for and what it renders: 25 days is
   * "4 WEEKS TO GO", and 25/7 rounds to 4 where it would floor to 3.
   *
   * Worth knowing that the spec's stated reason for nearest — "so it never
   * understates the time remaining" — is not what nearest does. 24 days rounds
   * *down* to 3 weeks and understates by three. Only `ceil` never understates.
   * The method is implemented as written because it is the one the mock shows;
   * changing it to `ceil` is one word here if the rationale is what matters.
   */
  weeksRemaining: number | null
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

const IST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The instant's calendar date in IST, as a whole day number. en-CA formats as
    YYYY-MM-DD, so the parse cannot be fooled by locale ordering. */
function istDayNumber(ms: number): number {
  const [year, month, day] = IST_DATE.format(ms).split('-').map(Number)
  return Date.UTC(year, month - 1, day) / DAY_MS
}

function programmeProgress(fleaDatetime: number, now: number, programmeStart: number): number {
  const span = fleaDatetime - programmeStart
  // A Flea at or before the anchor is a misconfigured sheet, not a countdown.
  // A full ring is the honest answer: there is no journey left to show.
  if (span <= 0) return 1
  return Math.min(1, Math.max(0, (now - programmeStart) / span))
}

export function computeCountdownState(
  fleaDatetime: number,
  now: number = Date.now(),
  programmeStart: number = PROGRAMME_START_MS,
): CountdownState {
  const progress = programmeProgress(fleaDatetime, now, programmeStart)

  // Once the bell has gone there is no time remaining to publish, and a `0` in
  // those fields would be a figure a formatter could render. `null` cannot be.
  const over = { remainingMs: 0, daysRemaining: null, weeksRemaining: null }

  if (now >= fleaDatetime + FLEA_EVENT_DURATION_MS) {
    return { display: '', mode: 'hidden', numeric: null, progress: 1, ...over }
  }
  if (now >= fleaDatetime) {
    return { display: 'LIVE NOW', mode: 'live', numeric: null, progress: 1, ...over }
  }

  const remaining = fleaDatetime - now
  const calendarDays = istDayNumber(fleaDatetime) - istDayNumber(now)
  const left = {
    remainingMs: remaining,
    daysRemaining: calendarDays,
    weeksRemaining: Math.round(calendarDays / 7),
  }

  if (remaining < TIMER_UNDER_MS) {
    const hours = Math.floor(remaining / HOUR_MS)
    const minutes = Math.floor((remaining % HOUR_MS) / 60_000)
    const seconds = Math.floor((remaining % 60_000) / 1000)
    return {
      display: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
      mode: 'timer',
      numeric: Math.floor(remaining / 1000),
      progress,
      ...left,
    }
  }

  const wholeDays = Math.floor(remaining / DAY_MS)
  if (remaining < DAYS_ONLY_FROM_MS) {
    const hours = Math.floor((remaining % DAY_MS) / HOUR_MS)
    return {
      display: `${wholeDays}D ${hours}H`,
      mode: 'daysHours',
      numeric: wholeDays,
      progress,
      ...left,
    }
  }

  return { display: String(calendarDays), mode: 'days', numeric: calendarDays, progress, ...left }
}

/**
 * The same countdown, banded and worded for `/podium`'s masthead.
 *
 * **A second presentation, not a second brain.** Every comparison against the
 * clock still happened in `computeCountdownState` above; this reads the figures
 * it published and decides which of them to show. The dial in the shared header
 * bands the identical state differently, and `/daily` is untouched by anything
 * here.
 *
 * The escalation, from far out to done:
 *
 *   > 7 days      "4"          WEEKS TO GO
 *   3–7 days      "5"          DAYS TO GO
 *   < 3 days      "2:14:30"    TO GO      — days:hours:minutes
 *   final day     "4:12:33"    TO GO      — hours:minutes:seconds
 *   live          "LIVE"       NOW
 *
 * **No milliseconds, at any band.** They are unreadable across a corridor, and
 * re-rendering a digit every frame for days on a panel that never sleeps is how
 * burn-in happens. Seconds already read as urgent.
 *
 * The two clock bands are not padded to two digits. `2:14:30` is a duration, and
 * padding it to `02:14:30` makes it look like a time of day.
 */
export type MastheadCountdown = { figure: string; label: string }

export function mastheadCountdown(state: CountdownState): MastheadCountdown | null {
  if (state.mode === 'hidden') return null
  if (state.mode === 'live') return { figure: 'LIVE', label: 'Now' }

  const { remainingMs, daysRemaining, weeksRemaining } = state
  if (daysRemaining === null || weeksRemaining === null) return null

  if (remainingMs > PODIUM_WEEKS_FROM_MS) {
    return { figure: String(weeksRemaining), label: 'Weeks to go' }
  }
  if (remainingMs >= PODIUM_CLOCK_UNDER_MS) {
    return { figure: String(daysRemaining), label: 'Days to go' }
  }

  const minutes = Math.floor((remainingMs % HOUR_MS) / 60_000)
  if (remainingMs >= TIMER_UNDER_MS) {
    const days = Math.floor(remainingMs / DAY_MS)
    const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS)
    return { figure: `${days}:${pad(hours)}:${pad(minutes)}`, label: 'To go' }
  }

  const hours = Math.floor(remainingMs / HOUR_MS)
  const seconds = Math.floor((remainingMs % 60_000) / 1000)
  return { figure: `${hours}:${pad(minutes)}:${pad(seconds)}`, label: 'To go' }
}

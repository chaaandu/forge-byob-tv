import type { Team, TeamId } from '@/lib/types'

/**
 * `/daily`'s figure: what each venture banked between 10:00 yesterday and
 * 10:00 today.
 *
 * ── Why this is computed on the laptop rather than read from a column ──
 *
 * There is no daily figure anywhere in `BYOB_MASTER` that covers a finished day.
 * `TV_Feed`'s `today_revenue` is `SUMIFS(… 'Daily Dump'!B:B, TODAY())` — live,
 * from midnight, and ₹0 for nearly every team until the afternoon.
 * `Daily Team Summary` is cumulative in spite of its name, `Weekly — by Team` is
 * weekly, and `Metrics` is empty. So a closed day has to be made rather than
 * found, and the only material available is `total_revenue`.
 *
 * **Photograph the running total, subtract it later.** That is exactly what the
 * sheet already does for `challenge_revenue`, and the argument is the same one:
 * when the only figure available is cumulative, a window is the difference
 * between two photographs of it. Here both photographs are taken by the wall, at
 * the first poll at or after 10:00 IST, and kept in `localStorage`.
 *
 * ── What it costs, stated rather than argued away ──
 *
 * **A wall needs two marks before it has a window**, so a laptop plugged in for
 * the first time — or one whose browser data was cleared — prints ₹0 on all
 * thirty-nine cards until the next 10:00. Up to twenty-four hours, and the board
 * renders perfectly throughout. Empty is a valid state on this wall, which is
 * what makes that acceptable; it is not what makes it invisible.
 *
 * **A missed 10:00 widens the window silently.** If the laptop is asleep from
 * 09:30 to 11:00 the mark is taken at 11:00 and the window is 25 hours; if it is
 * off for a day the next window is 48 hours. The figures are true in both cases
 * — they are the difference between two real photographs — but the board calls
 * whatever it is holding a day. The masthead states the window's *dates*, which
 * is the only reason a 48-hour day can be seen at all; see `boardScope`.
 *
 * ── This module reads no clock ──
 *
 * Which window an instant belongs to is `istWindowKey` in `lib/schedule.ts`,
 * which is the one module allowed to ask. Everything here takes a key it is
 * given, so the same marks produce the same board on any machine, and
 * `daily.test.ts` scans this file to keep it that way.
 */

/**
 * One photograph of every team's all-time total, stamped with the window it
 * closed.
 *
 * `totals` rather than a pre-computed delta: a delta cannot be re-based, and the
 * day this project wants a two-day window or an audit of a suspicious figure,
 * the totals are still here and the deltas would not have been.
 */
export type DailyMark = {
  /** The IST date the window closed on, `YYYY-MM-DD`. Sorts chronologically. */
  key: string
  totals: Readonly<Record<TeamId, number>>
}

/** The closed window the board is currently showing. */
export type DailyWindow = {
  /** The key of the mark that opened it — the board's figures start here. */
  opened: string
  /** The key of the mark that closed it. Also the period `detect` compares. */
  closed: string
  earned: Readonly<Record<TeamId, number>>
}

/**
 * Two, and it is a deliberate ceiling rather than a convenience.
 *
 * The board needs exactly the newest pair. Keeping a longer history would put
 * thirty-nine numbers per day into a store that is never pruned by anything
 * else, to serve a feature nothing has asked for — and the moment two marks are
 * kept "just in case", something will reach past the newest pair and quietly
 * measure a window nobody chose.
 */
export const MARKS_KEPT = 2

/**
 * Close the window `key` names, if it is not already closed.
 *
 * Pure, and it returns the array it was given — by identity — when there is
 * nothing to write. The caller leans on that to avoid a `localStorage` write on
 * all 1,439 polls a day that are not the first one after ten o'clock.
 *
 * ── A window is photographed once, at the first poll inside it ──
 *
 * Never re-photographed. Overwriting the newest mark on every poll would make
 * the window's opening edge crawl forward all day: by 18:00 the board would be
 * showing "10:00 yesterday to 18:00 yesterday", shrinking, under a masthead
 * saying otherwise, with every figure falling as the day went on. `last.key >=
 * key` is what forbids it.
 *
 * That same comparison is what makes a clock that has gone *backwards* harmless
 * — a laptop corrected by NTP, or one that came back from a trip still set to
 * another timezone and was fixed. An older key is not a new window, so it writes
 * nothing rather than rewinding the board onto a window that has already been
 * shown.
 */
export function markWindow(
  marks: readonly DailyMark[],
  teams: readonly Team[],
  key: string,
): readonly DailyMark[] {
  if (!needsMark(marks, key)) return marks

  const totals: Record<TeamId, number> = {}
  for (const team of teams) totals[team.teamId] = team.totalRevenue
  return [...marks, { key, totals }].slice(-MARKS_KEPT)
}

/**
 * Has this window been photographed yet?
 *
 * **This is what decides whether `/daily` goes to the network at all**, and it
 * is the same condition `markWindow` acts on rather than a second opinion about
 * it — which is why that function now asks this one. Two spellings of "is the
 * window already closed" that could drift apart is a board that either fetches
 * 1,440 times a day or never fetches again.
 *
 * ── Why the fetch is gated on the data rather than on a timer ──
 *
 * The obvious way to fetch once a day at ten is a `setTimeout` to the next
 * 10:00. It is the wrong mechanism on this wall, for reasons that are all about
 * a laptop nobody is standing at:
 *
 * - **A timer does not survive sleep.** A `setTimeout` armed for twenty hours on
 *   a machine that sleeps for eight fires eight hours late, so the board would
 *   photograph its window at six in the evening and call it ten in the morning.
 * - **A timer that misses has no second chance.** If the network is down at
 *   10:00, a timer has fired and gone; the board holds yesterday's window for
 *   another day and nothing retries.
 * - **A timer has to be right about `now` once.** This is asked afresh every
 *   tick, so a clock that was wrong and got corrected simply produces the right
 *   answer from then on.
 *
 * Asking a local question every minute costs nothing — no network, one string
 * comparison — and answers `true` exactly once per day. The wall fetches when
 * the answer changes, which is the same thing as "at ten", and it keeps trying
 * until it succeeds instead of missing the day.
 */
export function needsMark(marks: readonly DailyMark[], key: string): boolean {
  const last = marks[marks.length - 1]
  // `<` and not `!==`: a key *older* than the newest mark is a clock that went
  // backwards, and rewinding onto a window already shown is not a fetch worth
  // making. `markWindow` refuses to write it for the same reason.
  return last === undefined || last.key < key
}

/**
 * The newest pair of marks as a window, or `null` when there is not yet a pair.
 *
 * `null` is the board's cold start and it is a state, not an error: the caller
 * prints ₹0 on every card and says nothing about it, exactly as it would for a
 * cohort that had genuinely sold nothing.
 *
 * ── A team missing from the opening mark is left out, not treated as zero ──
 *
 * `?? 0` here would read "absent from the older photograph" as "had earned
 * nothing then", and hand a team its **entire all-time revenue** as one day's
 * takings. `TV_Feed` grows — it publishes whatever is in `Team Links`, and this
 * cohort has already gained rows — so a team joining the feed mid-window would
 * arrive at the top of the daily board on ₹96,167, one place above the team that
 * actually led the day, on a wall that would report nothing and keep doing it
 * for twenty-four hours.
 *
 * Omitted, that team prints ₹0 for one window and a true figure from the next,
 * which is the same direction `detect` fails in when it meets a team with no
 * previous rank: a venture nobody has a baseline for has not earned anything
 * *measurable*, and the honest answer is to say nothing about it for one day.
 *
 * ── A negative is carried, not clamped ──
 *
 * `total_revenue` is proof-gated upstream, and proof can be revoked after a
 * photograph is taken: a sale logged before the mark whose proof later goes to
 * `No` shrinks the all-time total and the window's difference comes out
 * negative. That happened to three teams on 19 August. Nothing is clamped here
 * or at the card, for the reason `compareChallenge` gives: clamping collapses "a
 * team that went backwards" into "a team that has not traded", and the first of
 * those is news.
 */
export function windowOf(marks: readonly DailyMark[]): DailyWindow | null {
  if (marks.length < MARKS_KEPT) return null
  const opened = marks[marks.length - 2]
  const closed = marks[marks.length - 1]

  const earned: Record<TeamId, number> = {}
  for (const [teamId, total] of Object.entries(closed.totals)) {
    const before = opened.totals[teamId]
    if (before === undefined) continue
    earned[teamId] = total - before
  }
  return { opened: opened.key, closed: closed.key, earned }
}

/** What this window says a team banked. `0` for a team it cannot measure. */
export function dailyEarned(day: DailyWindow | null, teamId: TeamId): number {
  return day?.earned[teamId] ?? 0
}

/**
 * The window as an integer, for the field `detect` compares to decide whether to
 * stay quiet.
 *
 * It has to change at ten o'clock, because that is the one tick where every
 * figure on this board changes at once — thirty-nine of them, in a single poll,
 * and every team whose new day beat its old one would otherwise read as having
 * overtaken somebody. It is the loudest non-event this board can produce and it
 * happens daily.
 *
 * ── Read off the date's digits, not off a clock ──
 *
 * `2026-09-18` becomes `20260918`. Monotonic, unique per day, and computable
 * without parsing a date — which keeps this module clock-free and therefore
 * keeps the board identical on two TVs showing it. A malformed key returns
 * `null`, which routes into the same silence a cold start does.
 */
export function windowPeriod(day: DailyWindow | null): number | null {
  if (day === null) return null
  const digits = day.closed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (digits === null) return null
  return Number(digits[1]) * 10_000 + Number(digits[2]) * 100 + Number(digits[3])
}

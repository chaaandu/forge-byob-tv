import type { BoardMode, Cohort, Team } from '@/lib/types'
import { currentChallenge } from '@/lib/feed'
import { dailyEarned, windowPeriod, type DailyWindow } from '@/lib/daily'
import { rankByChallenge, rankByDaily } from '@/lib/ranking'

/**
 * Which contest `/weekly` is showing, and everything that follows from it.
 *
 * ── One cell, because two would contradict each other ──
 *
 * `TV_Cohort` carries `challenge_mode`, typed `Yes` or `No`. Not two yes/no
 * cells — two booleans have four states and only two of them mean anything, so
 * the day someone leaves both on `Yes` the wall has to pick a winner silently.
 * One cell cannot be in a contradictory state.
 *
 * Not derived from `challenge_start_iso`/`challenge_end_iso` either, though it
 * could be. Deleting the dates is a destructive way to say "not this fortnight"
 * — you lose the window you will want back, and a blank cell reads as an
 * accident rather than a decision. The dates say *when*; this says *whether*.
 * One authority each, and neither is a second copy of the other.
 *
 * ── Anything that is not `Yes` is the daily board ──
 *
 * Blank, missing, `Nope`, a typo: all daily. That asymmetry is deliberate and it
 * is still the safe direction, though the reasoning has changed with the figure.
 *
 * It used to be that the fallback was the *week*, because `week_revenue` is a
 * required column and always holds real figures while `challenge_revenue`
 * between challenges is whatever the consolidator last left there. The daily
 * window is not a column at all — it is computed on the laptop from two
 * photographs of `total_revenue` — so the comparison is now between two
 * different ways of being wrong:
 *
 * - **Guessing wrong towards challenge** puts ₹0 on thirty-nine cards under a
 *   heading naming a contest that is not running, for as long as the cell stays
 *   misspelt. Nothing recovers it.
 * - **Guessing wrong towards daily** puts a true, ranked, finished day on the
 *   board under a heading that says so. It is not the board anybody asked for,
 *   but every figure on it is real and it self-corrects the moment the cell is
 *   fixed.
 *
 * The second is still plainly the direction to fail in.
 */
export function boardMode(cohort: Cohort): BoardMode {
  const raw = (cohort.challenge_mode ?? '').trim().toLowerCase()
  // `true` and `1` alongside `yes`, so a checkbox cell — which publishes as
  // `TRUE` — works without anyone having to know it publishes as `TRUE`.
  return raw === 'yes' || raw === 'y' || raw === 'true' || raw === '1' ? 'challenge' : 'daily'
}

/**
 * The figure the board ranks on and every card prints.
 *
 * **The daily half does not read the team row**, which is the one structural
 * difference between the two modes and the reason `day` is threaded through
 * every signature below it. A challenge figure is a cell in `TV_Feed`; a daily
 * figure is the difference between two photographs this wall took at ten
 * o'clock, and it lives in `lib/daily.ts`'s map. `dailyEarned` answers `0` for a
 * team the window cannot measure — see `windowOf` for why that is not `?? its
 * whole all-time total`.
 */
export function boardEarned(mode: BoardMode, team: Team, day: DailyWindow | null): number {
  return mode === 'challenge' ? team.challengeRevenue : dailyEarned(day, team.teamId)
}

/**
 * The matching comparator. Paired with `boardEarned` on purpose: a board that
 * sorts one figure and prints another is a leaderboard of the wrong contest,
 * rendered perfectly, and `board.test.ts` pins the two together.
 */
export function rankForMode(
  mode: BoardMode,
  teams: readonly Team[],
  day: DailyWindow | null,
): Team[] {
  return mode === 'challenge' ? rankByChallenge(teams) : rankByDaily(teams, day?.earned ?? {})
}

/** What the band calls itself. The heading must never outlive the figure. */
export function boardHeading(mode: BoardMode): string {
  return mode === 'challenge' ? '10-Day Challenge' : 'Daily Leaderboard'
}

/**
 * What the figures below the heading are measured over, for `WallHeader`'s
 * `scope` slot.
 *
 * ── The one piece of apparatus this wall has taken back, and why ──
 *
 * `AGENTS.md` records two removals in this territory: the `as_of` stamp, and
 * `/podium`'s `All time`. Both went on the same argument — this is a display of
 * figures, and a line of provenance apparatus is furniture on a slide that is
 * meant to be numbers. That argument was right about both of them and it does
 * not reach this one, for a reason that is about the board rather than about
 * taste.
 *
 * Every board before this one was **live**. A figure on it was current to within
 * six minutes, so the board's window was "now" and the only thing a stamp could
 * add was provenance. This board is **locked**: it shows a finished day and does
 * not move for twenty-four hours. A locked board with nothing saying which day
 * it is locked on is not missing its provenance — it is missing its *subject*.
 * At four in the afternoon it is showing figures that stopped at ten in the
 * morning, and a passer-by has no way to know that this is the design rather
 * than the failure.
 *
 * It also carries the only visible sign of the window widening. A laptop that
 * slept through ten o'clock takes its mark at eleven, or the next day, and the
 * figures stay true while the window silently becomes 25 or 48 hours long. The
 * dates say so — `17 → 18 Sep` reads as a day, `16 → 18 Sep` does not.
 *
 * **Challenge mode passes nothing**, as it always has: its board is live and its
 * day chip already binds its window.
 */
export function boardScope(mode: BoardMode, day: DailyWindow | null): string | undefined {
  if (mode === 'challenge' || day === null) return undefined
  return `${shortDate(day.opened)} → ${shortDate(day.closed)}, 10am`
}

/**
 * `2026-09-18` → `18 Sep`.
 *
 * Built from the key's own digits rather than by parsing it into a `Date` and
 * formatting that. A `Date` built from `2026-09-18` is midnight **UTC**, which
 * is 05:30 IST — so formatting it in any timezone west of Greenwich prints the
 * 17th, and this wall's masthead would name the wrong day on a laptop that had
 * come back from a trip still set to another zone. The key is already an IST
 * date; there is nothing to convert and no reason to involve a clock.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function shortDate(key: string): string {
  const digits = key.match(/^\d{4}-(\d{2})-(\d{2})$/)
  if (digits === null) return key
  return `${Number(digits[2])} ${MONTHS[Number(digits[1]) - 1] ?? ''}`.trim()
}

/**
 * The period this board's figure resets with — **including the mode flip
 * itself**.
 *
 * `detect` goes silent whenever this number changes, because that is the tick
 * where every figure on the board moves at once and thirty-nine resets must not
 * read as thirty-nine overtakes. There are now three such ticks:
 *
 * - **Ten o'clock every morning**, which is new and is the loudest of the three
 *   because it is the only one that happens daily. Every figure on the board is
 *   replaced in a single poll, and every team whose new day beat its old one
 *   would otherwise read as having passed somebody.
 * - **A challenge rolling over**, as before.
 * - **Switching `challenge_mode`**, which changes every card's figure in the
 *   poll the cell is edited.
 *
 * ── What this costs, and it is the largest cost of the daily board ──
 *
 * The daily board's figures only ever change at the tick this guard silences.
 * So **`/weekly` no longer produces overtakes at all** — not because the
 * detector was weakened, but because a locked board has no moment left where a
 * rank can be seen changing hands. The flip choreography in `lib/flipTimeline.ts`
 * and `lib/useKick.ts` is still wired, still tested, and still runs in challenge
 * mode; on the daily board it is deaf by construction.
 *
 * `/podium` is what keeps that machinery exercised in the ordinary case: it
 * ranks live all-time revenue, which resets never, and it animates every
 * change.
 *
 * ── The three clocks are folded into one number space ──
 *
 * Even is a challenge, odd is a day; no value means both. Challenge 3 and the
 * day whose key is `2026-09-18` are different periods, and handing `detect` two
 * numbers that could collide would make the one flip that most needs silencing
 * look like no change at all. Daily periods are date digits — `20260918` — so
 * they cannot reach a challenge number's range either way, but the parity is
 * kept because it is what makes the *switch itself* a change of period.
 */
export function boardPeriod(cohort: Cohort, day: DailyWindow | null): number | null {
  const mode = boardMode(cohort)
  if (mode === 'challenge') {
    const period = currentChallenge(cohort)
    return period === null ? null : period * 2
  }
  const period = windowPeriod(day)
  return period === null ? null : period * 2 + 1
}

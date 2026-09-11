import type { BoardMode, Cohort, Team } from '@/lib/types'
import { currentChallenge, openWeek } from '@/lib/feed'
import { rankByChallenge, rankByWeek } from '@/lib/ranking'

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
 * ── Anything that is not `Yes` is `No` ──
 *
 * Blank, missing, `Nope`, a typo: all week mode. That asymmetry is deliberate
 * and it is the safe direction. Week revenue is a required column and always
 * holds real figures; `challenge_revenue` is optional and, between challenges,
 * is whatever the consolidator last left in it. Guessing wrong towards week
 * puts true numbers on the wall under an honest heading. Guessing wrong towards
 * challenge puts ₹0 on thirty-nine cards, which renders perfectly and is the
 * exact failure this project is built around.
 */
export function boardMode(cohort: Cohort): BoardMode {
  const raw = (cohort.challenge_mode ?? '').trim().toLowerCase()
  // `true` and `1` alongside `yes`, so a checkbox cell — which publishes as
  // `TRUE` — works without anyone having to know it publishes as `TRUE`.
  return raw === 'yes' || raw === 'y' || raw === 'true' || raw === '1' ? 'challenge' : 'week'
}

/** The figure the board ranks on and every card prints. */
export function boardEarned(mode: BoardMode, team: Team): number {
  return mode === 'challenge' ? team.challengeRevenue : team.weekRevenue
}

/**
 * The matching comparator. Paired with `boardEarned` on purpose: a board that
 * sorts one figure and prints another is a leaderboard of the wrong contest,
 * rendered perfectly, and `board.test.ts` pins the two together.
 */
export function rankForMode(mode: BoardMode, teams: readonly Team[]): Team[] {
  return mode === 'challenge' ? rankByChallenge(teams) : rankByWeek(teams)
}

/** What the band calls itself. The heading must never outlive the figure. */
export function boardHeading(mode: BoardMode): string {
  return mode === 'challenge' ? '10-Day Challenge' : 'Weekly Leaderboard'
}

/**
 * The period this board's figure resets with — **including the mode flip
 * itself**.
 *
 * `detect` goes silent whenever this number changes, because that is the tick
 * where every figure on the board moves at once and thirty-nine resets must not
 * read as thirty-nine overtakes. Switching `challenge_mode` is exactly such a
 * tick: every card's figure changes in the same poll.
 *
 * The two clocks are folded into one number space rather than sharing one.
 * Challenge 3 and week 3 are different periods, and handing `detect` a bare `3`
 * for both would make the one flip that most needs silencing look like no
 * change at all. Even is a challenge, odd is a week; no value means both.
 */
export function boardPeriod(cohort: Cohort): number | null {
  const mode = boardMode(cohort)
  const period = mode === 'challenge' ? currentChallenge(cohort) : openWeek(cohort)
  if (period === null) return null
  return mode === 'challenge' ? period * 2 : period * 2 + 1
}

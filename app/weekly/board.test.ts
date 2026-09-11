import { describe, expect, it } from 'vitest'

import { BOARD } from '@/app/weekly/page'
import { boardHeading, boardMode, rankForMode } from '@/lib/board'
import { currentChallenge, openWeek } from '@/lib/feed'
import { SPARE_TEAM_IDS } from '@/config'
import { COMPETING_SIZE, team, teams } from '@/test/fixtures'

/**
 * `/weekly`'s board spec, asserted directly.
 *
 * ── Why a wiring test rather than a behaviour test ──
 *
 * `lib/overtake.ts` is already period-agnostic: it compares `prev.week` to
 * whatever number it is handed and has no opinion about where that number came
 * from. So every interesting *behaviour* here is already covered in
 * `lib/overtake.test.ts`, and the only thing that can break is the wiring — which
 * number this page hands it, and which figure it ranks on.
 *
 * Both failures are invisible. A board on the wrong period goes deaf to real
 * overtakes and talkative through the tick where thirty-nine figures reset
 * together; a board ranking the wrong revenue renders a perfectly plausible
 * leaderboard of the wrong contest. Neither reports anything, and on a wall
 * nobody is actively watching either could run for weeks.
 */

/** A cohort carrying both clocks, so a test can only be reading one of them. */
const both = (challenge_mode: string) => ({
  challenge_mode,
  current_challenge: '1',
  current_open_week: '5',
})

const ON = both('Yes')
const OFF = both('No')

describe('/weekly board spec', () => {
  describe('challenge mode — challenge_mode is Yes', () => {
    it('ranks and scores on the challenge figure', () => {
      expect(BOARD.earned(team({ challengeRevenue: 4_200, weekRevenue: 9_999 }), ON)).toBe(4_200)

      const ranked = BOARD.rank(
        teams([
          { teamId: 'VBC101', challengeRevenue: 100, weekRevenue: 90_000 },
          { teamId: 'VBC102', challengeRevenue: 9_000, weekRevenue: 0 },
        ]),
        ON,
      )
      expect(ranked[0].teamId).toBe('VBC102')
    })

    /**
     * The two clocks disagree by construction and always will — challenges run
     * Tuesday→Monday, programme weeks Monday→Sunday. This is that disagreement
     * pinned to a cohort carrying both.
     */
    it('resets with the challenge, not with the programme week', () => {
      expect(BOARD.period?.(ON)).not.toBe(BOARD.period?.({ ...ON, current_challenge: '2' }))
      expect(BOARD.period?.(ON)).toBe(BOARD.period?.({ ...ON, current_open_week: '9' }))
    })
  })

  describe('week mode — challenge_mode is No', () => {
    it('ranks and scores on the week figure', () => {
      expect(BOARD.earned(team({ challengeRevenue: 4_200, weekRevenue: 9_999 }), OFF)).toBe(9_999)

      const ranked = BOARD.rank(
        teams([
          { teamId: 'VBC101', challengeRevenue: 100, weekRevenue: 90_000 },
          { teamId: 'VBC102', challengeRevenue: 9_000, weekRevenue: 0 },
        ]),
        OFF,
      )
      expect(ranked[0].teamId).toBe('VBC101')
    })

    it('resets with the programme week, not with the challenge', () => {
      expect(BOARD.period?.(OFF)).not.toBe(BOARD.period?.({ ...OFF, current_open_week: '9' }))
      expect(BOARD.period?.(OFF)).toBe(BOARD.period?.({ ...OFF, current_challenge: '2' }))
    })
  })

  /**
   * **The flip itself is a reset, and the loudest one.** Every card's figure
   * changes in the single poll the cell is edited. Folding the mode into the
   * period is what keeps `detect` silent through it; without it the wall
   * answers one sheet edit with a queue of overtake animations celebrating
   * nothing.
   */
  it('reads a different period either side of the switch', () => {
    expect(BOARD.period?.(ON)).not.toBe(BOARD.period?.(OFF))
  })

  /**
   * The two clocks share one stored field, so their number spaces must not
   * collide: challenge 3 and week 3 are different periods, and a bare `3` for
   * both would make the flip that most needs silencing look like no change.
   */
  it('never collides a challenge number with a week number', () => {
    const challenges = [1, 2, 3, 4, 5].map((n) =>
      BOARD.period?.({ challenge_mode: 'Yes', current_challenge: String(n) }),
    )
    const weeks = [1, 2, 3, 4, 5].map((n) =>
      BOARD.period?.({ challenge_mode: 'No', current_open_week: String(n) }),
    )
    expect(new Set([...challenges, ...weeks]).size).toBe(challenges.length + weeks.length)
  })

  it('has no period at all when the cohort has not published its clock', () => {
    expect(BOARD.period?.({ challenge_mode: 'Yes' })).toBeNull()
    expect(BOARD.period?.({ challenge_mode: 'No' })).toBeNull()
  })

  /** The spares exist as workbooks but do not compete for a slot. */
  it('drops the spares before ranking, in both modes', () => {
    for (const cohort of [ON, OFF]) {
      const ranked = BOARD.rank(teams(), cohort)
      expect(ranked).toHaveLength(COMPETING_SIZE)
      for (const spare of SPARE_TEAM_IDS) {
        expect(ranked.map((row) => row.teamId)).not.toContain(spare)
      }
    }
  })

  /**
   * The grid sorts again, independently — see `rowsOf`. If the two ever
   * disagree an overtake animates the wrong two cards on a board that otherwise
   * looks entirely correct.
   */
  it('uses the same comparator the grid renders with', () => {
    const rows = teams([
      { teamId: 'VBC105', challengeRevenue: 16_141, weekRevenue: 900 },
      { teamId: 'VBC112', challengeRevenue: -3_850, weekRevenue: 70_000 },
    ]).filter((row) => !SPARE_TEAM_IDS.includes(row.teamId))

    for (const cohort of [ON, OFF]) {
      const mode = boardMode(cohort)
      expect(BOARD.rank(rows, cohort).map((row) => row.teamId)).toEqual(
        rankForMode(mode, rows).map((row) => row.teamId),
      )
    }
  })

  /**
   * **The heading is the only thing on the frame that says which contest the
   * figures belong to**, so it is not allowed to be a constant. A board titled
   * `10-Day Challenge` while ranking the week's revenue is the whole failure
   * mode this switch exists to avoid.
   */
  it('does not call both contests by the same name', () => {
    expect(boardHeading(boardMode(ON))).not.toBe(boardHeading(boardMode(OFF)))
  })

  /** Neither raw reader is wired directly any more; both go through the mode. */
  it('is not hardwired to either clock', () => {
    expect(BOARD.period).not.toBe(openWeek)
    expect(BOARD.period).not.toBe(currentChallenge)
  })
})

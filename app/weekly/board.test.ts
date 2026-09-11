import { describe, expect, it } from 'vitest'

import { BOARD } from '@/app/weekly/page'
import { currentChallenge, openWeek } from '@/lib/feed'
import { rankByChallenge } from '@/lib/ranking'
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
 * Both failures are invisible. A board left on `openWeek` goes deaf to real
 * overtakes every Monday and stays talkative through the one tick where forty
 * figures drop to zero together; a board left ranking `weekRevenue` renders a
 * perfectly plausible leaderboard of the wrong contest. Neither reports
 * anything, and on a wall nobody is actively watching either could run for
 * weeks.
 */
describe('/weekly board spec', () => {
  it('resets with the challenge, not with the programme week', () => {
    expect(BOARD.period).toBe(currentChallenge)
    expect(BOARD.period).not.toBe(openWeek)
  })

  /**
   * The two clocks disagree by construction and always will — challenges run
   * Tuesday→Monday, programme weeks Monday→Sunday. This is that disagreement
   * pinned to the live sheet's own values on 19 August.
   */
  it('reads a different number from the week on the same cohort', () => {
    const cohort = { current_challenge: '1', current_open_week: '5' }
    expect(BOARD.period?.(cohort)).toBe(1)
    expect(openWeek(cohort)).toBe(5)
  })

  it('ranks and scores on the challenge figure', () => {
    expect(BOARD.earned(team({ challengeRevenue: 4_200, weekRevenue: 9_999 }))).toBe(4_200)

    const ranked = BOARD.rank(
      teams([
        { teamId: 'VBC101', challengeRevenue: 100, weekRevenue: 90_000 },
        { teamId: 'VBC102', challengeRevenue: 9_000, weekRevenue: 0 },
      ]),
    )
    expect(ranked[0].teamId).toBe('VBC102')
  })

  /** The spares exist as workbooks but do not compete for a slot. */
  it('drops the spares before ranking', () => {
    const ranked = BOARD.rank(teams())
    expect(ranked).toHaveLength(COMPETING_SIZE)
    for (const spare of SPARE_TEAM_IDS) {
      expect(ranked.map((row) => row.teamId)).not.toContain(spare)
    }
  })

  it('uses the same comparator the grid renders with', () => {
    const rows = teams([
      { teamId: 'VBC105', challengeRevenue: 16_141 },
      { teamId: 'VBC112', challengeRevenue: -3_850 },
    ]).filter((row) => row.teamId !== 'VBC140' && row.teamId !== 'VBC141')
    expect(BOARD.rank(rows).map((row) => row.teamId)).toEqual(
      rankByChallenge(rows).map((row) => row.teamId),
    )
  })
})

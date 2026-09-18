import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { BOARD } from '@/app/daily/page'
import { boardHeading, boardMode, rankForMode } from '@/lib/board'
import type { DailyWindow } from '@/lib/daily'
import { currentChallenge, openWeek } from '@/lib/feed'
import { SPARE_TEAM_IDS } from '@/config'
import { COMPETING_SIZE, team, teams } from '@/test/fixtures'

/**
 * `/daily`'s board spec, asserted directly.
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

const DAY: DailyWindow = {
  opened: '2026-09-17',
  closed: '2026-09-18',
  earned: { VBC101: 100, VBC102: 9_000 },
}

/** The next morning's window. Same teams, different day. */
const NEXT: DailyWindow = { ...DAY, opened: '2026-09-18', closed: '2026-09-19' }

describe('/daily board spec', () => {
  describe('challenge mode — challenge_mode is Yes', () => {
    it('ranks and scores on the challenge figure', () => {
      expect(
        BOARD.earned(team({ challengeRevenue: 4_200, weekRevenue: 9_999 }), ON, DAY),
      ).toBe(4_200)

      const ranked = BOARD.rank(
        teams([
          { teamId: 'VBC101', challengeRevenue: 100, weekRevenue: 90_000 },
          { teamId: 'VBC102', challengeRevenue: 9_000, weekRevenue: 0 },
        ]),
        ON,
        DAY,
      )
      expect(ranked[0].teamId).toBe('VBC102')
    })

    /**
     * The challenge board is live, so it has to keep hearing overtakes through
     * every morning the daily board rolls. A period that moved with the day
     * would go silent at ten o'clock on a contest whose figures did not change.
     */
    it('resets with the challenge, and with neither the week nor the day', () => {
      expect(BOARD.period?.(ON, DAY)).not.toBe(
        BOARD.period?.({ ...ON, current_challenge: '2' }, DAY),
      )
      expect(BOARD.period?.(ON, DAY)).toBe(BOARD.period?.({ ...ON, current_open_week: '9' }, DAY))
      expect(BOARD.period?.(ON, DAY)).toBe(BOARD.period?.(ON, NEXT))
    })
  })

  describe('daily mode — challenge_mode is anything else', () => {
    /**
     * **The figure is not on the row**, which is what makes this the one mode
     * where the spec could be handed the window and quietly ignore it. Both
     * teams below carry a week and a challenge figure that would order them the
     * other way round.
     */
    it('ranks and scores on the window, not on any column', () => {
      expect(
        BOARD.earned(team({ teamId: 'VBC102', challengeRevenue: 4_200, weekRevenue: 9_999 }), OFF, DAY),
      ).toBe(9_000)

      const ranked = BOARD.rank(
        teams([
          { teamId: 'VBC101', challengeRevenue: 90_000, weekRevenue: 90_000 },
          { teamId: 'VBC102', challengeRevenue: 0, weekRevenue: 0 },
        ]),
        OFF,
        DAY,
      )
      expect(ranked[0].teamId).toBe('VBC102')
    })

    /**
     * **Ten o'clock is the loudest non-event this wall can produce**, and it
     * happens daily: every figure on the board is replaced in one poll, so every
     * team whose new day beat its old one would read as having passed somebody.
     */
    it('resets with the day, and with neither clock in the sheet', () => {
      expect(BOARD.period?.(OFF, DAY)).not.toBe(BOARD.period?.(OFF, NEXT))
      expect(BOARD.period?.(OFF, DAY)).toBe(
        BOARD.period?.({ ...OFF, current_open_week: '9' }, DAY),
      )
      expect(BOARD.period?.(OFF, DAY)).toBe(
        BOARD.period?.({ ...OFF, current_challenge: '2' }, DAY),
      )
    })

    /**
     * A window that widened is still one period. The figures are true — the
     * difference between two real photographs — so the board is not resetting,
     * it is holding a longer day, and `detect` should go on hearing it. What
     * says the window widened is the masthead; see `boardScope`.
     */
    it('is one period per closing date, whatever the window spans', () => {
      expect(BOARD.period?.(OFF, DAY)).toBe(BOARD.period?.(OFF, { ...DAY, opened: '2026-09-16' }))
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
    expect(BOARD.period?.(ON, DAY)).not.toBe(BOARD.period?.(OFF, DAY))
  })

  /**
   * The three clocks share one stored field, so their number spaces must not
   * collide: challenge 3 and the third day of the month are different periods,
   * and a bare `3` for both would make the flip that most needs silencing look
   * like no change.
   */
  it('never collides a challenge number with a day', () => {
    const challenges = [1, 2, 3, 4, 5].map((n) =>
      BOARD.period?.({ challenge_mode: 'Yes', current_challenge: String(n) }, DAY),
    )
    const days = [1, 2, 3, 4, 5].map((n) =>
      BOARD.period?.({ challenge_mode: 'No' }, { ...DAY, closed: `2026-09-0${n}` }),
    )
    expect(new Set([...challenges, ...days]).size).toBe(challenges.length + days.length)
  })

  /**
   * Both cold starts route into the same silence: a sheet that has not published
   * its challenge number, and a wall that does not yet have two marks. The
   * second is the one every fresh laptop is in for up to a day.
   */
  it('has no period at all when it has nothing to measure', () => {
    expect(BOARD.period?.({ challenge_mode: 'Yes' }, DAY)).toBeNull()
    expect(BOARD.period?.(OFF, null)).toBeNull()
  })

  /** The spares exist as workbooks but do not compete for a slot. */
  it('drops the spares before ranking, in both modes', () => {
    for (const cohort of [ON, OFF]) {
      const ranked = BOARD.rank(teams(), cohort, DAY)
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

    const window: DailyWindow = { ...DAY, earned: { VBC105: 40, VBC112: 9_000 } }
    for (const cohort of [ON, OFF]) {
      const mode = boardMode(cohort)
      expect(BOARD.rank(rows, cohort, window).map((row) => row.teamId)).toEqual(
        rankForMode(mode, rows, window).map((row) => row.teamId),
      )
    }
  })

  /**
   * **The heading is the only thing on the frame that says which contest the
   * figures belong to**, so it is not allowed to be a constant. A board titled
   * `10-Day Challenge` while ranking a finished day is the whole failure mode
   * this switch exists to avoid.
   */
  it('does not call both contests by the same name', () => {
    expect(boardHeading(boardMode(ON))).not.toBe(boardHeading(boardMode(OFF)))
  })

  /**
   * ── The board's name is a storage namespace, and three places have to agree ──
   *
   * `BOARD.name` keys `byob-tv.v2.board.<name>` and `byob-tv.v2.queue.<name>`.
   * `DevFlipTrigger` writes to that queue and clears it, and it cannot import
   * `BOARD` to find the name — the page imports the trigger, so the trigger
   * importing the page is a cycle. So it spells the string out, and the two
   * spellings can drift.
   *
   * **This is not hypothetical; it happened during the `/weekly` → `/daily`
   * rename on 18 September 2026.** `BOARD.name` moved and the trigger's two
   * literals did not, which puts every triggered overtake into a queue that
   * nothing drains: the button reports success, the queue grows, and the board
   * never animates. Dev-only, invisible, and exactly the shape of failure this
   * project is built around — so it is pinned by reading the trigger's source
   * rather than by trusting a comment.
   */
  it('is the storage namespace the dev trigger writes to', () => {
    const trigger = readFileSync('components/DevFlipTrigger.tsx', 'utf8')
    expect(trigger).toContain(`enqueueKicks('${BOARD.name}'`)
    expect(trigger).toContain(`clearKicks('${BOARD.name}')`)
    // And it must not be the old one, which is what the rename left behind.
    expect(trigger).not.toContain("'weekly'")
  })

  /**
   * The route and the namespace are separate strings and both moved in the
   * rename. A namespace that still said `weekly` under a page served at
   * `/daily` would work perfectly — it is just a key — right up until somebody
   * grepped for one and found the other.
   */
  it('matches the route it is served at', () => {
    expect(BOARD.name).toBe('daily')
    expect(existsSync('app/daily/page.tsx')).toBe(true)
    expect(existsSync('app/weekly/page.tsx')).toBe(false)
  })

  /** Neither raw reader is wired directly any more; both go through the mode. */
  it('is not hardwired to either clock', () => {
    expect(BOARD.period).not.toBe(openWeek)
    expect(BOARD.period).not.toBe(currentChallenge)
  })
})

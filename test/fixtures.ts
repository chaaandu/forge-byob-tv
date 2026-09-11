import { MIN_TEAM_ROWS, SPARE_TEAM_IDS } from '@/config'
import { COHORT_KEYS } from '@/lib/feed'
import type { Team } from '@/lib/types'

/**
 * Test-only builders. Nothing under `app/`, `components/` or `lib/` may import
 * this file — the wall has exactly one data source and a fixture reachable from
 * the running app is a screenshot waiting to be mistaken for real performance.
 */

export function team(overrides: Partial<Team> = {}): Team {
  return {
    teamId: 'VBC101',
    ventureName: 'Aurora',
    totalRevenue: 0,
    weekRevenue: 0,
    todayRevenue: 0,
    totalUnits: 0,
    challengeRevenue: 0,
    ...overrides,
  }
}

/**
 * The cohort shape, and the only place in the tests that knows it.
 *
 * **Derived from config, not restated.** `COHORT_SIZE` is the competing cohort
 * plus the spares, which is exactly what `TV_Feed` publishes — 41 rows,
 * `VBC101`–`VBC141`, of which the last two are `SPARE_TEAM_IDS`. Every
 * assertion about "how many teams are on the board" reads these rather than a
 * literal, because the literals are what made six tests fail the day the cohort
 * changed size, each one restating a number it did not own.
 */
export const COMPETING_SIZE = MIN_TEAM_ROWS
export const COHORT_SIZE = COMPETING_SIZE + SPARE_TEAM_IDS.length

/** The whole cohort, all named, all on zero — the shape before trading opens. */
export function teams(overrides: Partial<Team>[] = []): Team[] {
  const rows = Array.from({ length: COHORT_SIZE }, (_, index) =>
    team({
      teamId: `VBC1${String(index + 1).padStart(2, '0')}`,
      ventureName: `Venture ${index + 1}`,
    }),
  )
  for (const override of overrides) {
    const at = rows.findIndex((row) => row.teamId === override.teamId)
    if (at === -1) throw new Error(`fixture: unknown teamId ${override.teamId}`)
    rows[at] = { ...rows[at], ...override }
  }
  return rows
}

/** Every cohort key present and empty, which is the state before any sale. */
export function cohort(overrides: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = {}
  for (const key of COHORT_KEYS) base[key] = ''
  base.as_of = '11 Aug 14:23'
  base.current_open_week = '4'
  base.flea_datetime_iso = '2026-10-31T10:00:00+05:30'
  return { ...base, ...overrides }
}

export function feedCsv(rows: readonly Team[]): string {
  const header = 'team_id,venture_name,total_revenue,week_revenue,today_revenue,total_units'
  const body = rows.map(
    (row) =>
      `${row.teamId},${row.ventureName},${row.totalRevenue},${row.weekRevenue},${row.todayRevenue},${row.totalUnits}`,
  )
  return [header, ...body].join('\n')
}

export function cohortCsv(values: Record<string, string>): string {
  const body = Object.entries(values).map(([key, value]) => `${key},${value}`)
  return ['key,value', ...body].join('\n')
}

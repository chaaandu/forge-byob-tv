// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FEED_CSV_URL, POLL_INTERVAL_MS, WATCH_RANKS_DAILY } from '@/config'
import { rankByWeek } from '@/lib/ranking'
import { KEYS } from '@/lib/storage'
import type { Team } from '@/lib/types'
import { useWallData, type BoardSpec, type WallData } from '@/lib/useWallData'
import { cohort, cohortCsv, feedCsv, teams } from '@/test/fixtures'

/**
 * The freeze, exercised through the real hook: ticks that land during a kick
 * fetch, gate, cache and detect exactly as always, but the snapshot is held and
 * applied on thaw. The failure this guards against renders convincingly — a
 * poll landing mid-kick re-slots every keyed row under the animation, and on a
 * wall nobody is watching closely that is indistinguishable from working.
 */

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const BOARD: BoardSpec = {
  name: 'weekly-test',
  rank: rankByWeek,
  earned: (team) => team.weekRevenue,
  watchTo: WATCH_RANKS_DAILY,
}

/** Teams with week revenue descending by fixture order: C401 leads on 42k. */
function board(overrides: Partial<Team>[] = []): Team[] {
  return teams(overrides).map((team, index) => ({
    ...team,
    weekRevenue: team.weekRevenue || 1_000 * (42 - index),
  }))
}

let servedTeams: Team[]
let latest: WallData | null = null
let root: Root
let host: HTMLDivElement

function Probe() {
  // A test probe, not an app component: the render's one job is to expose the
  // hook's return value to the assertions.
  // eslint-disable-next-line react-hooks/globals
  latest = useWallData(BOARD)
  return null
}

async function flushTick() {
  // One microtask queue drain per await inside tick(); three covers fetch →
  // text → parse. `act` then commits the state updates.
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
  await flushTick()
}

beforeEach(async () => {
  vi.useFakeTimers()
  localStorage.clear()
  servedTeams = board()
  // **Matched against `FEED_CSV_URL` itself, not against a substring of it.**
  //
  // This used to read `String(url).includes('feed')`, which is true of a
  // fixture path like `/mock/feed.csv` and false of every published Google URL
  // — those carry an opaque `2PACX-…` id and a numeric `gid`. So on any machine
  // without a `.env.local` pointing at fixtures, *both* fetches were served the
  // cohort CSV, `parseTeams` threw `TvSchemaError` on every tick, and five of
  // the six tests in this file failed on a fresh clone. The suite was green
  // only against an untracked file.
  //
  // Comparing to the constant the hook actually fetches cannot drift: change
  // the URL in config and this follows it.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      text: async () =>
        String(url) === FEED_CSV_URL ? feedCsv(servedTeams) : cohortCsv(cohort()),
    })),
  )
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<Probe />))
  await flushTick() // the mount tick
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  latest = null
})

describe('useWallData freeze', () => {
  it('applies a quiet tick immediately when nothing is playing', async () => {
    expect(latest?.snapshot?.teams[0].weekRevenue).toBe(42_000)
    servedTeams = board([{ teamId: 'VBC101', weekRevenue: 50_000 }])
    await advance(POLL_INTERVAL_MS)
    expect(latest?.snapshot?.teams.find((t) => t.teamId === 'VBC101')?.weekRevenue).toBe(50_000)
  })

  /**
   * The second arm of the hold: the tick that detects the overtake is already
   * the re-sorted board, and applying it would move the attacker before the
   * kick plays. It must be held even though nothing is frozen yet.
   */
  it('holds the snapshot of the very tick that queued a kick', async () => {
    servedTeams = board([{ teamId: 'VBC108', weekRevenue: 38_500 }]) // 8th takes 5th
    await advance(POLL_INTERVAL_MS)
    // The kick is queued and announced…
    expect(latest?.queueVersion).toBe(1)
    expect(JSON.parse(localStorage.getItem(KEYS.queue('weekly-test')) ?? '[]')).toHaveLength(1)
    // …but the rendered order is still the old one.
    expect(latest?.snapshot?.teams.find((t) => t.teamId === 'VBC108')?.weekRevenue).toBe(35_000)
    // Settle: the held snapshot lands.
    act(() => latest?.thaw())
    expect(latest?.snapshot?.teams.find((t) => t.teamId === 'VBC108')?.weekRevenue).toBe(38_500)
  })

  it('holds every tick that lands while frozen, applying only the newest on thaw', async () => {
    act(() => latest?.freeze())
    servedTeams = board([{ teamId: 'VBC101', weekRevenue: 60_000 }])
    await advance(POLL_INTERVAL_MS)
    expect(latest?.snapshot?.teams[0].weekRevenue).toBe(42_000)
    servedTeams = board([{ teamId: 'VBC101', weekRevenue: 70_000 }])
    await advance(POLL_INTERVAL_MS)
    expect(latest?.snapshot?.teams[0].weekRevenue).toBe(42_000)
    act(() => latest?.thaw())
    expect(latest?.snapshot?.teams[0].weekRevenue).toBe(70_000)
  })

  it('still detects and queues a real overtake on a tick that lands mid-kick', async () => {
    act(() => latest?.freeze())
    servedTeams = board([{ teamId: 'VBC108', weekRevenue: 38_500 }])
    await advance(POLL_INTERVAL_MS)
    // Queued for the next drain, snapshot held: the mailbox works during a kick.
    expect(latest?.queueVersion).toBe(1)
    expect(JSON.parse(localStorage.getItem(KEYS.queue('weekly-test')) ?? '[]')).toHaveLength(1)
    expect(latest?.snapshot?.teams.find((t) => t.teamId === 'VBC108')?.weekRevenue).toBe(35_000)
  })

  it('keeps writing the CSV cache while frozen, so a remount never boots stale', async () => {
    act(() => latest?.freeze())
    servedTeams = board([{ teamId: 'VBC101', weekRevenue: 60_000 }])
    await advance(POLL_INTERVAL_MS)
    const cached = JSON.parse(localStorage.getItem(KEYS.csv) ?? '{}') as { feedCsv?: string }
    expect(cached.feedCsv).toContain('60000')
  })

  it('thaw with nothing held changes nothing', async () => {
    const before = latest?.snapshot
    act(() => latest?.thaw())
    expect(latest?.snapshot).toBe(before)
  })
})

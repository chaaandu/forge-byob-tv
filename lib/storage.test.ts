// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { KICK_QUEUE_CAP } from '@/config'
import { enqueueKicks, hasKicks, takeKick, readCsvCache, writeCsvCache } from '@/lib/storage'
import type { OvertakeEvent } from '@/lib/types'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('csv cache', () => {
  it('round-trips raw text so parseSnapshot stays the only path from bytes to data', () => {
    writeCsvCache({ feedCsv: 'team_id\nVBC101', cohortCsv: 'key,value\nas_of,now' })
    expect(readCsvCache()).toEqual({ feedCsv: 'team_id\nVBC101', cohortCsv: 'key,value\nas_of,now' })
  })

  it('returns null when absent, which is a valid first-paint state', () => {
    expect(readCsvCache()).toBeNull()
  })
})

/**
 * One fetch commonly detects several rank changes, and `detect` hands them over
 * biggest climb first. What the cap keeps decides what the wall spends its one
 * interrupt on.
 */
describe('the kick queue under a crowded poll', () => {
  const climb = (from: number, to: number): OvertakeEvent => ({
    id: `w:t${from}:${to}`,
    attacker: `t${from}`,
    attackerName: '',
    defender: `t${to}`,
    defenderName: '',
    fromRank: from,
    toRank: to,
  })

  it('keeps the biggest climbs of a batch, not the last ones off the end', () => {
    // Sorted the way `detect` emits them: 9 places down to 1.
    const batch = [climb(10, 1), climb(9, 2), climb(8, 3), climb(7, 4), climb(6, 5), climb(5, 4)]
    enqueueKicks('cap-test', batch)

    const kept: OvertakeEvent[] = []
    for (let i = 0; i < KICK_QUEUE_CAP + 2; i += 1) {
      const next = takeKick('cap-test')
      if (next === null) break
      kept.push(next)
    }
    expect(kept).toHaveLength(KICK_QUEUE_CAP)
    expect(kept[0]).toEqual(batch[0])
    expect(kept.map((event) => event.fromRank - event.toRank)).toEqual([9, 7, 5, 3])
  })

  it('still drops the oldest when a second poll lands behind the first', () => {
    enqueueKicks('cap-test', [climb(10, 1)])
    enqueueKicks('cap-test', [climb(20, 11), climb(21, 12), climb(22, 13), climb(23, 14)])
    // The staleness rule is untouched: the earlier poll's event is the one that
    // goes, because an overtake nobody has seen yet beats one from a minute ago.
    const next = takeKick('cap-test')
    expect(next?.fromRank).toBe(20)
  })

  it('says whether anything is still waiting, without consuming it', () => {
    expect(hasKicks('cap-test')).toBe(false)
    enqueueKicks('cap-test', [climb(6, 5), climb(4, 3)])
    expect(hasKicks('cap-test')).toBe(true)
    takeKick('cap-test')
    expect(hasKicks('cap-test')).toBe(true)
    takeKick('cap-test')
    expect(hasKicks('cap-test')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { hashTeamId } from '@/lib/seed'
import { teams } from '@/test/fixtures'

const COHORT = teams().map((row) => row.teamId)

describe('hashTeamId', () => {
  it('is stable for the same id', () => {
    expect(hashTeamId('VBC101')).toBe(hashTeamId('VBC101'))
  })

  it('separates neighbouring ids', () => {
    expect(hashTeamId('VBC101')).not.toBe(hashTeamId('VBC102'))
  })

  it('is non-negative, so it is safe as a modulo index', () => {
    for (const id of ['VBC101', 'VBC141', '', 'A']) {
      expect(hashTeamId(id)).toBeGreaterThanOrEqual(0)
    }
  })

  it('spreads the real cohort across six tints without clustering', () => {
    // The point of hashing rather than using the rank: 41 workbooks whose ids
    // differ by one character must not land in one or two buckets.
    const buckets = new Map<number, number>()
    for (const id of COHORT) {
      const bucket = hashTeamId(id) % 6
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
    }
    expect(buckets.size).toBe(6)
    for (const count of buckets.values()) expect(count).toBeGreaterThan(2)
  })

  it('collapses on a small modulus, which is why nothing takes % 3 of it', () => {
    // The multiplier is 31 and 31 ≡ 1 (mod 3), so `hash % 3` degenerates into
    // "sum of the character codes, mod 3". Every team id here is VBC1 plus
    // two digits, so the bucket is decided by the digit sum — and three teams
    // sharing one is ordinary rather than unlucky. Measured on the running
    // wall: all three podium marks drew the same idle timeline, which is what
    // sent the idle to place-based assignment instead.
    const bucket = (id: string) => hashTeamId(id) % 3
    expect(bucket('VBC135')).toBe(bucket('VBC126'))
    expect(bucket('VBC135')).toBe(bucket('VBC138'))
  })
})

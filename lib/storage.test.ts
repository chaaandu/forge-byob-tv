// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readCsvCache, writeCsvCache } from '@/lib/storage'

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

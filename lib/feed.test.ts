import { describe, expect, it } from 'vitest'

import { MIN_TEAM_ROWS } from '@/config'
import { COHORT_SIZE, cohort, cohortCsv, feedCsv, teams } from '@/test/fixtures'
import {
  COHORT_KEYS,
  TvSchemaError,
  cohortInstant,
  currentChallenge,
  fleaInstant,
  openWeek,
  parseCohort,
  parseSnapshot,
  parseTeams,
  passesRowGate,
} from '@/lib/feed'

describe('parseTeams', () => {
  it('reads a well-formed feed', () => {
    const rows = parseTeams(
      feedCsv(
        teams([
          {
            teamId: 'VBC107',
            totalRevenue: 104_500,
            weekRevenue: 21_000,
            todayRevenue: 5_400,
            totalUnits: 12,
          },
        ]),
      ),
    )
    expect(rows).toHaveLength(COHORT_SIZE)
    const seven = rows.find((row) => row.teamId === 'VBC107')
    expect(seven).toMatchObject({
      totalRevenue: 104_500,
      weekRevenue: 21_000,
      todayRevenue: 5_400,
      totalUnits: 12,
    })
  })

  /**
   * Google's published CSV is served with a UTF-8 BOM and CRLF endings. Without
   * handling, `﻿team_id` never matches `team_id` and the schema check
   * throws on *every* fetch from first deploy, while a stray `\r` rides along on
   * the last field of every row. Both are silent-until-total failures, so they
   * get their own test rather than being trusted to the parser's reputation.
   */
  it('survives a UTF-8 BOM and CRLF line endings', () => {
    const csv = `﻿${feedCsv(teams()).replace(/\n/g, '\r\n')}`
    const rows = parseTeams(csv)
    expect(rows).toHaveLength(COHORT_SIZE)
    expect(rows[0].teamId).toBe('VBC101')
    expect(rows[COHORT_SIZE - 1].totalUnits).toBe(0)
  })

  it('reads formatted rupee values, because the sheet publishes formatted cells', () => {
    const csv = ['team_id,venture_name,total_revenue,week_revenue,today_revenue,total_units', 'VBC101,Aurora,"₹1,04,500","₹21,000",0,12'].join('\n')
    expect(parseTeams(csv)[0].totalRevenue).toBe(104_500)
  })

  it('reads challenge_revenue, including a negative one', () => {
    const csv = [
      'team_id,venture_name,total_revenue,week_revenue,today_revenue,total_units,challenge_revenue',
      'VBC101,Dosa Crisps,57826,0,0,236,"-3,850"',
      'VBC102,ROOH,37830,3190,0,108,"3,190"',
    ].join('\n')
    expect(parseTeams(csv)[0]).toMatchObject({ teamId: 'VBC101', challengeRevenue: -3_850 })
    expect(parseTeams(csv)[1]).toMatchObject({ teamId: 'VBC102', challengeRevenue: 3_190 })
  })

  it('defaults challenge_revenue to 0 when the sheet has not grown the column', () => {
    const csv = [
      'team_id,venture_name,total_revenue,week_revenue,today_revenue,total_units',
      'VBC101,Dosa Crisps,57826,0,0,236',
    ].join('\n')
    expect(parseTeams(csv)[0]).toMatchObject({ challengeRevenue: 0 })
  })

  it('treats a blank revenue as zero — a team with no sales yet is normal', () => {
    const csv = ['team_id,venture_name,total_revenue,week_revenue,today_revenue,total_units', 'VBC101,Aurora,,,,'].join('\n')
    expect(parseTeams(csv)[0]).toMatchObject({
      totalRevenue: 0,
      weekRevenue: 0,
      todayRevenue: 0,
      totalUnits: 0,
    })
  })

  it('keeps a venture name containing a comma intact', () => {
    const csv = [
      'team_id,venture_name,total_revenue,week_revenue,today_revenue,total_units',
      'VBC101,"Bhatt, Rao & Co",1000,500,100,1',
    ].join('\n')
    expect(parseTeams(csv)[0].ventureName).toBe('Bhatt, Rao & Co')
  })

  it('throws on a missing header rather than guessing a column', () => {
    const csv = ['team_id,venture_name,total_revenue,total_units', 'VBC101,Aurora,1000,1'].join('\n')
    expect(() => parseTeams(csv)).toThrow(TvSchemaError)
  })

  /**
   * A formula tab mid-recalculation exports `#REF!` where a number should be.
   * Dropping the row rather than throwing is what lets `passesRowGate` be the
   * single judge of whether a fetch is trustworthy — see the gate tests below.
   */
  it('drops a row whose numbers did not parse rather than rendering NaN for a week', () => {
    const csv = [
      'team_id,venture_name,total_revenue,week_revenue,today_revenue,total_units',
      'VBC101,Aurora,#REF!,1,1,1',
      'VBC102,Kite,1000,500,100,1',
    ].join('\n')
    const rows = parseTeams(csv)
    expect(rows.map((row) => row.teamId)).toEqual(['VBC102'])
    expect(rows.every((row) => Number.isFinite(row.totalRevenue))).toBe(true)
  })
})

describe('header handling', () => {
  /**
   * The live `TV_Cohort` came back as `Key,Value`, not `key,value` — hand-typed,
   * looks correct in the sheet, and threw on every single fetch. Case and
   * surrounding space are not part of the contract; the names are.
   */
  it('reads a hand-typed header whatever its case or padding', () => {
    const csv = ['Key, Value', 'as_of,11 Aug 18:41', 'current_open_week,4', 'flea_datetime_iso,2026-09-06T10:00:00+05:30'].join('\r\n')
    expect(parseCohort(csv).current_open_week).toBe('4')
  })

  it('applies the same rule to the feed, so there is no per-tab special case', () => {
    const csv = [
      'Team_ID,Venture_Name,Total_Revenue,Week_Revenue,Today_Revenue,Total_Units',
      'VBC101,Dosa Crisps,9449,4250,0,38',
    ].join('\r\n')
    expect(parseTeams(csv)[0]).toMatchObject({ teamId: 'VBC101', weekRevenue: 4_250 })
  })
})

describe('venture names', () => {
  /**
   * The workbook template ships with this in the cell, and five of the forty
   * competing teams still had it. On a campus TV it reads as "nobody is looking
   * after this wall"; the team code reads as "not yet", and is the pressure to
   * go and fill it in.
   */
  it('treats the workbook placeholder as no name at all', () => {
    const csv = [
      'team_id,venture_name,total_revenue,week_revenue,today_revenue,total_units',
      'VBC121,Type your venture name,0,0,0,0',
      'VBC122,TYPE YOUR VENTURE NAME,0,0,0,0',
      'VBC123,  Dosa Crisps  ,1,1,1,1',
    ].join('\n')
    const rows = parseTeams(csv)
    expect(rows[0].ventureName).toBe('')
    expect(rows[1].ventureName).toBe('')
    expect(rows[2].ventureName).toBe('Dosa Crisps')
  })
})

describe('the product column', () => {
  const head = 'team_id,venture_name,total_revenue,week_revenue,today_revenue,total_units'

  /**
   * Read optionally and **deliberately not in `FEED_HEADERS`**: the live sheet
   * does not publish it yet, and a required column that does not exist throws
   * away every fetch. `/live` shows what a venture sells the moment the column
   * lands, with no deploy.
   */
  it('is absent, not empty, when the sheet has no such column', () => {
    const rows = parseTeams([head, 'VBC101,Dosa Crisps,1,1,1,1'].join('\n'))
    expect(rows[0].product).toBeUndefined()
  })

  it('carries what the team typed, trimmed', () => {
    const rows = parseTeams(
      [`${head},product`, 'VBC101,Dosa Crisps,1,1,1,1,"  Ragi chips, baked  "'].join('\n'),
    )
    expect(rows[0].product).toBe('Ragi chips, baked')
  })

  // The same reasoning as the venture-name placeholder above: the template's
  // own words are not an answer, and printing them would look like a wall
  // nobody is looking after.
  it('treats the workbook placeholder and a blank cell as no answer', () => {
    const rows = parseTeams(
      [
        `${head},product`,
        'VBC101,Dosa Crisps,1,1,1,1,Type your product here',
        'VBC102,ROOH,1,1,1,1,',
      ].join('\n'),
    )
    expect(rows[0].product).toBeUndefined()
    expect(rows[1].product).toBeUndefined()
  })
})

describe('parseCohort', () => {
  it('reads every key', () => {
    const parsed = parseCohort(cohortCsv(cohort({ current_open_week: '4' })))
    expect(parsed.current_open_week).toBe('4')
    for (const key of COHORT_KEYS) expect(parsed).toHaveProperty(key)
  })

  it('accepts an empty value — the sheet not knowing yet is normal', () => {
    const parsed = parseCohort(cohortCsv(cohort({ flea_datetime_iso: '' })))
    expect(parsed.flea_datetime_iso).toBe('')
  })

  it('throws on a missing key, because that means the sheet shape drifted', () => {
    const values = cohort()
    delete values.current_open_week
    expect(() => parseCohort(cohortCsv(values))).toThrow(TvSchemaError)
  })
})

describe('currentChallenge', () => {
  it('reads the challenge number', () => {
    expect(currentChallenge({ current_challenge: '1' })).toBe(1)
    expect(currentChallenge({ current_challenge: '2' })).toBe(2)
  })

  /**
   * Optional on purpose, and not in `COHORT_KEYS`. A wall fetching a sheet
   * mid-edit gets `null`, which routes into the same branch a brand-new TV
   * takes: record what you see, animate nothing.
   */
  it('is null when the sheet has not said', () => {
    expect(currentChallenge({})).toBeNull()
    expect(currentChallenge({ current_challenge: '' })).toBeNull()
    expect(currentChallenge({ current_challenge: 'first' })).toBeNull()
    expect(currentChallenge({ current_challenge: '0' })).toBeNull()
  })
})

describe('cohortInstant', () => {
  it('reads an instant that carries an offset', () => {
    const at = cohortInstant(
      { challenge_start_iso: '2026-08-18T00:00:00+05:30' },
      'challenge_start_iso',
    )
    expect(at?.toISOString()).toBe('2026-08-17T18:30:00.000Z')
  })

  /**
   * The load-bearing half. Without the offset the string is parsed in the
   * *browser's* timezone, so a laptop set to anything but IST derives a
   * different day number and looks completely healthy doing it.
   */
  it('refuses an instant with no offset', () => {
    expect(
      cohortInstant({ challenge_start_iso: '2026-08-18T00:00:00' }, 'challenge_start_iso'),
    ).toBeNull()
  })

  it('is null for a key the sheet has not published', () => {
    expect(cohortInstant({}, 'challenge_end_iso')).toBeNull()
  })
})

describe('passesRowGate', () => {
  /**
   * Short, not exact. Google's CSV export can re-read the sheet inside the
   * `clearContent` → `setValues` window of a full rebuild and come back short.
   * Acting on that would vanish teams and reshuffle ranks around the hole.
   */
  it('rejects a feed short of the competing cohort', () => {
    expect(passesRowGate(teams().slice(0, MIN_TEAM_ROWS - 1))).toBe(false)
  })

  it('accepts exactly the competing cohort, the spares being optional', () => {
    expect(passesRowGate(teams().slice(0, MIN_TEAM_ROWS))).toBe(true)
  })

  /**
   * The gate counts *usable* rows, so a torn export that garbles cells rather
   * than truncating lines is caught by the same rule. This is the reason
   * `parseTeams` drops an unparseable row instead of throwing on it.
   */
  it('rejects a full-length feed whose rows are too garbled to use', () => {
    const csv = feedCsv(teams())
      .split('\n')
      .map((line, index) => (index >= 1 && index <= 3 ? line.replace(/,0,0,0,0$/, ',#REF!,0,0,0') : line))
      .join('\n')
    const parsed = parseTeams(csv)
    expect(parsed).toHaveLength(COHORT_SIZE - 3)
    expect(passesRowGate(parsed)).toBe(false)
  })

  /**
   * The day one more workbook is added, an exact check would freeze every wall
   * on stale data permanently, silently, with no error state to notice. A
   * partial write cannot *add* rows, so growth is always legitimate.
   */
  it('accepts a longer feed, so adding a team does not freeze the wall', () => {
    expect(passesRowGate([...teams(), { ...teams()[0], teamId: 'VBC142' }])).toBe(true)
  })
})

describe('parseSnapshot', () => {
  it('builds both halves from raw text', () => {
    const snapshot = parseSnapshot({
      feedCsv: feedCsv(teams()),
      cohortCsv: cohortCsv(cohort()),
    })
    expect(snapshot.teams).toHaveLength(COHORT_SIZE)
    expect(snapshot.cohort.current_open_week).toBe('4')
  })
})

describe('openWeek', () => {
  it('reads the week the sheet says is open', () => {
    expect(openWeek(cohort({ current_open_week: '4' }))).toBe(4)
  })

  /** No week means the wall cannot tell a rollover from forty overtakes, so it must not guess. */
  it('is null when the sheet has not produced one', () => {
    expect(openWeek(cohort({ current_open_week: '' }))).toBeNull()
    expect(openWeek(cohort({ current_open_week: '#REF!' }))).toBeNull()
    expect(openWeek(cohort({ current_open_week: '0' }))).toBeNull()
    expect(openWeek(cohort({ current_open_week: '2.5' }))).toBeNull()
  })
})

describe('fleaInstant', () => {
  it('reads an instant carrying its offset', () => {
    // Compared to the fixture's own cell rather than to a literal instant: this
    // test is about the *parse*, not about which date the Flea is on, and a
    // restated date here breaks every time the cohort's calendar moves.
    expect(fleaInstant(cohort())?.toISOString()).toBe(
      new Date(cohort().flea_datetime_iso).toISOString(),
    )
  })

  /**
   * The offset is the whole point. Without it `new Date` parses in the browser's
   * timezone, so a laptop set to anything but IST counts down to the wrong
   * instant and looks completely healthy doing it. Rejecting is what keeps the
   * countdown a difference between two absolute instants.
   */
  it('rejects an instant with no offset rather than parsing it as browser-local', () => {
    expect(fleaInstant(cohort({ flea_datetime_iso: '2026-09-06T10:00:00' }))).toBeNull()
    expect(fleaInstant(cohort({ flea_datetime_iso: '06/09/2026 10:00' }))).toBeNull()
    expect(fleaInstant(cohort({ flea_datetime_iso: '' }))).toBeNull()
  })

  it('accepts UTC as an explicit offset', () => {
    expect(fleaInstant(cohort({ flea_datetime_iso: '2026-09-06T04:30:00Z' }))?.toISOString()).toBe(
      '2026-09-06T04:30:00.000Z',
    )
  })
})

import { describe, expect, it } from 'vitest'

import { nameOf, titleCase } from '@/lib/team'
import type { Team } from '@/lib/types'

const team = (over: Partial<Team> = {}): Team =>
  ({
    teamId: 'SLE-C407',
    ventureName: '',
    totalRevenue: 0,
    totalUnits: 0,
    weekRevenue: 0,
    todayRevenue: 0,
    challengeRevenue: 0,
    ...over,
  }) as Team

/**
 * The casing rule exists because the sheet's casing is 39 people's typing. Of
 * the 41 names in the feed, 10 are ALL CAPS and 3 are lowercase — so removing
 * `text-transform: uppercase` from the three name rules without this would have
 * produced a board where `BLUNNT` shouts next to `snackerly`.
 *
 * The cases below are the real names, not invented ones. Every regression this
 * function has had was a real name the invented cases did not cover.
 */
describe('titleCase', () => {
  it('leaves a name alone when the team cased it themselves', () => {
    // Mixed case is evidence of intent, and every one of these is damaged by a
    // per-word title-caser: `n` and `by` get raised, `ATC` gets flattened.
    for (const name of [
      'Dosa Crisps',
      'SoleMate',
      'ATC (All Things Camphor)',
      'The Chips n Dip Story',
      'In Between Sips by Kaappitalism',
      'Wake & Wyze',
      'Yōki',
    ]) {
      expect(titleCase(name)).toBe(name)
    }
  })

  it('normalises a name typed in one case', () => {
    expect(titleCase('BLUNNT')).toBe('Blunnt')
    expect(titleCase('XOCO')).toBe('Xoco')
    expect(titleCase('snackerly')).toBe('Snackerly')
    expect(titleCase('aarambh')).toBe('Aarambh')
  })

  /** The decision is per name, the rewrite is per word. */
  it('raises every word of a multi-word name it does normalise', () => {
    expect(titleCase('CHAKHA NA?')).toBe('Chakha Na?')
  })

  it('raises the first letter, not the first character', () => {
    expect(titleCase('(HELLO) THERE')).toBe('(Hello) There')
    expect(titleCase('10 SNACKS')).toBe('10 Snacks')
  })

  it('survives a name with no letters in it at all', () => {
    expect(titleCase('???')).toBe('???')
    expect(titleCase('')).toBe('')
  })
})

describe('nameOf', () => {
  it('cases the venture name', () => {
    expect(nameOf(team({ ventureName: 'ROOH' }))).toBe('Rooh')
  })

  /**
   * **The ID must not go through `titleCase`.** It has no lowercase in it, so
   * the rule would treat it as un-cased and return `Sle-c407` — which looks
   * like a typo on a wall nobody is close enough to query.
   */
  it('leaves an unnamed team its ID exactly as it is', () => {
    expect(nameOf(team({ ventureName: '' }))).toBe('SLE-C407')
  })
})

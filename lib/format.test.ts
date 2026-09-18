import { describe, expect, it } from 'vitest'

import { formatCount, formatRupees, ordinal } from '@/lib/format'

describe('formatRupees', () => {
  /**
   * Indian digit grouping. Western grouping on a lakh figure reads as a typo
   * before it reads as a number, to the cohort reading their own revenue off it.
   */
  it('groups the Indian way', () => {
    expect(formatRupees(104_500)).toBe('₹1,04,500')
    expect(formatRupees(0)).toBe('₹0')
  })

  /**
   * `/daily`'s challenge figure can legitimately be negative: a baseline is a
   * photograph of a proof-gated total, and proof can be revoked after the
   * shutter closes. The card prints it rather than hiding it.
   */
  it('keeps a real negative', () => {
    expect(formatRupees(-3_850)).toBe('-₹3,850')
    expect(formatRupees(-1.5)).toBe('-₹1')
  })

  /**
   * ── The `-₹0` bug, and why it is a rounding bug rather than a display rule ──
   *
   * `Math.round(-0.5)` is **negative zero**, and `Intl.NumberFormat` faithfully
   * renders its sign — so any shortfall between −₹0.50 and ₹0 printed `-₹0`. One
   * team was at exactly −₹0.50 on 19 August.
   *
   * At whole-rupee precision that value *is* zero, so the sign was describing
   * precision that had already been discarded. A minus in front of a zero on a
   * wall reads as a fault rather than as a fact.
   */
  it('never signs a value that rounds to zero', () => {
    expect(formatRupees(-0.5)).toBe('₹0')
    expect(formatRupees(-0.4)).toBe('₹0')
    expect(formatRupees(-0.0001)).toBe('₹0')
  })
})

describe('formatCount', () => {
  it('groups the Indian way, without a symbol', () => {
    expect(formatCount(104_500)).toBe('1,04,500')
  })
})

describe('ordinal', () => {
  it('reads as words a cropped photo still explains', () => {
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(2)).toBe('2nd')
    expect(ordinal(3)).toBe('3rd')
    expect(ordinal(4)).toBe('4th')
    expect(ordinal(11)).toBe('11th')
    expect(ordinal(12)).toBe('12th')
    expect(ordinal(13)).toBe('13th')
    expect(ordinal(21)).toBe('21st')
  })
})

/**
 * ── THE WIDEST FIGURE THIS WALL IS SIZED FOR ──
 *
 * `--t-stage-figure` on `/podium` and the board's column split are both sized
 * against a *twelve-glyph* figure, because `en-IN` groups by lakh and crore
 * and so separators arrive faster than digits: `₹2,42,546` is 9 glyphs,
 * `₹10,00,000` is 10, and `₹1,00,00,000` is 12.
 *
 * `--fs-1` carried this on `/podium` until the three places moved onto a
 * rendered image and their type became container units against a block's own
 * face. The bound did not move; what is measured against it did.
 *
 * **Twelve is a bound, not a maximum.** This function has no ceiling — the
 * sheet can hold any number — and the first value that needs thirteen is
 * ₹10,00,00,000, ten crore. `scripts/measure-figures.mjs` shows first place's
 * column holding twelve with 26px to spare at 1920x1080 and 12px at 1366x768,
 * so thirteen fits at the larger size and overflows at the smaller.
 *
 * That ceiling is stated rather than defended: thirty-nine student ventures
 * over one programme will not reach ten crore, and sizing the wall's hero
 * figure for a number that cannot occur costs every real figure the width it
 * would take. What matters is that the bound is *known* — it was not, and first
 * place's figure at 56px overflowed its column by 38px at every viewport with a
 * single crore in it, with nothing reporting it.
 *
 * **If the first assertion fails, the type sizes are what change**, not the
 * assertion. Switching to `notation: 'compact'`, adding paise or dropping the
 * grouping would all land here first.
 */
describe('the widest output the layout is sized against', () => {
  const glyphs = (n: number) => formatRupees(n).length

  it('stays inside twelve glyphs for everything up to ten crore', () => {
    for (const value of [0, 1, 999, 1_000, 99_999, 1_00_000, 10_00_000, 99_99_999,
                         1_00_00_000, 9_99_99_999]) {
      expect(glyphs(value)).toBeLessThanOrEqual(12)
    }
  })

  it('names the value where it stops fitting the smaller viewports', () => {
    // Ten crore is the first thirteen-glyph figure. Asserted so the boundary is
    // a documented number rather than a surprise on some future Friday.
    expect(formatRupees(9_99_99_999)).toBe('₹9,99,99,999')
    expect(glyphs(9_99_99_999)).toBe(12)
    expect(formatRupees(10_00_00_000)).toBe('₹10,00,00,000')
    expect(glyphs(10_00_00_000)).toBe(13)
  })

  it('groups by lakh and crore, which is where the width comes from', () => {
    expect(formatRupees(2_42_546)).toBe('₹2,42,546')
    expect(formatRupees(10_00_000)).toBe('₹10,00,000')
    expect(formatRupees(1_00_00_000)).toBe('₹1,00,00,000')
  })

  it('is as wide at one crore as at nine, because the figures are tabular', () => {
    // Every digit is the same advance, so width is glyph count alone and the
    // measurement script can use any twelve-glyph string as its probe.
    expect(glyphs(1_00_00_000)).toBe(glyphs(9_99_99_999))
  })

  it('a negative is one glyph wider, and only /daily prints one', () => {
    // The challenge figure can sit below its baseline when proof is revoked.
    // `/podium` prints all-time totals, which cannot be negative — so the
    // thirteen-glyph case never reaches the column that is tightest.
    expect(formatRupees(-10_00_000)).toBe('-₹10,00,000')
    expect(glyphs(-10_00_000)).toBe(glyphs(10_00_000) + 1)
  })
})

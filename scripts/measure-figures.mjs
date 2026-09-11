/**
 * Does the widest figure this wall is sized for still fit the box that holds it?
 *
 *   node scripts/measure-figures.mjs [url]
 *
 * Reach for this after changing any figure's type size, any column width, or
 * `formatRupees`. It is the check a 1920x1080 screenshot of *today's* data
 * cannot give you, because today's data is small.
 *
 * ── The trap it exists for ──
 *
 * `Intl.NumberFormat('en-IN')` groups by lakh and crore, so a figure gains
 * separators faster than it gains digits: ₹2,42,546 is 9 glyphs, ₹10,00,000 is
 * 10, and ₹1,00,00,000 is 12. The board is tuned against a cohort whose leader
 * is on ₹2.4L, so a third of the width a figure can eventually need is never
 * exercised. Measured before this existed: `/podium`'s leader figure at 56px
 * needed 350px in a 312px column and overflowed 38px into the gaps either side
 * of first place — at every viewport, with nothing reporting it.
 *
 * ── How it measures ──
 *
 * It does not need a stress fixture. It writes the widest string the formatter
 * can produce into each figure element, reads `scrollWidth` against the box
 * that must contain it, and puts the original text back. So it measures the
 * *running* layout at whatever data happens to be live.
 */

import { launch, open } from './measure-browser.mjs'

const url = process.argv[2] ?? 'http://localhost:3000'

/** 16:9 at three scales, plus one off-ratio. Columns are `vw`; figures are too,
    so the ratio between them holds — but the fixed `--s-*` gaps do not, which
    is what makes the smallest viewport the tightest. */
const SIZES = [
  [1920, 1080],
  [1600, 900],
  [1366, 768],
  [2000, 1100],
]

/**
 * The widest figure this wall is **sized for**, which is not the widest it can
 * print.
 *
 * Twelve glyphs. `formatRupees` has no ceiling — the sheet can hold any number
 * — and the first value needing thirteen is ₹10,00,00,000, ten crore. That
 * bound is stated rather than defended in `lib/format.test.ts`: thirty-nine
 * student ventures over one programme will not reach ten crore, and sizing the
 * hero figure for a number that cannot occur costs every real figure the width
 * it would take.
 *
 * The digits are all `9` and it does not matter which they are: the faces are
 * set with `font-variant-numeric: tabular-nums`, so every digit has the same
 * advance and width is glyph count alone.
 */
const WIDEST = '₹9,99,99,999'

/**
 * ── Why this measures a clone and not `scrollWidth` ──
 *
 * The obvious check is to write the widest string into the element and compare
 * its `scrollWidth` to its container. It does not work: `scrollWidth` returns
 * `max(clientWidth, content width)`, so an element that is already as wide as
 * its container reports the container's width whatever is in it. Every figure
 * came back with exactly zero slack — which reads as "fits perfectly" and
 * actually means "measured nothing".
 *
 * So the text is measured on an absolutely-positioned clone with
 * `white-space: nowrap` and `width: auto`, carrying the element's own computed
 * font and tracking. That gives the width the string genuinely needs, which is
 * the number the container has to beat.
 */
async function measure(page) {
  return page.evaluate((widest) => {
    const out = []

    const textWidth = (el, text) => {
      const cs = getComputedStyle(el)
      const probe = document.createElement('span')
      probe.textContent = text
      probe.style.cssText =
        `position:absolute;visibility:hidden;white-space:nowrap;width:auto;` +
        `font:${cs.font};letter-spacing:${cs.letterSpacing};` +
        `font-variant-numeric:${cs.fontVariantNumeric};text-transform:${cs.textTransform}`
      document.body.append(probe)
      const w = probe.getBoundingClientRect().width
      probe.remove()
      return Math.ceil(w)
    }

    const check = (label, el, haveWidth) => {
      if (!el || haveWidth === null) return
      const need = textWidth(el, widest)
      out.push({ label, need, have: Math.round(haveWidth), slack: Math.round(haveWidth) - need })
    }

    const inner = (el) => {
      const cs = getComputedStyle(el)
      return el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    }

    // Each podium place: the figure against its own column.
    const PLACE = { 0: 2, 1: 1, 2: 3 }
    document.querySelectorAll('.tv-pod-slot').forEach((slot, i) => {
      check(`podium place ${PLACE[i]}`, slot.querySelector('.tv-figure'), inner(slot))
    })

    // A list row is a grid — rank, mark, a `1fr` name, an `auto` figure. The
    // figure has no column of its own to be measured against, so the question
    // is what the *name* has left once the figure takes what it needs. A name
    // squeezed to nothing is the failure here, not an overflow.
    const row = document.querySelector('.tv-pod-row')
    if (row) {
      const fig = row.querySelector('.tv-figure')
      const name = row.querySelector('.tv-pod-row-name')
      const gaps = parseFloat(getComputedStyle(row).columnGap) * 3
      const fixed = [...row.children]
        .filter((c) => c !== name && c !== fig)
        .reduce((n, c) => n + c.getBoundingClientRect().width, 0)
      const left = inner(row) - fixed - gaps - textWidth(fig, widest)
      out.push({ label: 'podium list name', need: 0, have: Math.round(left), slack: Math.round(left) })
    }

    // A weekly card: both figure lines against the card's content box.
    const cell = document.querySelector('.tv-card-cell')
    if (cell) {
      const card = cell.querySelector('.tv-card')
      check('weekly figure', cell.querySelector('.tv-card-week'), inner(card))
      // The today line also carries the direction mark, which is 0.72em wide.
      const today = cell.querySelector('.tv-card-today')
      if (today) {
        const mark = 0.72 * parseFloat(getComputedStyle(today).fontSize)
        const gap = parseFloat(getComputedStyle(today).columnGap) || 0
        out.push({
          label: 'weekly today',
          need: Math.ceil(textWidth(today, widest) + mark + gap),
          have: Math.round(inner(card)),
          slack: Math.round(inner(card)) - Math.ceil(textWidth(today, widest) + mark + gap),
        })
      }
    }
    return out
  }, WIDEST)
}

const browser = await launch()
let failed = false

for (const [width, height] of SIZES) {
  for (const path of ['/weekly', '/podium']) {
    const { page, errors } = await open(browser, `${url}${path}`, { width, height })
    const rows = await measure(page)
    for (const r of rows) {
      const ok = r.slack >= 0
      if (!ok) failed = true
      console.log(
        `${ok ? '  ok  ' : '✗ OVER'} ${String(`${width}x${height}`).padEnd(10)} ` +
          `${r.label.padEnd(18)} needs ${String(r.need).padStart(4)}px  has ` +
          `${String(r.have).padStart(4)}px  slack ${String(r.slack).padStart(5)}px`,
      )
    }
    if (errors.length) console.log('   console errors:', errors)
    await page.close()
  }
}

await browser.close()
console.log(failed ? '\nFAIL — a figure does not fit its box.' : `\nAll figures fit ${WIDEST} at every size.`)
process.exit(failed ? 1 : 0)

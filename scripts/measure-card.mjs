/**
 * Does `/weekly`'s card still hold its rhythm now the day band is gone?
 *
 *   node scripts/measure-card.mjs [url]
 *
 * Reach for this after changing `--h-card-*`, `--s-card-pad-y`, `--w-day-mark`,
 * `--s-day-mark-gap` or the mark's `min()` in `.tv-card-row`. It answers the
 * four questions the band's removal opened, and every one of them is a failure
 * that renders convincingly:
 *
 * 1. **Does the ramp still descend?** The band's 28px came out of
 *    `--d-card-logo`'s subtraction, 10 of which went back to `--s-card-pad-y`
 *    and 18 to the marks. A bare subtraction can *invert* the ramp — that has
 *    happened here before, with rows 3 and 4 carrying a bonus multiplier that
 *    outlived the ramp it was compensating for, and the board grew towards the
 *    bottom on a page that otherwise looked entirely correct.
 * 2. **Is any mark now wider than its card?** The `min()` against the card's
 *    width is what forbids it, and 18px is enough to make width the binding
 *    axis on a row where height used to be.
 * 3. **Do all thirty-nine figures share one centre line?** This is the one the
 *    mark's positioning exists for. Laid out as a flex sibling the chevrons
 *    would be measured *with* the amount and the pair would be centred, so the
 *    figure on every card that had traded would sit a few pixels right of every
 *    figure on one that had not. Six numbers out of a column of thirty-nine,
 *    off by single pixels, is not something a screenshot settles.
 * 4. **Does the figure still clear the card's bottom edge?** The band used to
 *    be the card's last row and held the 10px of padding inside its own height.
 *    A rupee amount sitting on the card's own edge reads as a number that has
 *    been cut off.
 *
 * ── It seeds the daily window, because the board cannot draw one ──
 *
 * `/weekly`'s figures are the difference between two photographs of
 * `total_revenue` taken at 10:00 IST and kept in `localStorage`, so a browser
 * that has never run the wall has no window and every card prints ₹0. That is
 * a true state of the product — it is what a fresh laptop shows for up to a day
 * — and it is useless for measuring, because a board of identical short figures
 * cannot show a column drifting. Two marks are written before the first paint.
 *
 * It also rewrites `today_revenue` on the way through, because the committed
 * mock carries zero for all forty-one teams and the chevrons are drawn on
 * exactly the cards that have traded. Six, matching the live sheet's own count
 * on a working afternoon.
 */

import { launch } from './measure-browser.mjs'

const url = process.argv[2] ?? 'http://localhost:3100/weekly'

/** Roughly the live sheet's own shape: six teams trading, the rest quiet. */
const TRADED = {
  VBC101: 1_998,
  VBC107: 1_299,
  VBC114: 1,
  VBC118: 218,
  VBC132: 1_170,
  VBC139: 1_098,
}

const browser = await launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

// `today_revenue` on the way through. The column is index 4; the mock's own
// header order is asserted rather than assumed, so a reordered fixture fails
// loudly instead of silently writing a day figure into `total_units`.
await page.route('**/mock/feed.csv', async (route) => {
  const response = await route.fetch()
  const lines = (await response.text()).split('\n')
  const header = lines[0].split(',')
  if (header[2] !== 'total_revenue' || header[4] !== 'today_revenue') {
    throw new Error(`mock feed columns moved: ${header.slice(0, 6).join(',')}`)
  }
  const body = lines
    .map((line, i) => {
      if (i === 0 || line.trim() === '') return line
      const cells = line.split(',')
      cells[4] = String(TRADED[cells[0]] ?? 0)
      return cells.join(',')
    })
    .join('\n')
  await route.fulfill({ response, body })
})

/**
 * Two marks, before any script runs. The opening one is each team's total less
 * a fabricated day, so every card has a figure and the spread is wide enough
 * for a drifting column to show.
 */
await page.addInitScript(() => {
  const teams = Array.from({ length: 41 }, (_, i) => `VBC${101 + i}`)
  const opened = {}
  const closed = {}
  // Deliberately spread across four orders of magnitude, up to a crore. The
  // widest figure is what finds a mark that has been laid out rather than
  // positioned, and `₹1,04,00,000` is eleven glyphs against `₹1`'s two.
  const days = [0, 1, 218, 1_998, 12_400, 96_167, 2_42_546, 1_04_00_000]
  teams.forEach((id, i) => {
    const total = 50_000 + i * 31_000
    closed[id] = total
    opened[id] = total - days[i % days.length]
  })
  localStorage.setItem(
    'byob-tv.v2.daily',
    JSON.stringify([
      { key: '2026-09-17', totals: opened },
      { key: '2026-09-18', totals: closed },
    ]),
  )
})

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(2200)

const out = await page.evaluate(() => {
  const round = (n) => +n.toFixed(1)
  const rows = [...document.querySelectorAll('.tv-card-row')]

  const perRow = rows.map((row) => {
    const card = row.querySelector('.tv-card')
    const disc = row.querySelector('.tv-card-logo, .tv-disc, img, svg[class*="disc"]')
    const mark = row.querySelector('.tv-card-mark') ?? disc
    const fig = row.querySelector('.tv-card-week')
    const cardBox = card.getBoundingClientRect()
    const figBox = fig.getBoundingClientRect()
    return {
      cardW: round(cardBox.width),
      cardH: round(cardBox.height),
      markH: mark ? round(mark.getBoundingClientRect().height) : null,
      markW: mark ? round(mark.getBoundingClientRect().width) : null,
      figBottomToCard: round(cardBox.bottom - figBox.bottom),
    }
  })

  // Every figure's own centre, and whether the chevrons moved it.
  const figs = [...document.querySelectorAll('.tv-card-fig')].map((span) => {
    const box = span.getBoundingClientRect()
    const cell = span.closest('.tv-card')
    const cellBox = cell.getBoundingClientRect()
    return {
      offCentre: round(box.left + box.width / 2 - (cellBox.left + cellBox.width / 2)),
      traded: span.querySelector('.tv-day-mark') !== null,
      text: span.textContent.trim(),
    }
  })

  const chev = document.querySelector('.tv-card-fig .tv-day-mark')
  const chevBox = chev?.getBoundingClientRect()
  const anchor = chev?.closest('.tv-card-fig')?.getBoundingClientRect()

  return {
    perRow,
    cards: document.querySelectorAll('.tv-card').length,
    anchors: figs.length,
    traded: figs.filter((f) => f.traded).length,
    // The whole point of the anchor: these two must be the same number.
    centreTraded: [...new Set(figs.filter((f) => f.traded).map((f) => f.offCentre))],
    centreQuiet: [...new Set(figs.filter((f) => !f.traded).map((f) => f.offCentre))],
    mark: chevBox
      ? {
          w: round(chevBox.width),
          h: round(chevBox.height),
          gapToFigure: round(anchor.left - chevBox.right),
          // Positive means the mark sits below the figure box's own centre.
          vsFigureCentre: round(
            chevBox.top + chevBox.height / 2 - (anchor.top + anchor.height / 2),
          ),
          leftOfCard: round(chevBox.left - chev.closest('.tv-card').getBoundingClientRect().left),
        }
      : null,
    // Anything the band left behind.
    leftovers: {
      todayRow: document.querySelectorAll('.tv-card-today').length,
      delta: document.querySelectorAll('.tv-day-delta').length,
      dayFigure: document.querySelectorAll('.tv-day-figure').length,
    },
    sample: figs.slice(0, 4).map((f) => `${f.text}${f.traded ? ' ▲' : ''}`),
  }
})

console.log(JSON.stringify(out, null, 2))

/**
 * The three verdicts, because the numbers above do not read themselves.
 *
 * The centre-line one is the sharp test: both sets must be the *same* set. A
 * value appearing in one and not the other means the mark is being laid out
 * rather than positioned and is pushing its own figure sideways. A value
 * appearing in both merely means a figure wider than the card's content box —
 * which is the crore in this fixture, and is the documented threshold on
 * `.tv-card-fig` rather than a fault.
 */
const same = (a, b) => a.length === b.length && a.every((n) => b.includes(n))
const verdicts = [
  ['the mark never moves its own figure', same(out.centreTraded, out.centreQuiet)],
  ['no mark is wider than its card', out.perRow.every((r) => r.markW <= r.cardW)],
  ['the figure clears the card‘s foot', out.perRow.every((r) => r.figBottomToCard > 0)],
  ['nothing of the day band is left', Object.values(out.leftovers).every((n) => n === 0)],
]
console.log()
for (const [what, ok] of verdicts) console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`)
if (out.mark !== null) {
  console.log(
    `\nmark clearance inside the card at the widest figure in this fixture: ${out.mark.leftOfCard}px` +
      `\n  negative is expected past ~₹24,00,000 — see the note on .tv-card-fig`,
  )
}

if (errors.length) console.error('\nconsole errors:\n' + errors.join('\n'))
await browser.close()

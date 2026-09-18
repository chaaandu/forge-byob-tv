/**
 * Does the frame still fit, at every size it might be driven at?
 *
 *   node scripts/measure-fit.mjs [url]
 *
 * Reach for this after changing **any** height, gap or type size. It is the
 * script that catches the failure a single 1920x1080 check cannot.
 *
 * ── The trap it exists for ──
 *
 * The type and dimension tokens are `vw`, so they shrink with the frame. **The
 * `--s-*` spacing scale is fixed px and does not.** Every gap, padding and
 * margin therefore holds its size while everything around it contracts, which
 * means a band that merely *fits* at 1920 can overlap the header at 1600.
 * Measured, before this was budgeted properly: -15.8px of clearance at
 * 1600x900, on a layout that looked perfect at 1920.
 *
 * `clearance` is the gap between the bottom of the header and the top of the
 * highest thing in the board. **It must be positive at every size.** Aim for
 * 10px or more at the smallest size you care about; anything under ~5px is a
 * heading waiting to be overlapped by a font that loads a step heavier.
 */

import { launch, open } from './measure-browser.mjs'

const url = process.argv[2] ?? 'http://localhost:3000/podium'

/** 16:9 at three scales, plus one deliberately off-ratio — a browser window is
    never exactly 16:9, and off-ratio is where the fixed-px spacing bites. */
const SIZES = [
  [1920, 1080],
  [2000, 1100],
  [1600, 900],
  [2560, 1440],
]

const browser = await launch()

console.log('viewport     clearance   bottom   rowH   stripW   pillarGap   overflow')
for (const [width, height] of SIZES) {
  const { page } = await open(browser, url, { width, height })
  const r = await page.evaluate(() => {
    const n = (v) => +Number(v).toFixed(1)
    const header = document.querySelector('header')?.getBoundingClientRect()
    // The topmost thing under the header on either slide: the podium's marks and
    // capitals, or the weekly grid's first row of cards. **The weekly selector
    // is not optional here** — without it this returned `null` on /daily, and a
    // null clearance prints as "no number" rather than as a failure, which is
    // the quietest possible way for the one measurement this script exists for
    // to stop being taken. Measured while it was missing: -9.6px at 1600x900,
    // reported as `null`.
    //
    // It is `.tv-card-cell`, the whole grid cell, and **not `.tv-card`**, which
    // is now only the detail base sitting at the cell's *bottom*. Measuring that
    // reported 207.5px of clearance on a grid whose real top was 24px under the
    // header — a comfortable number that described the wrong edge.
    //
    // **`.tv-pod-numeral` first, because it is genuinely the topmost thing.**
    // Each rank numeral breaks above its card's edge, so the plinth's own top is
    // no longer the top of the slide — measured, a board reporting 86.4px of
    // clearance had its first-place numeral 42.8px from the frame edge. This is
    // the third time this script has described the wrong edge: `.tv-card` on
    // /daily reported 207.5px on a grid whose real top was 24px, and the medal
    // that preceded these numerals reported 26.1px on a board whose real top was
    // 3.9px. The rule that keeps falling over is that the outermost *ink* is not
    // always the outermost *box*.
    //
    // **`.tv-pod-mover` is in the list too, and that is the fourth correction to
    // it.** The podium is bottom-anchored now, so its own top is hundreds of
    // pixels down and reporting that as "clearance" would describe a board with
    // acres of room while the mover panel sat at the real top edge. The number
    // has to mean the same thing on both slides: air above the topmost thing.
    //
    // **`.tv-card-numeral` is the fifth correction, and it is the same mistake
    // a fifth time.** /daily's ranks 1-3 now carry the podium's metal numeral,
    // breaking above their cards exactly as the podium's break above their
    // pillars — so `.tv-card-cell` stopped being the top of that slide the
    // moment they landed. Measured with it missing: 63.5px of clearance
    // reported on a board whose real topmost ink was 12px under the header.
    //
    // The rule that keeps falling over is one line long: **the outermost ink is
    // not always the outermost box.** Anything that overflows its own container
    // upward belongs in this list, and nothing else does.
    //
    // The mark stays out — it bobs, so its top depends on which animation frame
    // the measurement caught.
    const tops = [
      ...document.querySelectorAll(
        '.tv-pod-numeral, .tv-pod-slot, .tv-pod-mover, .tv-card-numeral, .tv-card-cell',
      ),
    ].map((el) => el.getBoundingClientRect().top)
    const cards = [...document.querySelectorAll('.tv-pod-slot')].map((el) =>
      el.getBoundingClientRect(),
    )
    // The strip's own rows, addressed by class rather than by position. The
    // structural selector this replaced (`main > div > div:last-child > div`)
    // silently started counting the caption row as row one when the strip gained
    // a column heading, and a measurement that quietly describes a different
    // element is worse than no measurement.
    const rows = [...document.querySelectorAll('.tv-pod-stack')]
    const last = rows.at(-1)?.getBoundingClientRect()
    const sorted = [...cards].sort((a, b) => a.x - b.x)
    return {
      // **`/podium` has no header any more** — its masthead is a full-height
      // spine, so there is nothing across the top to clear. The measurement it
      // still needs is the same one: how much air is above the topmost thing on
      // the board. Falling back to the frame's own top edge keeps one number
      // meaning one thing on both slides, where returning `null` would quietly
      // stop taking the measurement this script exists for.
      clearance: tops.length ? n(Math.min(...tops) - (header ? header.bottom : 0)) : null,
      bottomAir: last ? n(innerHeight - last.bottom) : null,
      rowH: rows.length ? n(rows[0].getBoundingClientRect().height) : null,
      stripW: rows.length ? n(rows[0].getBoundingClientRect().width) : null,
      pillarGap: sorted.length === 3 ? n(sorted[1].left - sorted[0].right) : null,
      // Anything genuinely leaving the frame. **Elements an ancestor already
      // clips do not count**: the name marquee lays its second page out one
      // card-width to the right and relies on `overflow: hidden` to hide it, so
      // a naive box test reports a permanent overflow of 1 on a board that is
      // fine — and a count that is never zero is a count nobody reads.
      overflow: [...document.querySelectorAll('main *')].filter((el) => {
        const q = el.getBoundingClientRect()
        if (!q.width && !q.height) return false
        if (!(q.bottom > innerHeight + 0.5 || q.top < -0.5 || q.right > innerWidth + 0.5)) return false
        for (let a = el.parentElement; a !== null; a = a.parentElement) {
          const o = getComputedStyle(a)
          if (o.overflow === 'visible') continue
          const ab = a.getBoundingClientRect()
          if (q.right > ab.right + 0.5 || q.left < ab.left - 0.5) return false
          if (q.bottom > ab.bottom + 0.5 || q.top < ab.top - 0.5) return false
        }
        return true
      }).length,
    }
  })
  const flag = r.clearance !== null && r.clearance < 5 ? '  <-- TOO TIGHT' : ''
  console.log(
    `${String(width + 'x' + height).padEnd(12)} ${String(r.clearance).padStart(9)} ` +
      `${String(r.bottomAir).padStart(8)} ${String(r.rowH).padStart(6)} ` +
      `${String(r.stripW).padStart(8)} ${String(r.pillarGap).padStart(11)} ` +
      `${String(r.overflow).padStart(10)}${flag}`,
  )
  await page.close()
}
await browser.close()

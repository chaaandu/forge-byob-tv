/**
 * Is the crown actually on screen, actually gold, and actually not clipped?
 *
 * Four things a DOM test and a screenshot both miss:
 *
 * 1. **Is it painted at all.** A `<svg>` with `height: auto` and no intrinsic
 *    height in a flex or grid parent collapses to zero and reports a perfectly
 *    valid box of 95x0. The test suite counts one `.tv-crown` either way.
 * 2. **Is it clipped.** The crown deliberately overhangs its disc, so any
 *    `overflow: hidden` between it and the frame cuts a corner off it. Compared
 *    against every ancestor's clip rect rather than eyeballed.
 * 3. **Is it the gold token.** `fill: var(--crown-ink)` resolves to nothing at
 *    all if the token is undeclared on the surface in play — and an unresolved
 *    `fill` falls back to black, which on Deep Aubergine is a crown-shaped hole
 *    rather than an error.
 * 4. **Does it clear the numeral.** The overhang is upward and the rank numeral
 *    is directly above the mark.
 */
import { launch, open } from './measure-browser.mjs'

const url = process.argv[2] ?? 'http://localhost:3000/podium?still'

const browser = await launch()
// `open` already waits 2s for the feed, which is past the crown's 0.28s delay
// and 1.15s fall — so everything below is measured at rest.
const { page, errors } = await open(browser, url)

const report = await page.evaluate(() => {
  const crown = document.querySelector('.tv-crown')
  if (crown === null) return { found: false }

  const glyph = crown.querySelector('.tv-crown-glyph')
  const path = crown.querySelector('path')
  const band = crown.closest('.tv-pod-mark-band')
  const slot = crown.closest('.tv-pod-slot')
  const numeral = slot?.querySelector('.tv-pod-numeral')

  const box = crown.getBoundingClientRect()
  const glyphBox = glyph.getBoundingClientRect()
  const bandBox = band.getBoundingClientRect()

  // Every ancestor that could be clipping, intersected into one visible rect.
  let clip = { top: 0, left: 0, right: innerWidth, bottom: innerHeight }
  const clipped = []
  for (let el = crown.parentElement; el !== null; el = el.parentElement) {
    const cs = getComputedStyle(el)
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
    const r = el.getBoundingClientRect()
    clipped.push(`${el.className || el.tagName} (${cs.overflow})`)
    clip = {
      top: Math.max(clip.top, r.top),
      left: Math.max(clip.left, r.left),
      right: Math.min(clip.right, r.right),
      bottom: Math.min(clip.bottom, r.bottom),
    }
  }

  return {
    found: true,
    leader: slot?.querySelector('.tv-pod-name')?.textContent,
    rank: numeral?.textContent,
    // **Layout box and painted box are different numbers here, and only one of
    // them is the crown's size.** `getBoundingClientRect` returns the
    // *axis-aligned* box of a rotated element, so a 95x74 crown at -24deg
    // reports 117x106 — and reading that as the width makes the crown look 23%
    // bigger than it is and its clearances tighter than they are. `offsetWidth`
    // is the unrotated layout box; the rect is what actually has to fit.
    crown: { w: crown.offsetWidth, h: crown.offsetHeight },
    painted: { w: +box.width.toFixed(1), h: +box.height.toFixed(1) },
    glyph: { w: +glyphBox.width.toFixed(1), h: +glyphBox.height.toFixed(1) },
    disc: { w: +bandBox.width.toFixed(1), h: +bandBox.height.toFixed(1) },
    shareOfDisc: `${((crown.offsetWidth / bandBox.width) * 100).toFixed(1)}%`,
    fill: getComputedStyle(path).fill,
    crownInk: getComputedStyle(document.querySelector('main')).getPropertyValue('--crown-ink').trim(),
    surface: getComputedStyle(document.querySelector('main')).backgroundColor,
    // Positive numbers mean inside the clip on that edge.
    clearance: {
      top: +(box.top - clip.top).toFixed(1),
      left: +(box.left - clip.left).toFixed(1),
      right: +(clip.right - box.right).toFixed(1),
      bottom: +(clip.bottom - box.bottom).toFixed(1),
    },
    clippingAncestors: clipped,
    // **Two axes, not one.** The crown overhangs upward and the numeral sits
    // directly above the mark, so a vertical gap alone reports a collision
    // every time — while the numeral is centred on a 280px disc and the crown
    // is at its left edge, so they may never share a column. A collision needs
    // both axes to overlap; anything else is two boxes passing each other.
    vsNumeral:
      numeral === undefined || numeral === null
        ? null
        : (() => {
            const n = numeral.getBoundingClientRect()
            // Signed clear air on each axis, whichever side the numeral is on.
            // This assumed the numeral sat *above* the crown and to its right;
            // since the stage it is on the plinth, 600px below, and the old
            // one-sided subtraction reported a collision for two boxes that
            // were nowhere near each other. Two intervals overlap only if
            // both gaps are negative.
            const vGap = +Math.max(n.top - box.bottom, box.top - n.bottom).toFixed(1)
            const hGap = +Math.max(n.left - box.right, box.left - n.right).toFixed(1)
            return { vGap, hGap, collides: vGap < 0 && hGap < 0 }
          })(),
    overhangsDiscLeft: +(bandBox.left - box.left).toFixed(1),
    overhangsDiscTop: +(bandBox.top - box.top).toFixed(1),
    // Does it still touch the mark it is crowning?
    overlapsDisc: box.right > bandBox.left && box.bottom > bandBox.top,
    crownsOnBoard: document.querySelectorAll('.tv-crown').length,
  }
})

console.log(JSON.stringify(report, null, 2))
if (errors.length > 0) console.log('console errors:', errors)

/* A crop of first place, so the crown can be *looked* at as well as measured.
   Every number above can be right while the crown still sits wrong on the mark
   — "43.8px of overhang" is a fact, "that reads as a badge" is a judgement, and
   only one of them comes out of getBoundingClientRect. */
const slot = page.locator('.tv-pod-slot').filter({ has: page.locator('.tv-crown') })
await slot.screenshot({ path: '/tmp/crown-lead.png' })
await page.screenshot({ path: '/tmp/crown-slide.png' })
console.log('wrote /tmp/crown-lead.png and /tmp/crown-slide.png')

await browser.close()

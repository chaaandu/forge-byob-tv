/**
 * Does the crown still belong to first place at every width?
 *
 * The trap this exists for: the crown overhangs its disc to the **left**, and
 * the place to its left is rank 2. Every dimension on this slide is `vw`, so
 * the three columns narrow as the frame does while the gaps between them narrow
 * faster — which means the one measurement that matters is not the crown's size
 * but the distance from its left tip to rank 2's mark. At 1920 there is room;
 * at 1366 there may not be, and a crown touching the silver mark reads as
 * crowning the wrong venture.
 *
 * `measure-fit.mjs` walks the same four viewports for the frame as a whole. This
 * asks the one question that file cannot: not "does it fit" but "is it still
 * attached to the right thing".
 */
import { launch, open } from './measure-browser.mjs'

const url = process.argv[2] ?? 'http://localhost:3000/podium?still'

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1600, height: 900 },
  { width: 1366, height: 768 },
  { width: 2560, height: 1440 },
]

const browser = await launch()

for (const size of SIZES) {
  const { page } = await open(browser, url, size)
  const r = await page.evaluate(() => {
    const crown = document.querySelector('.tv-crown')
    if (crown === null) return null
    const box = crown.getBoundingClientRect()
    const own = crown.closest('.tv-pod-slot')
    const slots = [...document.querySelectorAll('.tv-pod-slot')]
    // The pillars are drawn 2 · 1 · 3, so the neighbour to the left of first
    // place is rank 2 — found by position in the DOM rather than by rank, which
    // is what the crown is physically next to.
    const left = slots[slots.indexOf(own) - 1]
    const leftMark = left?.querySelector('.tv-pod-disc')?.getBoundingClientRect()
    return {
      crownW: crown.offsetWidth,
      // Clear air between the crown's leftmost painted pixel and rank 2's mark.
      // Negative means the crown has reached into the silver place.
      gapToRank2: leftMark === undefined ? null : +(box.left - leftMark.right).toFixed(1),
      rank2Name: left?.querySelector('.tv-pod-name')?.textContent,
      // How much of the crown clears the disc's own box upward — the part a
      // passer-by actually reads as a crown rather than as a gold sliver.
      clearsDiscTop: +(
        crown.closest('.tv-pod-mark-band').getBoundingClientRect().top - box.top
      ).toFixed(1),
    }
  })
  console.log(`${size.width}x${size.height}`, JSON.stringify(r))
  await page.close()
}

await browser.close()

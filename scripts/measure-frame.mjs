/**
 * The full report for one slide, at a stated viewport.
 *
 *   node scripts/measure-frame.mjs [url] [screenshot.png] [--reduce-motion]
 *   node scripts/measure-frame.mjs http://localhost:3000/daily weekly.png
 *
 * Reach for this after any change to a board's geometry, colour or motion. It
 * answers the questions a DOM assertion cannot: did anything leave the frame,
 * do the three podium cards actually step in size, did `color-mix()` resolve to
 * three distinct greens, are the marks really on different idle timelines.
 *
 * Everything here is read back from the running page. `docs/DESIGN.md` §9 and
 * AGENTS.md both say the same thing and it has been earned three times over:
 * **measure the running app, do not read the source.**
 */

import { launch, open } from './measure-browser.mjs'

const url = process.argv[2] ?? 'http://localhost:3000/podium'
const shot = process.argv.slice(3).find((a) => !a.startsWith('--'))
const reducedMotion = process.argv.includes('--reduce-motion')

const browser = await launch()
const { page, errors } = await open(browser, url, { reducedMotion })

const report = await page.evaluate(() => {
  const n = (v) => +Number(v).toFixed(2)
  const box = (el) => {
    const r = el.getBoundingClientRect()
    return { x: n(r.x), y: n(r.y), w: n(r.width), h: n(r.height) }
  }

  /**
   * Relative luminance, so the ramp can be proved to *step*.
   *
   * Handles `color(srgb ...)` as well as `rgb(...)`: `color-mix()` resolves to
   * the former in Chrome, and a parser that only knew `rgb()` reported a
   * luminance of 0.0001 for a mid-green and made a correct ramp look broken.
   */
  const luminance = (value) => {
    const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
    const parts = srgb
      ? [+srgb[1], +srgb[2], +srgb[3]]
      : (value.match(/[\d.]+/g) ?? []).slice(0, 3).map((c) => +c / 255)
    const lin = parts.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return +(0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]).toFixed(4)
  }

  const header = document.querySelector('header')
  const h1 = header?.querySelector('h1')
  const dial = header?.querySelector('[role="img"][aria-label*="Mesa Flea"]')
  const arc = dial?.querySelectorAll('circle')[1]

  return {
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    // The no-scroll guarantee. A wall that scrolls has already failed.
    scroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
    overflow: [...document.querySelectorAll('main *')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        if (!r.width && !r.height) return false
        return r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5 || r.left < -0.5 || r.top < -0.5
      })
      .slice(0, 10)
      .map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 44), ...box(el) })),

    header: header && {
      box: box(header),
      heading: h1?.textContent,
      headingFamily: h1 && getComputedStyle(h1).fontFamily.split(',')[0].trim(),
      headingSize: h1 && getComputedStyle(h1).fontSize,
      dial: dial && {
        label: dial.getAttribute('aria-label'),
        text: dial.textContent,
        ring: box(dial.querySelector('svg')),
        arcColour: arc && getComputedStyle(arc).stroke,
        dashoffset: arc?.getAttribute('stroke-dashoffset'),
      },
    },

    // The three podium cards. **Size stepping and the green ramp are the
    // design's two claims about rank**, and both are read back here rather than
    // trusted: the ramp is three `color-mix()` results that have to resolve to
    // three *distinct* luminances, and the first pass at it stepped so little
    // that first and second read as the same green from across a corridor.
    //
    // This replaced a reading of `.tv-pod-shaft` and `.tv-pod-slab`, whose claim
    // was the opposite one — that the three pillars were identical in size.
    cards: [...document.querySelectorAll('.tv-pod-card')].map((el) => ({
      ...box(el),
      fill: getComputedStyle(el).backgroundColor,
      luminance: luminance(getComputedStyle(el).backgroundColor),
    })),
    medalTops: [...document.querySelectorAll('.tv-pod-medal')].map((el) =>
      n(el.getBoundingClientRect().y),
    ),

    // Three marks must never share a timeline, or they move in lockstep.
    idle: [...document.querySelectorAll('[class*="tv-idle-"]')].map((el) => {
      const cs = getComputedStyle(el)
      return { cls: el.className, name: cs.animationName, duration: cs.animationDuration }
    }),

    marks: [...document.querySelectorAll('main [role="img"], main img')]
      .filter((el) => !el.getAttribute('aria-label')?.includes('Mesa Flea'))
      .map((el) => ({ label: el.getAttribute('aria-label'), ...box(el) })),

    // `.tv-pill` is /daily's language. Its absence here is a design rule.
    pills: document.querySelectorAll('.tv-pill').length,

    rows: [...document.querySelectorAll('main > div > div:last-child > div')].map((el) => ({
      h: n(el.getBoundingClientRect().height),
      w: n(el.getBoundingClientRect().width),
      rule: getComputedStyle(el).borderBottomWidth,
      text: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 48),
    })),

    bodyBackground: getComputedStyle(document.body).backgroundColor,
    fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
  }
})

report.consoleErrors = errors
console.log(JSON.stringify(report, null, 2))

if (shot) await page.screenshot({ path: shot })
await browser.close()

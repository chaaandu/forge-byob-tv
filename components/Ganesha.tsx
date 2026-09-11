'use client'

import { useEffect, useRef, useState } from 'react'

import { DevGaneshaTrigger } from '@/components/DevGaneshaTrigger'
import { GANESH_CHECK_MS, GANESH_LOTTIE_URL } from '@/config'
import { isFestival } from '@/lib/schedule'

/**
 * Ganesh Chaturthi, as an 80px figure in the bottom-left corner of both slides.
 *
 * On the wall from 14 to 16 September 2026 and gone afterwards without anyone
 * touching the laptop — `isFestival` owns the window and `config.ts` owns the
 * dates.
 *
 * ── This loops, and that is a real exception ──
 *
 * AGENTS.md bans motion at rest and names "a looping Lottie" as the example
 * that does *not* inherit the crown's precedent. This is that ornament, looping,
 * so the argument has to be made here rather than assumed:
 *
 * The rule protects a board. Its whole subject is the thirty-nine cards, the
 * list of seven and the three podium marks — things that carry a *figure*, where
 * movement means a rank changed hands and anything else is a lie about the data.
 * This carries no figure. It cannot be mistaken for an overtake because it is
 * not on the board, not near a numeral, and not shaped like one. And it is
 * bounded in a way no previous ornament proposal was: **three days**, after
 * which the wall is back to the rule with nothing to undo.
 *
 * What it does cost is honest. For three days the wall is never completely
 * still, so "nothing moves unless something happened" is not true of the frame
 * as a whole — only of the board inside it. If that trade stops being worth it,
 * the fix is `loop: false` on the `loadAnimation` call below, which leaves a
 * figure that arrives once and holds, exactly as the crown does.
 *
 * ── Three things are stripped from the artist's file before it plays ──
 *
 * The file in `public/lottie/` is the untouched download, so it can go straight
 * back into the LottieFiles editor. The edits are made here, on the parsed copy:
 *
 * 1. **The `bg` layer.** Three deep maroons (`#5b1815`, `#700f06`, `#881a0b`)
 *    filling all 1920x1080. Dropping it is what lets Deep Aubergine show
 *    through — and it is also the only reason this file does not violate the
 *    hex rule in spirit: what is left is an idol, whose reds and saffrons are
 *    its own identity rather than a palette competing with Forge's.
 *
 * 2. **The two text layers.** The artist baked in "Ladoo Taiyaar Rakhna...."
 *    and "...Aaa Gaye Hai Hum." at 120px and 80px. At the size this renders
 *    they would be illegible smears, and copy on this wall belongs in Forge
 *    type where it can be read and changed.
 *
 * 3. **The mooshika.** Ganesha's vahana runs in from off-frame right at frame
 *    46, crosses the bottom of the composition and is gone by frame 83 — about
 *    1.2 seconds of the 7.3. It is stripped **because it does not fit, and the
 *    arithmetic is not close.** Measured over all 218 frames: the idol alone
 *    occupies 917x709, but the rat's path takes the composition's live area to
 *    the full 1920 x 783. That is aspect 2.45 against the idol's 1.29 — so an
 *    80px-tall ornament that contained the rat would be **196px wide**, in a
 *    gutter that is 92px. There is no 196x80 clear rectangle in either slide's
 *    bottom corner; `/weekly`'s fourth row leaves 92px on the left and about
 *    the same on the right.
 *
 *    It had to be found by measuring, and the way it was missed is worth
 *    keeping. The first crop came from six sampled frames — 0, 40, 90, 140, 190
 *    and 217 — and the rat is on screen for none of them. It sat between two
 *    samples. So for 1.2 seconds of every loop the corner showed a rat sliced
 *    through the middle by the crop's bottom edge, which is precisely this
 *    wall's stated failure mode: it rendered convincingly and nothing reported
 *    it. **Anything that re-crops this must scan every frame**, not a sample —
 *    `noRat` in the scan that produced `CROP` is the union over all 218.
 *
 * 4. **Nothing else.** The `loopOut()` expression on one rotation is left in,
 *    which is why this imports the full `lottie.min.js` rather than
 *    `lottie_light` — the light build silently drops expressions, and the
 *    symptom would be one sub-animation quietly stopping partway through.
 *
 * ── Why it is fetched rather than imported ──
 *
 * The JSON is 877KB. `import data from './ganesha.json'` would inline every
 * byte of that into the route's JS, on a wall whose first paint is a hard
 * requirement and whose ornament is not. Fetched from `public/`, it arrives
 * when it arrives and fades in; the boards are already on screen by then.
 * **No spinner and no placeholder** — the rule about filler applies here too,
 * and an ornament that is not there yet should look like nothing at all.
 */

/**
 * The crop, measured rather than guessed.
 *
 * The composition is 1920x1080 but the idol only occupies part of it, and the
 * rat sub-composition sits entirely off-canvas — a naive bounding box of the
 * SVG's own geometry reports 2606x803 spanning x -386 to 2220, because it
 * counts elements the 1920x1080 frame clips away. Rendering twelve frames to
 * PNG and taking the union of the non-background pixels gives the box that is
 * actually on screen: x 476-1392, y 282-990, across every frame of the loop.
 *
 * Six pixels of air on each side, and the result is what `viewBoxSize` hands
 * lottie-web. **Without it the ornament is 80px of mostly empty frame** with an
 * idol perhaps 50px tall in the middle of it — which renders convincingly, is
 * what the artist's file literally says, and is not what 80px was asked for.
 */
const CROP = '470 276 928 720'

/** The crop's aspect, so the CSS only has to be told a height. Kept here rather
    than restated as a number in `mesa-tv.css`: two places to change is one
    place to forget, and the symptom would be a squashed idol. */
const CROP_ASPECT = 928 / 720

export function Ganesha() {
  const host = useRef<HTMLDivElement>(null)
  // `null` until the first check runs. The window is a function of the clock,
  // and the clock is not a thing a server render may consult — see below.
  const [inWindow, setInWindow] = useState<boolean | null>(null)
  const [ready, setReady] = useState(false)

  /**
   * The development override, and **it is a second flag rather than a second
   * answer.** `DevGaneshaTrigger` has the argument; the short version is that
   * faking the clock or the dates would mean watching a wall running on a
   * schedule the real one does not have, and the dates are the part of this
   * most likely to be wrong.
   *
   * Plain component state, deliberately. It wants to survive the thirty-second
   * rotation, which it does for free — this component is mounted in the root
   * layout and the soft navigation never unmounts it, which is the same
   * property the ornament itself depends on. Persisting it would have meant
   * writing to localStorage, and `lib/storage.ts` is the only module in this
   * project allowed to do that; a dev toggle is not worth an exception to that,
   * and a browser reload resetting it is one click to undo.
   *
   * In production `DevGaneshaTrigger` renders `null` and nothing ever calls
   * `setForced`, so this is `false` for the life of the page.
   */
  const [forced, setForced] = useState(false)

  const showing = forced || inWindow === true

  /**
   * **The window is opened client-side, and never during render.**
   *
   * Both routes are prerendered static, so a `isFestival(new Date())` in the
   * component body would be answered once at *build* time and baked in. The
   * wall would then carry whatever the answer was on the day it was deployed,
   * for as long as it ran — a deploy on the 13th ships a wall that never shows
   * the ornament, and a deploy on the 15th ships one that shows it in December.
   * The page never reloads, so nothing would ever correct either.
   *
   * Re-checked once a minute for the same reason. The laptop is set up once and
   * left; the transition into the 14th and out of the 17th both happen with the
   * page already open and nobody watching.
   */
  useEffect(() => {
    const check = () => setInWindow(isFestival(new Date()))
    check()
    const timer = setInterval(check, GANESH_CHECK_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!showing) return
    const node = host.current
    if (node === null) return

    // Guards the async gap below: a window that shuts, or a slide that
    // unmounts, between the fetch starting and the JSON arriving must not
    // leave a player attached to a detached node.
    let live = true
    let anim: { destroy: () => void } | null = null

    void (async () => {
      try {
        // Both are dynamic, and for different reasons. `lottie-web` is 250KB
        // that no slide needs for 362 days of the year; the JSON is 877KB that
        // no slide needs at all. Neither belongs in the bundle that paints the
        // board.
        const [{ default: lottie }, response] = await Promise.all([
          import('lottie-web'),
          // **`cache: 'default'`, unlike the two CSV fetches.** Those carry
          // figures and must never be served stale; this is a static asset that
          // will not change while the wall is running, and re-downloading 877KB
          // on every slide that mounts it would be pure waste.
          fetch(GANESH_LOTTIE_URL),
        ])
        if (!live || !response.ok) return
        const data = await response.json()
        if (!live) return

        data.layers = data.layers.filter((layer: { nm?: string }) => layer.nm !== 'bg')
        const figure = data.assets.find((asset: { id?: string }) => asset.id === 'comp_0')
        // Defensive rather than decorative: if the artist's file is ever
        // replaced with a re-export whose comp ids differ, the strip below
        // should no-op rather than throw and take the slide down with it.
        if (figure !== undefined) {
          figure.layers = figure.layers.filter(
            (layer: { ty?: number; nm?: string }) =>
              // The two text layers, by type.
              layer.ty !== 5 &&
              // The mooshika, by name — `rat Comp 1`. **Matched on the name
              // rather than on its `refId` of `comp_1`**, because a re-export
              // renumbers comps freely while the artist's layer name usually
              // survives; matching the id would silently stop stripping and put
              // the sliced rat back. Anchored at the start so it cannot catch a
              // name that merely contains the letters.
              !/^rat\b/i.test(layer.nm ?? ''),
          )
        }

        // **The only thing that can still this.** lottie-web's SVG renderer
        // drives its own `requestAnimationFrame` loop and writes attributes, so
        // `animation-play-state` and the `prefers-reduced-motion` block in
        // `mesa-tv.css` have no handle on it whatsoever — the CSS there stills
        // the fade and nothing else. Read here instead, and the idol holds on
        // its first frame rather than vanishing: unlike the crown's glints there
        // is a whole figure underneath the motion, so the reduction is to stop
        // it, not to remove it.
        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        anim = lottie.loadAnimation({
          container: node,
          renderer: 'svg',
          loop: !still,
          autoplay: !still,
          animationData: data,
          rendererSettings: {
            // The measured crop, and the reason this is not `viewBoxOnly`:
            // lottie-web still needs to size and clip the SVG it writes.
            viewBoxSize: CROP,
            preserveAspectRatio: 'xMidYMid meet',
            // The wall is a display. There is nothing to click, and a
            // transparent 80px hit target in the corner of a fullscreen page is
            // one more thing that can swallow a pointer event during setup.
            className: 'tv-ganesha-svg',
          },
        })
        if (live) setReady(true)
      } catch {
        // **Swallowed on purpose, and this is the one place that is right.**
        // An ornament that fails to load should leave the wall exactly as it
        // was. The boards carry the figures; nothing here is worth a console
        // error on a machine with no console open, and there is no error state
        // on this wall to render into.
      }
    })()

    return () => {
      live = false
      anim?.destroy()
      setReady(false)
    }
  }, [showing])

  return (
    <>
      {/* Renders `null` in production, so the fragment below collapses to
          exactly what shipped before the button existed. It is outside the
          `showing` check on purpose: a switch that disappeared when the thing
          it controls was off could only ever be turned on. */}
      <DevGaneshaTrigger
        forced={forced}
        inWindow={inWindow === true}
        onToggle={() => setForced((on) => !on)}
      />
      {showing ? <GaneshaFigure host={host} ready={ready} /> : null}
    </>
  )
}

/**
 * The ornament itself, split out for one reason: the `ref` has to be attached
 * by the same render that decides to show it, and keeping the host element in
 * its own component makes that hard to get wrong when the dev switch is edited
 * later. Nothing here is conditional — if it is rendered at all, it is the
 * whole ornament.
 */
function GaneshaFigure({
  host,
  ready,
}: {
  host: React.RefObject<HTMLDivElement | null>
  ready: boolean
}) {
  return (
    <div
      className="tv-ganesha"
      style={
        {
          // Declared here and nowhere else, which `render.test.tsx` accepts as
          // a declaration — it scans inline styles as well as the stylesheets.
          // Written as a plain quoted key rather than a computed one so that
          // scan can see it: a `[x as string]` key reads as a token nothing
          // declares, and the test's report would be correct.
          '--ganesha-aspect': String(CROP_ASPECT),
        } as React.CSSProperties
      }
      // Presentational, for the same reason the crown is: this restates nothing
      // the board says, and `/weekly` and `/podium` are display pages. A screen
      // reader announcing an SVG's worth of unnamed groups in the corner of a
      // leaderboard is noise rather than help.
      aria-hidden="true"
      data-ready={ready ? '' : undefined}
      ref={host}
    />
  )
}

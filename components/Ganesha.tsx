'use client'

import { useEffect, useRef, useState } from 'react'

import { DevGaneshaTrigger } from '@/components/DevGaneshaTrigger'
import { VisarjanScene, WATER_Y } from '@/components/VisarjanScene'
import { GANESH_CHECK_MS, GANESH_LOTTIE_URL } from '@/config'
import { ganeshPhase, type GaneshPhase } from '@/lib/schedule'

/**
 * Ganesh Chaturthi — the idol at about 80px, with the mooshika running across
 * the bottom of it, in the bottom-left corner of both slides.
 *
 * On the wall from 14 to 24 September 2026, going into the water on the 25th,
 * and gone afterwards without anyone touching the laptop — `ganeshPhase` owns
 * the window and `config.ts` owns the dates.
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
 * bounded in a way no previous ornament proposal was: **an end date**, after
 * which the wall is back to the rule with nothing to undo. It was three days
 * until 15 September 2026, when it was asked to carry the whole festival.
 *
 * What it does cost is honest. Until the 26th the wall is never completely
 * still, so "nothing moves unless something happened" is not true of the frame
 * as a whole — only of the board inside it. If that trade stops being worth it,
 * the fix is `moving` in the effect below, which leaves a figure that arrives
 * once and holds, exactly as the crown does.
 *
 * ── On the 25th the idol stops dancing and goes into the water ──
 *
 * Visarjan, on Anant Chaturdashi. The artist's loop is **frozen** on
 * `VISARJAN_FRAME` and `VisarjanScene` draws water under the idol. Every
 * `--d-visarjan-cycle` the idol sinks, three ripples spread from where it went
 * under, and a sprout comes up in the same place — the seed-Ganesha immersion
 * rather than a literal melt. That substitution was agreed before any of this
 * was built: melting another artist's illustration needs an animator working
 * frame by frame, and done in code at 88px it would read as a glitch.
 *
 * **It replays rather than playing once, and the reason is the layout.** This
 * component sits above both slides and never remounts, so an immersion that
 * played once would play at midnight, to an empty corridor, and everybody who
 * walked past for the rest of the day would see only a plant. The replay is
 * the whole of the motion that day — the idol no longer loops underneath it —
 * and its timeline lives in `mesa-tv.css`, not here.
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
 * 3. **Nothing else — and in particular not the mooshika.** Ganesha's vahana
 *    runs in from off-frame right at frame 46 and is gone by 83, and the first
 *    version of this file stripped it. That was wrong, and the reason it looked
 *    right is in `CROP` below.
 *
 *    The `loopOut()` expression on one rotation is left in,
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
 * The crop, measured rather than guessed — and **measured on every frame, not
 * on a sample.** That distinction is the whole history of this constant.
 *
 * The composition is 1920x1080 and the idol occupies only part of it, so the
 * ornament is a window onto it. A naive bounding box of the SVG's own geometry
 * is no help: it reports 2606x803 spanning x -386 to 2220, because it counts
 * elements the 1920x1080 frame clips away. The box has to come from rasterising
 * frames and taking the union of the non-background pixels.
 *
 * ── How this was wrong, which is the useful part ──
 *
 * The first version rasterised **six** frames — 0, 40, 90, 140, 190, 217 — and
 * got x 476-1392, y 282-990. That is the idol exactly, and it is wrong, because
 * the mooshika is on screen for none of those six. It runs frames **46 to 83**,
 * about 1.2 seconds of the 7.3, and it sat in the gap between two samples. So
 * the corner showed a rat sliced in half by the crop's bottom edge twice a
 * minute while every measurement that had been taken said the crop was right —
 * this wall's stated failure mode exactly: rendering convincingly, reporting
 * nothing.
 *
 * Rasterising all 218 frames gives the two boxes that actually matter:
 *
 *   idol  x 476-1392, y 282- 990   (917 x 709)
 *   rat   x   0-1918, y 808-1064   (the full width — it enters at the right
 *                                   edge on f46 and exits at the left on f83)
 *
 * ── The bottom edge holds the rat's band ──
 *
 * The crop's height is the rat's, not the idol's: down to 1070, clearing the
 * animal's lowest point at 1064, so it is never cut through the middle.
 * **Raise it back towards 996 and the idol still looks perfect** — it is the
 * rat, for 1.2s of every 7.3, that loses its feet.
 *
 * ── The left edge is 0 so the rat leaves at the *screen* edge ──
 *
 * This started at 470, six units left of the idol, and the rat vanished into
 * thin air on its way out. The reason is worth stating exactly, because it is
 * not a clipping bug — the crop was doing what it was told.
 *
 * A frame edge only reads as an edge when there is something at it. In the
 * artist's 1920 composition the rat leaves at the boundary of the picture. Here
 * the ornament is a 103px box floating in the middle of a large dark board, so
 * its left edge was an **invisible line 28px in from the bezel**, and the rat
 * dissolved as it crossed it. Entering does not have this problem nearly as
 * badly — a thing appearing is read as arriving — but leaving does.
 *
 * So the crop now starts at the composition's own left edge, and
 * `mesa-tv.css` shifts the box left by exactly the width that adds, using
 * `--ganesha-lead`. The arithmetic cancels: the box grows by `LEAD` on the left
 * and moves left by `LEAD`, so **the idol and the box's right edge do not move
 * at any viewport** — every clearance measured against card 31 still holds, to
 * the pixel. What changes is only that the box's left edge is now off-screen,
 * so the *viewport* does the clipping. At 1920 the bezel cuts the composition
 * at x≈217, and the rat is entirely left of that by frame 82, a frame before
 * its layer ends. It runs off the television.
 *
 * **Zero rather than a negative number**, deliberately. The artist's frame
 * clips at 0 too, and there are elements out there — the naive bbox reaches
 * x -386 — that were never meant to be seen. Matching the composition's own
 * clip shows the whole of the rat's exit and nothing that was hidden on purpose.
 */
const CROP = '0 276 1398 794'

/** The crop's aspect, so the CSS only has to be told a height. Kept here rather
    than restated as a number in `mesa-tv.css`: two places to change is one
    place to forget, and the symptom would be a squashed idol. */
const CROP_ASPECT = 1398 / 794

/**
 * How far the crop reaches left of the idol, as a multiple of the box's
 * **height** — which is the only dimension `mesa-tv.css` is told, so it is the
 * only one the offset can be derived from there.
 *
 * `left: calc(inset - lead * height)` is what keeps the idol still while the
 * box grows leftward off the screen. Change `CROP`'s x or width without
 * changing this and the ornament slides sideways.
 */
const CROP_LEAD = 470 / 794

/** `CROP`'s top and height, read out of the one string rather than restated. */
const [, CROP_TOP, , CROP_HEIGHT] = CROP.split(' ').map(Number)

/**
 * The water's surface as a fraction of the box's height, which is where the
 * idol's mask starts dissolving it. Derived from the same `WATER_Y` the scene
 * draws the surface and the ripples at, so the idol goes under exactly where
 * the water is rather than a couple of pixels above it — at 88px, two pixels
 * is a figure visibly vanishing into dry air.
 */
const WATERLINE = (WATER_Y - CROP_TOP) / CROP_HEIGHT

/**
 * The frame the idol holds on the 25th, when the artist's loop stops.
 *
 * It has to be one of the frames the mooshika is **not** on — it runs 46 to 83,
 * see `CROP` — or a rat stands frozen in the water for a day. Beyond that it is
 * the idol at rest, with nothing mid-gesture to be caught sinking.
 */
const VISARJAN_FRAME = 0

export function Ganesha() {
  const host = useRef<HTMLDivElement>(null)
  // `undefined` until the first check runs. The window is a function of the
  // clock, and the clock is not a thing a server render may consult — see below.
  const [phase, setPhase] = useState<GaneshPhase | null | undefined>(undefined)
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
   * `setForced`, so this is `null` for the life of the page.
   */
  const [forced, setForced] = useState<GaneshPhase | null>(null)

  const shown = forced ?? phase ?? null

  /**
   * **The window is opened client-side, and never during render.**
   *
   * Both routes are prerendered static, so a `ganeshPhase(new Date())` in the
   * component body would be answered once at *build* time and baked in. The
   * wall would then carry whatever the answer was on the day it was deployed,
   * for as long as it ran — a deploy on the 13th ships a wall that never shows
   * the ornament, and a deploy on the 15th ships one that shows it in December.
   * The page never reloads, so nothing would ever correct either.
   *
   * Re-checked once a minute for the same reason. The laptop is set up once and
   * left; the transitions into the 14th, the 25th and the 26th all happen with
   * the page already open and nobody watching. The 25th rebuilds the player,
   * because `shown` is what the effect below depends on.
   */
  useEffect(() => {
    const check = () => setPhase(ganeshPhase(new Date()))
    check()
    const timer = setInterval(check, GANESH_CHECK_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (shown === null) return
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
          // The two text layers, by type. **The mooshika stays** — see `CROP`,
          // which is sized to hold its whole run rather than slicing it.
          figure.layers = figure.layers.filter((layer: { ty?: number }) => layer.ty !== 5)
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
        // On the 25th the idol stands still to be immersed; the immersion is
        // the motion that day, and it is CSS's.
        const moving = shown === 'chaturthi' && !still

        const player = lottie.loadAnimation({
          container: node,
          renderer: 'svg',
          loop: moving,
          autoplay: moving,
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
        anim = player
        if (shown === 'visarjan') {
          // A stopped player shows frame 0 of its own accord; asked for a frame
          // before its DOM exists it silently shows that instead.
          const hold = () => player.goToAndStop(VISARJAN_FRAME, true)
          if (player.isLoaded) hold()
          else player.addEventListener('DOMLoaded', hold)
        }
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
  }, [shown])

  return (
    <>
      {/* Renders `null` in production, so the fragment below collapses to
          exactly what shipped before the button existed. It is outside the
          `shown` check on purpose: a switch that disappeared when the thing
          it controls was off could only ever be turned on. */}
      <DevGaneshaTrigger
        forced={forced}
        phase={phase ?? null}
        onCycle={() =>
          setForced((on) => (on === null ? 'chaturthi' : on === 'chaturthi' ? 'visarjan' : null))
        }
      />
      {shown !== null ? <GaneshaFigure host={host} phase={shown} ready={ready} /> : null}
    </>
  )
}

/**
 * The ornament itself, split out for one reason: the `ref` has to be attached
 * by the same render that decides to show it, and keeping the host element in
 * its own component makes that hard to get wrong when the dev switch is edited
 * later. The only conditional part is the water, which is the 25th's.
 *
 * **The idol is two elements deep for the immersion's sake.** The outer one is
 * masked at the waterline and never moves; the inner one is the player, and it
 * is what sinks. A mask on the moving element would travel down with it and
 * dissolve nothing.
 */
function GaneshaFigure({
  host,
  phase,
  ready,
}: {
  host: React.RefObject<HTMLDivElement | null>
  phase: GaneshPhase
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
          // The leftward overrun, so the stylesheet can cancel it out of the
          // inset. Unitless on purpose — `mesa-tv.css` multiplies it by
          // `--h-ganesha`, and a length here would make that calc invalid.
          '--ganesha-lead': String(CROP_LEAD),
          // Unitless; the mask multiplies it by 100%. Read only on the 25th.
          '--visarjan-waterline': String(WATERLINE),
        } as React.CSSProperties
      }
      // Presentational, for the same reason the crown is: this restates nothing
      // the board says, and `/weekly` and `/podium` are display pages. A screen
      // reader announcing an SVG's worth of unnamed groups in the corner of a
      // leaderboard is noise rather than help.
      aria-hidden="true"
      data-phase={phase}
      data-ready={ready ? '' : undefined}
    >
      <div className="tv-ganesha-sink">
        <div className="tv-ganesha-idol" ref={host} />
      </div>
      {phase === 'visarjan' ? <VisarjanScene viewBox={CROP} /> : null}
    </div>
  )
}

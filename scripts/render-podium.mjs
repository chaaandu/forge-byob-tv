/**
 * Renders `/podium`'s three blocks as one lit 3D image.
 *
 * ── Why an image, when everything else on this wall is CSS ──
 *
 * Five passes tried to build these blocks in CSS: metal plinths, gradient
 * slabs, cylinders, 3D boxes, leaning 3D boxes. Every one of them failed the
 * same way. The references this is drawn from are *rendered illustrations* —
 * real lights, soft shadows, ambient occlusion, material — and CSS 3D gives
 * the geometry with none of the materials. The result signals "three
 * dimensional" and then cannot pay it off, which is worse than staying flat.
 *
 * So the form is rendered here, once, and the wall composites live type over
 * it. Chosen deliberately over the flat-and-chunky alternative.
 *
 * ── This is not borrowed artwork ──
 *
 * `AGENTS.md` forbids artwork this project did not draw, and the case it is
 * about is a venture wearing another team's logo. This file *is* the drawing:
 * the geometry, the palette and the lights are all parameters below, the
 * output is reproducible from them, and nothing about it claims to be anyone's
 * mark. What it does cost is stated in AGENTS.md — the palette is baked, so a
 * colour change here is a re-render rather than a token edit.
 *
 * ── The camera is off-axis, and that is the whole reason this works ──
 *
 * The image plane is parallel to the blocks' front faces and the frustum is
 * shifted down, which is what a tilt-shift lens does. Vertical lines stay
 * vertical and **every front face projects to an exact rectangle**, so the
 * venture name and its figure are laid over the image as ordinary flat HTML
 * at their ordinary sizes. Raise the camera and more of each top face comes
 * into view; nothing about the fronts changes.
 *
 * A pitched camera would rake the type, which is the fault that killed the
 * previous pass — this wall is read at six metres and legibility is not
 * something to spend on an effect.
 *
 * The manifest written beside the PNG carries each front rectangle and each
 * top-face centre as fractions of the image, computed by the same projection
 * used to render it. **Nothing downstream may re-derive those numbers.**
 *
 *   node scripts/render-podium.mjs
 *
 * Writes `public/podium/blocks.png` and `lib/podiumBlocks.ts`.
 *
 * **One manifest, not two.** It wrote a `blocks.json` beside the image for a
 * pass, which was a second copy of the same numbers that nothing read — and a
 * second copy of a layout's only authority is exactly the thing this project
 * keeps deleting elsewhere.
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

/* ── The scene, in design units: 1 unit is 1 CSS pixel at 1920 ──────────── */

const GAP = 26
const DEPTH = 210
const RADIUS = 26

/**
 * The three blocks, in drawing order 2 · 1 · 3.
 *
 * Heights are the ranking — 520 · 410 · 330, so first stands 110 over second
 * and second stands 80 over third. Not equal steps: the leap to first place is
 * the one this wall is about, and three equal risers read as a bar chart.
 *
 * **Each block is one flat colour with its medal on top, and the light does
 * all the modelling.**
 * They were multi-stop gradients until 13 September 2026 — first a hue
 * rotation each, then a rotation landing on that place's medal — and both
 * read as paint rather than as material. A lit box does not carry a gradient
 * in its surface; it carries one value, and the room decides what happens to
 * it. `heightLight` is the room. Everything vertical you see on a face is
 * falloff, ambient occlusion and the specular along the top edge.
 *
 * Each also carries a `metal`, which is its medal — gold, silver, bronze. It
 * is not part of the ramp and never touches a front face; see the cap in
 * `shade`, and the note above `metalAlb` for why a metal cannot be albedo in
 * this room.
 *
 * **Each block is its own medal, top to bottom** — gold into amber, silver
 * into sapphire, copper into maroon. The body is not a separate colour the metal
 * has to reach across; it is that metal in shadow, which is why the ramps are
 * short and why none of the three reads as more than one object.
 *
 * The three are told apart from each other rather than from their own tops:
 * a warm yellow, a cool blue and a red, roughly a third of the wheel between
 * each. Second place is a colour rather than a grey because a grey block on a
 * violet page is furniture — steel into sapphire is still silver in shadow,
 * and it is the only cool object on a stage with two warm ones.
 *
 * **First place's white type is what caps the whole stage's brightness.** The
 * name and the figure are printed on the upper part of each face, which is the
 * part nearest the light, so the leader's colour is the one with no headroom:
 * at an earlier set of values it measured **3.9:1** under its own figure —
 * below the 4.5 floor, on the biggest number on the wall. It sits at 5.2:1 on
 * the name and 5.6:1 on the figure now, with second and third at 6.7 and 7.7.
 * Anything that brightens a block has to re-measure those four.
 *
 * Value is the other half of the hierarchy and it is not set here: the blocks
 * share one light, so the tallest one's head is simply nearest to it. Measured
 * across the heads, 0.160 · 0.105 · 0.081 — and down to 0.059 · 0.058 · 0.053
 * at the feet, where they converge because they stand on the same floor under
 * the same falloff. Re-measure after moving a height, a colour or the light.
 */
const w1 = 460
const wRest = 350
const BLOCKS = [
  {
    place: 2,
    x: -(w1 / 2 + GAP + wRest / 2),
    w: wRest,
    h: 570,
    mark: 190,
    ramp: ['#33837e', '#33837e'],
    metal: '#98c1bd',
  },
  { place: 1, x: 0, w: w1, h: 720, mark: 250, ramp: ['#a96d11', '#a96d11'], metal: '#f5af1f' },
  {
    place: 3,
    x: w1 / 2 + GAP + wRest / 2,
    w: wRest,
    h: 450,
    mark: 190,
    ramp: ['#71272e', '#71272e'],
    metal: '#cd7742',
  },
]

/* The camera. `Z` is how far in front of the fronts it sits and decides how
   much of each inner side face shows; `Y` is how high it is and decides how
   much of each top face shows. Both were read off the render rather than
   reasoned about: at Z 1500 the sides were 23 units wide and the leader's top
   was 25 units deep, which is not a platform anything can stand on.

   **`Y` has to rise with the blocks.** What a top face shows is
   `(1 - z/(z+depth)) * (Y - h)`, so it closes as a block approaches eye level
   — at Y 1250 the leader's top went to 79 units when its height went to 760,
   and the platform vanished while every other number looked fine. */
const CAM = { x: 0, y: 1500, z: 1100 }

/* The visible rectangle of the z = 0 plane, which is the plane the fronts sit
   in. Everything behind it converges toward the camera's axis, so the region
   only has to hold the front faces plus bleed for the shadow, which falls back
   and to the left because the key light is front-upper-right.

   **`y1` is far above the tallest block on purpose.** The image is laid into
   `/podium`'s left column at that column's full width, so its aspect is what
   decides how much of the column's height the podium occupies — and at 860
   the blocks filled 686px of an 871px column and left the rest as a band of
   bare page above them, which read as leftover rather than as air. The extra
   is where the haze below lives: it is the room the stage stands in. */
const VIEW = { x0: -640, x1: 640, y0: -30, y1: 1100 }
const SCALE = 1.5
const SS = 2 // supersamples per axis

const W = Math.round((VIEW.x1 - VIEW.x0) * SCALE)
const H = Math.round((VIEW.y1 - VIEW.y0) * SCALE)

/* ── Lighting ──

   Key from the front-upper-right, which is the corner the page's own glow is
   in — one room, one light. Fill from the opposite side at a fifth of the
   strength and cooler, so the shadowed side keeps some colour instead of going
   to black. Ambient is a hemisphere: violet from above, near-nothing from
   below, which is what stops the undersides reading as holes. */
/* **The key has a position, and that is what stops the faces being slabs.**

   It was a direction, and a direction has no *where* — so every point on a
   flat face got the identical light vector and the identical exposure, and a
   460-unit-wide front face came out one uniform colour. That is the last tell
   that separates a render from a CSS gradient, and no palette reaches past it:
   the eye reads a lit object by watching the light fall off *across* a
   surface, not down it.

   Placed above, in front, and to the right — the corner the page's own glow is
   already in. `REF` is the distance at which it is at full strength, and it is
   **first place's head**, so the brightest point on the stage is the one the
   crown sits on.

   **How far right is a ranking decision, not a lighting one.** At x 500 the
   light stood over the right-hand block, which is rank *three* — and measured
   off the render, third place's face came out L 0.207 against first place's
   0.180. The podium's whole job is to say who won, and the light was
   contradicting it. At 320 the distances run 1008 · 1286 · 1144 to the three
   heads, so the leader is nearest and the two behind it fall away.

   The cost of pulling it in is the horizontal gradient across first place's
   face, which goes from 1.6x to 1.33x left-to-right. That is the term that
   stops a flat face being a slab, so it is the thing to watch if the light
   ever moves again — centring it entirely would take it to 1.0 and hand back
   the whole reason the light has a position. */
const KEY_POS = [320, 1300, 760]
const KEY_REF = 1008
const KEY = [1.02, 0.99, 0.94]
const FILL_DIR = norm([-0.62, 0.34, 0.5])
const FILL = [0.52, 0.44, 0.76]
const SKY = [0.38, 0.30, 0.56]
const RIM = [0.86, 0.80, 1.0]

/* ── The room falls off too, and without this the far blocks are slabs ──

   The key has a position, so it dims with distance on its own. The fill and
   the hemisphere ambient do not — they are directions, and a direction lights
   a foot exactly as hard as a head. That is fine while the key dominates, and
   the key only dominates on the block nearest to it: measured down a clean
   column, first place fell 1.60x from head to foot and **second place fell
   1.16x**, which is a flat slab with a rim on it. The further a block stands
   from the light, the larger the share of it that is lit by terms with no
   falloff at all. With the gradient in, the three faces run **2.67x · 1.81x ·
   1.56x** head to foot — the short block spans less of the light's range,
   which is correct rather than a shortfall.

   So the environment gets a vertical gradient, in world space, applied to the
   fill and the ambient only. This is not a second light — the key is still the
   only thing in the scene that emits — it is the room being brighter above the
   stage than at its feet, which is true of this room in particular: the haze
   behind the blocks is a glow standing *over* them, and the floor blocks the
   lower hemisphere.

   **`TOP` is the haze's own centre**, for the same reason `KEY_REF` is first
   place's head: a falloff peaking anywhere other than the glow you can see
   gives the scene two rooms. */
const AMB = { top: 900, floor: 0.30, curve: 1.3 }

function ambientAt(y) {
  const t = Math.min(Math.max(y / AMB.top, 0), 1)
  return AMB.floor + (1 - AMB.floor) * t ** AMB.curve
}

/* ── The haze ──

   A soft violet glow standing above the blocks, added only where a ray misses
   everything, so the blocks occlude it exactly as a solid object occludes the
   light behind it.

   **Rendered here rather than added as a CSS gradient**, for the reason the
   blocks themselves are rendered: it has to sit in the same light as the thing
   it is lighting. A gradient in the stylesheet is a second light source with
   its own falloff that nothing in the scene answers to, and at six metres the
   two read as a picture with a glow pasted behind it.

   Screen-space rather than volumetric. A real participating medium would
   scatter through the gap between the blocks and cost a second march per ray;
   this is a Gaussian in the plane the fronts sit in, which at this softness is
   indistinguishable and free. */
const HAZE = [0.40, 0.20, 0.78]
const HAZE_AT = { y: 840, sx: 420, sy: 300 }
const HAZE_STRENGTH = 0.42

/**
 * Smoothstep, used to take the haze to exactly zero at the view's border.
 *
 * **Without it the haze is a rectangle.** A Gaussian wide enough to read as a
 * room is nowhere near zero where the image ends: measured at the first
 * settings, it was still at 31% of peak on the left and right edges and 69% at
 * the top, so the render carried a hard-edged panel of violet that was plainly
 * visible against the page it was composited onto. The falloff below is what
 * makes the image's boundary invisible, which is the whole requirement for a
 * transparent asset laid over a gradient.
 */
function edgeFade(t) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t * t * (3 - 2 * t)
}
const GROUND = [0.08, 0.05, 0.14]

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
}

/* sRGB in, linear out. Lighting that is not done in linear light produces the
   muddy mid-tones that make a render look like a gradient. */
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
}
function hexToLinear(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  ]
}

for (const b of BLOCKS) b.lin = b.ramp.map(hexToLinear)

/* ── The medal lives in the reflection, not in the paint ──

   A first pass put gold, silver and bronze in the *albedo*, across the bottom
   third of each block, and it failed twice over. It looked like three
   gradients again, and the scene's violet fill turned the two unsaturated
   metals back into the page — silver rendered #ada5d9 and bronze #ce8f93,
   lavender and dusty pink.

   Which is the wrong physics for the thing being asked for. A painted surface
   reflects the light's own colour; **a metal tints what it reflects**. So the
   medal goes where a metal actually shows: the specular and the fresnel rim.
   The body of each block keeps its rank colour, and the highlight running the
   top edge and the lit corner is gold, silver or bronze. That is a trophy —
   colour with metal trim — rather than a bar painted to look like one.

   It also sidesteps the desaturation problem entirely: a highlight is not
   competing with the fill light, it *is* light.

   Normalised to its brightest channel, so swapping a metal changes its hue and
   not the sheen's strength. Gold comes out [1.00, 0.52, 0.04], silver
   [0.85, 0.88, 1.00] — near-neutral, which is what silver is and why block two
   reads as a cooler white edge rather than a coloured one. */
/* ── How far the medal runs down the face ──

   A share of each block's height, from the top. The cap alone was a lid: the
   review was "just adding those on top?", and it was right — a plane of gold
   sitting on a plane of pink is two objects, not one dipped one.

   **What made the lid unavoidable was the type, not the metal.** Measured off
   the running board, the name and the figure occupied the top **21%** of every
   face and then 48% of it was empty — so the only clear ground was the sliver
   above the name, and a wash there would have taken first place's figure from
   5.5:1 to under 4. Moving the type down into the empty half is what buys the
   metal its room, and it is a better composition besides.

   Published in the manifest so the type is placed *from* this number rather
   than from a constant that happens to agree with it. A wash and a name that
   drift apart is a venture's figure printed on gold, and nothing on this wall
   would report it.

   **Short, and the first attempt at it was not.** At 0.38 and 0.72 the metal
   owned better than a third of every block and the thing came back as a
   gradient — which is the look two passes have now been rejected for. It also
   pushed the type so far down that third place's figure landed on its own rank
   numeral. And it is where the two colours meet that the length hurts most:
   bronze into azure is warm into cool, and a long crossing spends it in a band
   of dead grey. A short dip keeps that crossing to a line. */
/* ── The environment the metal reflects ──

   **This is what was missing, and no amount of moving the metal around fixed
   it.** The medals were a colour blended into the albedo — which is paint. A
   painted surface scatters; a metal *reflects*, and what it reflects is the
   room. That is the whole difference between gold and orange, and the review
   that called the cap a lid was really calling it flat.

   `--crown-ink`'s own notes in `forge-tokens.css` §5 say this outright about
   the crown: "gold does not read as a gold blob: interior value variation is
   what gives a metal its metal". The crown got that variation hand-drawn into
   its gradient stops. The blocks get it from an actual reflection.

   A studio environment, which is the cheapest one that reads: bright above the
   horizon, a lift at the horizon itself, near-dark below it. Sampled by the
   reflection vector, so it costs nothing and varies correctly across a face —
   a front face reflects the floor and goes dark at its foot, a top face
   reflects the sky and goes bright, and the rounded corner between them sweeps
   the whole range. That sweep is the highlight a metal has and a fill does
   not. */
function envSample(ry) {
  if (ry >= 0) return 0.34 + 0.66 * Math.min(ry / 0.5, 1) ** 0.8
  return 0.06 + 0.28 * Math.max(1 + ry / 0.35, 0)
}

const ENV = 1.55

/**
 * ── The polish, and it is art direction rather than physics ──
 *
 * The reflection above does the right thing on a top face and almost nothing
 * on a front one, and that is not a bug: with the camera above the stage, a
 * vertical face physically reflects the *floor*, so it stays flat however much
 * environment you give it. Chasing it with a low softbox was tried and is
 * fragile — the band of reflection vectors a face sweeps depends on that
 * block's height, so a lobe tuned to light first place misses third entirely.
 *
 * So the metal's internal value is *drawn*, as a function of how far down the
 * dip a point is. Three things, all of which a real dipped metal has:
 *
 *   · a dark line immediately under the cap's lip, where the overhang shades
 *     the face — this is what gives the cap an edge instead of a fade
 *   · a bright band through the middle of the dip, the metal catching the room
 *   · a fall back to the rank colour at the waterline
 *
 * That dark-then-bright is the whole trick. `forge-tokens.css` §5 says it about
 * the crown in as many words — "gold does not read as a gold blob: interior
 * value variation is what gives a metal its metal" — and the crown got its
 * variation hand-drawn into gradient stops for exactly this reason. The blocks
 * had none, which is why two passes of moving the metal around kept producing
 * orange paint.
 *
 * Consistent across all three blocks because it is keyed to the dip, not to
 * the geometry, which is the property the reflection could not give.
 *
 * **`t`, which is depth into the collar — not the blend weight.** It was
 * written against the weight while the dip still faded out, and when the dip
 * became a band with a meniscus that weight went to ~1 across the whole collar.
 * `polish(1)` is 0.66, so every collar came out uniformly **34% darker** and
 * the gold went to ochre. It looked like a deliberate matte finish and it was
 * a curve being read at one end of itself.
 */
function polish(t) {
  const lip = Math.exp(-((t - 0.05) ** 2) / (2 * 0.055 ** 2))
  const band = Math.exp(-((t - 0.46) ** 2) / (2 * 0.2 ** 2))
  return 1 - 0.34 * lip + 0.62 * band
}

const WASH_END = 0.46
const WASH_MAX = 0.97
const WASH_CURVE = 1.15

/* ── Where the type may start, which is not where the ramp ends ──
 *
 * The ramp is nearly half the block, and waiting for its literal end would
 * push third place's figure onto its own rank numeral — that collision has
 * already happened once. It does not have to wait: what the type needs is not
 * the absence of metal but enough of the deep rank colour under it to hold
 * contrast, and the ramp is down to a tint long before it is down to nothing.
 *
 * `TYPE_SAFE` is the weight at which that is true, and the depth below is
 * solved from it rather than guessed, so changing `WASH_CURVE` moves the type
 * with it instead of quietly eating the margin. Measured after the fact. */
const TYPE_SAFE = 0.14
const TYPE_TOP = WASH_END * (1 - TYPE_SAFE ** (1 / WASH_CURVE))

for (const b of BLOCKS) {
  b.metalAlb = hexToLinear(b.metal)
  const peak = Math.max(...b.metalAlb)
  b.metalLin = b.metalAlb.map((c) => c / peak)
  /* The ramp's two ends, converted once. Per pixel this is three lerps and a
     trig pair; converting here rather than in `shade` is the difference
     between a 20-second render and a two-minute one. */
  b.lchBody = toLch(b.lin[0])
  b.lchMetal = toLch(b.metalAlb)
}

/* ══ OKLab, and it is the whole answer to the mud ══════════════════════════
 *
 * Blending a medal into a rank colour muddied at every length tried, and the
 * diagnosis was wrong three times running. It is not *how far* the blend runs.
 * It is that a straight line between two saturated hues in RGB — or in linear
 * light, which is what this file was doing — passes through the middle of the
 * colour solid, and the middle of the colour solid is grey. Gold to raspberry
 * lost its chroma around orange-brown; bronze to azure lost all of it.
 *
 * A perceptual space does not have that problem, because you can rotate the
 * hue *around* the neutral axis instead of driving through it. Interpolating
 * lightness, chroma and hue separately in OKLCh keeps every step of the ramp
 * as saturated as its ends:
 *
 *   gold   78° → amber    70°     8° of turn
 *   silver (no hue) → teal      189°     0°, a pure chroma ramp
 *   copper 51° → maroon   18°    33° of turn
 *
 * ── And the arcs are short because long ones were the actual complaint ──
 *
 * The first set of bodies were raspberry, violet and azure, which made the
 * turns 87°, 0° and **159°**. Reviewed block by block, the scores tracked that
 * one number almost exactly: silver at 0° was the best of the three, gold at
 * 87° was middling, and third place at 159° was called out for having "multiple
 * colours in it" — which it did. 159° of arc is copper, then red, then magenta,
 * then blue. OKLCh had solved the *mud*; it could not make a long journey read
 * as one object, because a long journey is not one object.
 *
 * So each block now stays inside one hue family and the three are separated
 * from **each other** instead — 70°, 189° and 18°, a warm orange-gold, a cool
 * teal and a red.
 *
 * **First place's body is the one that had to give.** It sat at 61°, which is
 * an amber brown, and that was two faults at once: it left only 43° between
 * blocks one and three, the weakest separation on the board, and it made the
 * leader read as brown rather than gold. Moving it to 75° buys both — 57°
 * between one and three, and first place's own arc down to 9°.
 *
 * ── Saturation is a gamut problem, and gold's is the awkward one ──
 *
 * Reviewed once more, bronze was called the best of the three and gold "very
 * dull, top and bottom". Measured as a share of the chroma sRGB actually
 * allows at each end's lightness, that was exactly right: copper ran 74% and
 * 67% of maximum, and gold's body ran **98%** — it was already as rich as a
 * yellow can be at that lightness, and it still looked like mustard.
 *
 * **Because dark yellow is muddy and there is no way around it.** Yellow's
 * chroma peaks near L0.80 and collapses either side — 0.167 at L0.80, 0.119 at
 * L0.57, 0.109 at L0.88. Red has no such problem, which is why copper's body
 * can be dark *and* rich and gold's cannot. Both gold ends now sit on that
 * peak rather than past it: the metal was at L0.82, on the wrong side of the
 * hump, which is why it read pale.
 *
 * **Turning the body orange is what resolved that**, and it was asked for as a
 * look rather than as a fix. Orange keeps its chroma where yellow loses it —
 * maxC at L0.60 is 0.141 at h60 against 0.126 at h76 — so the body can be
 * *darker and richer at once*. It is 96% of maximum now, and the venture name
 * on it went from 4.67:1 back to 5.3:1. Gold is still the tightest contrast on
 * the board and the one to re-measure after any change to it.
 *
 * **Silver's body went the other way twice before it landed.** At 46% of
 * maximum it was nowhere — too grey for a sapphire, too blue for a steel, so
 * it read as denim. Taken down to a true steel at 29% it was coherent and
 * dull, which was the correct answer to the wrong question: the body does not
 * have to be the metal's own shadow, it has to hold the *stage* together.
 *
 * **And the reason it kept reading as dull is not hue at all — blue is dark.**
 * At the lightness the warm bodies live at, a saturated blue carries roughly
 * half their relative luminance: the steel measured 0.083 against amber's
 * 0.194. No hue or chroma choice fixes that; only lightness does. **Compare
 * bodies by relative luminance, not by OKLCh lightness** — the two disagree
 * most exactly where blue is involved, which is how this was got wrong twice.
 *
 * ── Then blue was rejected outright, and what is left is narrow ──
 *
 * Lifted to L0.55 the azure measured 0.164 and read level with the warm two,
 * which fixed the dullness and was still not wanted. The wheel is more spoken
 * for than it looks: gold holds 70°, copper 18°, the page is violet at 297°,
 * and blue is out.
 *
 * **Green is the trap.** It is the obvious remaining cool, and it is the one
 * hue this brand cannot use: `forge-tokens.css` opens by recording that Mesa's
 * parent brand *is* green and Forge is the deliberate purple re-skin of it. An
 * emerald block would read as a regression to the parent brand, on a wall
 * whose entire palette exists to be the re-skin.
 *
 * That leaves teal, and it happens to be a good answer rather than a leftover:
 * cool without being blue, green-adjacent without being Mesa's green, and at
 * 0.184 relative luminance it sits level with amber's 0.194 while staying
 * under it. It is also 172° from copper's maroon, so the complementary axis
 * the stage is built on simply moved from first-against-second to
 * second-against-third.
 *
 * ── And the silver had to stop being a grey ──
 *
 * Reviewed once more, second place was called vague at the top and its
 * gradient weak next to the other two. Measured as a share of available
 * chroma, the three metals ran **96%, 6% and 74%** — silver was a grey
 * standing between two colours. That is also why its *ramp* looked different
 * in kind: gold and copper run a value ramp inside one saturated hue, and
 * silver ran a saturation ramp from nothing to teal, which reads as a wash
 * rather than as a material.
 *
 * At 32% it is a pale cool metal with the body's own hue in it — a silver with
 * a patina rather than a shade of grey — and its ramp now has the same shape
 * as the other two. Relative luminance 0.485, still under gold's 0.502, so the
 * cap order holds at 0.356 / 0.320 / 0.202.
 *
 * **55% was tried first and it was too much**: at that chroma the block stops
 * being a silver and becomes a teal one, which wins the richness argument by
 * abandoning the thing the block is for. The ceiling is about a third.
 *
 * **It is a complementary pair plus a neighbour, not an even triad.** Silver
 * and copper's bodies sit **172°** apart, which is as close to a true
 * complement as makes no difference, and that axis is what gives the stage its
 * structure.
 * Copper is 52° from gold and cannot leave: gold is yellow and bronze is
 * orange-red, neighbours on the wheel because that is what the medals are.
 * Widening it means pushing copper toward oxblood, which takes its own arc past
 * 60° and straight back into the fault this rule exists for. So blocks one and
 * three are held apart by *value* instead — bodies 0.194 against 0.052 in
 * relative luminance — with the cool block opposite them both. Each block is a metal fading into its own shadow; the board is
 * still three distinct colours. **Keep new arcs under ~35°.** That is the
 * number this was tuned to and the one the complaint was about.
 *
 * ── Second place was violet first, and it failed twice over ──
 *
 * It was the one ramp that worked while the others were long, so it survived a
 * round it should not have. Two faults, both measurable:
 *
 *   · its body sat at **h297°, which is the page's own hue exactly** — the
 *     block was the background colour, so it never read as an object the way
 *     the two warm ones did
 *   · its metal was **L0.85 against gold's L0.82**, so second place out-glowed
 *     first. Measured at the caps it was 0.28 vs 0.40 the right way round once
 *     fixed, and a podium whose runner-up is the brightest thing on it is
 *     working against the only job it has
 *
 * Sapphire at 267° is 30° off the page and complements both warm blocks; the
 * silver is stepped down so the gold stays the brightest object on the stage.
 * **Check both of those before changing this block again.**
 *
 * Ottosson's constants, unmodified. In and out of *linear* sRGB, which is what
 * this renderer works in — feeding it gamma-encoded values gives a ramp that
 * looks right in a swatch and wrong under a light.
 * ═══════════════════════════════════════════════════════════════════════════ */
function linearToOklab(c) {
  const l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2])
  const m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2])
  const s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2])
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function oklabToLinear(c) {
  const l = (c[0] + 0.3963377774 * c[1] + 0.2158037573 * c[2]) ** 3
  const m = (c[0] - 0.1055613458 * c[1] - 0.0638541728 * c[2]) ** 3
  const s = (c[0] - 0.0894841775 * c[1] - 1.291485548 * c[2]) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** Linear sRGB to OKLCh — lightness, chroma, hue in radians. */
function toLch(rgb) {
  const [L, a, b] = linearToOklab(rgb)
  return [L, Math.hypot(a, b), Math.atan2(b, a)]
}

const TAU = Math.PI * 2

/**
 * One step along the ramp, in OKLCh.
 *
 * **Chroma decides the hue when one end has barely any.** Measured, the six
 * ends of these three ramps are:
 *
 *   gold       C 0.142  h  81°      raspberry  C 0.170  h 354°
 *   silver     C 0.015  h 165°      violet     C 0.218  h 300°
 *   bronze     C 0.121  h  59°      azure      C 0.145  h 260°
 *
 * Silver is the odd one and the threshold exists for it. Its chroma is 0.015 —
 * a tenth of anything else here — because it is pre-compensated a hair toward
 * green to survive this room's violet fill. At that chroma the hue is not a
 * colour, it is a rounding artefact, and rotating the violet's 300° to meet its
 * 165° swept the second-place block through **cyan and teal**: hues this brand
 * does not contain, arriving on the board because `atan2` was asked a question
 * about noise. So an achromatic end borrows the other's hue and the ramp
 * becomes what it should be — chroma alone, falling away to nothing.
 *
 * 0.05 separates cleanly: every real end above is 0.12 or more.
 */
function rampAt(from, to, t) {
  const [L0, C0, h0] = from
  const [L1, C1, h1] = to
  const hA = C0 < 0.05 ? h1 : h0
  const hB = C1 < 0.05 ? hA : h1
  let d = hB - hA
  while (d > Math.PI) d -= TAU
  while (d < -Math.PI) d += TAU
  const L = L0 + (L1 - L0) * t
  const C = C0 + (C1 - C0) * t
  const h = hA + d * t
  const lin = oklabToLinear([L, C * Math.cos(h), C * Math.sin(h)])
  /* Out-of-gamut is real here — the arc bulges past sRGB between two in-gamut
     ends — and a negative channel cubes back to a black speck rather than
     clipping quietly. Clamp at the floor, and let the tone map take the top. */
  return [Math.max(lin[0], 0), Math.max(lin[1], 0), Math.max(lin[2], 0)]
}

/** Toward the medal, by `k`, from a neutral. */
function towardMetal(base, metal, k) {
  return [
    base[0] + (metal[0] - base[0]) * k,
    base[1] + (metal[1] - base[1]) * k,
    base[2] + (metal[2] - base[2]) * k,
  ]
}

/* ── Signed distance to the scene ────────────────────────────────────────
   A rounded box, three times. Exact, so sphere tracing converges in a handful
   of steps rather than creeping. */
function sdBlock(px, py, pz, b) {
  const hx = b.w / 2 - RADIUS
  const hy = b.h / 2 - RADIUS
  const hz = DEPTH / 2 - RADIUS
  const qx = Math.abs(px - b.x) - hx
  const qy = Math.abs(py - b.h / 2) - hy
  const qz = Math.abs(pz + DEPTH / 2) - hz
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  const oz = Math.max(qz, 0)
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(qx, qy, qz), 0) - RADIUS
}

function sdScene(px, py, pz) {
  let d = Infinity
  for (const b of BLOCKS) {
    const s = sdBlock(px, py, pz, b)
    if (s < d) d = s
  }
  return d
}

/** Which block a point belongs to, for its material. */
function blockAt(px, py, pz) {
  let d = Infinity
  let hit = BLOCKS[0]
  for (const b of BLOCKS) {
    const s = sdBlock(px, py, pz, b)
    if (s < d) {
      d = s
      hit = b
    }
  }
  return hit
}

/* Slab test against every block's bounding box at once. Most rays miss the
   scene entirely, and marching them to the far plane is most of the render
   time — this is what turns minutes into seconds. */
function sceneBounds(ox, oy, oz, dx, dy, dz) {
  let near = Infinity
  let far = -Infinity
  for (const b of BLOCKS) {
    const lo = [b.x - b.w / 2, 0, -DEPTH]
    const hi = [b.x + b.w / 2, b.h, 0]
    let t0 = -Infinity
    let t1 = Infinity
    const o = [ox, oy, oz]
    const d = [dx, dy, dz]
    let miss = false
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-9) {
        if (o[a] < lo[a] || o[a] > hi[a]) {
          miss = true
          break
        }
      } else {
        const inv = 1 / d[a]
        let ta = (lo[a] - o[a]) * inv
        let tb = (hi[a] - o[a]) * inv
        if (ta > tb) [ta, tb] = [tb, ta]
        if (ta > t0) t0 = ta
        if (tb < t1) t1 = tb
        if (t0 > t1) {
          miss = true
          break
        }
      }
    }
    if (miss || t1 < 0) continue
    if (t0 < near) near = t0
    if (t1 > far) far = t1
  }
  return near === Infinity ? null : [Math.max(near - RADIUS, 0), far + RADIUS]
}

function march(ox, oy, oz, dx, dy, dz) {
  const range = sceneBounds(ox, oy, oz, dx, dy, dz)
  if (range === null) return -1
  let t = range[0]
  for (let i = 0; i < 96; i++) {
    const d = sdScene(ox + dx * t, oy + dy * t, oz + dz * t)
    if (d < 0.05) return t
    t += d
    if (t > range[1]) return -1
  }
  return -1
}

function normalAt(px, py, pz) {
  const e = 0.12
  const nx = sdScene(px + e, py, pz) - sdScene(px - e, py, pz)
  const ny = sdScene(px, py + e, pz) - sdScene(px, py - e, pz)
  const nz = sdScene(px, py, pz + e) - sdScene(px, py, pz - e)
  return norm([nx, ny, nz])
}

/** Percentage-closer soft shadow, the standard SDF trick: the closest the ray
    passes to the geometry, relative to how far along it was, is the penumbra. */
function softShadow(px, py, pz, lx, ly, lz, k, maxT = 2600) {
  let res = 1
  let t = 1.5
  for (let i = 0; i < 40 && t < maxT; i++) {
    const d = sdScene(px + lx * t, py + ly * t, pz + lz * t)
    if (d < 0.02) return 0
    res = Math.min(res, (k * d) / t)
    t += Math.max(d, 1.2)
  }
  return Math.max(res, 0)
}

/** Five taps along the normal. Crude and completely sufficient for boxes: all
    it has to find is the crease where two blocks or a block and the floor meet. */
function ao(px, py, pz, nx, ny, nz) {
  let occ = 0
  let w = 1
  for (let i = 1; i <= 5; i++) {
    const h = i * 9
    const d = sdScene(px + nx * h, py + ny * h, pz + nz * h)
    occ += (h - d) * w
    w *= 0.72
  }
  return Math.min(Math.max(1 - occ * 0.033, 0), 1)
}

/** The block's own colour at a height: its ramp, sampled top to bottom.
 *
 * **Any number of stops, evenly spaced.** All three blocks pass one colour
 * twice today, which is the flat case and the one the file argues for — the
 * light does the modelling. The machinery is kept because it is what a
 * *material* variation would use if one is ever wanted, and because it cost
 * nothing: two stops of the same value is the same arithmetic.
 *
 * It earned its keep on the way past. Three-stop hue rotations were the old
 * board, and a four-stop pass tried to land each block on its own medal —
 * which failed for a reason worth keeping: the scene's fill light is violet,
 * so an unsaturated colour comes back as the page. Silver rendered **#ada5d9**
 * and bronze **#ce8f93**, lavender and dusty pink. Only saturated colour
 * survives this room, which is why the three below are all saturated. */
function albedo(b, y) {
  const f = Math.min(Math.max(1 - y / b.h, 0), 1)
  const r = b.lin
  const seg = r.length - 1
  const i = Math.min(Math.floor(f * seg), seg - 1)
  const u = f * seg - i
  const a = r[i]
  const c = r[i + 1]
  return [a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u, a[2] + (c[2] - a[2]) * u]
}

function shade(px, py, pz, nx, ny, nz, vx, vy, vz) {
  const b = blockAt(px, py, pz)
  const occ = ao(px, py, pz, nx, ny, nz)

  /* ── The cap, and why it is the top face and nothing else ──

     Tinting the specular alone was not enough to read: a highlight on these
     blocks is a sliver along one edge, and at six metres a sliver is not a
     medal. The top face is a whole plane, it is the plane the mark stands on,
     and it is the one surface the key light hits close to head-on — which is
     exactly where an unsaturated metal keeps its colour instead of being
     turned back into the page by the violet fill. That was the failure of the
     pass that made the metals albedo; here the physics is on the right side.

     **To the fourth power, and the exponent is load-bearing.** A front face
     has `ny` of 0 and gets none of this at any exponent — but the 26px rounded
     corner between the two sweeps `ny` through every value in between, and
     that corner projects tall on screen. Squared, the wash ran a visible band
     down the top of each front face: dusty bronze on third place, which is the
     exact colour the albedo pass failed at. Raised to four it stops at the
     corner, so the cap has an edge and the face keeps its rank colour. */
  const up = Math.max(ny, 0) ** 4

  /* And the same metal running down the face from under it. Keyed to height
     alone, so it crosses the front, both sides and the rounded corners at one
     level — a dip has a waterline, and a wash that followed the normal would
     ride up the sides and read as paint instead.

     ── A long fade, which was only possible once the ramp moved to OKLCh ──

     This ran as a hard band with a meniscus for one pass, and the reasoning
     behind that band was wrong in an interesting way. Three fades before it had
     muddied in the middle, so the conclusion was that a fade between two
     contrasting materials *must* mud and the crossing had to be given no width.
     It does not. It muds in linear RGB, because a straight line between two
     saturated hues runs through the neutral axis. In OKLCh the same fade
     rotates around it and every step stays as saturated as the ends — so the
     crossing can have all the width it wants, and the band goes back to being
     the gradient it should have been.

     Long on purpose: at 0.46 nearly half the block is ramp, which is what stops
     either end reading as a flat area with a join. `t` is depth into it. */
  const t = Math.min(Math.max((1 - py / b.h) / WASH_END, 0), 1)
  const down = (1 - t) ** WASH_CURVE

  /* `max`, not a sum: where the cap and the wash meet they are the same metal,
     and adding them would lay a bright seam along the edge the two share. */
  const metalness = Math.max(0.9 * up, WASH_MAX * down)
  /* Down the ramp rather than across a lerp. At `metalness` 0 this returns the
     block's flat rank colour, so everything below the ramp is unchanged. */
  const alb = rampAt(b.lchBody, b.lchMetal, metalness)

  /* To the light rather than along a fixed axis, and the inverse square that
     comes with having somewhere to be. Both terms vary across a flat face,
     which is the whole point of the move. */
  const lx = KEY_POS[0] - px
  const ly = KEY_POS[1] - py
  const lz = KEY_POS[2] - pz
  const ld = Math.hypot(lx, ly, lz)
  const kx = lx / ld
  const ky = ly / ld
  const kz = lz / ld
  const atten = Math.min((KEY_REF / ld) ** 2, 1.35)
  const sh = softShadow(px, py, pz, kx, ky, kz, 14, ld)

  const kdot = Math.max(nx * kx + ny * ky + nz * kz, 0)
  const nk = kdot * atten
  const nf = Math.max(nx * FILL_DIR[0] + ny * FILL_DIR[1] + nz * FILL_DIR[2], 0)
  const hemi = 0.5 + 0.5 * ny

  /* On the fill and the ambient, never on the key — the key already dims by
     being somewhere. Scaling it twice is how a stage ends up lit like a
     tunnel. */
  const room = ambientAt(py)

  const out = [0, 0, 0]
  for (let c = 0; c < 3; c++) {
    const ambient = (GROUND[c] + (SKY[c] - GROUND[c]) * hemi) * occ
    out[c] = alb[c] * (KEY[c] * nk * sh + (FILL[c] * nf * occ + ambient) * room)
  }

  /* The specular, on the key only. It was a broad one for as long as the
     material carried its own gradient — the blocks needed a wide sheen to say
     "solid" because nothing else was. The light does that now, so this can
     tighten to what a real highlight is: a line along the top edge where the
     face turns through the mirror angle, rather than a bloom across it. */
  const hx = kx - vx
  const hy = ky - vy
  const hz = kz - vz
  const hl = Math.hypot(hx, hy, hz)
  const nh = Math.max((nx * hx + ny * hy + nz * hz) / hl, 0)
  const spec = nh ** 36 * 0.34 * sh * atten
  const specTint = towardMetal(KEY, b.metalLin, 0.65)
  for (let c = 0; c < 3; c++) out[c] += spec * specTint[c]

  /* ── The rim, and why it only shows on the edges ──

     Fresnel: how far the surface has turned away from the eye. A front face
     points straight down the barrel, so `facing` is ~1 and the term is zero —
     the flat middle of a block gets nothing at all. It climbs only across the
     rounded corner where the face rolls away, which is exactly the sliver a
     real object lights up and a flat fill cannot.

     Gated three ways, and each gate is a fault it had without it: by `kdot` so
     it only appears on the side the light is on, by `sh` so a block standing in
     another's shadow does not glow along its edge, and by `occ` so the crease
     where two blocks nearly touch stays a crease.

     Cool and near-white rather than the key's warm white, because an edge
     catches the *room* and this room's sky is violet. */
  const facing = Math.max(-(nx * vx + ny * vy + nz * vz), 0)

  /* ── The reflection, and it is only the metal that has one ──

     Weighted by `metalness`, so the rank colour below the waterline stays the
     matte painted surface it is and the dipped part above it stays metal. The
     two materials meet at one line instead of being one material pretending.

     Metals reflect hard at every angle, not only at grazing ones — hence the
     0.52 floor rather than a pure fresnel, which would have put the whole
     reflection on the silhouette and left the face flat again. */
  if (metalness > 0.002) {
    const vn = nx * vx + ny * vy + nz * vz
    const ry = vy - 2 * vn * ny
    const env = envSample(ry) * (0.52 + 0.48 * (1 - facing) ** 3)
    const refl = metalness * env * ENV * sh
    for (let c = 0; c < 3; c++) out[c] += refl * b.metalLin[c] * alb[c]
    /* A metal has almost no diffuse. */
    for (let c = 0; c < 3; c++) out[c] *= 1 - 0.46 * metalness

    /* And the drawn profile, faded in by the same weight, so the rank colour
       below the waterline is untouched by it. */
    const p = 1 + (polish(t) - 1) * metalness
    for (let c = 0; c < 3; c++) out[c] *= p
  }
  const rim = (1 - facing) ** 3.4 * (0.2 + 0.8 * kdot) * sh * occ * 0.62
  const rimTint = towardMetal(RIM, b.metalLin, 0.55)
  for (let c = 0; c < 3; c++) out[c] += rim * rimTint[c]

  return out
}

/* ── The camera ──────────────────────────────────────────────────────────
   A pixel names a point on the z = 0 plane; the ray is from the camera
   through it. That is what makes the plane's mapping to the image exactly
   linear, which is the property the whole design rests on. */
function planeToImage(wx, wy) {
  return [((wx - VIEW.x0) / (VIEW.x1 - VIEW.x0)) * W, ((VIEW.y1 - wy) / (VIEW.y1 - VIEW.y0)) * H]
}

/** Any world point to image pixels, by intersecting the ray with z = 0. */
function project(wx, wy, wz) {
  const s = (CAM.z - 0) / (CAM.z - wz)
  return planeToImage(CAM.x + (wx - CAM.x) * s, CAM.y + (wy - CAM.y) * s)
}

/* ── Render ──────────────────────────────────────────────────────────── */

const px = new Float32Array(W * H * 4)

for (let iy = 0; iy < H; iy++) {
  for (let ix = 0; ix < W; ix++) {
    let r = 0
    let g = 0
    let b = 0
    let a = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const u = VIEW.x0 + ((ix + (sx + 0.5) / SS) / W) * (VIEW.x1 - VIEW.x0)
        const v = VIEW.y1 - ((iy + (sy + 0.5) / SS) / H) * (VIEW.y1 - VIEW.y0)
        const dir = norm([u - CAM.x, v - CAM.y, 0 - CAM.z])
        const t = march(CAM.x, CAM.y, CAM.z, dir[0], dir[1], dir[2])

        if (t > 0) {
          const hx = CAM.x + dir[0] * t
          const hy = CAM.y + dir[1] * t
          const hz = CAM.z + dir[2] * t
          const n = normalAt(hx, hy, hz)
          const c = shade(hx, hy, hz, n[0], n[1], n[2], dir[0], dir[1], dir[2])
          r += c[0]
          g += c[1]
          b += c[2]
          a += 1
          continue
        }

        /* The room above the stage. Added before the floor so a ray that
           reaches neither still carries it. */
        {
          const dx = u - 0
          const dy = v - HAZE_AT.y
          const hz =
            Math.exp(-(dx * dx) / (2 * HAZE_AT.sx ** 2) - (dy * dy) / (2 * HAZE_AT.sy ** 2)) *
            edgeFade((VIEW.x1 - Math.abs(u)) / 300) *
            edgeFade((VIEW.y1 - v) / 340) *
            edgeFade((v - VIEW.y0) / 160)
          if (hz > 0.002) {
            const al = hz * HAZE_STRENGTH
            /* Premultiplied, like every other contribution in this loop — the
               divide at the end is by the accumulated alpha. */
            r += HAZE[0] * al
            g += HAZE[1] * al
            b += HAZE[2] * al
            a += al
          }
        }

        /* ── The floor is a shadow catcher and nothing else ──

           It is never shaded, so the page's own gradient shows through
           untouched and no seam can appear between a rendered floor and a CSS
           one. All it contributes is alpha where the blocks occlude the key
           light, plus the ambient darkening in the crease at their feet. */
        if (dir[1] < -1e-6) {
          const tf = -CAM.y / dir[1]
          const fx = CAM.x + dir[0] * tf
          const fz = CAM.z + dir[2] * tf
          if (tf > 0 && fz > -1400 && Math.abs(fx) < 1400) {
            const flx = KEY_POS[0] - fx
            const fly = KEY_POS[1] - 0.6
            const flz = KEY_POS[2] - fz
            const fld = Math.hypot(flx, fly, flz)
            const sh = softShadow(fx, 0.6, fz, flx / fld, fly / fld, flz / fld, 9, fld)
            const occ = ao(fx, 0.6, fz, 0, 1, 0)
            /* ── Contact, not cast ──

               The long cast shadow was most of the floor's alpha for a pass,
               and on this page it is close to useless: `--surface-dark` runs
               from #1a0f2e to #0e0719, so darkening it further returns a
               muddy blob rather than a shadow. What does read on a dark page
               is the tight crease where a block meets the floor, so the
               ambient-occlusion term carries the weight and the cast shadow
               is left as a hint of direction. */
            const fall = Math.exp(-((fz + 180) ** 2) / (2 * 430 ** 2))
            const dark = (1 - sh) * 0.20 * fall + (1 - occ) * 0.58
            const al = Math.min(Math.max(dark, 0), 0.72)
            a += al
          }
        }
      }
    }

    const n = SS * SS
    const o = (iy * W + ix) * 4
    /* Premultiplied while averaging — the samples that missed contribute no
       colour, so dividing by the *hit* count would brighten every silhouette
       edge and dividing colour by `n` is what keeps them clean. */
    px[o] = r / n
    px[o + 1] = g / n
    px[o + 2] = b / n
    px[o + 3] = a / n
  }
  if (iy % 80 === 0) process.stderr.write(`  row ${iy}/${H}\n`)
}

/* ── Encode ─────────────────────────────────────────────────────────────── */

const rgba = Buffer.alloc(W * H * 4)
for (let i = 0; i < W * H; i++) {
  const a = px[i * 4 + 3]
  const o = i * 4
  if (a <= 0.0005) {
    rgba[o] = 0
    rgba[o + 1] = 0
    rgba[o + 2] = 0
    rgba[o + 3] = 0
    continue
  }
  for (let c = 0; c < 3; c++) {
    /* Un-premultiply, then to sRGB. PNG stores straight alpha. */
    const lin = px[o + c] / a
    rgba[o + c] = Math.round(Math.min(Math.max(linearToSrgb(lin), 0), 1) * 255)
  }
  rgba[o + 3] = Math.round(Math.min(a, 1) * 255)
}

const CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // truecolour with alpha
const raw = Buffer.alloc(H * (W * 4 + 1))
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0 // filter: none
  rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4)
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

mkdirSync('public/podium', { recursive: true })
writeFileSync('public/podium/blocks.png', png)

/* ── The manifest ───────────────────────────────────────────────────────── */

const places = Object.fromEntries(
  BLOCKS.map((b) => {
    const [lx, ty] = planeToImage(b.x - b.w / 2, b.h)
    const [rx, by] = planeToImage(b.x + b.w / 2, 0)
    const [tx, tyc] = project(b.x, b.h, -DEPTH / 2)
    const f = (n) => +n.toFixed(5)
    return [
      b.place,
      {
        front: { x: f(lx / W), y: f(ty / H), w: f((rx - lx) / W), h: f((by - ty) / H) },
        top: { x: f(tx / W), y: f(tyc / H) },
        mark: f(b.mark / (VIEW.x1 - VIEW.x0)),
        wash: f(TYPE_TOP),
      },
    ]
  }),
)

/* ── The manifest, as a module the app imports ──

   **Not fetched at runtime.** This wall has two network dependencies and they
   are the two published CSVs; a third request for the geometry of its own
   layout is a request that can fail on a display nobody is watching, and it
   would fail by rendering the three blocks with their type stacked in the top
   left corner. Compiled in, it cannot. */
writeFileSync(
  'lib/podiumBlocks.ts',
  `/**
 * GENERATED by \`scripts/render-podium.mjs\`. Do not edit.
 *
 * Where \`public/podium/blocks.png\`'s three blocks are, as fractions of the
 * image with the origin at its top left. \`front\` is a block's face, which is
 * an exact rectangle because the render's camera is off-axis; \`top\` is the
 * centre of its top face, where the mark stands; \`mark\` is that mark's
 * diameter as a fraction of the image's width; \`wash\` is how far down the
 * face the medal has faded to a tint, as a share of the face's own height, and
 * is what the name and the figure are placed below. It is *not* where the ramp
 * ends — the ramp runs on underneath the type as a wash of colour.
 *
 * Re-run the script after changing any block's size, the camera, or the view.
 */

export type BlockAnchor = {
  front: { x: number; y: number; w: number; h: number }
  top: { x: number; y: number }
  mark: number
  wash: number
}

export const BLOCK_IMAGE = { src: '/podium/blocks.png', width: ${W}, height: ${H} } as const

export const BLOCKS: Record<number, BlockAnchor> = ${JSON.stringify(places, null, 2)}
`,
)

console.log(`wrote public/podium/blocks.png  ${W}x${H}  ${(png.length / 1024).toFixed(0)}KB`)
console.log('wrote lib/podiumBlocks.ts')

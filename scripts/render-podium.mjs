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
 * Each gradient runs top to bottom and ends *warmer and lighter* than it
 * starts, which is the reference's own lighting logic. First place is the only
 * one that reaches a warm hue; the other two stay in the page's purple family,
 * so the hierarchy survives a greyscale crop.
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
    ramp: ['#5b3bc4', '#4a63ef', '#3fb9f0'],
  },
  { place: 1, x: 0, w: w1, h: 720, mark: 250, ramp: ['#7c3ad0', '#c026d3', '#ff6a7f'] },
  {
    place: 3,
    x: w1 / 2 + GAP + wRest / 2,
    w: wRest,
    h: 450,
    mark: 190,
    ramp: ['#63309f', '#9b56cf', '#e79bd8'],
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
const KEY_DIR = norm([0.55, 0.72, 0.42])
const KEY = [1.0, 0.97, 0.94]
const FILL_DIR = norm([-0.62, 0.34, 0.5])
const FILL = [0.52, 0.44, 0.76]
const SKY = [0.38, 0.30, 0.56]
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
function softShadow(px, py, pz, lx, ly, lz, k) {
  let res = 1
  let t = 1.5
  for (let i = 0; i < 40 && t < 2600; i++) {
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
  return Math.min(Math.max(1 - occ * 0.028, 0), 1)
}

/** The block's own colour at a height: its ramp, sampled top to bottom. */
function albedo(b, y) {
  const f = Math.min(Math.max(1 - y / b.h, 0), 1)
  const [a, m, c] = b.lin
  if (f < 0.5) {
    const u = f * 2
    return [a[0] + (m[0] - a[0]) * u, a[1] + (m[1] - a[1]) * u, a[2] + (m[2] - a[2]) * u]
  }
  const u = (f - 0.5) * 2
  return [m[0] + (c[0] - m[0]) * u, m[1] + (c[1] - m[1]) * u, m[2] + (c[2] - m[2]) * u]
}

function shade(px, py, pz, nx, ny, nz, vx, vy, vz) {
  const b = blockAt(px, py, pz)
  const alb = albedo(b, py)
  const occ = ao(px, py, pz, nx, ny, nz)
  const sh = softShadow(px, py, pz, KEY_DIR[0], KEY_DIR[1], KEY_DIR[2], 14)

  const nk = Math.max(nx * KEY_DIR[0] + ny * KEY_DIR[1] + nz * KEY_DIR[2], 0)
  const nf = Math.max(nx * FILL_DIR[0] + ny * FILL_DIR[1] + nz * FILL_DIR[2], 0)
  const hemi = 0.5 + 0.5 * ny

  const out = [0, 0, 0]
  for (let c = 0; c < 3; c++) {
    const ambient = (GROUND[c] + (SKY[c] - GROUND[c]) * hemi) * occ
    out[c] = alb[c] * (KEY[c] * nk * sh + FILL[c] * nf * occ + ambient)
  }

  /* One broad specular, on the key only. Enough to put a sheen along the top
     edges, which is what says "solid object" rather than "painted rectangle";
     any tighter and the blocks read as plastic. */
  const hx = KEY_DIR[0] - vx
  const hy = KEY_DIR[1] - vy
  const hz = KEY_DIR[2] - vz
  const hl = Math.hypot(hx, hy, hz)
  const nh = Math.max((nx * hx + ny * hy + nz * hz) / hl, 0)
  const spec = nh ** 26 * 0.30 * sh
  for (let c = 0; c < 3; c++) out[c] += spec * KEY[c]

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
            const sh = softShadow(fx, 0.6, fz, KEY_DIR[0], KEY_DIR[1], KEY_DIR[2], 9)
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
 * diameter as a fraction of the image's width.
 *
 * Re-run the script after changing any block's size, the camera, or the view.
 */

export type BlockAnchor = {
  front: { x: number; y: number; w: number; h: number }
  top: { x: number; y: number }
  mark: number
}

export const BLOCK_IMAGE = { src: '/podium/blocks.png', width: ${W}, height: ${H} } as const

export const BLOCKS: Record<number, BlockAnchor> = ${JSON.stringify(places, null, 2)}
`,
)

console.log(`wrote public/podium/blocks.png  ${W}x${H}  ${(png.length / 1024).toFixed(0)}KB`)
console.log('wrote lib/podiumBlocks.ts')

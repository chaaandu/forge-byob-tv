/* ── The TV wall: shared data and drawing for both slides ──
 *
 * Served straight out of `public/tv/`, so the board paints from cached CSV
 * before Next has booted anything. `ladder.html` is the BYOB Leaderboard and
 * `floor.html` is the Daily Leaderboard; `wall.html` rotates the two. */

const FEED_LIVE =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIPEG2OyaUG4epSSXmvtiHClz9jUwDKuHIUy1de4gw6AevZMBM2oODC5W8DwqbRDQspTqqM34DalBd/pub?gid=1357679077&single=true&output=csv'
const FEED_LOCAL = './real-feed.csv'

/** 39, not 41. Two spares in the sheet are not in the cohort. */
const SPARES = ['VBC140', 'VBC141']

const LIVERY_COUNT = 39

/* ── The same hash the real app uses, so a venture is the same colour here,
      on the wall and on a phone. ── */
function hashTeamId(id) {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}
function mix(v) {
  let h = v
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}
/**
 * ── A colour per venture, and no two the same ──
 *
 * This was `mix(hash) % 16`, which collides by construction: 39 teams over 16
 * colours means two of the visible top ten share one on most days, and the
 * board looks like it has made a mistake. The palette is now the size of the
 * cohort and this is a BIJECTION — teams sorted by id, one livery each, in a
 * strided palette so id-adjacent teams are never hue-adjacent.
 *
 * Keyed by ID rather than by rank, which is the property that matters: a
 * venture's colour is its identity and must not change when it climbs. Rank is
 * said by position, size and the numeral — never by hue.
 */
let LIVERY = new Map()
/**
 * ── The locked map: team id -> livery, written out rather than computed ──
 *
 * This used to be a team's POSITION in the id-sorted list, which is only
 * stable while the list itself never changes. Measured: drop one venture from
 * TV_Feed and 29 of the remaining 38 shift colour, because everyone after the
 * gap moves up one slot. A wall where a third of the board recolours because
 * somebody edited a spreadsheet row is not locked in any useful sense.
 *
 * So the assignment is frozen here. A venture keeps its colour through a team
 * leaving, a team joining, a rename, or a rank change. An id nobody has seen
 * before falls back to the hash, which is stable for that id too.
 */
const TEAM_LIVERY = {
  "VBC101": 1, "VBC102": 2, "VBC103": 3, "VBC104": 4, "VBC105": 5, "VBC106": 6,
  "VBC107": 7, "VBC108": 8, "VBC109": 9, "VBC110": 10, "VBC111": 11, "VBC112": 12,
  "VBC113": 13, "VBC114": 14, "VBC115": 15, "VBC116": 16, "VBC117": 17, "VBC118": 18,
  "VBC119": 19, "VBC120": 20, "VBC121": 21, "VBC122": 22, "VBC123": 23, "VBC124": 24,
  "VBC125": 25, "VBC126": 26, "VBC127": 27, "VBC128": 28, "VBC129": 29, "VBC130": 30,
  "VBC131": 31, "VBC132": 32, "VBC133": 33, "VBC134": 34, "VBC135": 35, "VBC136": 36,
  "VBC137": 37, "VBC138": 38, "VBC139": 39,
}

function assignLiveries(teams) {
  LIVERY = new Map(Object.entries(TEAM_LIVERY))
}
const liveryFor = (id) => LIVERY.get(id) ?? ((mix(hashTeamId(id)) % LIVERY_COUNT) + 1)
/** 0-7. Which decorative shape a card wears. Different bits again, so two
 * teams sharing a colour are still told apart by the shape of their card. */
const shapeFor = (id) => (mix(hashTeamId(id)) >>> 19) % 8


/* ── Money. en-IN groups by lakh, so ₹1,04,500 and never ₹104,500. ── */
const rupees = (n) =>
  '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n))

/**
 * A figure with its last group masked: ₹36,110 -> ₹36,xxx.
 *
 * Suspense that still carries magnitude. Printing the exact number answers the
 * question the hook is asking, and the hook is the reason anybody reaches for
 * a phone. Masking only the LAST group is deliberate — ₹1,00,596 becomes
 * ₹1,00,xxx and still reads as "over a lakh", where masking more would throw
 * away the only part that makes it worth scanning.
 */
function maskRupees(n) {
  const s = rupees(n)
  const cut = s.lastIndexOf(',')
  return cut === -1 ? s : s.slice(0, cut + 1) + 'x'.repeat(s.length - cut - 1)
}

/**
 * A figure rounded down to the nearest thousand with a plus: ₹5,82,823 ->
 * ₹5,82,000+.
 *
 * Rounding DOWN matters. `+` after a floored number is a promise the board
 * always keeps; rounding to nearest would sometimes print more money than the
 * cohort has actually taken, on a wall whose entire discipline is that it only
 * says what it can prove.
 */
function plusRupees(n) {
  if (n < 1000) return rupees(Math.floor(n))          // no plus: it would overstate
  return rupees(Math.floor(n / 1000) * 1000) + '+'
}

/* ── Casing is per NAME, not per word ──
   Of the real names, ten are ALL CAPS in the sheet and three are lowercase.
   A name carrying both cases is printed exactly as the sheet has it, which is
   what keeps `SoleMate` and `ATC (All Things Camphor)` intact. */
function titleCase(name) {
  if (/[a-z]/.test(name) && /[A-Z]/.test(name)) return name
  return name
    .toLowerCase()
    .replace(/(^|[\s(\-\/&.])([a-zà-ɏ])/g, (_, p, c) => p + c.toUpperCase())
}

/** Two letters, the way a venture would put them on a stamp. */
function monogram(name, id) {
  const words = titleCase(name).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return id.slice(-2)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Gold, on one object, on one rank — the wall's single standing exemption. */
/* ── The viewBox was cropping the crown, not the layout ──
 *
 * Content spans x -1.5..65.5 and y -1.5..47 — the two outer balls sit 1.5
 * units outside a 64-wide box and the top ball 1.5 above it — so the three
 * highlights were being sliced by the SVG's own frame before the page ever
 * saw them. Widened to the true bounds plus 6 units of air on every side. */
const CROWN = `<svg viewBox="-7.5 -7.5 79 60.5" aria-hidden="true">
  <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffe89a"/><stop offset=".45" stop-color="#f2b93c"/>
    <stop offset=".72" stop-color="#c9860c"/><stop offset="1" stop-color="#8a5504"/>
  </linearGradient></defs>
  <path fill="url(#cg)" d="M5 40 2 12l14 10L32 4l16 18 14-10-3 28z"/>
  <rect fill="url(#cg)" x="5" y="40" width="54" height="7" rx="2"/>
  <circle fill="#ffe89a" cx="2.5" cy="11" r="4"/><circle fill="#ffe89a" cx="61.5" cy="11" r="4"/>
  <circle fill="#ffe89a" cx="32" cy="3" r="4.5"/>
</svg>`

/* ── Parsing ── */
function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1 }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  const head = rows.shift().map((h) => h.trim())
  return rows.filter((r) => r.length >= head.length && r[0]).map((r) =>
    Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])))
}

const num = (v) => { const n = Number(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0 }

/* ── First paint reads the cache, never the network ────────────────────────
 *
 * Measured on the rotation: 1.6s to first content on the Ladder and 2.9s on
 * the Daily board, of which almost all was one request — docs.google.com
 * redirecting to googleusercontent and serving the CSV. The page rendered
 * NOTHING until it landed, so every thirty-second slide change opened with
 * seconds of empty frame.
 *
 * The wall's own rule covers this: no spinners, first paint reads cached CSV.
 * So the parsed feed is kept in localStorage and a mount renders it
 * immediately; the network fetch runs in the background purely to refresh the
 * cache for the NEXT mount.
 *
 * Deliberately NOT re-rendering when the fetch lands. The rotation remounts
 * this page every thirty seconds anyway, so fresh data is at most one slide
 * behind — and repainting mid-slide would move figures and reorder the board
 * while somebody is reading it, which is the one thing this wall does not do.
 */
const CACHE_KEY = 'byob-tv.feed'

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    return Array.isArray(raw?.teams) && raw.teams.length ? raw.teams : null
  } catch { return null }
}

function writeCache(teams) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), teams })) } catch { /* full */ }
}

async function fetchTeams() {
  let text = null
  try {
    const res = await fetch(FEED_LIVE, { cache: 'no-store' })
    if (res.ok) { const body = await res.text(); if (body.includes('team_id')) text = body }
  } catch { /* offline, or the sheet is unreachable — fall through */ }
  if (text === null) text = await (await fetch(FEED_LOCAL, { cache: 'no-store' })).text()

  const teams = parseCsv(text)
    .filter((r) => r.team_id && !SPARES.includes(r.team_id))
    .map((r) => ({
      id: r.team_id,
      name: r.venture_name ? titleCase(r.venture_name) : r.team_id,
      total: num(r.total_revenue),
      today: num(r.today_revenue),
      week: num(r.week_revenue),
      challenge: num(r.challenge_revenue),
      units: num(r.total_units),
    }))
  writeCache(teams)
  return teams
}

async function loadTeams() {
  const cached = readCache()
  if (cached) {
    assignLiveries(cached)
    fetchTeams().catch(() => {})     // refresh for the next mount; never awaited
    return cached
  }
  // Cold browser only: there is nothing to draw, so the fetch has to be waited on.
  const teams = await fetchTeams()
  assignLiveries(teams)
  return teams
}

/** logged revenue desc -> units desc -> team id asc, exactly as the wall sorts. */
const rankBy = (teams, key) =>
  [...teams].sort((a, b) => b[key] - a[key] || b.units - a.units || a.id.localeCompare(b.id))


/* ── The squad ──────────────────────────────────────────────────────────────
   `PEOPLE_PHOTOS` from config.ts, exported to JSON so a static mock can read
   the same manifest the app does. THE LIST, NOT THE FILESYSTEM: an entry with
   no file behind it is a broken image, and a file missing from the list is
   simply invisible.

   `TV_Feed` publishes no `members` column yet, so this takes the same fallback
   production runs today — the roster IS the photographs. A student without one
   is invisible here, which is the cost `AGENTS.md` records, not a new bug.

   Nobody's face is ever borrowed. No photograph, no person. */
let PHOTOS = []
async function loadPhotos() {
  try { PHOTOS = await (await fetch('./people.json', { cache: 'no-store' })).json() } catch { PHOTOS = [] }
}

/**
 * Warm the whole cohort's photographs into the browser cache, once, after the
 * board has painted.
 *
 * The squad is picked by RANK, so the three teams that need pictures change
 * whenever the standings do — and a team promoted into the podium at 3am has
 * to arrive with its faces already there. 105 files at 14KB average is 1.47MB
 * for all thirty-nine, which is one ordinary web page, fetched once, on a
 * machine that then runs for weeks. Cheaper than being clever.
 */
function warmPhotos() {
  requestIdleCallback
    ? requestIdleCallback(() => PHOTOS.forEach((p) => { new Image().src = `/people/${p}.webp` }))
    : setTimeout(() => PHOTOS.forEach((p) => { new Image().src = `/people/${p}.webp` }), 1200)
}

/** Slugs back to names, for the title attribute and for ordering. */
function squadOf(teamId) {
  return PHOTOS.filter((p) => p.startsWith(teamId + '/'))
    .map((p) => ({ slug: p.slice(teamId.length + 1), src: `/people/${p}.webp` }))
}

/** Bottom-aligned cutouts, shoulders overlapping and heads not, the last fifth
    faded so a crop ending on somebody's chest is not a straight cut across
    them. Exactly `/live`'s treatment, scaled to the bar. */
function squadHtml(teamId, h, max) {
  const people = squadOf(teamId).slice(0, max)
  if (people.length === 0) return ''
  const w = Math.round(h * (96 / 132))
  const lap = Math.round(w * 0.31)
  return `<span class="squad" style="height:${h}px">` + people.map((p, i) =>
    `<span class="person" style="width:${w}px;height:${h}px;z-index:${people.length - i};` +
    `margin-left:${i === 0 ? 0 : -lap}px"><img src="${p.src}" alt=""></span>`).join('') + '</span>'
}


/* ── The daily figure needs no machinery at all ────────────────────────────
 *
 * `TV_Feed`'s `today_revenue` is `SUMIFS(… 'Daily Dump'!B:B, TODAY())` — the
 * Daily Dump summed by DATE, resetting at midnight. That is the whole feature,
 * already published, already correct.
 *
 * Two of the three designs tried before this one are now deleted rather than
 * left as dead code:
 *
 *   a fixed 10:00-to-10:00 closed day   two stored marks; a locked board that
 *                                       is up to 24 hours stale by teatime
 *   a rolling last-24-hours             twenty-six stored marks; and figures
 *                                       that FALL at every hourly roll, when
 *                                       yesterday's sales leave the window
 *
 * Both existed to manufacture a window the sheet does not publish. It
 * publishes this one. Reading it is better on every axis that matters:
 *
 *   MONOTONIC     a figure only ever rises, so any movement on the board is a
 *                 sale. Nothing drops because a clock ticked.
 *   NO STORAGE    no localStorage, no marks, no cold start. A browser that has
 *                 never seen this wall shows the right numbers immediately.
 *   PORTABLE      the same number on the TV and on a phone, so /live and
 *                 /daily can agree again instead of measuring different things.
 *   INVISIBLE     the reset lands at midnight, when the building is empty.
 *
 * The cost is that at 8am the board is eight hours old, not twenty-four, so it
 * is sparse in the morning and fills through the day. That is what a "today"
 * board is, and the heading says so.
 *
 * One behaviour to know: the sum is by the sale's own DATE, so a sale logged
 * this morning against yesterday lands in yesterday's bucket and never appears
 * on today's board. Late logging under-reports today rather than inflating it.
 */


/* ── Fit the 1920x1080 board to whatever screen it lands on ──
 * A laptop driving a TV over HDMI does not always hand the browser exactly
 * 1920x1080 — 1280x720 output, a window that is not full height, and a 4K
 * panel all differ — and the board must be the same board on every one of
 * them. Set as a bare number on the root so `.tv`'s scale() can read it. */
function fitToScreen() {
  const fit = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
  document.documentElement.style.setProperty('--fit', String(fit))
}
fitToScreen()
window.addEventListener('resize', fitToScreen)

import { PEOPLE_PHOTOS, TEAM_LINKS, TEAM_PEOPLE } from '@/config'
import { photoSrc } from '@/lib/lineup'
import { competingTeams, rankByChallenge, rankByToday, rankByWeek, rankTeams } from '@/lib/ranking'
import { hashTeamId } from '@/lib/seed'
import { titleCase } from '@/lib/team'
import type { BoardMode, Team, TeamId } from '@/lib/types'

/**
 * Everything `/live` knows that is not a pixel. Pure: no clock, no storage, no
 * DOM — `live.test.ts` scans for them, the way `ranking.test.ts` does.
 *
 * ── `/live` is a reader of the wall's rules, not a second copy of them ──
 *
 * The all-time board ranks with `rankTeams`, which is `/podium`'s comparator to
 * the line. A phone that disagreed with the TV in the corridor about who is
 * fourth would be worse than no phone.
 *
 * ── The period board followed `/daily` and now only half can ──
 *
 * It used to call `rankForMode` directly, so the phone's middle tab *was*
 * `/daily`'s board, week or challenge, decided by the same cell. In challenge
 * mode that is still exactly what happens: `rankByChallenge` is the comparator
 * `rankForMode` reaches for, and `challenge_revenue` is a published column both
 * devices read.
 *
 * The rest of the time it cannot be, and the reason is physical rather than a
 * choice. `/daily`'s figure is no longer a column: it is a **finished day**,
 * 10:00 to 10:00, computed from two photographs of `total_revenue` that the
 * laptop driving the TV took and kept in its own `localStorage` — see
 * `lib/daily.ts`. A phone is a different machine. It has never held those marks
 * and cannot be handed them without this project growing the backend it does not
 * have.
 *
 * So the phone's period tab keeps the **week**, and says `Last 7 days`. That is
 * not a fudge of the wall's board, it is a different published figure under its
 * own honest label, and it is the more useful of the two on a phone: somebody
 * holding this wants *live*, and the tab beside it — `Today`, `today_revenue`,
 * current to the last poll — is the live daily board the wall's locked one
 * cannot be.
 *
 * **And that tab agrees with `/weekly` again from 21 September 2026.** The
 * divergence this comment used to end by conceding was real and was worse than
 * it sounds: the wall's weekly board moved to a rolling seven days and the phone
 * stayed on the programme week, so the same label sat over ₹6,94,123 and ₹5,274
 * on the same afternoon. Both surfaces now take the figure from
 * `periodRevenueOf` in `lib/feed.ts`, which prefers `last7_revenue`, so the
 * agreement is structural rather than remembered. The divergence that remains is
 * the intended one above: the phone's period tab is a week and the wall's
 * `/daily` is a locked day, and those are different boards rather than two
 * spellings of one.
 *
 * Today's comparator (`compareToday`) lives in `lib/ranking.ts` beside the
 * others for the same reason they all do.
 */

export type BoardKey = 'all' | 'period' | 'today'

export const BOARD_KEYS: readonly BoardKey[] = ['all', 'period', 'today']

export type Standing = {
  team: Team
  /** 1-based. Every comparator is a total order, so a rank is just a position. */
  rank: number
  /** The figure this board ranks on. */
  figure: number
}

export function figureOf(key: BoardKey, mode: BoardMode, team: Team): number {
  if (key === 'all') return team.totalRevenue
  if (key === 'today') return team.todayRevenue
  // Read off the row in both modes, which is what keeps this page a reader of
  // published columns. The wall's daily window is not one of them.
  return mode === 'challenge' ? team.challengeRevenue : team.weekRevenue
}

/** One board, ranked, spares removed. */
export function standingsFor(key: BoardKey, mode: BoardMode, teams: readonly Team[]): Standing[] {
  const competing = competingTeams(teams)
  const ranked =
    key === 'all'
      ? rankTeams(competing)
      : key === 'today'
        ? rankByToday(competing)
        : mode === 'challenge'
          ? rankByChallenge(competing)
          : rankByWeek(competing)
  return ranked.map((team, index) => ({ team, rank: index + 1, figure: figureOf(key, mode, team) }))
}

/**
 * The tab's label. Short, because three of them share a phone's width.
 *
 * `Last 7 days` rather than `This week` from 21 September 2026, because the
 * figure behind it is a rolling window and `This week` said otherwise. Measured
 * before it went in: 78.6px in a 94px chip at 320px, the narrowest phone this
 * page is built for, so it fits everywhere the old label did. It is the longest
 * of the three and the grid is `repeat(3, 1fr)`, so a longer one still needs
 * measuring rather than eyeballing.
 */
export function boardLabel(key: BoardKey, mode: BoardMode): string {
  if (key === 'all') return 'All-time'
  if (key === 'today') return 'Today'
  return mode === 'challenge' ? '10-Day' : 'Last 7 days'
}

/**
 * What the figure on this board is, in words, for the team sheet.
 *
 * **All four read `<window> revenue`, in that order.** `.lv-label` is uppercase
 * at 0.2em, and at that tracking the eye lands on the first word; leading with
 * the window is what lets someone flicking between tabs see which board they
 * are on without reading the whole label. `Revenue today` led with the word
 * every tab shares, which made the three captions look identical at a glance.
 */
export function figureLabel(key: BoardKey, mode: BoardMode): string {
  if (key === 'all') return 'All-time revenue'
  if (key === 'today') return 'Today revenue'
  return mode === 'challenge' ? '10-Day Challenge revenue' : 'Last 7 days revenue'
}

/**
 * An avalanche step before the modulus.
 *
 * Every id is `VBC1` plus two digits, and `hashTeamId` is a polynomial hash, so
 * its low bits are decided almost entirely by the last two characters — `% 12`
 * straight off it bunches. `lib/seed.ts` records the same trap for `% 3`.
 */
function mix(value: number): number {
  let h = value
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

export const LIVERY_COUNT = 39
export const EMBLEM_COUNT = 12

/**
 * The wall's locked map, `TEAM_LIVERY` in `public/tv/tv.js`, so a venture is
 * the same colour here as on `/weekly`. `lib/tvWall.test.ts` holds the two equal.
 */
const TEAM_LIVERY: Readonly<Record<string, number>> = Object.fromEntries(
  Array.from({ length: LIVERY_COUNT }, (_, i) => [`VBC${101 + i}`, i + 1]),
)

/**
 * 1–39, matching `--lv-N-*` in `forge-tokens.css` §8. Keyed by id, so a climb
 * never recolours a team; an id the map has never seen falls back to the same
 * hash the wall uses.
 */
export function liveryFor(teamId: TeamId): number {
  return TEAM_LIVERY[teamId] ?? (mix(hashTeamId(teamId)) % LIVERY_COUNT) + 1
}

/**
 * 0–11. Drawn from different bits than the livery, so two teams sharing a
 * colour — as F1 teammates do — are still told apart by their mark.
 */
export function emblemFor(teamId: TeamId): number {
  return (mix(hashTeamId(teamId)) >>> 8) % EMBLEM_COUNT
}

export type Race = {
  self: Standing
  leader: Standing
  /** The team one place up, or `undefined` for the leader. */
  ahead?: Standing
  /** The team one place down, or `undefined` for last. */
  behind?: Standing
  total: number
}

/** Where a team is on one board, and who is either side of it. `null` if it is not on the board. */
export function raceFor(standings: readonly Standing[], teamId: TeamId): Race | null {
  const at = standings.findIndex((s) => s.team.teamId === teamId)
  if (at === -1) return null
  return {
    self: standings[at]!,
    leader: standings[0]!,
    ahead: standings[at - 1],
    behind: standings[at + 1],
    total: standings.length,
  }
}

/**
 * Places gained since last week's close, on the all-time board only.
 *
 * `prev_week_rank` ranks the cumulative figure, so it can only be compared
 * with the all-time rank — against the week or today it would be comparing
 * two different contests. `null` when the sheet does not publish it, or the
 * team had no standing then (see `Team.prevWeekRank`).
 */
export function climbOf(key: BoardKey, standing: Standing): number | null {
  if (key !== 'all' || standing.team.prevWeekRank === undefined) return null
  return standing.team.prevWeekRank - standing.rank
}

/** Revenue per unit, or `null` before the first unit — a ₹0 average is not a price. */
export function avgTicket(team: Team): number | null {
  return team.totalUnits > 0 ? team.totalRevenue / team.totalUnits : null
}

/** This team's slice of the whole board's figure, 0–1, or `null` when the board is empty. */
export function shareOf(standings: readonly Standing[], teamId: TeamId): number | null {
  const total = standings.reduce((sum, s) => sum + Math.max(0, s.figure), 0)
  if (total <= 0) return null
  const self = standings.find((s) => s.team.teamId === teamId)
  return self === undefined ? null : Math.max(0, self.figure) / total
}

/**
 * What kind of thing a venture sells, guessed from its own words.
 *
 * `product` is free text a team typed into its workbook, so this is a reading
 * of *wording*, not a taxonomy: the first list whose word appears wins, and
 * anything unrecognised is `other`, which draws a neutral tag. A wrong icon
 * would be a small lie about a venture; a neutral one says only "a product".
 *
 * Order matters. `hair oil` is beauty and `chilli oil` is food, so the
 * specific phrases are matched before the loose words, and food is asked
 * after fragrance so a `camphor` diffuser is not read as a snack.
 */
export type Sells =
  | 'snack'
  | 'bakery'
  | 'drink'
  | 'beauty'
  | 'fragrance'
  | 'apparel'
  | 'jewellery'
  | 'home'
  | 'stationery'
  | 'craft'
  | 'other'

const SELLS: readonly (readonly [Sells, readonly string[]])[] = [
  ['beauty', ['hair oil', 'face', 'skin', 'serum', 'lip', 'aloe', 'neem', 'soap', 'balm', 'shampoo', 'scrub', 'mist']],
  ['fragrance', ['perfume', 'attar', 'fragrance', 'candle', 'incense', 'camphor', 'wax melt', 'scent', 'diffuser', 'oud']],
  ['drink', ['coffee', 'tea ', 'tea,', 'chai', 'juice', 'kombucha', 'brew', 'drink', 'beverage', 'smoothie', 'shake', 'lemonade']],
  ['bakery', ['cake', 'cookie', 'brownie', 'bread', 'sourdough', 'bake', 'chocolate', 'dessert', 'sweet', 'mithai', 'laddoo', 'granola']],
  ['snack', ['chips', 'namkeen', 'makhana', 'peanut', 'snack', 'pickle', 'masala', 'chilli', 'spice', 'millet', 'protein', 'jam', 'honey']],
  ['jewellery', ['jewel', 'earring', 'silver', 'ring', 'bead', 'pendant', 'charm', 'anklet', 'bracelet']],
  ['apparel', ['shirt', 'tee', 'apparel', 'wear', 'stole', 'scarf', 'denim', 'linen', 'sock', 'dress', 'scrunchie', 'clothing']],
  ['home', ['planter', 'mug', 'ceramic', 'decor', 'cushion', 'napkin', 'coaster', 'terracotta', 'pottery', 'lamp', 'home']],
  ['stationery', ['notebook', 'paper', 'sticker', 'journal', 'print', 'card', 'poster']],
  ['craft', ['macrame', 'crochet', 'resin', 'handmade', 'craft', 'knot', 'art', 'bamboo', 'upcycled', 'tote', 'pouch', 'bag']],
]

export function sellsCategory(product: string): Sells {
  const text = product.toLowerCase()
  for (const [category, words] of SELLS) {
    if (words.some((word) => text.includes(word))) return category
  }
  return 'other'
}

/**
 * The students on a team, split out of the one cell the sheet keeps them in.
 *
 * **Every separator here was measured in the live master**, not imagined. The
 * forty-one cells are written at least five ways:
 *
 *     TANISHQUE JAIN, NIRMALYA SAH, SACHIDANANDA DEHURY   all caps
 *     Harsh Malani, Meith Jain and Ritesh Oswal           the last one joined by "and"
 *     Aarav, Divy, Tushar.                                a trailing full stop
 *     happy panjwani, diya harish , rishika choudhary     lowercase, stray spaces
 *     Aarav, Preethi S, Udhav Kothari                     an initial as a surname
 *
 * `titleCase` from `lib/team.ts` does the casing, which is the same rule the
 * whole project uses on venture names: a name with both cases in it is left
 * exactly as typed, so `Preethi S` keeps its initial and `McCarthy` would keep
 * its capital, while an all-caps or all-lowercase name is normalised.
 *
 * **The cap is six.** The largest real team is four; six leaves room without
 * letting a pasted paragraph become a wall of faces.
 */
export const MAX_MEMBERS = 6

export function membersOf(team: Team): string[] {
  const raw = (team.members ?? '').trim()
  if (raw === '') return photographedRoster(team.teamId)
  return raw
    .split(/\s*(?:,|;|\band\b|&|\+)\s*/i)
    // Trailing punctuation, and anything that is not a name at all.
    .map((name) => name.replace(/[.\s]+$/, '').trim())
    .filter((name) => /\p{L}/u.test(name))
    .map(titleCase)
    .filter((name, index, all) => all.indexOf(name) === index)
    .slice(0, MAX_MEMBERS)
}

/**
 * Who is on a team according to the photographs themselves.
 *
 * **A fallback for exactly one situation, and it is the situation production
 * is in.** `members` is an optional `TV_Feed` column and the published sheet
 * does not carry it yet — so the deployed site had no roster, and with no
 * roster there was nothing to hang a photograph on: every squad rendered
 * empty while the same page on a laptop, reading a fixture built from the
 * master, was full of faces.
 *
 * `PEOPLE_PHOTOS` already knows which students belong to which team — that is
 * what `<TEAM_ID>/<slug>` means — so the faces can be shown from the manifest
 * alone. The slug goes back to a name well enough for a screen reader and
 * exactly enough for `photoSlug` to round-trip.
 *
 * **What it cannot do is the reason to still publish the column.** A student
 * with no photograph is invisible here, because nothing in the repo knows
 * they exist: the twelve who are initials on a laptop are simply absent on
 * production, and so are every product and every link. The moment `members`
 * is published this branch stops running and the sheet decides again —
 * including the order people stand in.
 */
function photographedRoster(teamId: TeamId): string[] {
  const prefix = `${teamId}/`
  return PEOPLE_PHOTOS.filter((entry) => entry.startsWith(prefix))
    .map((entry) =>
      entry
        .slice(prefix.length)
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
    )
    .slice(0, MAX_MEMBERS)
}

/**
 * Where a student's photograph lives, if one has been committed:
 * `public/people/<TEAM_ID>/<slug>.webp`.
 *
 * The slug is derived from the name so a photograph needs no mapping file —
 * `scripts/prepare-people.py` writes the file and the manifest entry
 * together, exactly as `prepare-logos.py` does for a venture's mark.
 */
export function photoSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** A person's initials, for the placeholder portrait. `Preethi S` → `PS`. */
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => /\p{L}/u.test(word))
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]!.charAt(0) + words[words.length - 1]!.charAt(0)).toUpperCase()
}

/**
 * A venture's own links, turned into something a browser may open — or
 * `null`.
 *
 * ── These cells are untrusted input ──
 *
 * `TV_Feed` is published from a workbook forty teams type into. Putting a cell
 * straight into an `href` means a cell reading `javascript:…` becomes script
 * on a page other people open, and `data:` means a page that looks like this
 * one and is not. So the scheme is decided **here** and only `https` is ever
 * produced: a handle becomes a profile URL, a bare domain gets `https://`, and
 * anything already carrying a scheme must be `http(s)` or it is refused.
 *
 * The parse layer deliberately does not do this — `lib/feed.ts` judges whether
 * the sheet's *shape* is trustworthy; whether a string is a safe URL is a
 * different question and belongs where it is used.
 */
const HANDLE = /^[A-Za-z0-9._]{1,30}$/

/**
 * A venture's own links, preferring the sheet and falling back to the manifest.
 *
 * **The sheet always wins.** `TV_Feed` publishes eight columns and `website` /
 * `instagram` are not among them, so `TEAM_LINKS` in `config.ts` is what
 * production actually reads today — transcribed from `Team Links`, which has
 * carried both all along. The moment those columns are selected into
 * `TV_Feed`, every published cell takes over here and the manifest stops being
 * consulted for that team, so a venture that changes its own Instagram is
 * right on the next poll rather than at the next deploy.
 *
 * Per FIELD rather than per team, deliberately. A team with a published
 * website and no published Instagram should keep the Instagram the manifest
 * knows about, rather than losing it because the row went half-silent.
 *
 * The raw cell is returned, never a URL: whether a string is safe to put in an
 * `href` is `instagramUrl` / `websiteUrl`'s job, and answering it in two
 * places is how two answers drift apart. `lib/live.test.ts` pins that nothing
 * in the manifest is refused by them.
 */
export function linksOf(team: Team): { website?: string; instagram?: string; facebook?: string } {
  const fallback = TEAM_LINKS[team.teamId] ?? {}
  const pick = (cell: string | undefined, spare: string | undefined) => {
    const value = (cell ?? '').trim()
    return value !== '' ? value : spare
  }
  return {
    website: pick(team.website, fallback.website),
    instagram: pick(team.instagram, fallback.instagram),
    // No `TV_Feed` column carries Facebook, so the manifest is the only source.
    facebook: fallback.facebook,
  }
}

export function instagramUrl(raw: string | undefined): string | null {
  const value = (raw ?? '').trim()
  if (value === '') return null

  // A full profile URL, in any of the forms people paste: with or without a
  // scheme, with or without `www.`, with or without a trailing slash or query.
  const asUrl = value.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#\s]+)/i)
  const handle = (asUrl?.[1] ?? value).replace(/^@/, '')
  return HANDLE.test(handle) ? `https://instagram.com/${handle}` : null
}

export function websiteUrl(raw: string | undefined): string | null {
  const value = (raw ?? '').trim()
  if (value === '') return null
  // A scheme that is not http(s) — `javascript:`, `data:`, `file:` — is
  // refused outright rather than repaired.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  // A hostname with a dot and no spaces. `localhost`, an IP, or a stray
  // sentence in the cell are all not a venture's website.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return null
  url.protocol = 'https:'
  return url.toString()
}

/**
 * A Facebook page, and only a Facebook page. The cell goes through
 * `websiteUrl` for the scheme and hostname checks, and is then refused unless
 * the host is Facebook's own — a cell under a "Facebook" label that opens
 * somewhere else is the same lie as a wrong logo.
 */
export function facebookUrl(raw: string | undefined): string | null {
  const href = websiteUrl(raw)
  if (href === null) return null
  const host = new URL(href).hostname.toLowerCase()
  return /^(?:(?:www|m|web)\.)?(?:facebook\.com|fb\.com)$/.test(host) ? href : null
}

/**
 * A LinkedIn profile, and only a profile — returned as one canonical URL.
 *
 * The tracker's cells come in every shape a phone's share sheet produces:
 * `in.linkedin.com`, no scheme, `http:`, and a tail of `utm_*` or `trk=`. All
 * of that is dropped; what is kept is the one path segment after `/in/`, which
 * is the profile. Anything else — a company page, a post, a `share.google`
 * short link — is refused, because a row that says LinkedIn and opens
 * somewhere else is the same lie as a wrong logo.
 */
export function linkedinUrl(raw: string | undefined): string | null {
  const href = websiteUrl(raw)
  if (href === null) return null
  const { hostname, pathname } = new URL(href)
  if (!/^(?:[a-z]{2,3}\.)?linkedin\.com$/i.test(hostname)) return null
  const slug = pathname.match(/^\/in\/([^/]+)\/?$/)?.[1]
  if (slug === undefined || !/^[\p{L}\p{N}_-]{2,100}$/u.test(decodeURIComponent(slug))) return null
  return `https://www.linkedin.com/in/${slug}`
}

/**
 * The students behind a venture, from `TEAM_PEOPLE` — or nobody.
 *
 * **This is the only source, not a floor.** `TV_Feed` has no LinkedIn column
 * and the roster in `membersOf` is a string of names with nothing to hang a
 * link on, so unlike `TEAM_LINKS` there is no published cell to prefer. A
 * team missing from the manifest gets no section at all.
 */
export function peopleOf(teamId: TeamId): { name: string; linkedin: string | null; photo: string | null }[] {
  return (TEAM_PEOPLE[teamId] ?? []).map((person) => ({
    name: person.name,
    linkedin: linkedinUrl(person.linkedin),
    // Only a photograph that is actually listed — the `PEOPLE_PHOTOS` rule.
    photo:
      person.photo !== undefined && PEOPLE_PHOTOS.includes(`${teamId}/${person.photo}`)
        ? photoSrc(teamId, person.photo)
        : null,
  }))
}

/** What a link is called on screen. `instagram.com/aks.perfumes` reads as a lockup; a full URL does not. */
export function linkLabel(url: string): string {
  const { hostname, pathname } = new URL(url)
  const host = hostname.replace(/^www\./, '')
  const path = pathname.replace(/\/$/, '')
  // `facebook.com/profile.php` and `facebook.com/share/1JxswCt3Wo` name no one.
  if (/^(?:m\.)?facebook\.com$/.test(host) && /^\/(?:profile\.php|share)(?:\/|$)/.test(path)) return 'facebook.com'
  return `${host}${path}`
}

/** Case- and accent-insensitive search over venture name, team id and the team's students. */
export function matchesQuery(team: Team, query: string): boolean {
  const needle = fold(query.trim())
  if (needle === '') return true
  return fold(team.ventureName).includes(needle) || fold(team.teamId).includes(needle)
    || memberMatch(team, query) !== null
}

/**
 * The student a search found this team by, or null.
 *
 * Search by a person's name, added 25 September 2026: "which team is Preethi
 * on" is the question a phone gets asked most, and the answer was only
 * findable by opening teams one at a time. Reads the same two rosters the
 * team sheet does — `TEAM_PEOPLE` (names written by hand) and `membersOf`
 * (the sheet's cell, or the photographs) — so anyone shown on a team can be
 * found by name. Matches any part of the name, case- and accent-blind.
 */
export function memberMatch(team: Team, query: string): string | null {
  const needle = fold(query.trim())
  if (needle === '') return null
  const names = [...peopleOf(team.teamId).map((p) => p.name), ...membersOf(team)]
  return names.find((name) => fold(name).includes(needle)) ?? null
}

/** Case- and accent-blind text, for search. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

import Image from 'next/image'

import { LOGOS } from '@/config'
import { hashTeamId } from '@/lib/seed'
import type { Team } from '@/lib/types'

/**
 * A venture's mark: its logo if one has been committed, otherwise a two-letter
 * monogram on a tinted disc.
 *
 * **The monogram is not a fallback, it is the wall.** `LOGOS` is empty — see
 * `config.ts` for why the placeholder set had to go — so today every mark on
 * both slides is one of these. It gets the same care as the logo path; if it
 * looked like an error state, the whole wall would look broken.
 *
 * ── One letter became two ──
 *
 * Measured over the 41-row design fixture, which is the widest set of real
 * venture names this project has:
 *
 *     single initial   20 distinct   8 collision groups   29 of 41 teams
 *                      worst: S×8, A×5, T×4
 *     two letters      33 distinct   5 collision groups   13 of 41 teams
 *                      worst: SN×3, AA×3, SO×3
 *
 * **Not zero, and it is not trying to be.** Two letters more than halve the
 * teams caught in a collision, and they read as a monogram rather than as a
 * truncation — `Banana Chips` is `BC`, the way a venture would write it on a
 * stamp. Pushing to zero means abandoning that: `Snackerly` would have to
 * become `SY` or `SK` to clear `Snapper`, which is a code rather than a
 * monogram, and every team would carry one so that three of them could be
 * told apart.
 *
 * **The name is printed directly under every mark**, on both slides and in the
 * footer. The monogram is what makes a disc an identity at six metres; the name
 * is what resolves it. A pair of collided marks in different tints — and three
 * of the five groups do collide on tint as well — is two cards a passer-by
 * tells apart by reading one word, which is what they were going to do anyway.
 *
 * ── This component owns its own mount ──
 *
 * The white disc under a mark used to be painted by whatever was holding it —
 * `.tv-disc-face` on `/daily`, `.tv-pod-disc` and `.tv-pod-row-mark` on
 * `/podium`, `.tv-pod-mover-mark` in the footer. Four places, one decision, and
 * the decision is not theirs: a white ground exists so pale *artwork* has an
 * edge, and a tinted monogram is its own ground. With the mounts painting it
 * unconditionally, every monogram wore a white ring it did not ask for.
 *
 * So the mount moved in here, where the branch already is. A holder is now a
 * plain round box and this fills it: white with the artwork inset for a logo,
 * edge-to-edge tint for a monogram.
 */

/**
 * Six tints, and **they are surface tokens, not brand colours named here.**
 *
 * They used to be six `var(--...)` strings in this file, half of which inverted
 * on a dark page — `--deep-teal` is "deepest brand surface", which on
 * `.surface-dark` *is* the page, so one team in six drew an invisible disc. The
 * tokens resolve per surface now; see §6 of `app/forge-tokens.css` for the
 * ramp and the measured contrast of each.
 *
 * Assigned by hashing the team ID rather than by rank, so a venture keeps the
 * same colour as it climbs — the mark is an identity, and one that changed
 * colour on promotion would read as a different venture.
 */
const TINTS = [
  'var(--mark-1)',
  'var(--mark-2)',
  'var(--mark-3)',
  'var(--mark-4)',
  'var(--mark-5)',
  'var(--mark-6)',
] as const

/**
 * A venture's tint.
 *
 * **Exported, because the podium's list rows are keyed by it.** A row that
 * carries a whisper of its venture's own colour is a row whose 44px mark is
 * doing something rather than sitting there as a coloured dot — and the tint
 * has to come from *here*, because the assignment is a hash of the team id and
 * a second implementation of that hash is a row whose wash disagrees with the
 * mark sitting on it.
 */
export function tintFor(teamId: string): string {
  return TINTS[hashTeamId(teamId) % TINTS.length]
}

/** Words that are never the venture, only its grammar. */
const ARTICLES = new Set(['the', 'a', 'an'])

/**
 * A venture's two letters.
 *
 * `Banana Chips` → `BC`. `Apple` → `AP`. Two words give their two initials; one
 * word gives its first two letters.
 *
 * **A leading article is dropped**, so `The Nibble Co` is `NC` rather than `TN`.
 * Five of the current thirty-nine start with `The`, and without this they
 * collapse onto `T?` and the monogram stops distinguishing exactly the teams it
 * exists to distinguish.
 *
 * A team with no venture name yet gets the last two characters of its team ID —
 * `VBC107` → `07` — which is unique across the cohort and agrees with the label
 * printed under the mark, since `nameOf` gives that team its ID as a name. A
 * nameless team fires no trigger but it still appears on the board, and it
 * needs *something* in its disc.
 *
 * Exported for `render.test.tsx`: the collision count across a cohort is the
 * property worth pinning, and it is not visible in a rendered disc.
 */
export function monogramFor(team: Team): string {
  const words = team.ventureName
    // **Parentheses are an expansion, not the name.** `ATC (All Things
    // Camphor)` is the venture `ATC`; without this the second "word" is `(All`
    // and the monogram came out `A(` — measured on the running board, a bracket
    // rendered as half a venture's identity at 44px.
    .replace(/\([^)]*\)/g, ' ')
    .trim()
    .split(/\s+/)
    // Punctuation-only tokens are not words. `Wake & Wyze` is `WW`, not `W&`.
    .map((word) => word.match(/[\p{L}\p{N}][\p{L}\p{N}']*/u)?.[0] ?? '')
    .filter((word) => word !== '')

  if (words.length > 0) {
    const named =
      words.length > 1 && ARTICLES.has(words[0]!.toLowerCase()) ? words.slice(1) : words
    if (named.length > 1) return (named[0]!.charAt(0) + named[1]!.charAt(0)).toUpperCase()
    // One word: its first two letters, or its one letter if that is all there
    // is. `S` stays `S` — a monogram that invented a second character would be
    // naming a venture something it is not called.
    return named[0]!.slice(0, 2).toUpperCase()
  }

  const id = team.teamId.replace(/[^\p{L}\p{N}]/gu, '')
  return id.slice(-2).toUpperCase()
}

/**
 * `size` takes a number of pixels, or any CSS length.
 *
 * **Callers pass the mount's full diameter.** They used to pass a fraction of it
 * — `calc(var(--d-pod-disc) * 0.93)` — because the mount was the white disc and
 * the mark had to sit inside it. The inset belongs to the artwork, not to the
 * mark, so it is applied below and only on the branch that needs it.
 *
 * A CSS length rather than only a number because a mark that stayed put while
 * every dimension around it scaled was measured climbing into the header band
 * at 1600x900.
 */
export function VentureLogo({ team, size }: { team: Team; size: number | string }) {
  const dim = typeof size === 'number' ? `${size}px` : size

  /**
   * ── The mark is its own container, and that is a safety property ──
   *
   * Everything inside a mark used to be derived from `size` with `calc()`: the
   * monogram at `size * 0.36`, its optical offset at `size * 0.035`, the
   * artwork's inset at `size * 0.93`. That is correct arithmetic and it forced
   * every caller to pass a **length**, because a percentage in a `font-size`
   * resolves against the parent's font size rather than against the disc.
   *
   * `/podium` therefore passed `100cqw`, leaning on a `container-type` declared
   * in the stylesheet one level up — and **when that declaration did not
   * arrive, `cqw` fell back to the viewport and one venture's mark rendered
   * 1920px wide, over the entire wall.** Twice, from a stale dev build. The
   * board is unattended for weeks and this project's stated bar is that a bug
   * which renders convincingly is the dangerous kind; a bug that renders
   * catastrophically off a *missing* rule is worse, because nothing about the
   * component said it needed one.
   *
   * So the container is declared **here, inline, on the element the units
   * measure** — it cannot be absent, because it ships with the thing that
   * reads it. `100%` is now a safe `size`, the disc can never exceed its
   * holder, and the only thing a lost stylesheet can cost is the letters being
   * the wrong size inside a correctly-sized circle.
   */
  const box: React.CSSProperties = {
    width: dim,
    height: dim,
    containerType: 'inline-size',
  }

  if (LOGOS.includes(team.teamId)) {
    return (
      <div
        style={{
          width: dim,
          ...box,
          borderRadius: '50%',
          // The white ground, here rather than on the holder. Artwork is the
          // only thing that needs it: several of these files are drawn dark on
          // transparency and several are white to their own edge, so without a
          // ground the first kind vanishes on a dark page and the second has no
          // shape on a light one.
          background: 'var(--white)',
          display: 'grid',
          placeItems: 'center',
          // The only thing giving a cream-to-the-edge mark a silhouette.
          boxShadow: 'inset 0 0 0 var(--stroke-hair) var(--hairline-strong)',
        }}
      >
        <Image
          src={`/logos/${team.teamId}.png`}
          alt={team.ventureName || team.teamId}
          // Intrinsic hints for the image loader only; the CSS below sizes it.
          width={200}
          height={200}
          style={{
            // The inset that used to live at every call site. Container units,
            // so it is a share of the disc rather than of whatever `size` was
            // written as — see the note at `box`.
            width: '93cqw',
            height: '93cqw',
            // A disc, because the source artwork is one. `prepare-logos.py`
            // masks every logo to a circle with transparent corners, so a
            // rounded-square radius here would draw a square ring around a
            // round mark and clip nothing.
            borderRadius: '50%',
            objectFit: 'contain',
          }}
          unoptimized
        />
      </div>
    )
  }

  return (
    <div
      aria-label={team.ventureName || team.teamId}
      role="img"
      style={{
        ...box,
        // A disc, so a venture that has drawn a mark and one that has not sit in
        // the same shape. A rounded square beside a circle reads as a missing
        // logo; the same disc in a brand tint reads as a venture that has not
        // drawn one yet, which is the honest difference.
        borderRadius: '50%',
        background: tintFor(team.teamId),
        // **One ink for all six tints**, because on either surface all six sit
        // on the same side of the page's value — light fills on the dark slide,
        // dark fills on the light one. The branch this replaced kept a set of
        // "tints light enough to need dark type", which is a rule that has to be
        // re-derived by hand every time a tint changes.
        color: 'var(--mark-ink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* ── The letters are a child, and that is not cosmetic ──
       *
       * **An element cannot query its own container.** `cqw` resolves against
       * the nearest *ancestor* that declares one, so a `font-size: 36cqw` on
       * the same div that carries `container-type` looks straight past it —
       * and with no container above, it falls back to the viewport. Measured:
       * 36vw is a 691px monogram, which rendered as letterforms lying across
       * the whole wall on both slides.
       *
       * One `<span>` fixes it, because a child of the container is exactly
       * what the unit is for. Everything sized off the disc lives here. */}
      <span
        style={{
          // Optically centred: capitals sit high in their em box, so centring
          // the box leaves the letters looking a touch above centre in a circle.
          lineHeight: 1,
          paddingTop: '3.5cqw',
          fontFamily: 'var(--font-sans)',
          fontWeight: 800,
          // 0.36, where a single initial took 0.52. Two letters in a circle are
          // bound by the *chord* at the letters' own height rather than by the
          // diameter, and at 0.52 a two-letter monogram overran its disc.
          fontSize: '36cqw',
          letterSpacing: '0.01em',
        }}
      >
        {monogramFor(team)}
      </span>
    </div>
  )
}

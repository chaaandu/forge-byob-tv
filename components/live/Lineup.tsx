import Image from 'next/image'

import { PEOPLE_PHOTOS } from '@/config'
import { lineup } from '@/lib/lineup'
import { initialsOf, membersOf, peopleOf, photoSlug } from '@/lib/live'
import type { Team } from '@/lib/types'

/**
 * The team's squad, overlapping in the sheet's header — the way an esports
 * line-up card stacks its players rather than listing them.
 *
 * **No names, and the photographs bleed off the bottom of the header.** The
 * heads are the information; a caption under each 58px crop would be four
 * ellipsised first names. Whose face is whose is answered by the roster the
 * cohort already knows, and by the sheet's own header saying which venture
 * this is.
 *
 * ── A photograph is never requested unless it exists ──
 *
 * Presence is read from `PEOPLE_PHOTOS` in `config.ts`, never from the
 * filesystem — the same rule `LOGOS` follows, and for the same reason: an id
 * in the list with no file behind it is a broken image on somebody's phone,
 * and a file on disk missing from the list is simply invisible. The file and
 * its manifest entry arrive in one commit, written together by
 * `scripts/prepare-people.py`.
 *
 * ── No photograph, no figure ──
 *
 * A student without one used to get a drawn silhouette carrying their
 * initials. Removed on request: the line-up is a photograph of a team, and a
 * drawn stand-in beside real cutouts reads as a gap rather than as a person.
 *
 * **Nothing is invented in its place.** No stock face, no borrowed one — that
 * would be the `LOGOS` mistake with a person's face in it, and this file's
 * whole reason for reading `PEOPLE_PHOTOS` rather than the filesystem is that
 * it will only ever show a photograph that exists.
 *
 * What it costs: a student who missed the shoot is now absent from their
 * team's line-up rather than present as a silhouette, and a team where nobody
 * has a photograph renders no squad at all. In production today that changes
 * nothing — `TV_Feed` publishes no `members` column, so `membersOf` falls back
 * to the photographs themselves and everyone listed has one by construction.
 * It starts to matter the day that column is published.
 */
export function Squad({ team }: { team: Team }) {
  const members = membersOf(team)
  if (members.length === 0) return null

  /**
   * Only the people there is a photograph of, in the roster's own order.
   *
   * This used to sort faces first and stand the silhouettes at the right-hand
   * end, so a missing photograph read as the end of the row rather than as a
   * gap in the middle of it. With no silhouettes left there is nothing to
   * sort: the ones without a photograph simply are not here, and everybody
   * else keeps the order the sheet listed them in.
   */
  const shown = members.filter((name) =>
    PEOPLE_PHOTOS.includes(`${team.teamId}/${photoSlug(name)}`),
  )
  if (shown.length === 0) return null

  /* Order and layering come from `lineup` — the same rule the wall uses, so a
     team stands the same way on the TV and on a phone. It replaced "leftmost
     in front", which put bodies cut by their photo's frame over clean ones. */
  const nameOf = new Map(shown.map((name) => [photoSlug(name), name]))
  const placed = lineup(team.teamId, shown.map(photoSlug))

  return (
    /* ── One frame, and the fade belongs to it ──
     *
     * `.lv-squad` is the frame the whole line-up is drawn into, and
     * `live.css` puts the bottom gradient THERE rather than on each figure.
     * Per figure it made every body translucent in its last fifth, and the
     * figures overlap by nearly half their width, so the person behind showed
     * through the person in front. One frame flattens the group first, so an
     * overlap is opaque and only the outside edge softens. */
    <div className="lv-squad" aria-label={`Team: ${shown.join(', ')}`} role="img">
      {placed.map((p) => (
        <Person
          key={p.slug}
          name={nameOf.get(p.slug) ?? p.slug}
          src={p.src}
          cut={[p.cutL !== null && 'cut-l', p.cutR !== null && 'cut-r'].filter(Boolean).join(' ')}
          cutAt={{ ...(p.cutL !== null && { '--cl': `${p.cutL}%` }), ...(p.cutR !== null && { '--cr': `${p.cutR}%` }) } as React.CSSProperties}
          style={{ zIndex: p.z }}
        />
      ))}
    </div>
  )
}

function Person({
  name,
  src,
  cut,
  cutAt,
  style,
}: {
  name: string
  src: string
  cut: string
  cutAt: React.CSSProperties
  style: React.CSSProperties
}) {
  return (
    <span className="lv-person" style={style} title={name}>
      <Image
        className={cut || undefined}
        style={cutAt}
        src={src}
        alt=""
        width={256}
        height={256}
        unoptimized
      />
    </span>
  )
}

/**
 * The students behind a venture, by name, each one a way to reach them.
 *
 * **This is where the names are, which is why the squad has none.** The
 * header's line-up is faces with no captions, on purpose; this is the list a
 * person reads when they want to know *who*, and it sits beside the venture's
 * own links because both answer the same question — how do I get in touch.
 *
 * **One card, a row per person**, in the same anatomy as the Venture card
 * above it — see `Venture` in `TeamSheet.tsx` for why the foot of the sheet
 * is those two cards and nothing else. A row with a profile is a link, whole
 * row, 52px tall so a thumb finds it; a row without one is a name and nothing
 * to press, rather than a button that goes nowhere.
 *
 * **The face is the same cutout as the header's**, cropped to head and
 * shoulders on a disc of the team's livery. A student with no photograph gets
 * initials on the same disc — the thing `Squad` refuses to do, and the
 * difference is the name beside it: in a line-up of faces a drawn stand-in is
 * a gap, in a list of names it is an ordinary avatar.
 */
export function Roster({ team }: { team: Team }) {
  const people = peopleOf(team.teamId)
  if (people.length === 0) return null

  return (
    <section className="lv-group" aria-label="Team">
      <span className="lv-label lv-group-head">Team</span>
      <ul className="lv-group-list">
        {people.map((person) => {
          const body = (
            <>
              <span className="lv-group-mark lv-roster-face" aria-hidden="true">
                {person.photo === null ? (
                  <span className="lv-roster-initials">{initialsOf(person.name)}</span>
                ) : (
                  <Image src={person.photo} alt="" width={370} height={440} unoptimized />
                )}
              </span>
              <span className="lv-group-value">{person.name}</span>
              {person.linkedin === null ? null : <LinkedInMark />}
            </>
          )
          return (
            <li key={person.name}>
              {person.linkedin === null ? (
                <div className="lv-group-row">{body}</div>
              ) : (
                <a
                  className="lv-group-row"
                  href={person.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${person.name} on LinkedIn`}
                >
                  {body}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** LinkedIn's `in`, drawn here like the Instagram and Facebook marks beside it. */
function LinkedInMark() {
  return (
    <span className="lv-roster-in" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="5.2" cy="5.3" r="2.3" />
        <rect x="3.2" y="9" width="4" height="12" rx="0.6" />
        <path d="M10 9.6c0-.3.3-.6.6-.6h2.9c.3 0 .6.3.6.6v1.1c.8-1.3 2.2-2 3.9-2 2.9 0 4 1.9 4 4.9v6.8c0 .3-.3.6-.6.6h-2.8c-.3 0-.6-.3-.6-.6v-6.1c0-1.4-.5-2.3-1.8-2.3s-2 .9-2 2.4v6c0 .3-.3.6-.6.6h-2.8c-.3 0-.6-.3-.6-.6z" />
      </svg>
    </span>
  )
}

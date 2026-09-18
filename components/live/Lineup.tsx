import Image from 'next/image'

import { PEOPLE_PHOTOS } from '@/config'
import { initialsOf, membersOf, photoSlug } from '@/lib/live'
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
 * ── Until then, everyone gets a drawn portrait ──
 *
 * Not a grey box and not a stock face: a silhouette in the team's own livery
 * with the person's initials. **A photograph of somebody who is not that
 * student would be the `LOGOS` mistake with a person's face in it** — the rule
 * there is that borrowed artwork says something false about who a team is, and
 * a borrowed face says it about who a person is. So the placeholder is
 * obviously a placeholder, and it is the same shape and size as the real
 * thing, so the layout is already the finished one.
 */
export function Squad({ team }: { team: Team }) {
  const members = membersOf(team)
  if (members.length === 0) return null

  return (
    <div className="lv-squad" aria-label={`Team: ${members.join(', ')}`} role="img">
      {members.map((name, index) => (
        <Person
          key={name}
          teamId={team.teamId}
          name={name}
          // The left-most sits on top and each one behind the last, so the
          // stack reads front-to-back rather than as a row of half-faces.
          style={{ zIndex: members.length - index }}
        />
      ))}
    </div>
  )
}

function Person({ teamId, name, style }: { teamId: string; name: string; style: React.CSSProperties }) {
  const path = `${teamId}/${photoSlug(name)}`
  const hasPhoto = PEOPLE_PHOTOS.includes(path)

  return (
    <span className="lv-person" style={style} title={name}>
      {hasPhoto ? (
        <Image src={`/people/${path}.webp`} alt="" width={256} height={256} unoptimized />
      ) : (
        <PlaceholderPortrait initials={initialsOf(name)} />
      )}
    </span>
  )
}

/**
 * A student with no photograph: a head-and-shoulders silhouette in the team's
 * livery, with their initials on it.
 *
 * **The silhouette was dropped once and has to come back.** While every
 * portrait sat in its own framed disc the frame was already person-shaped, so
 * the drawing added nothing and muddied the letters. The photographs are
 * cutouts now, standing with no frame at all — so a bare pair of letters
 * floats in the gap where a body should be, which is what it looked like on
 * `LUMI` before this. The silhouette is what keeps two cutouts and one
 * placeholder reading as three people.
 *
 * Seven of the cohort missed the shoot and five more have no frame recorded
 * against them, so this is on the board today rather than hypothetically.
 */
function PlaceholderPortrait({ initials }: { initials: string }) {
  return (
    <svg viewBox="0 0 120 160" className="lv-person-placeholder" aria-hidden="true">
      {/* **One group, one opacity.** Drawn as two translucent shapes, the
          head and the shoulders each showed their own edge and the overlap
          went darker than both — a person assembled from parts. The group
          carries the transparency so the union is flat, and the shoulders
          start above the chin so there is no seam to see. */}
      <g className="lv-person-body">
        <circle cx="60" cy="56" r="30" />
        {/* The shoulders start at y=78, eight units above the head's own
            bottom edge at 86. They started level with it once and the two
            shapes read as a ball above a hill. */}
        <path d="M6 160C6 108 30 78 60 78s54 30 54 82z" />
      </g>
      <text x="60" y="58" className="lv-person-initials">
        {initials}
      </text>
    </svg>
  )
}

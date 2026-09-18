/**
 * The crown on first place, and the only ornament on either slide.
 *
 * ── Where the geometry comes from ──
 *
 * Google's Noto Emoji crown (`googlefonts/noto-emoji`, **Apache 2.0** — the
 * notice and the statement of changes are in `Crown-NOTICE.txt` beside this
 * file). It is the emoji the brief asked for, as *geometry* rather than as a
 * font character, and that distinction is the whole reason it can be here.
 *
 * `👑` as a character is drawn by the machine's own colour-emoji font: its
 * colour is whatever Apple picked rather than a token, its size comes from font
 * metrics rather than from the mark it sits on, and it renders differently on
 * any other laptop — so two TVs driven from two machines would crown first
 * place in two different crowns and nobody would think to check. The same
 * artwork as inlined paths has none of those properties. It is ours, it scales
 * off the disc, and every fill below reads a token.
 *
 * ── Every colour is re-pointed, and that is not a tidiness pass ──
 *
 * The upstream file carries **eight hex values**: `#ffca28`, `#f19534` and
 * `#fff59d` for the metal, then `#26a69a`, `#69f0ae`, `#00796b`, `#f44336` and
 * `#ffa8a4` for the gems. This project allows hex in exactly one file, and two
 * of those are worse than a rule violation — `#26a69a` is a teal, which is the
 * *parent* Mesa brand this wall was deliberately re-skinned away from, and
 * `#f44336` is a material red that appears nowhere in Forge.
 *
 * So the eight collapse to six tokens, in two families:
 *
 *   metal → `--crown-deep` · `--crown-ink` · `--crown-lit`
 *   gems  → `--crown-gem-deep` · `--crown-gem` · `--crown-gem-lit`
 *
 * The metal ramp is Forge gold, rotated a little as well as lightened: warm in
 * shadow, pale in the specular, which is the difference between a metal and a
 * tint ramp. It was a single hue at three lightnesses once, and the crown read
 * as flat yellow for exactly that reason — three steps of one hue are three
 * steps of one paint. §3 of `forge-tokens.css` has the numbers and the argument.
 *
 * **The three steps are painted as a gradient, not as regions.** Every body
 * path below is filled `url(#tv-crown-metal)`, one `linearGradient` laid across
 * the shared viewBox from upper-left to lower-right, so the whole object has a
 * lit side and a shadowed side under one light. The stops read the same tokens,
 * so the light surface gets the identical modelling in Royal Purple.
 *
 * The gems become one stone rather than two. Upstream alternates teal and red
 * around the band; both map onto the surface's `--accent`, so a crown carries a
 * single gemstone instead of a colour scheme. Measured on Deep Aubergine:
 * 5.18 / 7.17 / 12.47:1 for the metal, 4.05 / 8.39 / 11.74:1 for the gems.
 *
 * ── What is deliberately *not* simplified ──
 *
 * The gems are about 9px across at the wall's own scale, which is below the
 * size at which anything is legible at six metres. They are not there to be
 * read. They are part of what stops 95px of gold reading as a gold blob — the
 * gradient above is the rest of it. Interior value variation is what gives a
 * silhouette its shape at distance, and the
 * `--crown-gem` ramp is chosen for value separation rather than for hue. If the
 * crown ever has to shrink much below a third of the disc, drop the gems and
 * the highlight paths rather than shrinking them: detail below the legibility
 * floor is noise that costs paint time and buys nothing.
 */
/**
 * Where each spark sits and when it fires — six of them, in three pairs.
 *
 * **The pairs are what the table is for.** A twinkle that returns to the same
 * two points every cycle is a pair of indicator lights: the eye learns the
 * position after the second repeat and then reads it as a blinking widget
 * rather than as an object in a room. Moving it means the crown is never
 * twinkling in the place you last saw it twinkle, which is what a real
 * highlight does as the thing it is on shifts under the light.
 *
 * `at` is a delay into the shared 18s cycle, so the three pairs land 6s apart —
 * 1.5s, 7.5s, 13.5s — and each pair's second spark is 0.36s behind its first.
 * On a thirty-second slide that is five strikes: A · B · C · A · B. No pair
 * repeats back to back, and the sequence restarts on every rotation because
 * `/podium` remounts.
 *
 * **Each pair straddles the crown**, one spark left of centre and one right,
 * so a strike reads as light crossing the whole object rather than as one
 * corner of it lighting up twice.
 *
 * `r` is centre-to-tip in viewBox units, and it tracks the feature underneath:
 * the two big terminal balls carry the largest sparks, the arc balls and the
 * centre stone smaller ones. A spark much bigger than the form it is sitting on
 * stops reading as a highlight and starts reading as a star sticker.
 */
const GLINTS = [
  // Pair A — the right-hand terminal ball, and the left arc's ball.
  { cx: 115, cy: 24, r: 12, at: 1.5 },
  { cx: 38, cy: 15, r: 10, at: 1.86 },
  // Pair B — the left-hand terminal ball, and the right arc's ball.
  { cx: 9, cy: 24, r: 11, at: 7.5 },
  { cx: 91, cy: 15, r: 10, at: 7.86 },
  // Pair C — the tall centre point, and the base band's lower-left corner. The
  // only pair that is not two ball tips, and that corner is on its third
  // position. It was the left flank *stone* first, which photographed as
  // nothing: the stone is `--crown-gem-lit`, a pale lavender, and pale gold on
  // pale lavender has no value step — the same failure as painting a spark on
  // the metal, one material along. It was then the left arc's outer foot, which
  // read but weakly, because the arc there is a thin edge rather than a form
  // and the spark had no silhouette to break. The band's corner is a real
  // corner with the page behind it, and it is the only strong position on the
  // crown's bottom half.
  { cx: 64, cy: 29, r: 9, at: 13.5 },
  { cx: 19, cy: 106, r: 9.5, at: 13.86 },
]

export function Crown({
  className,
  glint = true,
}: {
  className?: string
  /**
   * Whether the six sparks are drawn at all.
   *
   * **`false` on `/daily`, and that is a rule boundary rather than a taste.**
   * `AGENTS.md` states the motion rule as *nothing moves at rest except the
   * crown's glint*, and scopes the exception to "one object, on one slide".
   * The crown itself now appears on both slides — the leader wears it wherever
   * the leader is drawn — but the loop does not follow it across, for a reason
   * that is specific to the board it would follow it onto.
   *
   * `/daily` has exactly one thing it must be able to say: a rank changed
   * hands, said with a two-and-a-half-second interrupt against thirty-nine
   * still cards. **An interrupt only reads as one against a still frame.** A
   * permanent twinkle on rank 1 is the only other moving thing on that board,
   * so it competes directly with the single event the board exists to show —
   * which is the identical argument that removed row 1's idle and `/podium`'s
   * numeral dance, both recorded in `DailyGrid` and `Podium`.
   *
   * The drop is unaffected and stays on both slides. It runs once on mount and
   * stops, so it is an entrance rather than motion at rest — and on this board
   * it is a real one: when rank 1 changes hands the crown lands on the new
   * leader, which is precisely the event `/daily` is built around.
   */
  glint?: boolean
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 128 128"
      // **Presentational, not an image.** The crown restates a rank the numeral
      // above the mark already announces to a screen reader, and `/podium` is a
      // display page — a second "first place" in the accessibility tree is
      // noise rather than help.
      aria-hidden="true"
      focusable="false"
    >
      {/* ── The metal, as one light source rather than three fills ──

          Every body path below is painted with this rather than with a flat
          `--crown-ink`, because three flat steps of one ramp are three flat
          shapes and a metal is the interpolation between them. Upper-left to
          lower-right: pale specular on the points, the metal itself across the
          face, burnished shadow into the base. One light, one object.

          **`userSpaceOnUse`, not the `objectBoundingBox` default**, and that is
          the trap this would otherwise walk into. Object-bounding-box units
          resolve per *path*, so the tiny 13x4 fragment at the right arc's foot
          would get the entire ramp compressed into thirteen pixels and flare
          white beside a neighbour painted mid-gold. In user space all nine
          paths read one gradient laid across the shared 128x128 viewBox, which
          is what makes them one surface. The crown is scaled by CSS width and
          the viewBox scales with it, so this holds at any size.

          The line runs from outside the artwork on both ends, so nothing on the
          crown reaches a pure stop, and the metal holds flat from 32% to 72% —
          the face is gold rather than a wash, and only the corners go pale and
          deep. The colours are the surface's, so Lavender Mist gets the same
          modelling in Royal Purple without a second declaration. */}
      <defs>
        <linearGradient
          id="tv-crown-metal"
          gradientUnits="userSpaceOnUse"
          x1="-8"
          y1="-12"
          x2="136"
          y2="146"
        >
          <stop offset="0%" stopColor="var(--crown-lit)" />
          <stop offset="32%" stopColor="var(--crown-ink)" />
          <stop offset="72%" stopColor="var(--crown-ink)" />
          <stop offset="100%" stopColor="var(--crown-deep)" />
        </linearGradient>
      </defs>

      {/* The two side arcs, and the shadow under the base. */}
      <path
        fill="var(--crown-deep)"
        d="M94.52 21.81c2.44-1.18 4.13-3.67 4.13-6.56a7.28 7.28 0 0 0-14.56 0c0 2.93 1.73 5.44 4.22 6.6c-2.88 15.6-7.3 27.21-23.75 29.69c0 0 4.43 22.15 25.15 22.15s22.82-21.93 22.82-21.93c-16.81.86-18.23-20.27-18.01-29.95z"
      />
      <path
        fill="var(--crown-deep)"
        d="M34.74 21.81c-2.44-1.18-4.13-3.67-4.13-6.56a7.28 7.28 0 0 1 14.56 0c0 2.93-1.73 5.44-4.22 6.6c2.88 15.6 7.3 27.21 23.75 29.69c0 0-4.43 22.15-25.15 22.15S16.74 51.77 16.74 51.77c16.8.85 18.22-20.28 18-29.96z"
      />

      {/* The body: five points, the sweep between them, and the base band. */}
      <path
        fill="url(#tv-crown-metal)"
        d="M89.43 73.69c.09 0 .18.01.27.01c5.71 0 10-1.67 13.22-4.08l-13.49 4.07z"
      />
      <path
        fill="url(#tv-crown-metal)"
        d="M119.24 16.86c-3.33-.45-6.51 2.72-7.09 7.06c-.36 2.71.37 5.24 1.78 6.87l-2.4 9.95s-3.67 23.51-22.21 28.15C74.5 72.6 69.13 45.47 67.83 37.09c2.82-1.4 4.77-4.3 4.77-7.67c0-4.73-3.83-8.56-8.56-8.56s-8.56 3.83-8.56 8.56c0 3.39 1.98 6.32 4.85 7.7c-1.03 8.27-5.57 34.5-21.57 31.76c-16.24-2.79-23.33-30.14-24.97-37.58c1.95-1.6 3.04-4.42 2.64-7.45c-.58-4.35-4.02-7.47-7.68-6.98c-3.66.49-6.15 4.41-5.57 8.75c.42 3.16 2.36 5.67 4.79 6.62l12.72 79.03s11.1 8.77 43.35 8.77s43.35-8.77 43.35-8.77l12.75-79.24c2.06-1.08 3.68-3.51 4.08-6.49c.59-4.35-1.64-8.23-4.98-8.68z"
      />

      {/* The centre stone. */}
      <ellipse cx="64.44" cy="88.3" rx="9.74" ry="11.61" fill="var(--crown-gem)" />
      <path
        fill="var(--crown-gem-lit)"
        d="M64.44 79.56c.38.42.72 1.19 0 2.69s-4.6 3.53-5.31 3.94c-.71.42-1.18.23-1.4.06c-1.05-.84-.65-2.74.03-3.9c1.46-2.51 4.55-5.1 6.68-2.79z"
      />
      <path
        fill="var(--crown-gem-deep)"
        d="M63.72 92.63c-1.1.53-4.71 2.14-3.52 4.05c.7 1.13 2.15 1.61 3.48 1.67c1.33.06 2.64-.36 3.82-.97c5.6-2.9 6.05-10.52 4.96-11.1c-1.12-.6-1.88.95-2.46 1.61a20.266 20.266 0 0 1-6.28 4.74z"
      />

      {/* The two outer stones. */}
      <path
        fill="var(--crown-gem)"
        d="M118.09 78.8c1.56-8.63-4.24-10.79-4.24-10.79s-3.74-.68-5.5 9.03c-1.76 9.7 1.98 10.38 1.98 10.38s6.19.01 7.76-8.62z"
      />
      <path
        fill="var(--crown-gem-lit)"
        d="M115.51 70.96c1.36 1.82-.25 4.51-2.86 6.3c-.77.53-1.79.33-1.94-.11c-.42-1.26-.24-2.69.32-3.9c1.66-3.63 3.79-3.21 4.48-2.29z"
      />
      <path
        fill="var(--crown-gem)"
        d="M9.76 79.06C8.19 70.44 14 68.27 14 68.27s3.74-.68 5.5 9.03c1.76 9.7-1.98 10.38-1.98 10.38s-6.2.01-7.76-8.62z"
      />
      <path
        fill="var(--crown-gem-lit)"
        d="M15.78 71.2c1.34 1 .79 2.31-.22 3.22c-1.15 1.05-2.03 2.2-3.01 3.39c-.15.18-.32.38-.56.43c-.46.1-.83-.37-.98-.82c-.43-1.26-.35-2.74.29-3.9c1.82-3.31 3.96-2.71 4.48-2.32z"
      />

      {/* The two inner stones. Upstream draws these red against the outer pair's
          teal; here they are the same stone, so the band reads as one setting
          rather than as two materials. */}
      <path
        fill="var(--crown-gem)"
        d="M99.99 87.16c-.69 3.93-3.84 6.66-7.05 6.1c-3.21-.56-3.65-3.91-2.96-7.84c.69-3.93 2.24-6.94 5.44-6.38c3.21.56 5.26 4.2 4.57 8.12z"
      />
      <path
        fill="var(--crown-gem)"
        d="M30.43 87.16c.69 3.93 3.84 6.66 7.05 6.1s3.65-3.91 2.96-7.84c-.69-3.93-2.24-6.94-5.44-6.38s-5.25 4.2-4.57 8.12z"
      />
      <path
        fill="var(--crown-gem-lit)"
        d="M35.08 84.54c-.73.82-2.51 2.47-3.14 1.21c-.86-1.72.33-4.32 1.69-5.18c1.36-.86 2.47-.18 2.66.59c.23.98-.56 2.64-1.21 3.38z"
      />
      <path
        fill="var(--crown-gem-lit)"
        d="M91.98 87.05c-.99-.15-1.1-3.56 1.56-6.24c1.27-1.28 3.09.24 2.63 2.29c-.44 1.95-2.38 4.23-4.19 3.95z"
      />

      {/* The base band, its highlight, and the rule between band and body. */}
      <path
        fill="url(#tv-crown-metal)"
        d="M109.15 98.21c-5.99 3-19.73 10.99-45.1 10.99s-39.11-7.99-45.1-10.99c0 0-2.15 1.15-2.15 2.35v9.21c0 1.23.65 2.36 1.71 2.99c4.68 2.76 18.94 9.28 45.55 9.28s40.87-6.52 45.55-9.28a3.475 3.475 0 0 0 1.71-2.99v-9.21c-.02-1.2-2.17-2.35-2.17-2.35z"
      />
      <path
        fill="var(--crown-lit)"
        d="M39.6 110.84c2.8.55 3.65.79 3.46 2.35c-.39 3.07-6.76 2.34-10.53 1.35c-7.79-2.05-9.37-4.21-9.37-6.14c0-1.77 1.36-1.98 3.46-1.24c2.51.89 6.39 2.39 12.98 3.68z"
      />
      <path
        fill="none"
        stroke="var(--crown-deep)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeMiterlimit="10"
        d="M109.15 100.23s-16.57 9.38-45.1 9.38s-45.1-9.38-45.1-9.38"
      />

      {/* Inner edges on the two arcs, and the specular highlights. These are
          what keep the silhouette from flattening at distance. */}
      <path
        fill="url(#tv-crown-metal)"
        d="M26.97 49.57c5.32-3.8 8.18-10.61 8.43-21.45c.02-.98.3-1.27.83-1.33c.85-.09.99.68.98 1.23c-.24 11.7-1.73 19.01-7.63 23.13c-.29.2-2.36 1.46-3.24.59c-1.05-1.02.29-1.93.63-2.17z"
      />
      <path
        fill="url(#tv-crown-metal)"
        d="M31.84 15.54c-.17-1.81.25-5.07 5-6.55c1.39-.43 2.25.25 2.41.78c.4 1.32-.76 1.84-1.29 2.01c-3.65 1.18-3.83 3-4.58 4.16s-1.48.15-1.54-.4z"
      />
      <path
        fill="url(#tv-crown-metal)"
        d="M78.22 47.17c4.81-4.27 8-9.04 10.1-19.9c.19-.96.47-1.22.99-1.2c.85.02.89.81.8 1.35c-1.78 11.58-3.47 14.88-9.4 21.45c-.67.74-2.3 1.41-3.22.64c-.83-.69.13-1.8.73-2.34z"
      />
      <path
        fill="url(#tv-crown-metal)"
        d="M85.3 15.63c-.17-1.81.25-5.07 5-6.55c1.39-.43 2.25.25 2.41.78c.4 1.32-.76 1.84-1.29 2.01c-3.65 1.18-3.83 3-4.58 4.16c-.74 1.16-1.48.15-1.54-.4z"
      />
      <path
        fill="var(--crown-lit)"
        d="M31.59 71.62C19.97 66.35 16.55 52.6 14.73 46.63c-.24-.79-.12-1.54.67-1.78s1.26.27 1.51 1.06c1.32 4.33 6.45 18.79 17.04 22.9c.77.3 1.97 1.03 1.32 2.28c-.43.81-1.81 1.38-3.68.53z"
      />
      <path
        fill="var(--crown-lit)"
        d="M12.68 24.63c-.56-1.16-.79-2.26-3.84-3.53c-.77-.32-1.28-1.03-1.07-1.83s1.01-1.4 2.17-1.2c3.77.65 4.59 4.48 4.75 5.81c.15 1.28-1.44 1.91-2.01.75z"
      />
      <path
        fill="var(--crown-lit)"
        d="M96.87 71.62c11.62-5.27 15.04-19.02 16.86-24.99c.24-.79.12-1.54-.67-1.78s-1.26.27-1.51 1.06c-1.32 4.33-6.45 18.79-17.04 22.9c-.77.3-1.97 1.03-1.32 2.28c.43.81 1.81 1.38 3.68.53z"
      />
      <path
        fill="var(--crown-lit)"
        d="M115.78 24.63c.56-1.16.79-2.26 3.84-3.53c.77-.32 1.28-1.03 1.07-1.83s-1.01-1.4-2.17-1.2c-3.77.65-4.59 4.48-4.75 5.81c-.15 1.28 1.45 1.91 2.01.75z"
      />
      <path
        fill="var(--crown-lit)"
        d="M59.38 29.55c.61-1.25 1.68-2.96 5.17-3.68c1.34-.28 1.73-.86 1.61-1.74c-.24-1.83-2.52-1.7-3.75-1.41c-4.1.96-5.01 4.6-5.18 6.04c-.17 1.37 1.55 2.04 2.15.79z"
      />
      {/* ── The glints ──

          Six sparks, **two lit at a time**, in three pairs that take it in
          turns. Position and timing are one table rather than two, because the
          thing being decided is "this place, at this moment" — see `GLINTS`
          below for both, and the keyframes in `mesa-tv.css` for the cycle they
          share. Drawn last so they sit over the metal rather than under it.

          ── Why every one of the six is on an edge ──

          The first attempt put two sparks on the artwork's own specular
          streaks: the right arc's inner edge and the base band's highlight,
          which is where Noto's illustrator decided the light is. Screenshotted
          at full size, **neither was visible.** `--crown-lit` is one step of
          the same metal ramp the body is painted from — 12.47:1 against the
          page where `--crown-ink` is 7.17 — so a spark drawn *inside* the
          silhouette is a pale gold shape on gold, with almost no value step to
          live on.

          A tip is where the object *ends*, so a spark centred on one is half on
          metal and half on Deep Aubergine, and it is the second half that makes
          it read at six metres. That is also what a specular does on a curved
          metal object: it catches the edge, not the middle.

          **The disc is the other half of that constraint, and it is what rules
          most of the crown out.** The mark's Lavender Mist disc sits behind the
          crown's lower right, and a pale warm spark landing there has nothing
          to be brighter than. So the six are the crown's five ball tips, which
          all overhang into the dark page, plus the base band's lower-left
          corner, which clears the disc on the other side. **The lower right has
          no position on it and cannot have one** without a second colour — if a
          seventh spark is ever wanted, it is not going there. */}
      {glint
        ? GLINTS.map(({ cx, cy, r, at }) => (
            <path
              key={`${cx}-${cy}`}
              className="tv-crown-glint"
              fill="var(--crown-lit)"
              style={{ animationDelay: `${at}s` }}
              d={sparkle(cx, cy, r)}
            />
          ))
        : null}
    </svg>
  )
}

/**
 * A four-point spark, centred on (`cx`, `cy`), `r` across from centre to tip.
 *
 * **Built in absolute coordinates rather than drawn once and placed with a
 * `transform` attribute**, and that is not a style choice. The glint is scaled
 * by CSS, and a CSS `transform` replaces an element's `transform` presentation
 * attribute outright rather than composing with it — so a spark positioned by
 * `transform="translate(...)"` would jump to the viewBox origin on the first
 * animated frame and pulse in the top-left corner of the crown's box. Two
 * numbers in a path string cannot do that.
 *
 * The waist pinches to `0.26r`, which is what makes it a spark rather than a
 * diamond: the concave sides are the whole read at this size.
 */
function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.26;
  return (
    `M${cx} ${cy - r}` +
    `C${cx} ${cy - k} ${cx + k} ${cy} ${cx + r} ${cy}` +
    `C${cx + k} ${cy} ${cx} ${cy + k} ${cx} ${cy + r}` +
    `C${cx} ${cy + k} ${cx - k} ${cy} ${cx - r} ${cy}` +
    `C${cx - k} ${cy} ${cx} ${cy - k} ${cx} ${cy - r}Z`
  );
}

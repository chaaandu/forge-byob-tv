/**
 * The crown on first place, and the only ornament on either slide.
 *
 * ── Why this is a path and not `👑` ──
 *
 * The brief asked for the emoji. An emoji character is rendered by the
 * *machine's* colour-emoji font — Apple Color Emoji on the MacBook driving this
 * wall — which means three things this project does not accept. Its colour is
 * whatever Apple picked (a glossy purple-and-gold jewel), not
 * `--forge-metal-gold`, so it is the one element on the wall that cannot read a
 * token. Its size is set by a font's own metrics rather than by the mark it sits
 * on. And it renders differently on any other machine, so two TVs driven from
 * two laptops would crown first place in two different crowns and nobody would
 * think to check.
 *
 * A path costs nothing extra, is actually gold, and is identical everywhere.
 *
 * ── The shape ──
 *
 * Five points, flat fill, no gradient and no stroke. Detail is the enemy here:
 * this is read at six metres, where a jewelled crown with a rim highlight
 * collapses into a gold smudge and a plain silhouette still says *crown*. The
 * band is a separate sub-path rather than a stroke so the whole mark scales as
 * one object — a stroked band keeps its width as the crown grows and the
 * proportion drifts.
 *
 * `preserveAspectRatio` is left at its default: the caller sizes by width and
 * the height follows, so the crown cannot be squashed by a container.
 */
export function Crown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 78"
      // **Presentational, not an image.** The crown restates a rank the numeral
      // above the mark already announces to a screen reader, and `/podium` is a
      // display page — a second "first place" in the accessibility tree is noise
      // rather than help.
      aria-hidden="true"
      focusable="false"
    >
      {/* One path, two sub-paths: the five-point body, then the band. Drawn
          together so a single `fill` covers both and there is no seam between
          them to go one pixel out of register at an odd viewport width. */}
      <path
        fill="var(--crown-ink)"
        d="M4 57 L0 7 Q0 2 4 4 L25.5 28 L45.5 1.5 Q50 -2 54.5 1.5 L74.5 28 L96 4 Q100 2 100 7 L96 57 Z
           M3 62 H97 A3 3 0 0 1 97 76 H3 A3 3 0 0 1 3 62 Z"
      />
    </svg>
  )
}

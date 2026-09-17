/**
 * A packshot silhouette for a sample product — jar, pouch, box, bottle, tote.
 *
 * Only ever drawn beside a `Sample` badge; see `lib/liveSample.ts`. The fill
 * comes from the card's livery (`--livery-a`, `--livery-b`), so nothing here
 * names a colour. When `TV_Products` publishes a real `image_url`, the card
 * shows that image instead and this goes.
 */
export function ProductArt({ art }: { art: number }) {
  return (
    <svg className="lv-product-art" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      {SHAPES[art % SHAPES.length]}
    </svg>
  )
}

const SHAPES: readonly React.ReactNode[] = [
  // jar
  <g key="jar">
    <rect x="38" y="22" width="44" height="14" rx="4" className="lv-art-dark" />
    <rect x="30" y="34" width="60" height="68" rx="16" className="lv-art-body" />
    <rect x="38" y="54" width="44" height="26" rx="6" className="lv-art-label" />
  </g>,
  // pouch
  <g key="pouch">
    <path d="M32 26h56l6 70c0 6-4 8-8 8H34c-4 0-8-2-8-8z" className="lv-art-body" />
    <rect x="32" y="26" width="56" height="10" rx="2" className="lv-art-dark" />
    <circle cx="60" cy="66" r="15" className="lv-art-label" />
  </g>,
  // box
  <g key="box">
    <path d="M24 42l36-16 36 16v48l-36 16-36-16z" className="lv-art-body" />
    <path d="M24 42l36 16 36-16M60 58v48" className="lv-art-line" />
    <path d="M60 58l36-16v48l-36 16z" className="lv-art-dark" />
  </g>,
  // bottle
  <g key="bottle">
    <rect x="52" y="14" width="16" height="14" rx="3" className="lv-art-dark" />
    <path d="M50 28h20v10c10 6 14 12 14 22v38c0 5-4 8-8 8H44c-4 0-8-3-8-8V60c0-10 4-16 14-22z" className="lv-art-body" />
    <rect x="42" y="64" width="36" height="24" rx="4" className="lv-art-label" />
  </g>,
  // tote
  <g key="tote">
    <path d="M44 42c0-20 32-20 32 0" className="lv-art-line" strokeWidth="6" />
    <path d="M26 42h68l-6 62H32z" className="lv-art-body" />
    <rect x="44" y="60" width="32" height="22" rx="4" className="lv-art-label" />
  </g>,
]

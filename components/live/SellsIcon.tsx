import { sellsCategory } from '@/lib/live'

/**
 * A mark for the *kind* of thing a venture sells, read off its own product
 * line by `sellsCategory`.
 *
 * Eleven glyphs, drawn here in code like `Emblem`'s badges, in
 * `currentColor`. There is no stock icon set and no per-team artwork: the
 * category is a guess about wording, so the picture has to be generic enough
 * to be right about a whole category and the unrecognised case has to draw
 * something that claims nothing — which is what `other`'s plain tag is for.
 */
export function SellsIcon({ product, size = 22 }: { product: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[sellsCategory(product)]}
    </svg>
  )
}

const GLYPHS: Record<ReturnType<typeof sellsCategory>, React.ReactNode> = {
  // a sealed snack pouch
  snack: (
    <>
      <path d="M6 5h12l-1.2 14.2a1.8 1.8 0 0 1-1.8 1.8H9a1.8 1.8 0 0 1-1.8-1.8z" />
      <path d="M6 5h12M9.5 9.5h5" />
    </>
  ),
  // a cupcake
  bakery: (
    <>
      <path d="M6.5 11h11l-1.4 8.2a1.6 1.6 0 0 1-1.6 1.3H9.5a1.6 1.6 0 0 1-1.6-1.3z" />
      <path d="M7.5 11a4.5 4.5 0 0 1 9 0" />
      <path d="M12 3.5v3" />
    </>
  ),
  // a cup
  drink: (
    <>
      <path d="M5 7h12v7a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z" />
      <path d="M17 9h1.8a2.2 2.2 0 0 1 0 4.4H17" />
      <path d="M8 3.6v2M12 3.2v2.4" />
    </>
  ),
  // a dropper bottle
  beauty: (
    <>
      <path d="M9.5 3h5v3l2 2.6V19a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V8.6L9.5 6z" />
      <path d="M8 12h8" />
    </>
  ),
  // a perfume flacon
  fragrance: (
    <>
      <rect x="9" y="2.6" width="6" height="3.2" rx="1" />
      <path d="M8 9.4A3.4 3.4 0 0 1 10.4 6h3.2A3.4 3.4 0 0 1 16 9.4V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" />
      <path d="M10.5 12.5h3" />
    </>
  ),
  // a t-shirt
  apparel: (
    <path d="M9 3.5 5 5.8l1.6 4L9 9v11.5h6V9l2.4.8 1.6-4L15 3.5a3 3 0 0 1-6 0z" />
  ),
  // a pendant
  jewellery: (
    <>
      <path d="M4.5 5.5a11 11 0 0 0 15 0" />
      <path d="m12 9.5 3 3.4-3 5.6-3-5.6z" />
    </>
  ),
  // a house with a plant pot
  home: (
    <>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M6 12v8h12v-8" />
      <path d="M10 20v-3.5h4V20" />
    </>
  ),
  // a notebook
  stationery: (
    <>
      <path d="M6.5 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-11a2 2 0 0 1 0-4h11" />
      <path d="M6.5 3.5v12" />
    </>
  ),
  // hands / making
  craft: (
    <>
      <path d="M12 3.2 14 9l6 .5-4.6 3.8L17 19l-5-3-5 3 1.6-5.7L4 9.5 10 9z" />
    </>
  ),
  // a plain tag — claims nothing
  other: (
    <>
      <path d="M11.4 3.5H20a.5.5 0 0 1 .5.5v8.6a2 2 0 0 1-.6 1.4l-6.6 6.6a1.5 1.5 0 0 1-2.1 0l-7.2-7.2a1.5 1.5 0 0 1 0-2.1L10 4.1a2 2 0 0 1 1.4-.6z" />
      <circle cx="16.4" cy="7.6" r="1.4" />
    </>
  ),
}

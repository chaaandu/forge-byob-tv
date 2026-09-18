/**
 * Indian digit grouping throughout — `₹1,04,500`, not `₹104,500`.
 *
 * The audience is an Indian cohort reading their own revenue off a wall, and
 * western grouping on a lakh figure reads as a typo before it reads as a number.
 */
const RUPEES = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const PLAIN = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export function formatRupees(value: number): string {
  // `|| 0`, and not a comparison. `Math.round(-0.5)` is **negative zero**, which
  // `Intl.NumberFormat` faithfully renders as `-₹0` — and `-0 === 0` is `true`,
  // so `rounded < 0` can never catch it while `rounded === 0` would need a
  // second branch to say the same thing. At whole-rupee precision the value *is*
  // zero, so the sign describes precision already discarded, and a minus in
  // front of a zero on a wall reads as a fault rather than a fact.
  //
  // Every real negative passes through untouched. Reached only by `/daily`'s
  // challenge figure, which can sit below its baseline when proof is revoked on
  // a sale logged before the photograph was taken; every figure `/podium` prints
  // is a non-negative all-time total.
  return RUPEES.format(Math.round(value) || 0)
}

export function formatCount(value: number): string {
  return PLAIN.format(Math.round(value))
}

/**
 * Rank in words, not a bare numeral.
 *
 * A photo of one corner of this wall still has to say "2nd". The dashboard
 * reached the same conclusion for the same reason: a crop outlives the context
 * that explained it.
 */
export function ordinal(rank: number): string {
  const tens = rank % 100
  if (tens >= 11 && tens <= 13) return `${rank}th`
  const suffix = ['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'
  return `${rank}${suffix}`
}

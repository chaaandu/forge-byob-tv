/* ============================================================
   NAZAR — the evil eye beside each slide's biggest number.

   Asked for directly on 25 September 2026, for the wall and not for /live:
   "an evil eye for the nazar thing … go crazy with it". So a glass nazar
   battu sits to the LEFT of the one figure each slide is about:

     /weekly, /podium   the total, top right. It HANGS there on a kalava
                        thread from the top of the frame, the way one hangs
                        over a shop door, swings in and settles.
     /daily             the No. 1's gold figure. It ROLLS in from the left,
                        the way everything on that slide drives in, comes to
                        rest a little dizzy, and then watches the count.

   ── It is the second looping ornament, and it moves at rest ──
   AGENTS.md: "A second looping ornament is a new argument, not an extension
   of this one." This is that argument lost on purpose: it blinks, glances
   and (hanging) sways, forever. What keeps it off the BOARD's territory is
   that it carries no figure and never moves one, and its gaze is on long
   cycles (a blink every few seconds, not a flutter). Lengthen before
   shortening, as with the crown's glint. `NAZAR` below is the off switch.

   ── Two things a sale does ──
   `nazarWatch(value)` is told the slide's figure on every paint. When it
   goes UP (never on the first paint, never on a zeroing — `>` for the reason
   the chevrons use it) the eye winks and its pupil turns into a ₹ for a
   beat — money eyes — the one moment it reacts to something that happened.
   It does the same once on arrival, the first time it looks at the figure.
   (Two rings rippling out over the number did this job first; removed on
   25 September 2026, asked for directly.)

   No colour is named here; every fill is a `--nz-*` token in tv.css.
   ============================================================ */

const NAZAR = !new URLSearchParams(location.search).has('nonazar')
let nzCount = 0
let nzLast = null

/** The bead itself: glass, a white, an iris that looks around, two lids. */
function nazarSvg() {
  const n = ++nzCount
  return `<svg class="nz-svg" viewBox="-50 -50 100 100" aria-hidden="true">
    <defs>
      <radialGradient id="nzg${n}" cx="-16" cy="-20" r="74" gradientUnits="userSpaceOnUse">
        <stop offset="0" style="stop-color:var(--nz-glass-hi)"/>
        <stop offset="0.5" style="stop-color:var(--nz-glass)"/>
        <stop offset="1" style="stop-color:var(--nz-glass-deep)"/>
      </radialGradient>
      <radialGradient id="nzi${n}" cx="0" cy="0" r="20" gradientUnits="userSpaceOnUse">
        <stop offset="0.45" style="stop-color:var(--nz-iris-hi)"/>
        <stop offset="1" style="stop-color:var(--nz-iris)"/>
      </radialGradient>
      <clipPath id="nzc${n}"><circle r="30"/></clipPath>
    </defs>
    <circle class="nz-bead" r="47" fill="url(#nzg${n})"/>
    <g clip-path="url(#nzc${n})">
      <circle class="nz-white" r="30"/>
      <g class="nz-gaze">
        <circle r="19" fill="url(#nzi${n})"/>
        <circle class="nz-iris-ring" r="18.2"/>
        <circle class="nz-pupil" r="9"/>
        <text class="nz-rupee" x="0" y="1" text-anchor="middle" dominant-baseline="central">₹</text>
        <circle class="nz-catch" cx="-5" cy="-6" r="3.4"/>
        <circle class="nz-catch nz-catch-sm" cx="4.5" cy="5" r="1.5"/>
      </g>
      <g class="nz-eyes">
        <ellipse class="nz-lid nz-lid-up" cx="0" cy="-66" rx="44" ry="36" fill="url(#nzg${n})"/>
        <ellipse class="nz-lid nz-lid-dn" cx="0" cy="66" rx="44" ry="36" fill="url(#nzg${n})"/>
        <path class="nz-lash" d="M-24 1 Q0 14 24 1 M-15 7 l-4 7 M0 9 v8 M15 7 l4 7"/>
      </g>
    </g>
    <circle class="nz-socket" r="30"/>
    <circle class="nz-rim" r="46"/>
    <path class="nz-gloss" d="M-36 -12 A38 38 0 0 1 -14 -35"/>
    <circle class="nz-gloss-dot" cx="-30" cy="-30" r="2.6"/>
    <path class="nz-glint" d="M0 -10 L1.8 -1.8 10 0 1.8 1.8 0 10 -1.8 1.8 -10 0 -1.8 -1.8Z"/>
  </svg>`
}

/** `kind` is `hang` (a thread from the top of the frame) or `roll`. */
function nazarHtml(kind) {
  if (!NAZAR) return ''
  // A repaint is not an arrival (see `html.settled` in tv.css): an eye
  // rebuilt on a later poll is simply there, already awake.
  const calm = document.documentElement.classList.contains('settled') ? ' calm' : ''
  const bead = `<span class="nz-bead-box">
      <span class="nz-spin">${nazarSvg()}</span>
    </span>`
  if (kind === 'roll') return `<span class="nz nz--roll${calm}">${bead}</span>`
  return `<span class="nz nz--hang${calm}"><span class="nz-swing">
      <span class="nz-thread"></span>
      <span class="nz-charm nz-charm-1"></span><span class="nz-charm nz-charm-2"></span>
      <span class="nz-cap"></span>
      ${bead}
    </span></span>`
}

/** Fill every `[data-nazar]` placeholder the page has left for one. */
function mountNazar(root = document) {
  root.querySelectorAll('[data-nazar]').forEach((slot) => {
    slot.outerHTML = nazarHtml(slot.dataset.nazar)
  })
}

/** Told the slide's figure on every paint; a rise is a sale, and it winks. */
function nazarWatch(value) {
  const rose = nzLast !== null && value > nzLast
  nzLast = value
  if (!rose) return
  document.querySelectorAll('.nz').forEach((el) => {
    el.classList.remove('sale')
    void el.offsetWidth          // restart the one-shot, not just re-add it
    el.classList.add('sale')
  })
}

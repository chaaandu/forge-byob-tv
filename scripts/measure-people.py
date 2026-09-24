"""
Write `public/tv/people-meta.json`: for every photograph, a version stamp and
where its body is cut — `{ "VBC132/rohan-vivek": { "v": "3f9a…", "cut": [1, 1, 0] } }`,
`cut` being `[left, right, short of the bottom]`, a side given as the cut's
distance in from that edge in % of the width, or null when it is not cut.

    python3 scripts/measure-people.py

**Run this after `register-people.py` and `export-people-json.mjs`**, whenever
a photograph is added or replaced. Both the wall (`tv.js`) and `/live`
(`lib/lineup.ts`) read it.

── The version stamp ──

Photographs are served with a day of cache (`next.config.ts`), because the
wall remounts every thirty seconds and would otherwise re-download the cohort
twice a minute. The cost: a REPLACED photograph keeps its URL, so every browser
that has seen the old one keeps showing it for up to a day. Measured on 23
September 2026 — a corrected face was on disk and served, and the page on the
laptop still drew the old one. `v` is the first 10 hex of the file's SHA-1,
appended as `?v=`, so a changed file is a new URL and arrives immediately,
while an unchanged one stays cached exactly as before.

── Why this exists ──

Every crop is 370x440, built around a square taken from the shoot, and the
square's own edges land at x=20 and x=350 inside it. A student photographed
close enough that their shoulders or arms reach past that square is cut there:
a dead-straight vertical edge running from the shoulder down, inside the
cutout, where everybody else has a clean silhouette. Measured on 23 September
2026: 76 of 113 photographs have one, at x=20 (29) or x=350 (59), starting
between y=209 and y=277.

On its own a cut is invisible. It shows when that student stands IN FRONT of a
neighbour — the straight edge then runs down across the other person, and the
cut student looks wider and pasted on. Reported on Mugshot, where the line-up
put Rohan in the middle and in front, cut on both sides.

So the file records the cuts, and the wall layers each line-up to hide them:
people with a clean silhouette stand in front; a person cut on a side stands
behind the neighbour on that side, whose body covers the edge. Where that
cannot be satisfied, the cut side is faded before the cut line instead.

A cut is a column where the matte jumps (or the crop's own edge where the body
still is) from body to nothing (or back) across
at least 40% of the rows in the lower half of the crop — the half a cut runs
through; a forearm cut by the frame counts, because it shows just the same. The threshold
was set against the images, not guessed: no clean silhouette comes near it,
and every cut found by eye clears it.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = json.loads((ROOT / "public/tv/people.json").read_text())
OUT = ROOT / "public/tv/people-meta.json"


def cuts(path: Path) -> tuple[float | None, float | None, bool]:
    """
    Where the body is cut by the photograph's frame, as a percentage of the
    crop's width in from each side (None: not cut), and whether the body stops
    short of the bottom edge.

    The position is kept (always 0 today, the crop's edge) so the surfaces can
    start a fade exactly at the cut line if one ever sits further in.
    """
    alpha = Image.open(path).convert("RGBA").getchannel("A")
    w, h = alpha.size
    px = alpha.load()
    rows = range(h // 2, h)
    need = (h - h // 2) * 0.4
    left: float | None = None
    right: float | None = None
    # A body that runs INTO the crop's own edge is cut there — there is no
    # column beyond it to jump to, so the scan below cannot see it.
    if sum(1 for y in rows if px[0, y] > 128) >= need:
        left = 0.0
    if sum(1 for y in rows if px[w - 1, y] > 128) >= need:
        right = 0.0
    # **Only the crop's own edge.** This also scanned for a straight vertical
    # jump INSIDE the crop — which is where the old 370 crops were cut — and at
    # 450, with every photograph re-cut from an original with room, the only
    # things it still found were the straight sides of two blazers (Akristi
    # Mohta, Pratiksha Bihani), measured at 0.41-0.50 of the rows against 0.49
    # for a real cut: no threshold separates them. A body can now only be cut
    # where the crop ends, so that is the only place this looks. A source too
    # narrow for the crop is the pipeline's to fix (widen its background, as
    # Atharva Agrawal's was), not the page's to fade.
    # A body that stops short of the bottom edge is a passport-style headshot.
    # Those are not used — see the test that fails on one.
    body = [y for y in range(h) if sum(1 for x in range(w) if px[x, y] > 128) > 40]
    # Any gap at all: a line-up stands on its bottom edge on /podium and
    # /weekly, so a body ending even 13px short is a hard line across it
    # (Annashri Mahato's phone photo, 24 September 2026). 15px let it pass.
    short = bool(body) and max(body) < h - 4
    return left, right, short


result = {}
for photo in PHOTOS:
    path = ROOT / "public/people" / f"{photo}.webp"
    left, right, short = cuts(path)
    result[photo] = {
        "v": hashlib.sha1(path.read_bytes()).hexdigest()[:10],
        # [left, right, short]: a side is the cut's distance in from that edge
        # as a % of the width, or null when that side is not cut.
        "cut": [left, right, int(short)],
    }

OUT.write_text(json.dumps(result, indent=1, sort_keys=True) + "\n")
print(f"{len(result)} photographs; {sum(1 for m in result.values() if m['cut'][0] is not None or m['cut'][1] is not None)} "
      f"cut at a side by their frame; {sum(m['cut'][2] for m in result.values())} stop short of the bottom")

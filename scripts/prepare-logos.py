"""
Turn the circular source logos into discs the wall can render.

    python3 scripts/prepare-logos.py

Reads `public/assets/Circle logos/Team <N>.(jpg|png)` and writes
`public/logos/VBC1NN.png` at 512x512 RGBA, the artwork masked to a circle
with everything outside it transparent. Paste the printed list into `LOGOS` in
config.ts.

── Why this is the opposite of what it used to do ──

The previous version squared each logo *onto its own background colour*, so a
circular frame could be filled rather than the artwork cropped. That was right
when the sources were arbitrary rectangles.

The sources are now circles, and both boards draw them as discs — `/podium`
clips to one, and `/weekly` stands them on a Deep Forest Green panel. A baked-in
background is now actively wrong: it would put a white or black square corner
behind a disc on a green field. So the corners come out transparent and the
board's own surface shows through.

── The sources are only mostly uniform ──

They arrive as JPG and PNG, on white, on black, and on transparency; `Team 15`
is 841x1280 rather than square, and `Team 18` is 1067x1086. So the circle is
*found* rather than assumed:

- An image with real transparency is trusted and its alpha bounding box used.
- Otherwise the background is read from the four corners and the bounding box is
  every pixel far enough from it. A box covering nearly the whole frame means
  the reading failed — a logo whose own artwork reaches the edges — and the full
  frame is used instead of a bad crop.

The box is then squared about its own centre, so an off-centre circle is not
squashed, and padded with the background colour where the square runs past the
edge. The mask is drawn at 4x and downsampled, because a hard-edged circle at
512 shows visible stair-stepping on a mark that is only ~100px on the wall.

── The team-number mapping is CONFIRMED ──

Sources are named `Team 17`, not `SLE-C417`, and this script assumes team *N* is
workbook `VBC1NN` (Forge C1; it was `SLE-C4NN` for Cohort 2026). That assumption was unverified for a long time and is
recorded as open item 1 in scripts/README.md.

**It has now been checked, and it holds.** All 24 numbered logos were read
against the live `TV_Feed` venture names on 12 August 2026 and every one agrees:
Team 1 is Dosa Crisps (`SLE-C401`), Team 15 is CHAKHA NA? (`SLE-C415`), Team 34
is In Between Sips by Kaappitalism (`SLE-C434`), and so on for all of them.

Two files in the folder carry no team number — `Unhinged Logo.png` and
`PHOTO-...jpg`, which is ROLLIN. Neither venture name appears in the feed. The
only unnamed non-spare workbooks are `SLE-C422` and `SLE-C435`, so they are
almost certainly those two, but nothing says which is which and a guess is a
coin flip on a public wall. **They are deliberately not emitted.** Both teams get
the coloured initial instead, which is a first-class treatment. To place them,
rename the file to `Team 22.png` / `Team 35.png` and re-run.
"""

import os
import re
from PIL import Image, ImageDraw

SRC = "public/assets/Circle logos"
OUT = "public/logos"
SIZE = 512
SS = 4  # mask supersampling
BG_TOLERANCE = 30  # RGB distance before a pixel counts as content


def corner_background(im):
    """The flat colour behind the circle, read from the four corners."""
    w, h = im.size
    inset = max(2, min(w, h) // 100)
    corners = [
        im.getpixel((inset, inset)),
        im.getpixel((w - 1 - inset, inset)),
        im.getpixel((inset, h - 1 - inset)),
        im.getpixel((w - 1 - inset, h - 1 - inset)),
    ]
    corners = [c[:3] for c in corners]
    # The most repeated corner. A logo bleeding into one corner should not get
    # to define the background for the other three.
    return max(set(corners), key=corners.count)


def content_box(im):
    """Where the artwork actually is."""
    w, h = im.size
    alpha = im.getchannel("A")
    if alpha.getextrema()[0] < 250:
        box = alpha.getbbox()
        if box is not None:
            return box

    bg = corner_background(im)
    rgb = im.convert("RGB")
    # Manhattan distance is enough to separate artwork from a flat backdrop and
    # is far cheaper than Euclidean over a few million pixels.
    mask = Image.new("L", (w, h), 0)
    mask.putdata([
        255 if abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) > BG_TOLERANCE else 0
        for p in rgb.getdata()
    ])
    box = mask.getbbox()
    if box is None:
        return (0, 0, w, h)
    # Covering nearly everything means the reading failed rather than that the
    # logo is enormous — fall back to the whole frame, which is never a bad crop.
    if (box[2] - box[0]) * (box[3] - box[1]) > 0.98 * w * h:
        return (0, 0, w, h)
    return box


def squared(im, box):
    """The smallest square holding `box`, centred on it, padded where it runs out."""
    bg = corner_background(im)
    cx = (box[0] + box[2]) / 2
    cy = (box[1] + box[3]) / 2
    side = max(box[2] - box[0], box[3] - box[1])
    left = int(round(cx - side / 2))
    top = int(round(cy - side / 2))
    canvas = Image.new("RGBA", (side, side), bg + (255,))
    canvas.paste(im, (-left, -top), im)
    return canvas


def disc(im):
    """Mask to a circle, antialiased."""
    mask = Image.new("L", (SIZE * SS, SIZE * SS), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, SIZE * SS - 1, SIZE * SS - 1), fill=255)
    mask = mask.resize((SIZE, SIZE), Image.LANCZOS)
    out = im.resize((SIZE, SIZE), Image.LANCZOS)
    out.putalpha(mask)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for stale in os.listdir(OUT):
        if stale.endswith(".png"):
            os.remove(os.path.join(OUT, stale))

    done, skipped = [], []
    for name in sorted(os.listdir(SRC)):
        path = os.path.join(SRC, name)
        if not os.path.isfile(path) or name.startswith("."):
            continue
        match = re.match(r"team\s*(\d+)\s*\.(jpg|jpeg|png)$", name, re.IGNORECASE)
        if match is None:
            skipped.append(name)
            continue

        team_id = f"VBC1{int(match.group(1)):02d}"
        im = Image.open(path).convert("RGBA")
        disc(squared(im, content_box(im))).save(os.path.join(OUT, f"{team_id}.png"))
        done.append(team_id)

    print(f"wrote {len(done)} discs to {OUT}/\n")
    if skipped:
        print("NOT emitted — no team number in the filename:")
        for name in skipped:
            print(f"  {name}")
        print("  These teams fall back to the coloured initial. See the docstring.\n")

    print("Paste into LOGOS in config.ts:\n")
    for team_id in sorted(done):
        print(f"  '{team_id}',")


if __name__ == "__main__":
    main()

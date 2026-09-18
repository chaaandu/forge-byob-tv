"""
Write the app icons from Mesa's logomark.

    python3 scripts/make-icons.py

Produces, from `mesa_forge_design_system/logos/mesa_logomark_tile.png`:

    app/favicon.ico     16, 32, 48 — the browser tab
    app/icon.png        512        — everything modern, including Android
    app/apple-icon.png  180        — an iPhone home screen

Next.js picks all three up by filename; nothing imports them. See
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`.

── Why a white tile rather than the page's own aubergine ──

The brand book specifies the logomark as a rounded **white** tile carrying the
aubergine `m`, and that is also the reading that survives a browser: a tab strip
is light in one theme and near-black in the other, and a white tile has an edge
in both. An aubergine tile would dissolve into a dark tab — the same failure
the wall's own `--surface`/`--ink` rule exists to prevent, one surface further
out than this project usually reaches.

── The colour is baked, like the podium's blocks ──

`app/forge-tokens.css` owns every colour the *pages* draw. An icon is a PNG a
browser reads before any CSS exists, so it cannot read a token. The values are
therefore here, named, and this file is the one place they may be changed —
exactly the arrangement `scripts/render-podium.mjs` documents for the blocks.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "mesa_forge_design_system" / "logos" / "mesa_logomark_tile.png"

WHITE = (255, 255, 255, 255)
# Deep Aubergine, the brand's own — `--aubergine` in forge-tokens.css §0.
AUBERGINE = (42, 24, 73, 255)
# The mark's share of the tile. The brand book asks for clearance of half the
# tile height around the lockup; at 16px a mark that obedient is four pixels of
# ink, so the icon takes the tighter end of it.
INSET = 0.18
# iOS rounds its own corners, the tab strip does not; 22% is Apple's squircle
# radius and reads as a tile rather than a blob at 16px.
RADIUS = 0.22


def mark() -> Image.Image:
    """The `m`, cropped to its own ink and recoloured to the brand aubergine."""
    source = Image.open(SOURCE).convert("RGBA")
    # **Flattened onto white before anything is measured.** The source is the
    # mark on a white tile with *transparent* corners, and `convert("L")` reads
    # transparency as black — so the threshold below found "ink" in all four
    # corners and the first icon came out with a dark wedge in each. Measured,
    # on the rendered 128px preview.
    tile = Image.alpha_composite(Image.new("RGBA", source.size, WHITE), source)
    # The source is the mark on white, so the ink is what is *dark* — an alpha
    # bounding box would return the whole canvas.
    grey = tile.convert("L")
    ink = grey.point(lambda v: 255 if v < 160 else 0)
    box = ink.getbbox()
    if box is None:
        raise SystemExit(f"No mark found in {SOURCE}")
    glyph = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), AUBERGINE)
    glyph.putalpha(ink.crop(box))
    return glyph


def icon(size: int) -> Image.Image:
    glyph = mark()
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    radius = round(size * RADIUS)
    tile = Image.new("RGBA", (size, size), WHITE)
    rounded = Image.new("L", (size, size), 0)
    ImageDraw.Draw(rounded).rounded_rectangle((0, 0, size - 1, size - 1), radius, fill=255)
    tile.putalpha(rounded)
    canvas.alpha_composite(tile)

    room = round(size * (1 - INSET * 2))
    scale = min(room / glyph.width, room / glyph.height)
    fitted = glyph.resize((max(1, round(glyph.width * scale)), max(1, round(glyph.height * scale))), Image.LANCZOS)
    canvas.alpha_composite(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
    return canvas


def main() -> int:
    app = ROOT / "app"
    icon(512).save(app / "icon.png")
    icon(180).save(app / "apple-icon.png")
    # One file, three sizes: browsers pick the one they want, and the 16px is
    # drawn from its own render rather than downscaled from 512 by the browser.
    icon(48).save(app / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("wrote app/icon.png, app/apple-icon.png, app/favicon.ico")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

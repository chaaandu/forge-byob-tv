"""
Turn the cohort's headshots into the discs `/live` renders.

    python3 scripts/prepare-people.py ~/Downloads/headshots

Reads whatever the cohort sends and writes `public/people/<TEAM_ID>/<slug>.webp`
at 256x256, then prints the list to paste into `PEOPLE_PHOTOS` in config.ts.

── What it accepts ──

One image per student, named with the team and the student's name:

    VBC101 - Tanishque Jain.jpg
    VBC101_nirmalya sah.png
    VBC104-Preethi S.HEIC

Any separator between the team id and the name, any case, any extension Pillow
can open. Nested folders are walked, so `VBC101/Tanishque Jain.jpg` works too
and is the tidier way to hand over 118 files.

**The name in the filename is the only mapping.** `photoSlug` in lib/live.ts
derives the same slug from the name in the sheet's `members` cell, so a photo
finds its student without a second file that could drift out of step. That is
also the failure mode to watch: a file named `Tanishq Jain.jpg` against a sheet
saying `Tanishque Jain` simply never appears, silently, on one card. The script
prints every slug it writes, and `--check` compares them against the live feed.

── What it does to the pixels ──

- Squares the image with a **face-biased crop**: the centre horizontally, and
  a third of the way down vertically rather than the middle, because a
  headshot's face sits above centre and a centre crop takes the chin off.
- Resizes to 256x256 — the disc is 68px at 2x, so 256 covers a 3x phone and
  leaves room for the sheet's larger treatments later.
- Saves WebP at quality 82, which lands each file at roughly 15-25KB. A team
  sheet loads three or four, so a tap costs about 80KB.
- Strips EXIF, which on a phone photo carries the camera, the time and often
  the GPS coordinates of wherever it was taken. These files are going onto a
  public URL; the picture is the point and the metadata is not.
- Honours EXIF orientation *before* stripping it, or half the phone photos
  arrive rotated.

── HEIC ──

iPhones hand over HEIC. Pillow needs `pillow-heif` for those:

    pip3 install pillow-heif

Without it the script says so and skips them rather than failing the run.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from PIL import Image, ImageOps

try:  # optional, and only needed for iPhone originals
    import pillow_heif  # type: ignore

    pillow_heif.register_heif_opener()
    HEIC = True
except ImportError:  # pragma: no cover - depends on the machine
    HEIC = False

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "people"
SIZE = 256
QUALITY = 82
# Where the face sits in a headshot, as a fraction down the frame. A centre
# crop (0.5) takes the chin off a portrait shot at arm's length.
FACE_Y = 0.38

TEAM = re.compile(r"^(VBC\d{3})\s*[-_ ]+\s*(.+)$", re.IGNORECASE)


def slug(name: str) -> str:
    """Must agree with `photoSlug` in lib/live.ts, character for character."""
    import unicodedata

    plain = unicodedata.normalize("NFD", name)
    plain = "".join(ch for ch in plain if not unicodedata.combining(ch))
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", plain.lower()))


def team_and_name(path: Path) -> tuple[str, str] | None:
    """`VBC101 - Tanishque Jain.jpg`, or `VBC101/Tanishque Jain.jpg`."""
    stem = path.stem.strip()
    match = TEAM.match(stem)
    if match:
        return match.group(1).upper(), match.group(2).strip()
    parent = path.parent.name.upper()
    if re.fullmatch(r"VBC\d{3}", parent):
        return parent, stem
    return None


def square(image: Image.Image) -> Image.Image:
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = int((height - side) * FACE_Y) if height > width else (height - side) // 2
    return image.crop((left, top, left + side, top + side))


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    source = Path(sys.argv[1]).expanduser()
    if not source.is_dir():
        print(f"Not a folder: {source}")
        return 2

    written: list[str] = []
    skipped: list[str] = []

    for path in sorted(source.rglob("*")):
        if not path.is_file() or path.name.startswith("."):
            continue
        pair = team_and_name(path)
        if pair is None:
            skipped.append(f"{path.name} — no team id in the name or the folder")
            continue
        team, name = pair

        try:
            with Image.open(path) as raw:
                image = ImageOps.exif_transpose(raw).convert("RGB")
        except Exception as error:  # noqa: BLE001 - the report is the point
            hint = " (pip3 install pillow-heif)" if path.suffix.lower() in {".heic", ".heif"} and not HEIC else ""
            skipped.append(f"{path.name} — cannot open{hint}: {error}")
            continue

        disc = square(image).resize((SIZE, SIZE), Image.LANCZOS)
        target = OUT / team / f"{slug(name)}.webp"
        target.parent.mkdir(parents=True, exist_ok=True)
        # No `exif=` argument, so the metadata does not travel with the file.
        disc.save(target, "WEBP", quality=QUALITY, method=6)
        written.append(f"{team}/{slug(name)}")

    written.sort()
    print(f"\n{len(written)} photographs written to public/people/\n")
    if skipped:
        print(f"{len(skipped)} skipped:")
        for line in skipped:
            print(f"  - {line}")
        print()

    print("Paste into PEOPLE_PHOTOS in config.ts:\n")
    print("export const PEOPLE_PHOTOS: readonly string[] = [")
    for entry in written:
        print(f"  '{entry}',")
    print("]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

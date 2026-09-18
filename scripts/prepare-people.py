"""
Turn any photograph of a student into the same cutout the shoot produced.

    python3 scripts/prepare-people.py ~/Downloads/missing

Reads a folder of files named for their team and student, writes
`public/people/<TEAM_ID>/<slug>.webp`, and prints the lines to add to
`PEOPLE_PHOTOS` in config.ts.

    VBC103 - Annashri Mahato.jpg
    VBC137 - Kaavya Goenka.png
    VBC110/zuha fathima.heic      (a folder per team works too)

**The name must be spelled as `Team Links` spells it**, because that is what
`photoSlug` turns into a filename at the other end. A file named for a
different spelling of the same person simply never appears, silently, on one
card.

── This exists for the twelve the shoot missed ──

Seven of the cohort did not come to the shoot, four have no frame recorded
against them, and one is a first name the shoot has three of. Their cards show
initials until a photograph arrives from somewhere else — a phone, a re-shoot,
anywhere.

**Wherever it comes from, it lands in the same crop.** `scripts/cutout.py`
finds the face, builds the frame in face widths and removes the background, so
a photograph taken on a phone against a kitchen wall stands in the line-up at
the same scale as the studio ones. What it cannot fix is resolution: under
about 400px the face has nothing to enlarge and the initials are the better
card. The script says so rather than writing a mushy one.

Any format Pillow opens. HEIC needs `pip3 install pillow-heif`.
"""

from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cutout import HEADROOM, QUALITY, cut_out, detector, face_box, frame, portrait, subject_share

try:  # optional, and only needed for iPhone originals
    import pillow_heif  # type: ignore

    pillow_heif.register_heif_opener()
except ImportError:  # pragma: no cover - depends on the machine
    pass

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "people"
TEAM = re.compile(r"^(VBC\d{3})\s*[-_ ]+\s*(.+)$", re.IGNORECASE)
# Below this the face is too few pixels to enlarge into the frame.
MIN_FACE = 90


def slug(name: str) -> str:
    plain = unicodedata.normalize("NFD", name)
    plain = "".join(ch for ch in plain if not unicodedata.combining(ch))
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", plain.lower()))


def team_and_name(path: Path) -> tuple[str, str] | None:
    stem = path.stem.strip()
    match = TEAM.match(stem)
    if match:
        return match.group(1).upper(), match.group(2).strip()
    parent = path.parent.name.upper()
    if re.fullmatch(r"VBC\d{3}", parent):
        return parent, stem
    return None


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    source = Path(sys.argv[1]).expanduser()
    if not source.is_dir():
        print(f"Not a folder: {source}")
        return 2

    model = detector()
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
            hint = " (pip3 install pillow-heif)" if path.suffix.lower() in {".heic", ".heif"} else ""
            skipped.append(f"{path.name} — cannot open{hint}: {error}")
            continue

        box = face_box(model, image)
        if box is None:
            skipped.append(f"{path.name} — no face found")
            continue
        if box[3] < MIN_FACE:
            skipped.append(
                f"{path.name} — the face is only {box[3]}px tall; it would enlarge to mush, "
                "so the initials stay"
            )
            continue

        cut, gap = frame(cut_out(portrait(image, box)))
        if gap < HEADROOM:
            skipped.append(f"{path.name} — only {gap}px above the head; crop it looser and resend")
            continue
        share = subject_share(cut)
        if not 0.18 < share < 0.92:
            skipped.append(f"{path.name} — background removal looks wrong ({share:.0%} subject)")
            continue

        target = OUT / team / f"{slug(name)}.webp"
        target.parent.mkdir(parents=True, exist_ok=True)
        # No `exif=`: the camera, the time and any GPS stay behind.
        cut.save(target, "WEBP", quality=QUALITY, method=6)
        written.append(f"{team}/{target.stem}")

    written.sort()
    print(f"\n{len(written)} written to public/people/\n")
    if skipped:
        print(f"{len(skipped)} skipped:")
        for line in skipped:
            print(f"  - {line}")
        print()

    print("Add to PEOPLE_PHOTOS in config.ts:\n")
    for entry in written:
        print(f"  '{entry}',")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

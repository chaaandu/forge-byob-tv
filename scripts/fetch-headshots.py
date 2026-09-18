"""
Pull the cohort's headshots out of the Dropbox shoot and into `/live`.

    python3 scripts/fetch-headshots.py map.json [--only VBC101,VBC102]

`map.json` is `{"VBC101": [{"name": "Tanishque Jain", "slot": "5247"}, ...]}`.

── Why this exists rather than "download the folder" ──

The shoot is **22.6 GB**: 565 camera JPEGs at about 43 MB each, named
`DSC0<slot>.JPG`. `/live` needs 256x256. So each file is streamed, cropped and
written as WebP, and **the original is deleted before the next one starts** —
peak disk is one photo, and only the frames a student is actually matched to
are fetched.

Dropbox serves no resized preview for a shared-folder link; `&size=w640h480`
comes back as the full 43 MB original. Measured, twice. So the bandwidth is
the bandwidth: roughly 43 MB per student.

── The slot number is the join, and the join is a name ──

`Headshot Slots` (the shoot's running order) gives student name → slot number.
`Team Links` col D gives team → student names. Nothing links a *face* to a
team directly, so the two are matched on the name, and a name that does not
match confidently is **left out rather than guessed** — a face under the wrong
person is the one mistake on this page that would be worth an apology.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image, ImageOps

from cutout import QUALITY, cut_out, detector, face_box, portrait

FOLDER = (
    "https://www.dropbox.com/scl/fo/m36ozbh9jrqx0xerpsb5d/AAw7rl67gtYNEN0lnT1Co4o"
    "?rlkey=b4bz73hxyl8dnoszeu7iuaw0j"
)


def slug(name: str) -> str:
    import re
    import unicodedata

    plain = unicodedata.normalize("NFD", name)
    plain = "".join(ch for ch in plain if not unicodedata.combining(ch))
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", plain.lower()))


def fetch(slot: str) -> bool:
    """
    One frame, with retries.

    **Dropbox throttles a run of these.** The first full pass asked for a 40 MB
    original every ~35 seconds and 83 of 100 came back short or empty — then
    the same URLs served perfectly a minute later, so the failures were the
    rate and not the link. Hence three attempts with a widening pause, a
    breath between students, and a check that what arrived is actually a JPEG
    rather than an error page with a 200 on it.
    """
    url = f"{FOLDER}&preview=DSC0{slot}.JPG&dl=1"
    for attempt in range(3):
        if attempt:
            time.sleep(5 * 2**attempt)
        subprocess.run(
            ["curl", "-sL", "--max-time", "600", "-o", str(TMP), url],
            capture_output=True,
        )
        if TMP.exists() and TMP.stat().st_size > 1_000_000:
            with TMP.open("rb") as handle:
                if handle.read(2) == b"\xff\xd8":  # JPEG's start-of-image
                    return True
        print(f"      retrying ({attempt + 1}/3)", flush=True)
    return False


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    mapping = json.loads(Path(sys.argv[1]).read_text())
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))

    model = detector()
    written: list[str] = []
    failed: list[str] = []
    faceless: list[str] = []
    for team, people in sorted(mapping.items()):
        if only and team not in only:
            continue
        for person in people:
            name, slot = person["name"], person["slot"]
            target = OUT / team / f"{slug(name)}.webp"
            if target.exists():
                written.append(f"{team}/{target.stem}")
                continue
            print(f"  {team}  {name:26} DSC0{slot}.JPG …", flush=True)
            if not fetch(slot):
                failed.append(f"{team} {name} (slot {slot})")
                continue
            with Image.open(TMP) as raw:
                image = ImageOps.exif_transpose(raw).convert("RGB")
            box = face_box(model, image)
            if box is None:
                # No face, no cutout. A guessed crop of a person is worse than
                # the initials the page already draws.
                faceless.append(f"{team} {name} (slot {slot})")
                TMP.unlink(missing_ok=True)
                continue
            crop = portrait(image, box)
            target.parent.mkdir(parents=True, exist_ok=True)
            # No `exif=`: the camera, the time and any GPS stay behind.
            cut_out(crop).save(target, "WEBP", quality=QUALITY, method=6, lossless=False)
            written.append(f"{team}/{target.stem}")
            TMP.unlink(missing_ok=True)
            # A breath between students. The whole run is an hour either way;
            # what this buys is not being throttled into an 83% failure rate.
            time.sleep(2)

    written.sort()
    print(f"\n{len(written)} written, {len(failed)} failed, {len(faceless)} with no face found")
    for line in failed:
        print(f"  failed: {line}")
    for line in faceless:
        print(f"  no face found, left to initials: {line}")
    print("\nPaste into PEOPLE_PHOTOS in config.ts:\n")
    print("export const PEOPLE_PHOTOS: readonly string[] = [")
    for entry in written:
        print(f"  '{entry}',")
    print("]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

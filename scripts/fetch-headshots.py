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

import cv2
import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "people"
TMP = Path("/tmp/headshot-original.jpg")
# The cutout, not a thumbnail: wide enough for shoulders, tall enough to run
# off the bottom of the frame the way a line-up card does.
WIDTH = 330
HEIGHT = 440
QUALITY = 84

# ── The crop is found, not assumed ──
#
# **These are not headshots.** The shoot is environmental portraits: the
# student standing, half the frame behind them, shot at 6000x4000. A square
# taken from the middle — which is what a headshot pipeline does, and what the
# first run of this script did — produces a person the size of a thumbnail
# inside their own photograph. Measured on the first three: the face was about
# 7% of the crop's height.
#
# So YuNet finds the face and the square is built around it. The model is
# ~230KB and is fetched on first run rather than committed: it is a tool this
# project uses, not a thing this project ships.
YUNET = Path("/tmp/yunet-face.onnx")
YUNET_URL = (
    "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)
# ── One scale for everybody ──
#
# The students were shot at different distances, so a fixed crop would give a
# line-up of people at four different sizes — which reads as a mistake rather
# than a group. Every crop is therefore measured **in face widths**: the frame
# is 3.4 faces across and 4.6 faces tall, with the eyes a fifth of the way
# down. Heads then come out the same size whoever took two steps back.
FACE_W = 3.4
FACE_H = 4.6
EYE_LINE = 0.22

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


def detector() -> cv2.FaceDetectorYN:
    if not YUNET.exists():
        print("fetching the face model …")
        subprocess.run(["curl", "-sSL", "-o", str(YUNET), YUNET_URL], check=True)
    return cv2.FaceDetectorYN.create(str(YUNET), "", (320, 320), 0.6, 0.3, 5000)


def face_box(model: cv2.FaceDetectorYN, image: Image.Image) -> tuple[int, int, int, int] | None:
    """The largest face in the frame, as (x, y, w, h) in the image's own pixels."""
    # Detection runs on a downscaled copy: a 6000px frame is slow and the model
    # is trained near 320px anyway.
    scale = 1024 / max(image.size)
    small = image.resize((int(image.width * scale), int(image.height * scale)), Image.BILINEAR)
    frame = cv2.cvtColor(np.array(small), cv2.COLOR_RGB2BGR)
    model.setInputSize((frame.shape[1], frame.shape[0]))
    _, faces = model.detect(frame)
    if faces is None or len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])[:4]
    return int(x / scale), int(y / scale), int(w / scale), int(h / scale)


def portrait(image: Image.Image, box: tuple[int, int, int, int] | None) -> Image.Image | None:
    """Head and shoulders, scaled off the face so everyone matches."""
    if box is None:
        return None
    width, height = image.size
    x, y, w, h = box
    cw = int(w * FACE_W)
    ch = int(cw * HEIGHT / WIDTH)
    cx = x + w // 2
    cy = y + h // 2
    left = cx - cw // 2
    top = int(cy - ch * EYE_LINE)
    # Clamp into the frame, keeping the box's size — a cutout that shrank at
    # the edge of a photograph would break the one-scale rule above.
    left = max(0, min(width - cw, left)) if cw <= width else 0
    top = max(0, min(height - ch, top)) if ch <= height else 0
    return image.crop((left, top, left + cw, top + ch)).resize((WIDTH, HEIGHT), Image.LANCZOS)


def cut_out(image: Image.Image) -> Image.Image:
    """
    The background removed, so the line-up is a group rather than four framed
    pictures.

    `rembg`'s human-segmentation model, which is trained on exactly this —
    a person, a room behind them. The alpha is eroded by a pixel and blurred
    by one more: the raw matte leaves a bright halo of the office wall around
    the hair, and on a dark header that halo is the first thing the eye finds.
    """
    from rembg import new_session, remove

    global _SESSION
    if _SESSION is None:
        _SESSION = new_session("u2net_human_seg")
    cut = remove(image, session=_SESSION, post_process_mask=True)
    alpha = cut.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    cut.putalpha(alpha)
    return cut


_SESSION = None


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
            crop = portrait(image, box)
            if crop is None:
                # No face, no cutout. A guessed crop of a person is worse than
                # the initials the page already draws.
                faceless.append(f"{team} {name} (slot {slot})")
                TMP.unlink(missing_ok=True)
                continue
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

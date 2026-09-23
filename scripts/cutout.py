"""
The one crop, shared by both headshot scripts.

`fetch-headshots.py` takes the cohort's own shoot; `prepare-people.py` takes
whatever a student sends. **They must produce the same object** — a 330x440
cutout with the face at one fixed scale — or a line-up is a studio portrait
standing next to a phone snap and the group falls apart. So the geometry and
the background removal live here and neither script owns a copy.

Two things this has to survive that the shoot did not:

- **A small source.** A profile photograph is often 400x400. The crop this
  wants is measured in face widths and can easily be bigger than the file, so
  the image is upscaled until the crop fits rather than padded — padding puts
  bars in the frame, and a bar is the one thing background removal keeps.
- **A tight source.** A photograph already cropped to the head has no room for
  shoulders. Upscaling cannot invent them, so the crop is allowed to sit
  higher in the frame and the figure simply starts lower; everyone's *face*
  still lands at the same size, which is what the eye reads.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

# ── 20px of clear space down each side, and FACE_W moves with WIDTH ──
#
# The frame was 330 wide at 3.4 face widths, and the body reached a side edge
# on 92 of the 105 photographs — measured, with a median of 105 rows out of 440
# pressed flat against the right edge. A cutout whose shoulder is sliced by its
# own frame has no room to sit beside another one.
#
# 370 is 330 plus 20 a side. **`FACE_W` has to grow in the same proportion or
# the face shrinks**: the face occupies `WIDTH / FACE_W` pixels of the frame, so
# 330/3.4 and 370/3.81 are both 97px and every student stays the size they
# were. Change one without the other and every crop silently re-scales.
# ── 450, and the extra 80 is real body, not empty space ──
#
# 370 was 330 plus 20 a side — but the shoot's crops were never re-cut at 370;
# they were padded, so 76 of 113 had a body ending in a dead-straight vertical
# line 20px inside the frame, and every surface had to fade it. On 23
# September 2026 the frame went to 450 at the SAME face size (97px), and the
# photographs were re-cut from the shoot's originals, so a shoulder carries on
# to the edge. Surfaces draw the crop 450/370 = 121.6% of their person box,
# centred, so spacing and scale are exactly what they were at 370.
WIDTH = 450
HEIGHT = 440
QUALITY = 84

# Every crop is measured in face widths, so students photographed at different
# distances — or on a phone, or by LinkedIn — still come out the same size.
FACE_W = 4.64   # 450 / 97
FACE_H = 4.6

# ── Headroom is measured on the cutout, not guessed from the face box ──
#
# The first version placed the eyes a fifth of the way down and hoped. **91 of
# the first 105 came out with the hair flat against the top edge**, because the
# face box a detector returns covers eyebrows to chin — it knows nothing about
# how tall somebody's hair is, and that varies by more than the margin the
# framing left.
#
# So the crop is taken deliberately tall, the background is removed, and *then*
# the topmost opaque pixel — the real top of the hair — is measured and the
# final window placed against it. Every student ends up with the same gap above
# their head whatever their hair is doing.
HEADROOM = 27  # px in a 440-tall frame ≈ 8px at the 132px the squad renders
# How much taller than the final frame to cut before measuring. 1.6x covers the
# tallest hair in the cohort with room to spare.
OVERSHOOT = 1.6
# How far a small photograph may be enlarged to fit the crop. Past about three
# times, a 400px profile picture is mush and the initials are the better card.
MAX_UPSCALE = 3.0

YUNET = Path("/tmp/yunet-face.onnx")
YUNET_URL = (
    "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/"
    "face_detection_yunet/face_detection_yunet_2023mar.onnx"
)

_SESSION = None


def detector() -> cv2.FaceDetectorYN:
    if not YUNET.exists():
        print("fetching the face model …")
        subprocess.run(["curl", "-sSL", "-o", str(YUNET), YUNET_URL], check=True)
    return cv2.FaceDetectorYN.create(str(YUNET), "", (320, 320), 0.6, 0.3, 5000)


def face_box(model: cv2.FaceDetectorYN, image: Image.Image) -> tuple[int, int, int, int] | None:
    """The largest face in the frame, as (x, y, w, h) in the image's own pixels."""
    scale = min(1.0, 1024 / max(image.size))
    small = image.resize((int(image.width * scale), int(image.height * scale)), Image.BILINEAR)
    frame = cv2.cvtColor(np.array(small), cv2.COLOR_RGB2BGR)
    model.setInputSize((frame.shape[1], frame.shape[0]))
    _, faces = model.detect(frame)
    if faces is None or len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])[:4]
    return int(x / scale), int(y / scale), int(w / scale), int(h / scale)


def portrait(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """
    A deliberately tall crop around the face, at the shared scale.

    Taller than the frame that ships, because the top of the head cannot be
    found until the background is gone — see `HEADROOM`. `frame` does the
    final placement.
    """
    x, y, w, h = box
    cw = w * FACE_W
    ch = cw * HEIGHT / WIDTH * OVERSHOOT

    # Enlarge a small source until the crop fits inside it, up to the cap.
    grow = max(cw / image.width, ch / image.height, 1.0)
    if grow > 1.0:
        grow = min(grow, MAX_UPSCALE)
        image = image.resize((round(image.width * grow), round(image.height * grow)), Image.LANCZOS)
        x, y, w, h = (round(v * grow) for v in (x, y, w, h))
        cw = w * FACE_W
        ch = cw * HEIGHT / WIDTH * OVERSHOOT

    cw, ch = round(min(cw, image.width)), round(min(ch, image.height))
    cx, cy = x + w // 2, y + h // 2
    left = max(0, min(image.width - cw, round(cx - cw / 2)))
    # Centre the *face* in the tall crop and let `frame` decide the rest.
    top = max(0, min(image.height - ch, round(cy - ch * 0.42)))
    scale = WIDTH / cw
    tall = image.crop((left, top, left + cw, top + ch))
    return tall.resize((WIDTH, round(ch * scale)), Image.LANCZOS)


# ── Eyes on one line, not hair ──
#
# Placing the window by the top of the hair put every student's hair 27px from
# the top — and their EYES anywhere from y=98 to y=139, because hair is not
# the same height on everybody. In a line-up that reads as people placed at
# random. A group photograph lines up eyes. Measured across the cohort, hair
# to eye line is at most 112px, so eyes at 120 keeps every head 8px clear of
# the top; anyone taller than that sits lower rather than being cut.
EYE_Y = 120
MIN_TOP = 8


def eye_line(cut: Image.Image) -> int | None:
    """The eye line in the cutout's own pixels, from the face detector's landmarks."""
    ground = Image.new("RGB", cut.size, (200, 200, 200))
    ground.paste(cut, mask=cut.getchannel("A"))
    frame_ = cv2.cvtColor(np.array(ground), cv2.COLOR_RGB2BGR)
    model = detector()
    model.setInputSize((frame_.shape[1], frame_.shape[0]))
    _, faces = model.detect(frame_)
    if faces is None or len(faces) == 0:
        return None
    f = max(faces, key=lambda f: f[2] * f[3])
    return round((f[5] + f[7]) / 2)


def frame(cut: Image.Image) -> tuple[Image.Image, int]:
    """
    The final 450x440 window, placed so the eyes sit on `EYE_Y` — unless the
    hair would then come within `MIN_TOP` of the top edge, in which case the
    head sits lower instead.

    Returns the frame and the gap above the hair — smaller than `MIN_TOP` only
    when the photograph itself has nothing above the head, and the caller
    reports those.
    """
    bbox = cut.getchannel("A").getbbox()
    hair = bbox[1] if bbox else 0
    eye = eye_line(cut)
    top = hair - HEADROOM if eye is None else min(eye - EYE_Y, hair - MIN_TOP)
    top = max(0, top)
    gap = hair - top

    window = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    window.paste(cut.crop((0, top, WIDTH, min(top + HEIGHT, cut.height))), (0, 0))
    return window, gap


def cut_out(image: Image.Image) -> Image.Image:
    """
    The background removed, so a line-up is a group rather than framed pictures.

    The alpha is eroded by a pixel and blurred by one more: the raw matte
    leaves a bright halo of whatever was behind the person, and on a dark
    header that halo is the first thing the eye finds.
    """
    from rembg import new_session, remove

    global _SESSION
    if _SESSION is None:
        _SESSION = new_session("u2net_human_seg")
    cut = remove(image, session=_SESSION, post_process_mask=True)
    alpha = cut.getchannel("A").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    cut.putalpha(alpha)
    return cut


def subject_share(cut: Image.Image) -> float:
    """How much of the frame the person occupies. Near 0 or near 1 means the removal failed."""
    return sum(cut.getchannel("A").histogram()[200:]) / (cut.width * cut.height)

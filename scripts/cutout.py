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

WIDTH = 330
HEIGHT = 440
QUALITY = 84

# Every crop is measured in face widths, so students photographed at different
# distances — or on a phone, or by LinkedIn — still come out the same size.
FACE_W = 3.4
FACE_H = 4.6
EYE_LINE = 0.22
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
    """Head and shoulders, scaled off the face so everyone matches."""
    x, y, w, h = box
    cw = w * FACE_W
    ch = cw * HEIGHT / WIDTH

    # Enlarge a small source until the crop fits inside it, up to the cap.
    grow = max(cw / image.width, ch / image.height, 1.0)
    if grow > 1.0:
        grow = min(grow, MAX_UPSCALE)
        image = image.resize((round(image.width * grow), round(image.height * grow)), Image.LANCZOS)
        x, y, w, h = (round(v * grow) for v in (x, y, w, h))
        cw, ch = w * FACE_W, w * FACE_W * HEIGHT / WIDTH

    cw, ch = round(min(cw, image.width)), round(min(ch, image.height))
    cx, cy = x + w // 2, y + h // 2
    left = max(0, min(image.width - cw, round(cx - cw / 2)))
    top = max(0, min(image.height - ch, round(cy - ch * EYE_LINE)))
    return image.crop((left, top, left + cw, top + ch)).resize((WIDTH, HEIGHT), Image.LANCZOS)


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

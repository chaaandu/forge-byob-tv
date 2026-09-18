"""
Rewrite `PEOPLE_PHOTOS` in config.ts from what is actually on disk.

    python3 scripts/register-people.py

**Run this after anything that writes or removes a photograph.** The manifest
is the list the page reads — `components/live/Lineup.tsx` never looks at the
filesystem — so an entry with no file behind it is a broken image on
somebody's phone. That is not hypothetical: re-running the fetch meant
emptying `public/people/` first, and for the length of that run every card
asked for 105 files that were not there yet.
"""

import glob
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
entries = sorted(
    f"{os.path.basename(os.path.dirname(f))}/{os.path.basename(f)[:-5]}"
    for f in glob.glob(str(ROOT / "public/people/*/*.webp"))
)
config = ROOT / "config.ts"
source = config.read_text()
block = (
    "export const PEOPLE_PHOTOS: readonly string[] = [\n"
    + "".join(f"  '{e}',\n" for e in entries)
    + "]"
)
config.write_text(
    re.sub(r"export const PEOPLE_PHOTOS: readonly string\[\] = \[[^\]]*\]", block, source, flags=re.S)
)
print(f"{len(entries)} photographs registered")

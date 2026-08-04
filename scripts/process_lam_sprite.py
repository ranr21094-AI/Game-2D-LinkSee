"""Slice the AI-generated Lam sprite row into a uniform 3-frame 64x64 game sheet.

Source: tmp/lam-raw.png (transparent). Detects the three figures as connected
components (the source is not on a strict grid), normalizes by the standing
figure's height so all poses share one body scale, feet baseline at y=60.
Output: src/assets/lam.png — frames [idle, wave, camera].
"""
from PIL import Image
import numpy as np

RAW = "tmp/lam-raw.png"
OUT = "src/assets/lam.png"
CHECK = "tmp/lam-check.png"

CHAR_H = 56
BASELINE = 60
CELL = 64
MIN_AREA = 800

raw = Image.open(RAW).convert("RGBA")
mask = np.array(raw.getchannel("A")) > 10

labels = np.zeros(mask.shape, dtype=np.int32)
components = []
current = 0
for sy in range(mask.shape[0]):
    for sx in range(mask.shape[1]):
        if not mask[sy, sx] or labels[sy, sx]:
            continue
        current += 1
        stack = [(sy, sx)]
        labels[sy, sx] = current
        pixels = []
        while stack:
            y, x = stack.pop()
            pixels.append((y, x))
            for ny, nx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = current
                    stack.append((ny, nx))
        if len(pixels) >= MIN_AREA:
            ys = [p[0] for p in pixels]
            xs = [p[1] for p in pixels]
            components.append({"label": current, "area": len(pixels), "cx": sum(xs) / len(xs),
                               "bbox": (min(xs), min(ys), max(xs) + 1, max(ys) + 1)})

components.sort(key=lambda c: c["cx"])
figures = components[:3]
if len(figures) < 3:
    raise SystemExit(f"expected 3 figures, found {len(figures)}")

crops = []
for fig in figures:
    single = np.where(labels == fig["label"], 255, 0).astype("uint8")
    piece = raw.copy()
    piece.putalpha(Image.fromarray(single))
    crops.append(piece.crop(fig["bbox"]))

scale = CHAR_H / crops[0].height

frames = []
for crop in crops:
    resized = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.LANCZOS)
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cell.paste(resized, ((CELL - resized.width) // 2, BASELINE - resized.height), resized)
    frames.append(cell)

sheet = Image.new("RGBA", (CELL * 3, CELL), (0, 0, 0, 0))
for index, frame in enumerate(frames):
    sheet.paste(frame, (index * CELL, 0), frame)
sheet.save(OUT)

zoom = 6
check = Image.new("RGBA", (sheet.width * zoom, sheet.height * zoom), (60, 58, 54, 255))
check.paste(sheet.resize((sheet.width * zoom, sheet.height * zoom), Image.NEAREST), (0, 0))
check.save(CHECK)
print("saved", OUT, sheet.size, "and", CHECK)

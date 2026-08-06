"""Turn a Seedream green-screen egg-tart vendor into the 64x64 game sprite.

Chroma-key strategy: flood-fill from the image border through green-dominant
pixels (G clearly above R and B). Whatever the flood reaches from the border is
background. Interior non-green pixels — including the olive apron — survive,
because nothing connects them to the border through green. Then trim to the
figure box, nearest-neighbor downscale to the shared 64px cell with the feet on
the baseline (y=61). Writes the game asset, a zoomed check preview, and prints a
coarse ASCII map.

Usage: python scripts/process_egg_tart_vendor.py <source.png> [out.png]
"""
import sys
from collections import deque

import numpy as np
from PIL import Image

RAW = sys.argv[1] if len(sys.argv) > 1 else "docs/q-align/generated-sources/egg-tart-vendor-candidate-1.png"
OUT = sys.argv[2] if len(sys.argv) > 2 else "src/assets/egg-tart-vendor-pixel.png"

CELL = 64
CHAR_H = 58
BASELINE = 61
EXCESS = 30          # G - max(R,B) above this counts as floodable background
MIN_AREA = 1500      # drop leftover specks at 2048px scale


def flood_background(a, excess):
    h, w = excess.shape
    removed = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if excess[y, x] > EXCESS and not removed[y, x]:
                removed[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if excess[y, x] > EXCESS and not removed[y, x]:
                removed[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and excess[ny, nx] > EXCESS and not removed[ny, nx]:
                removed[ny, nx] = True
                q.append((ny, nx))
    return removed


def largest_component(mask):
    labels = np.zeros(mask.shape, dtype=np.int32)
    best = None
    current = 0
    stack = []
    for sy in range(mask.shape[0]):
        for sx in range(mask.shape[1]):
            if not mask[sy, sx] or labels[sy, sx]:
                continue
            current += 1
            stack.append((sy, sx))
            labels[sy, sx] = current
            n = 0
            xmin = xmax = sx
            ymin = ymax = sy
            while stack:
                y, x = stack.pop()
                n += 1
                xmin, xmax = min(xmin, x), max(xmax, x)
                ymin, ymax = min(ymin, y), max(ymax, y)
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = current
                        stack.append((ny, nx))
            if n >= MIN_AREA and (best is None or n > best["n"]):
                best = {"n": n, "bbox": (xmin, ymin, xmax + 1, ymax + 1)}
    return best


def main():
    raw = Image.open(RAW).convert("RGBA")
    a = np.array(raw)
    r, g, b = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
    excess = g - np.maximum(r, b)

    removed = flood_background(a, excess)
    alpha = np.where(removed, 0, 255).astype("uint8")

    # De-fringe: kill greenish ring pixels that survived right at the figure edge.
    defringed = np.where((excess > EXCESS * 0.45) & (excess <= EXCESS), 0, 255).astype("uint8")
    alpha = np.minimum(alpha, defringed)

    # Keep only the largest connected non-background figure (drops green specks
    # and anything the flood could not reach but that is not the figure).
    keep = largest_component(alpha == 255)
    if keep is None:
        raise SystemExit("no figure component found")
    bbox = keep["bbox"]
    comp_mask = np.zeros(alpha.shape, dtype=bool)
    comp_mask[bbox[1]:bbox[3], bbox[0]:bbox[2]] = True
    alpha = np.where(comp_mask, alpha, 0).astype("uint8")
    a[:, :, 3] = alpha
    piece = Image.fromarray(a).crop(bbox)
    print("figure bbox", bbox, "size", piece.size, "kept px", keep["n"])

    # Nearest-neighbor downscale: fit figure height to CHAR_H, feet at BASELINE.
    scale = CHAR_H / piece.height
    resized = piece.resize((max(1, round(piece.width * scale)), max(1, round(piece.height * scale))), Image.NEAREST)
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cell.paste(resized, ((CELL - resized.width) // 2, BASELINE - resized.height), resized)
    cell.save(OUT)

    zoom = 8
    check = Image.new("RGBA", (CELL * zoom, CELL * zoom), (70, 66, 60, 255))
    check.paste(cell.resize((CELL * zoom, CELL * zoom), Image.NEAREST), (0, 0))
    check_path = OUT.replace(".png", "-check.png")
    check.save(check_path)

    # Coarse ASCII map (every pixel one char, transparent = space).
    p = np.array(cell)
    rows = []
    for y in range(CELL):
        line = ""
        for x in range(CELL):
            r, g, b, al = p[y, x]
            if al < 40:
                line += " "
            elif g > r + 20 and g > b + 20:
                line += "G"
            elif r > 180 and g > 120 and b < 90:
                line += "o"  # gold/tart
            elif r > 150 and g > 130 and b > 100:
                line += "."  # cream/white
            elif r < 90 and g < 90 and b < 90:
                line += "#"  # dark
            elif g > r + 5 and g > b + 5:
                line += "g"  # olive/green apron
            else:
                line += "x"  # mid tone
        rows.append(line)
    print("\n".join(rows))
    print("saved", OUT, "and", check_path)


if __name__ == "__main__":
    main()

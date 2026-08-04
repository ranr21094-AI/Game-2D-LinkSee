"""Slice the AI-generated 6x3 walk sheet into a uniform 4-direction x 3-frame game sheet.

Source: tmp/traveler-walk-raw.png (1536x1024, transparent).
Columns: 0-1 back, 2-4 right profile, 5 front. Rows: 3 walk poses.
Output: src/assets/traveler-walk.png — rows [up, left, right, down], 3 frames each,
64x64 cells, character height ~56px, feet baseline at y=60.
"""
from PIL import Image

RAW = "tmp/traveler-walk-raw.png"
OUT = "src/assets/traveler-walk.png"
CHECK = "tmp/traveler-walk-check.png"

COLS = {"up": 1, "right": 3, "down": 5}
ROWS_Y = [(0, 341), (341, 682), (682, 1024)]
CELL_W = 256
CHAR_H = 56
BASELINE = 60
CELL = 64

raw = Image.open(RAW).convert("RGBA")

def largest_component(img: Image.Image) -> Image.Image:
    """Keep only the largest connected opaque blob (drops specks bled from neighbor cells)."""
    import numpy as np
    mask = np.array(img.getchannel("A")) > 10
    if not mask.any():
        return img
    labels = np.zeros(mask.shape, dtype=np.int32)
    current = 0
    sizes = []
    for sy in range(mask.shape[0]):
        for sx in range(mask.shape[1]):
            if not mask[sy, sx] or labels[sy, sx]:
                continue
            current += 1
            stack = [(sy, sx)]
            labels[sy, sx] = current
            count = 0
            while stack:
                y, x = stack.pop()
                count += 1
                for ny, nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
                    if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = current
                        stack.append((ny, nx))
            sizes.append(count)
    keep = 1 + int(np.argmax(sizes))
    cleaned = img.copy()
    cleaned.putalpha(Image.fromarray((np.where(labels == keep, 255, 0)).astype("uint8")))
    return cleaned

def trim(img: Image.Image) -> Image.Image:
    img = largest_component(img)
    bbox = img.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()
    return img.crop(bbox) if bbox else img

def normalize(img: Image.Image) -> Image.Image:
    img = trim(img)
    scale = CHAR_H / img.height
    w = max(1, round(img.width * scale))
    return img.resize((w, CHAR_H), Image.LANCZOS)

def place(img: Image.Image) -> Image.Image:
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cell.paste(img, ((CELL - img.width) // 2, BASELINE - img.height), img)
    return cell

poses = {}
for direction, col in COLS.items():
    frames = []
    for y0, y1 in ROWS_Y:
        cell = raw.crop((col * CELL_W, y0, (col + 1) * CELL_W, y1))
        frames.append(place(normalize(cell)))
    poses[direction] = frames
poses["left"] = [frame.transpose(Image.FLIP_LEFT_RIGHT) for frame in poses["right"]]

sheet = Image.new("RGBA", (CELL * 3, CELL * 4), (0, 0, 0, 0))
for row, direction in enumerate(["up", "left", "right", "down"]):
    for col, frame in enumerate(poses[direction]):
        sheet.paste(frame, (col * CELL, row * CELL), frame)
sheet.save(OUT)

zoom = 6
check = Image.new("RGBA", (sheet.width * zoom, sheet.height * zoom), (60, 58, 54, 255))
check.paste(sheet.resize((sheet.width * zoom, sheet.height * zoom), Image.NEAREST), (0, 0))
check.save(CHECK)
print("saved", OUT, sheet.size, "and", CHECK)

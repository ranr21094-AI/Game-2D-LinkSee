"""Process the AI-generated Ruins of St. Paul facade into base/memory/warm game assets.

Keeps the largest connected component (drops the watermark), trims, resizes to a
200px-tall native module, then derives:
  warm   -> as generated (full color)
  memory -> mix(grayscale, warm, 0.34) matching ground-tiles TONES
  base   -> grayscale with the same luma weights as ground-tiles (0.24/0.68/0.08)
Output: src/assets/ruins-facade-{base,memory,warm}.png + tmp/ruins-facade-check.png
"""
from PIL import Image
import numpy as np

RAW = "tmp/ruins-facade-raw.png"
NATIVE_H = 200

raw = Image.open(RAW).convert("RGBA")
mask = np.array(raw.getchannel("A")) > 10

labels = np.zeros(mask.shape, dtype=np.int32)
current = 0
best_label, best_size = 0, 0
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
            for ny, nx in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = current
                    stack.append((ny, nx))
        if count > best_size:
            best_size, best_label = count, current

facade = raw.copy()
facade.putalpha(Image.fromarray(np.where(labels == best_label, 255, 0).astype("uint8")))
bbox = facade.getchannel("A").getbbox()
facade = facade.crop(bbox)

scale = NATIVE_H / facade.height
facade = facade.resize((max(1, round(facade.width * scale)), NATIVE_H), Image.LANCZOS)

rgb = np.array(facade.convert("RGB")).astype(np.float32)
alpha = facade.getchannel("A")
gray = (rgb[..., 0] * 0.24 + rgb[..., 1] * 0.68 + rgb[..., 2] * 0.08)
gray3 = np.stack([gray, gray, gray], axis=-1)
memory = gray3 * (1 - 0.34) + rgb * 0.34

def save(arr: np.ndarray, path: str) -> None:
    out = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"))
    out.putalpha(alpha)
    out.save(path)

save(rgb, "src/assets/ruins-facade-warm.png")
save(memory, "src/assets/ruins-facade-memory.png")
save(gray3, "src/assets/ruins-facade-base.png")

strip = Image.new("RGBA", (facade.width * 3 + 24, NATIVE_H + 16), (60, 58, 54, 255))
for index, name in enumerate(["base", "memory", "warm"]):
    state = Image.open(f"src/assets/ruins-facade-{name}.png")
    strip.paste(state, (8 + index * (facade.width + 8), 8), state)
strip = strip.resize((strip.width * 3, strip.height * 3), Image.NEAREST)
strip.save("tmp/ruins-facade-check.png")
print("saved 3 states,", facade.size)

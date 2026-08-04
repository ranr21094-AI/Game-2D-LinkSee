"""Preview generator for tactile brick textures (mirrors the JS spec, 8x zoom)."""
import random
from PIL import Image, ImageDraw

CELL = 20          # texture canvas: 16px brick + 2px transparent margin
MARGIN = 2
SCALE = 8

PALETTES = {
    "normal": dict(base=(125, 122, 108), grout=(74, 71, 60), seam_light=(150, 146, 128),
                   ridge=(168, 162, 138), ridge_light=(196, 190, 164), ridge_dark=(88, 84, 68)),
    "lit": dict(base=(164, 134, 74), grout=(104, 84, 44), seam_light=(200, 172, 110),
                ridge=(226, 198, 128), ridge_light=(246, 230, 176), ridge_dark=(128, 102, 52)),
}


def jitter(c, amount, rng):
    return tuple(max(0, min(255, v + rng.randint(-amount, amount))) for v in c)


def draw_brick(draw: ImageDraw.ImageDraw, ox: int, oy: int, p: dict, kind: str, rng: random.Random, wear: int = 2):
    x0, y0 = ox + MARGIN, oy + MARGIN
    # soft contact shadow bleeding into the transparent margin
    draw.rectangle([x0 - 1, y0 + 1, x0 + 16, y0 + 17], fill=(0, 0, 0, 70))
    # grout bed (the gap between bricks)
    draw.rectangle([x0, y0, x0 + 15, y0 + 15], fill=p["grout"])
    # brick body inset by 1px of grout
    for y in range(1, 15):
        for x in range(1, 15):
            draw.point((x0 + x, y0 + y), fill=jitter(p["base"], 7, rng))
    # wet top highlight / bottom shadow on the body
    for x in range(1, 15):
        draw.point((x0 + x, y0 + 1), fill=jitter(p["seam_light"], 5, rng))
        draw.point((x0 + x, y0 + 14), fill=jitter(p["grout"], 4, rng))
    # worn corners
    for _ in range(wear):
        cx = x0 + rng.choice([1, 2, 13, 14])
        cy = y0 + rng.choice([1, 2, 13, 14])
        draw.point((cx, cy), fill=p["grout"])

    if kind == "guidance":
        for i in range(4):
            rx = x0 + 2 + i * 3
            # ridge shadow
            for y in range(3, 14):
                draw.point((rx + 1, y + 1), fill=jitter(p["ridge_dark"], 5, rng))
            # ridge body 2px wide with rounded ends
            for y in range(2, 14):
                for dx in (0, 1):
                    if y in (2, 13) and dx == 1:
                        continue
                    draw.point((rx + dx, y), fill=jitter(p["ridge"], 6, rng))
                draw.point((rx, y), fill=jitter(p["ridge_light"], 5, rng))
    else:
        for row in range(4):
            for col in range(4):
                cx = x0 + 3 + col * 3
                cy = y0 + 3 + row * 3
                draw.point((cx + 1, cy + 1), fill=p["ridge_dark"])
                draw.point((cx, cy), fill=jitter(p["ridge"], 6, rng))
                draw.point((cx, cy - 1), fill=jitter(p["ridge_light"], 5, rng))
                draw.point((cx - 1, cy), fill=jitter(p["ridge"], 6, rng))


def sheet(palette_name: str) -> Image.Image:
    rng = random.Random(20260804)
    p = PALETTES[palette_name]
    # row: 6 guidance bricks (strip look) + gap + 2 decision bricks
    width = CELL * 6 + 12 + CELL * 2
    img = Image.new("RGBA", (width, CELL), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for i in range(6):
        draw_brick(draw, i * CELL, 0, p, "guidance", rng)
    for i in range(2):
        draw_brick(draw, 6 * CELL + 12 + i * CELL, 0, p, "decision", rng)
    return img.resize((width * SCALE, CELL * SCALE), Image.NEAREST)


def pavement(w: int, h: int, rng: random.Random) -> Image.Image:
    """faux warm-gray stone pavement to judge how bricks sit in the scene"""
    img = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(img)
    base = (96, 94, 88)
    for y in range(h):
        for x in range(w):
            draw.point((x, y), fill=jitter(base, 9, rng))
    # stone slab seams every 24px
    for x in range(0, w, 24):
        draw.line([(x, 0), (x, h)], fill=(70, 68, 63))
    for y in range(0, h, 24):
        draw.line([(0, y), (w, y)], fill=(70, 68, 63))
    return img


rng = random.Random(7)
bg = pavement(CELL * 8 + 24, CELL * 4, rng)
# lay a strip of guidance bricks onto the pavement, then a decision brick
p = PALETTES["normal"]
strip = Image.new("RGBA", bg.size, (0, 0, 0, 0))
d = ImageDraw.Draw(strip)
for i in range(8):
    draw_brick(d, 12 + i * CELL, 24, p, "guidance", random.Random(100 + i))
draw_brick(d, 12 + 8 * CELL + 4, 24, p, "decision", random.Random(55))
scene = Image.alpha_composite(bg, strip).resize((bg.width * 4, bg.height * 4), Image.NEAREST)

sheet("normal").save("docs/q-align/brick-preview-normal.png")
sheet("lit").save("docs/q-align/brick-preview-lit.png")
scene.save("docs/q-align/brick-preview-scene.png")
print("saved")

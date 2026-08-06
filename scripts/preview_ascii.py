"""Print compact 16x16 ASCII previews of processed vendor candidates."""
import sys
import numpy as np
from PIL import Image

for arg in sys.argv[1:]:
    cell = Image.open(arg).convert("RGBA")
    a = np.array(cell)
    print(f"===== {arg} =====")
    for by in range(16):
        line = ""
        for bx in range(16):
            ys, ys2 = by * 4, (by + 1) * 4
            xs, xs2 = bx * 4, (bx + 1) * 4
            block = a[ys:ys2, xs:xs2]
            al = block[:, :, 3]
            if (al > 40).mean() < 0.12:
                line += " "
                continue
            rgb = block[al > 40][:, :3].astype(int)
            r, g, b = rgb[:, 0].mean(), rgb[:, 1].mean(), rgb[:, 2].mean()
            if g > r + 25 and g > b + 25:
                line += "G"
            elif r > 170 and g > 110 and b < 90:
                line += "o"
            elif r > 150 and g > 130 and b > 100:
                line += "."
            elif r < 95 and g < 95 and b < 95:
                line += "#"
            else:
                line += "x"
        print(line)

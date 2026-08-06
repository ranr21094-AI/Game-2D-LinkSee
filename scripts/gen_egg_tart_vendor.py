"""Generate egg-tart vendor sprite candidates via Seedream (doubao-seedream-5-0).

Each candidate is an independent single-image call so the design can vary. They
are drawn on a pure green screen so a chroma-key pass can isolate the figure.

Output: docs/q-align/generated-sources/egg-tart-vendor-candidate-{1..N}.png
"""
import base64
import datetime
import os
import sys
from openai import OpenAI

API_KEY = os.environ.get("ARK_API_KEY")
if not API_KEY:
    raise SystemExit(
        "Missing ARK_API_KEY environment variable (火山方舟 API key). "
        "Set it before running, e.g. in PowerShell:\n"
        "  $env:ARK_API_KEY = '...'; python scripts/gen_egg_tart_vendor.py 3"
    )

CLIENT = OpenAI(
    base_url="https://ark.cn-beijing.volces.com/api/v3",
    api_key=API_KEY,
)
OUT_DIR = r"docs/q-align/generated-sources"
COUNT = int(sys.argv[1]) if len(sys.argv) > 1 else 3
START = int(sys.argv[2]) if len(sys.argv) > 2 else 2

PROMPT = (
    "澳门像素风游戏里的老年摊主正面全身像素精灵图（16-bit 硬边像素艺术，色彩鲜艳）。"
    "人物：白色纸帽、黑色短发、圆脸带微笑和淡淡腮红、深绿色围裙内搭米色衬衫、"
    "深色长裤和深色皮鞋。双手在腰部高度于身前托住一个木质托盘，双手清晰可见，"
    "托盘上三只金黄酥脆的葡挞。全身完整可见：纸帽顶端到脚尖全部在画面内，"
    "躯干清晰、双腿完整，双脚脚尖踩在画面底边，人物居中。"
    "纯绿色背景（纯绿幕 #00FF00），不要地面阴影，"
    "无文字、无水印、无边框、无 HUD、无任何多余元素。"
)

os.makedirs(OUT_DIR, exist_ok=True)
for index in range(START, START + COUNT):
    resp = CLIENT.images.generate(
        model="doubao-seedream-5-0-260128",
        prompt=PROMPT,
        size="2K",
        response_format="b64_json",
        extra_body={"watermark": False, "output_format": "png"},
    )
    b64 = resp.data[0].b64_json
    path = os.path.join(OUT_DIR, f"egg-tart-vendor-candidate-{index}.png")
    with open(path, "wb") as f:
        f.write(base64.b64decode(b64))
    print("Saved:", path)

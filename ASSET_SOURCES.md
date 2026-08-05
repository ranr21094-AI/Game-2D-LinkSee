# 素材来源

当前生产素材、ImageGen 处理记录和 CC0 音频许可统一登记在 [`docs/q-align/ASSET_SOURCES.md`](docs/q-align/ASSET_SOURCES.md)。

2026-08-05 过场更新使用内置 ImageGen 生成 `chapter-map-pixel-v2.png` 与 `bus-window-panorama-pixel.png`；章节背景明确不含路线圆点、连线或文字，车窗图仅作为局部滚动模块。

2026-08-05 口岸序章新增 `sighted-guide-tutorial-pixel.png` 三格扶盲教学图；中文要点由界面叠加。旧 `gate-facade` 位图退出运行时，拱北口岸改由 16px 程序化建筑瓦片组成。

2026-08-05 上车公益贴士新增 `bus-accessibility-tip-pixel.png`；内置 ImageGen 生成暖灰雨夜像素插画，表现盲人等车与公众主动询问协助，不含品牌、可读文字、水印或用户照片中的人物元素。

2026-08-05 公交车厢重做新增 `bus-interior-modules-pixel.png`；内置 ImageGen 生成模块化雨窗、座椅、扶杆、刷卡机、按铃和顶灯图集，去除绿幕后按模块裁切，车厢交互与碰撞仍由代码定义。

2026-08-05 公交无障碍贴士改用 `bus-ride-access-tip-pixel.png`；内置 ImageGen 生成完整暖灰雨夜像素车厢公益插画，不含品牌、可读文字、水印或用户照片元素。公交乘客座椅改为程序化像素绘制，图集中的座椅裁剪不再进入运行时。

2026-08-05 公交车厢下排坐姿新增 `traveler-sit-up.png`；内置 ImageGen 参考上排坐姿生成背向/向上坐姿，绿幕去除辅助处理后以 nearest-neighbor 缩至 64×64，无盲杖。

历史整图背景和 M2–M4 图片条已经从生产代码与 `src/assets/` 删除；它们不再代表当前瓦片化版本。

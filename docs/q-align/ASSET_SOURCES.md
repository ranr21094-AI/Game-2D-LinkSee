# AI 素材来源

所有以下素材均由 Codex 内置 ImageGen 在本项目 M2-M4 批次生成，生成后以项目内 PNG 形式保存；洋红色背景素材使用 ImageGen 技能附带的 `remove_chroma_key.py` 转为透明 PNG。素材仅作为场景装饰，不承载触觉路径、玩家、HUD 或路线逻辑。

| 项目素材 | 用途 | 生成预览 / 处理 |
| --- | --- | --- |
| `src/assets/m2-border-gate-strip.png` | 關閘候车区上方建筑条 | ImageGen 原图，保留雨夜背景并在 Phaser 中缩放为 640×108 |
| `src/assets/m2-bus-shelter.png` | 玻璃候车亭与金属栏杆 | ImageGen 洋红抠像，去除背景后缩放为 240×120 |
| `src/assets/m2-bus-side-states.png` | 公交车闭门/开门双状态 | ImageGen 洋红抠像，左右半幅分别代表闭门与开门 |
| `src/assets/m2-bus-interior-strip.png` | 车厢窗带、扶手与雨夜窗景 | ImageGen 洋红抠像，去除背景后缩放为 640×72 |
| `src/assets/m2-bus-stop-sign.png` | 站牌模板 | ImageGen 洋红抠像；17/25 数字由代码绘制，确保文字清晰 |

本批次预览在生成后逐项展示并检查了构图、透明边缘和禁止元素；代码仍以瓦片和程序化文字提供可验证的游戏语义。

## M4

| 项目素材 | 用途 | 生成预览 / 处理 |
| --- | --- | --- |
| `src/assets/chapter-map.png` | 章节过场的澳门路线地图 | ImageGen 原图，节点与中文标签由 React 叠加 |
| `src/assets/npc-spritesheet.png` | 卖花人、雨伞行人、老年观鸟者 NPC 表 | ImageGen 4×3 洋红抠像，去除背景后按 362×362 帧加载 |

## M3-M4 路线重构与街区房屋模块

| 项目素材 | 用途 | 生成预览 / 处理 |
| --- | --- | --- |
| `src/assets/traveler-no-cane.png` | 无拐杖玩家四向 spritesheet；实时盲杖由代码绘制 | ImageGen 基于原玩家表做无拐杖编辑；黑色背景自动抠像并保留 RGBA |
| `src/assets/m3-oldcity-house-left.png` | 旧城左侧澳门骑楼立面 | ImageGen 洋红抠像，透明叠加在旧城瓦片上，纯装饰 |
| `src/assets/m3-oldcity-house-right.png` | 旧城右侧澳门骑楼立面 | ImageGen 洋红抠像，透明叠加在旧城瓦片上，纯装饰 |
| `src/assets/m3-oldcity-arcade-corner.png` | 旧城街角与骑楼柱廊模块 | ImageGen 洋红抠像，透明叠加在旧城上方边缘，纯装饰 |
| `src/assets/m3-crossing-corner-left.png` | 路口左侧转角房屋模块 | ImageGen 洋红抠像，透明叠加在路口边缘，纯装饰 |
| `src/assets/m3-crossing-corner-right.png` | 路口右侧转角房屋模块 | ImageGen 洋红抠像，透明叠加在路口边缘，纯装饰 |
| `src/assets/m4-ruins-lowrise-wall.png` | 牌坊周围低层房屋与石墙模块 | ImageGen 洋红抠像，透明叠加在牌坊场景两侧，中心留空，纯装饰 |

以上六组房屋素材与无拐杖玩家素材均在接入前逐项预览，检查了暖灰雨夜像素风、透明边缘与无品牌/可读文字约束。

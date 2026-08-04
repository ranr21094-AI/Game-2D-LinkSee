# Design QA

## 2026-08-05 重做修复批次验收（当前有效版本）

- Browser URL: `http://localhost:5173/`（DEV 跳转栏可分段进入候车/车厢/过场/旧城/路口/终点）
- 静态验证：`tsc -b` 通过；`vitest run src` 48 个测试全部通过（含 colorMemory 容量新增用例）
- 本批修复回归清单：
  1. 站牌确认后场景内 `objectiveId` 同步为 `board-17`，车门 (488,284) 交互与 HUD/Q/H 指向恢复正常。
  2. 巴士过场跳过（>3 秒按 E）时补发 `bus-rain` 记忆，跳过不再惩罚终章层级与结局指标。
  3. 建筑图集五模块按裁切宽高比 contain-fit 显示，骑楼恢复竖向比例，无非等比压扁。
  4. 程序化装饰（关闸/候车亭/巴士/车窗等）按实际显示尺寸原生重绘，消除拉伸。
  5. 触觉砖调色板重构 + 四边描边，在 plaza 灰（≈126）地面上轮廓清晰可读。
  6. 暖色恢复 2 秒后改为 750ms 叠层渐变淡出至 35% 淡彩记忆，不再整砖/整楼硬切。
  7. 主角接入四向 × 三帧走路动画（7fps），身高 100px → 56px 原生 1:1，脚部锚点；NPC 58px。
  8. 林伯独立三姿态精灵（站立/挥手/举相机），终章播放挥手→举相机动画。
  9. 大三巴牌坊换用手绘模块（base/memory/warm 三态与地砖同权重派生），程序化矩形版退役。
  10. `colorMemory` 增加 240 条硬上限（丢弃最旧）、去重距离 32px、每帧场景记忆引用缓存。
  11. 扶手段方向键 ↑/↓ 与 W/S 等效，恢复双键位约定。

### 端到端手动验收清单

| 段落 | 验收点 |
| --- | --- |
| 主菜单/教学 | 标题、继续按钮状态；教学页四纹/点阵示例与键位表正确 |
| 關閘候车 | 站牌凸字 17 与诱饵 25 可分别敲出；确认 17 后 HUD 切换为车门任务；车门开启后到 (488,284) 出现「E 上车」；误入车行道触发车流警告并退回人行道 |
| 车厢 | 杖击座位边缘后才可 E 入座；四纹盲道与点阵砖常显 |
| 过场 | 3 秒后可 E 跳过；跳过与不跳过均获得 `bus-rain` 记忆；报站字幕按时刻出现 |
| 白鸽巢 | 三帧步态正常、朝向正确；支路围栏敲出障碍文案并收录 `old-city-bell`；金属扶手敲出后可 E 握住，W/S/↑/↓ 移动，走到底切换路口 |
| 路口 | E 请求通行 → 等待 → 双音提示后可通行；走廊约束正交；对岸点阵右转离开 |
| 大三巴 | 手绘牌坊三态正常；暖色 2 秒保持 + 750ms 淡出；E 回应林伯触发暖色波与挥手/举相机动画；结局按记忆数分层文案 |
| 结局/暂停 | 三种结局可达；暂停计时停止；设置项即时生效；刷新后继续游戏恢复检查点与淡彩记忆 |

final result: pending browser E2E walkthrough（静态验证全部通过）

## Legacy evidence（已废弃深靛蓝概念，存档于 `docs/q-align/legacy-qa/`）

- Source visual truth: `C:\Users\10127\.codex\generated_images\019fbb02-4d10-7761-8593-5ff0b86f3527\exec-b1a19eb4-8278-4fd7-96ad-d2411b80c109.png`
- Browser implementation capture: `docs/q-align/legacy-qa/qa-game-old-city-final.png`
- Side-by-side comparison: `docs/q-align/legacy-qa/qa-comparison.png`
- Browser URL: `http://127.0.0.1:4173/`
- Viewport: 1280 × 720 CSS pixels, device scale factor 1
- Source pixels: 1672 × 941; normalized to 1280 × 720 with nearest-neighbor resampling for comparison
- Implementation pixels: 1280 × 720
- State: Old City scene, character on tactile route, single forward code-drawn cane active, developer jump controls hidden

## Full-view comparison evidence

The implementation retains the selected concept's top-down chunky pixel composition, dark indigo rain-wet Macau, warm amber windows, Ruins of St. Paul destination, brass-framed corner HUD, warm-gold reveal, one code-drawn white cane and beige-coated traveler. The gameplay version uses a forward Space tap and reveals only nearby path fragments, matching the approved accessible interaction rather than treating the concept's larger glow as a static decoration.

## Focused-region comparison evidence

The normalized 1280×720 comparison keeps the top-left task panel, top-right memory panel, player/cane silhouette, four-ridge path and 4×4 decision dots readable in the full image, so separate crops were not needed. These regions were checked individually in the combined image.

## Required fidelity surfaces

- Fonts and typography: serif display Chinese and readable sans-serif support text reproduce the concept hierarchy; small HUD copy remains legible.
- Spacing and layout rhythm: task, memory and control panels occupy the same three corners without obscuring the playable center.
- Colors and visual tokens: deep navy/slate base, restrained amber scenery and warm-gold interaction state match the target.
- Image quality and asset fidelity: all scenery and character art are raster assets in one coherent pixel-art direction; nearest-neighbor rendering is enabled and no placeholder or CSS-drawn game art remains.
- Copy and content: the concept's short destination label is expanded to actionable task copy because the game must explain decision tiles without relying on sound.

## Comparison history

### Pass 1 — blocked

- P2: the old-city player spawned too close to the lower edge and the feet/cane were clipped.
- P2: the developer-wide hint drew entire route segments outside the intended reveal area, visually overwhelming the scene.

Fixes made:

- Moved the old-city spawn and first route node upward.
- Subdivided tactile route segments and clipped every subsection to the active reveal sector.
- Recaptured the implementation at the same viewport and state with developer controls hidden.

### Pass 2 — passed

- No actionable P0/P1/P2 differences remain.
- P3 follow-up: the selected concept uses a broader, softer echo volume, while the playable tap is a compact forward contact. This is an intentional mechanic difference that keeps the cane interaction readable.

## Primary interactions tested

- Start menu → tutorial → playable bus stop
- Bus interior in `boarding` state → seat prompt → direct `E` interaction → `seated` → ride cutscene
- Ride cutscene → arrived checkpoint → White Dove Garden / Old City
- Old City target → Ruins scene → Lin interaction → ending
- Pause → request help → second confirmation → “迷途折返” ending
- Console checked after the startup fix; no new runtime errors appeared in the verified flow

## Findings

No actionable P0/P1/P2 findings remain.

## Follow-up polish

- P3: add a slightly softer outer dither edge to the sweep sector after gameplay timing is locked.
- P3: add two-frame walk cycles for each direction while retaining the generated character proportions.

final result: passed

## 2026-08-04 简化路线与街区素材验收

- 全部 `PATHS` 路段通过正交几何测试，公交站、车厢、旧城、路口、牌坊节点均落在可行走瓦片上。
- 玩家 spritesheet 已替换为无拐杖版本；画面只保留一根代码绘制的实时盲杖，Space 固定敲击正前方，教学和 HUD 不再提示 Shift/A/D。
- 旧城接入左右骑楼与街角柱廊，路口接入两侧转角房屋，牌坊接入低层房屋与石墙；均为透明装饰层，不参与盲道与碰撞判定。
- 路口状态改为垂直斑马线 + 对岸横移，碰撞约束保持正交走廊；旧有记忆、站牌/座位确认、NPC 问路、三种结局和暖色记忆机制保留。

final result: pending browser/build verification

## 2026-08-04 M2-M4 暖灰瓦片与章节过场验收

- Browser URL: `http://localhost:5173/`
- Browser state: DEV 跳转栏用于快速进入公交站、车厢、旧城、路口和终点；画布保持 640×360，浏览器 viewport 为 1280×720。
- M2：公交站和车厢使用 40×22 通用 TileMap；站牌 17/25、候车亭、公交车闭门/开门、车厢窗带与站牌模板均来自 ImageGen 并已去除抠像底；站牌确认后才开放车门，座位边缘确认后才允许 E 入座。
- M3：旧城路口改为程序化沥青/路缘/斑马线瓦片，斑马线垂直过街并在对岸横向转弯；F 手机辅助按 6 秒冷却播报八方向，旧城与路口各有一名可问路 NPC；大三巴使用独立瓦片层与牌坊 facade，E 触发暖色记忆波纹并进入结局。
- M4：章节路线图覆盖 `關閘 → 17路 → 白鸽巢 → 旧城 → 大三巴`，场景边界展示 2.5 秒并可任意键跳过；NPC spritesheet 接入卖花人/雨伞行人/观鸟老人风格，非 reduced-motion 状态使用轻微 idle tween。
- Visual captures reviewed inline: M2 bus stop / bus interior, M3 old city / crossing, M4 ruins finale and ending modal. No new binary QA capture committed.
- Console logs during browser flow contained no new runtime errors. Production build, Sites build, and Sites worker tests all passed; only the existing large-chunk warning remains.

final result: passed

## 2026-08-04 暖灰版 M1 验收

- Browser URL: `http://localhost:5173/`
- State: DEV 跳转至 `old-city`，开发流程栏保留用于测试
- 验证结果：
  - 白鸽巢场景使用暖灰程序化地面瓦片，盲道砖始终可见并嵌入路面。
  - 右侧短支路使用 dirt 材质，围栏仍保持封闭边界且可探索返回。
  - `Space` 触碰导向砖后 HUD 显示“四条连续凸纹：沿纹路继续”。
  - `H` 复述最近触觉结果与当前任务。
  - 触碰区域约 2 秒完整显色，随后保留淡彩记忆；刷新并继续游戏后视觉记忆仍在。
  - 角色和盲杖覆盖在盲道砖之上，控制台无 error/warning。
- Browser captures: M1 verification captures were reviewed inline against `docs/q-align/img-4.png` and `img-5.png`; no new binary QA artifact was committed.
- Findings: no new P0/P1/P2 issues.

final result: passed

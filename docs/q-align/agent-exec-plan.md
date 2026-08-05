# 《声路·澳门 2D》重构执行文档（Agent 可执行版）

> 本文档是 `docs/q-align/rework-plan.md` 的可执行细化版，供 AI agent 直接按序实施。
> 编写日期：2026-08-04。所有设计决策已经项目所有者确认，文中不再有"待定"项；
> 标注 **⚠️需人工确认** 的步骤，执行到时必须停下向用户报告并等待答复。

---

## 0. 文档使用说明（执行 agent 必读）

1. **按里程碑顺序执行**：M1收尾 → M2 → M3 → M4。每个里程碑内的任务按编号顺序做；
   里程碑末尾有"验收标准"，全部通过后才能进入下一里程碑。
2. **每完成一个任务就跑 `npm test`**（vitest run src），保持全绿；类型检查用 `npx tsc -b`。
3. **本文档不含 git 操作**。提交时机由用户自行掌握，agent 不要主动 commit/push。
4. 遇到与本文档冲突的代码现状，以"先核实现状、再最小修改"为原则；若冲突涉及设计
   方向，停下问用户。
5. 游戏内所有面向玩家的文案用**简体中文**（现状如此），地名沿用现有写法（關閘用繁体，
   与现有 content.ts 一致）。
6. 浏览器实测：自己运行 `npm run dev` 并用可用的浏览器工具打开预览（AGENTS.md 要求
   agent 自行运行，不要让用户手动起服务器）。DEV 模式下页面底部有流程跳转栏
   （dev-tools），可直接跳到任意场景测试。

### 不可破坏的硬约束

- 以下四个文件**保持完好，不得修改删除**（Sites 部署链）：
  `.openai/hosting.json`、`worker/index.js`、`scripts/prepare-sites-build.mjs`、
  `tests/sites-worker.test.mjs`。
- 桌面画布固定 **640×360**，nearest-neighbor 缩放、整数像素对齐（engine.ts 已配置，勿动）。
- HUD 保持四角布局、细黄铜像素边框；中文正文必须保持易读，不用全像素显示字体。
- `Q` 键只能是指向目标的方向箭头，**绝不显示路线**；路线记忆图已砍掉，不要复活。
- 盲道是语义游戏图层，**永远不烙进背景图**；杖触只增强杖尖附近 2–4 块砖，
  绝不出现"召唤发光路线"。
- 保留主角、林伯、17 路、记忆系统与三种结局（reunion / detour / return）的故事骨架。
- 游戏未经视障人士实测的免责声明（README）保持存在。

---

## 1. 项目速览

**技术栈**：Phaser 3.90 + React 19 + TypeScript + Vite。React 管菜单/教程/HUD/结局
等 DOM 外壳，Phaser 管游戏画布；双向通信只走 `src/game/events.ts` 的类型安全事件总
线（`hud`/`pause`/`ending`/`scene`/`announce` + dev 事件），共享状态只走
`src/game/store.ts` 的模块单例存档（localStorage，key `sound-road-macau-2d:v1`）。

**核心隐喻**：城市默认**暖灰**（明亮可读，不压黑、不恐怖）；盲杖触碰处恢复完整的
澳门雨后暖色约 2 秒，随后褪为约 35% 饱和度的淡彩"颜色记忆"永久保留；到达大三巴时
整条走过的路线恢复完整色彩（M3 终章）。

**场景流转**（6 个 SceneId，串行）：
`bus-stop`（關閘候车）→ `bus-interior`（车厢找座）→ `bus-ride`（过场，非 WalkScene）
→ `old-city`（白鸽巢，目前唯一瓦片地图场景）→ `old-city-crossing`（斜向路口）
→ `ruins`（大三巴，结局）。

**`src/game/` 文件职责一览**：

| 文件 | 职责 |
|---|---|
| engine.ts | Phaser.Game 单例创建/销毁，640×360 像素完美配置 |
| events.ts | Phaser↔React 事件总线 |
| store.ts | 存档单例 + localStorage 持久化 |
| types.ts | 全部领域类型（SceneId、TactilePathNode、GameSnapshotV2、HudState…） |
| flow.ts | 纯逻辑：巴士/路口状态机、结局判定、颜色记忆去重、场景检查点 |
| content.ts | 单一内容源：REVEAL_PROFILE、OBJECTIVES、PATHS 盲道路径、扶手/路口定义、教学文案 |
| tactile-tiles.ts | 路径栅格化为 16px 盲道砖 + 决策砖中文触觉播报 |
| oldcity-map.ts | 白鸽巢 40×22 字符画瓦片地图 + 图例 + 坐标换算 |
| tactile-layer.ts | Canvas 程序化绘制盲道砖纹理（导向 4 凸纹 / 决策 4×4 点，normal+lit 双态） |
| ground-tiles.ts | 程序化 9 种地面瓦片 + 树冠，每种 normal/warm 双版本（TonePair） |
| pixel.ts | 确定性 LCG 随机 + 颜色工具（保证纹理帧间稳定） |
| audio.ts | WebAudio 合成音效（杖击 4 种表面频率、脚步、门、路口音） |
| scenes.ts | 核心 1000+ 行：WalkScene 基类 + 6 个场景类 |

**键位**（现有 + 本次新增）：WASD 行走；Space 精确前敲；按住 Shift 手动摆杖
（A/D 摆动 ±58°、W/S 缓步）；E 互动（上车/坐下/握扶手/收集记忆/回应/问路）；
H 复述；Q 方向箭头（4.5s 冷却）；Esc 暂停。F 手机确认位置于 2026-08-05
暂时停用并从输入、教程和 HUD 隐藏，辅助算法与测试保留。

**测试**：`npm test` = vitest 跑 src 下 4 个纯逻辑测试文件（flow / content /
tactile-tiles / oldcity-map）。`npm run test:sites` 跑 Sites Worker 测试。
scenes.ts 与 React 层无单测——凡能抽成纯函数的新逻辑都应抽出来配单测。

---

## 2. 贯穿全程的架构泛化主线（M2 第一批任务，此处先说明思路)

现有代码有三个"old-city 单场景特例"，M2 起必须泛化，这是整个重构的主线：

### 2.1 通用瓦片地图模块 `src/game/tilemap.ts`（新文件）

从 `oldcity-map.ts` 抽出通用部分：

```ts
export type TileMapDefinition = {
  rows: string[];                              // 字符画行
  legend: Record<string, GroundTileKey>;       // 字符 → 瓦片
  offsetY: number;                             // 地图相对画布的纵向偏移
};
export function tileAt(map: TileMapDefinition, col: number, row: number): GroundTileKey | null;
export function tileCenter(col: number, row: number, offsetY: number): { x: number; y: number };
export function tileUnderPoint(map: TileMapDefinition, point: {x,y}): GroundTileKey | null;
export function isWalkable(map: TileMapDefinition, point: {x,y}, walkable: Set<GroundTileKey>): boolean;
```

`oldcity-map.ts` 改为导出 `OLD_CITY_TILEMAP: TileMapDefinition`，原有具名导出保留
re-export（或同步更新 oldcity-map.test.ts 的引用，二选一，倾向后者更干净）。
瓦片尺寸 16px 常量放 tilemap.ts。

### 2.2 场景表面检测钩子（scenes.ts）

`WalkScene.detectCaneSurface()` 现在内部硬编码 `if (this.sceneId === "old-city")`
的扶手/围栏判断。拆分为：

- 基类保留通用判定：决策砖（半径 15）→ 导向盲道段（11）→ 默认按脚下瓦片给材质
  label（接入 `tileUnderPoint`，如 dirt → "碎土：材质与主路不同"）。
- 新增受保护钩子 `protected detectSceneSurface(tip: {x,y}): CaneSurface | null`，
  基类在通用判定**之前**调用；OldCityScene 把扶手金属（半径 9）与死路围栏判断迁进
  自己的 override。后续场景各自注册站牌/车门/座位/路缘/NPC 表面。
- `types.ts` 的 `CaneSurfaceKind` 扩展：`"sign" | "seat" | "door" | "curb" | "person"`；
  scenes.ts 的音效映射为新 kind 指定音色（sign/door→metal、seat→stone 低音、
  person→轻提示音）。

### 2.3 瓦片派生碰撞（scenes.ts）

有 tileMap 的场景，`constrainMovement` 用 `isWalkable(map, next, this.walkableTiles())`
派生碰撞（默认 walkable 集合 `stone/plaza/asphalt` + 场景自定义），替换手写矩形；
OldCityScene 删掉三个手写 lane 矩形。**风险**：手感可能比手写矩形更严格，M2 做完
必须回归实测 old-city 段；如手感变差，允许"瓦片碰撞 + 场景微调矩形"混合。
`groundTileRows(): string[] | null` 钩子改签名为 `tileMap(): TileMapDefinition | null`。

### 2.4 AI 素材双态管线 `src/game/warm-image.ts`（新文件）

AI 生成的建筑立面/站牌等大件必须遵守"暖灰基底 + 杖触恢复暖色"。方案：

- `pixel.ts` 新增纯函数 `toWarmGray(rgb: Rgb): Rgb`——去饱和 + 暖灰偏移（色相拉向
  暖灰基调、饱和度压到 ~15%、亮度略提），配单测锁定数值。
- `warm-image.ts`：`createWarmGrayTexture(scene, sourceKey, targetKey)` 把已加载的
  原图（= warm 态）经 canvas 逐像素 `toWarmGray` 生成 normal 态纹理。
- 场景里用现有 `registerGroundOverlay(sprite, normalKey, warmKey, x, y)` 注册，
  复用 `updateGroundColors` 的脉冲/记忆逻辑——**AI 素材不需要任何新显色代码**。

### 2.5 App.tsx 坐标去重

`teleportToCurrentTarget` 的 `targetByObjective` 手抄了 OBJECTIVES 坐标，M2 起改
坐标必失配。改为 `import { OBJECTIVES }` 派生（M1 收尾 G6 就做）。

---

## 3. 里程碑 1 收尾：验证 + 修补

现状：M1 的瓦片化代码已基本写完在工作区。本里程碑先验证、后修 6 个缺口。

### 3.1 自动验证

| 步骤 | 命令 |
|---|---|
| 全量单测 | `npm test`（4 个测试文件应全绿） |
| 类型检查 | `npx tsc -b` |
| 交付链完整性 | `npm run build` 然后 `npm run test:sites`，确认产出 `dist/client/index.html`、`dist/server/index.js`、`dist/.openai/hosting.json` |

### 3.2 浏览器实测流程（7 步，用 dev-tools 跳转）

1. 新游戏 → dev「旧城」进 old-city：盲道砖**不敲杖也始终可见**（有 1px 上亮边、
   下阴影、路面接缝的嵌入感），地面是暖灰瓦片而非整图背景。
2. Space 敲击 + Shift+A/D 摆杖：只有杖尖附近 2–4 块砖增强（提亮+颗粒），
   2 秒暖色脉冲后留 35% 淡彩驻留（瓦片 tint ≈ 0xdccfa8）。
3. 沿路走到决策砖 (395,165)：杖触后 HUD 触觉栏出现"盲道在此暂停，右侧有金属扶手"
   类播报；摆杖找到扶手 → E 握住 → W 沿扶手前进 → 到尽头自动切 old-city-crossing。
4. 故意走进右侧支路（x>500）：有偏离播报（detour），杖碰围栏有"封闭围栏"障碍反馈，
   能自行走回主路，无自动重置。
5. 目视确认角色脚部与杖尖遮挡盲道砖（player depth 20 / cane 23 > 砖 10）。
6. 刷新页面 → 继续游戏：淡彩记忆（colorMemory）与砖块 remembered tint 正确还原。
7. 截图与 `docs/q-align/img-4.png`、`img-5.png` 对照密度/材质感，归档截图。

### 3.3 已确认完成、不必重做的验收点

- **breakBefore 缺口两端与扶手对齐**：content.test.ts 已锁定 rail start=(395,165)、
  end=(455,120) 与两个决策节点重合；rasterizeTactilePath 对 breakBefore 段跳绘。
- **决策砖播报**：detectCaneSurface 命中决策节点 → decisionHint → describeDecisionBrick
  拓扑推导（直行/左/右/中断四态），有完整单测。
- **短支路"环境不符"线索**：围栏障碍反馈 + detour 播报 + fence 瓦片围合已在，
  G3 再补材质线索。

### 3.4 遗留缺口修复（G1–G6）

| # | 缺口 | 位置 | 修法 |
|---|---|---|---|
| G1 | H 键只播任务，未复述"最近一次触觉结果"（read.md 明确要求两者都播） | scenes.ts `handleActions` 的 H 分支 | 改为 `最近触觉：${this.contact}。${this.repeatTaskText()}`；复述文案拼装抽成纯函数 `composeRepeatText(contact, task)` 放 content.ts 或 flow.ts 并配单测 |
| G2 | 砖点亮时长 1100ms 与色彩脉冲 2000ms 不一致（决策为"完整暖色约 2 秒"） | scenes.ts `enhanceTactileAt` | 统一为 2000ms；抽常量 `TACTILE_LIT_MS` 进 content.ts（与 REVEAL_PROFILE 放一起） |
| G3 | 支路走廊瓦片是 stone，与主路观感太接近，"材质突变"线索弱 | oldcity-map.ts 支路走廊行 | 走廊瓦片改 `:`(dirt)；配合 2.2 的脚下瓦片材质 label（M1 至少先换瓦片，label 可等 M2 泛化时接入） |
| G4 | old-city 走瓦片分支但 preload 仍加载整图背景（浪费） | scenes.ts `preload` | 若 `groundTileRows()`（M2 后为 `tileMap()`）非空则跳过背景图加载；注意 RuinsScene 目前还复用该图，判断要按场景自身 |
| G5 | design-qa.md 结论基于暗色版，暖灰版未做 QA | design-qa.md | 按 3.2 截图，在 design-qa.md 追加一节"2026-08-04 暖灰版 Pass"记录结论与截图文件名 |
| G6 | App.tsx dev 传送坐标手抄 OBJECTIVES | App.tsx `teleportToCurrentTarget` | 改为从 `OBJECTIVES` import 派生 |

### 3.5 新增单测

- tactile-tiles.test.ts：old-city 路径栅格化后，缺口区间（395,165→455,120）内任意
  采样点距最近 guidance 砖 > 16px（断言缺口内无导向砖）。
- oldcity-map.test.ts：支路走廊瓦片为 dirt（配合 G3）。
- G1 的 `composeRepeatText` 纯函数单测。

### 3.6 M1 完成定义

`npm test` 全绿 + 3.2 七步人工全过 + G1–G4、G6 修复合入 + G5 QA 记录归档。

---

## 4. 里程碑 2：公交段重做（關閘候车 → 车厢）

### 4.0 前置泛化（本里程碑第一批任务，做完先回归 old-city）

按第 2 章执行：新建 `tilemap.ts`、改造 `oldcity-map.ts`、scenes.ts 三处泛化
（tileMap 钩子 / detectSceneSurface 钩子 / 瓦片派生碰撞）、types.ts 扩展
CaneSurfaceKind、新建 `warm-image.ts` + pixel.ts 的 `toWarmGray`。
完成后：`npm test` 全绿 + old-city 段浏览器回归（手感对比 3.2 步骤 2–4）。

### 4.1 新数据文件

**`src/game/busstop-map.ts`** — `BUS_STOP_TILEMAP`（40×22，参照 oldcity-map.ts
字符画模式）。布局：

- 上部：關閘边检大楼现代立面（AI overlay 区，wall 行打底）。
- 中部：开阔混凝土广场（新瓦片 `concrete`）+ 玻璃候车亭（AI overlay）+ 两块站牌：
  **17 路站牌**（正确）与**25 路干扰站牌**，间隔足够远避免误触。
- 下部：候车黄线（新瓦片 `paint`）+ 路缘 curb 行 + 车行道 asphalt 行（巴士停靠位）。

**`src/game/businterior-map.ts`** — `BUS_INTERIOR_TILEMAP`（窄图：中央过道 +
两侧座位排）。新瓦片：`bus-floor`（防滑纹地板，可走）、`bus-seat`（座位，不可走）。
车窗/车壁用一条 AI overlay 压顶部。

**ground-tiles.ts** 新增 4 个 GroundTileKey 的 TonePair + drawer：
`concrete`（浅灰混凝土板，细接缝）、`paint`（地面导向漆线/候车黄线）、
`bus-floor`、`bus-seat`。全部程序化，风格对齐现有 9 种。

### 4.2 content.ts 变更

- 重排 `PATHS["bus-stop"]`：入口 → 站牌决策砖（新任务锚点）→ 候车决策砖（车门位，
  `breakBefore` 缺口到车门——站台到车门之间无盲道，符合现实）。
  重排 `PATHS["bus-interior"]`：车门 → 过道导向砖 → 座位决策砖。节点全部落在新
  地图 walkable 瓦片上。
- 新增 `ROUTE_BRIEFINGS: Partial<Record<SceneId, string>>`，`bus-stop` 项为出发前
  简报（示例基调："今天的路线：在關閘总站找到 17 路站牌上车，白鸽巢站下车，沿盲道
  和扶手走到大三巴，林伯在牌坊前等你。"）。
- 新增 objective `find-stop-sign`（排在 `board-17` 之前）：任务文案"用杖头找到
  17 路站牌，摸清牌面凸字"。
- 新增常量：`BUS_STOP_SIGN = { x, y, radius, routeLabel: "17" }`、
  `BUS_STOP_DECOY_SIGNS: Array<{x, y, radius, routeLabel}>`（至少一块 "25"）、
  `BUS_SEAT_EDGE = { x, y, radius }`。坐标依新地图定。
- `flow.ts`：`checkpointForScene("bus-stop")` 改为 `find-stop-sign`。

### 4.3 存档升版

`store.ts` 的存档 key `sound-road-macau-2d:v1` → `:v2`（或 version 字段 bump，
沿用现有校验方式）。旧存档直接失效、从头开始，**不写迁移**（已确认，本地开发期）。

### 4.4 四个交互（全部走现有 WalkScene 钩子，不新增系统）

**① 出发前路线简报（H 可重复）**
- `BusStopScene.onSceneReady()` 开场 `announce(ROUTE_BRIEFINGS["bus-stop"])` +
  speechSynthesis（复用现有 H 分支的 TTS 写法）。
- `BusStopScene` 覆写 `repeatTaskText()` 为 `简报 + 当前任务`；配合 G1，bus-stop
  里按 H = 最近触觉 + 简报 + 任务。

**② 辨别 17 路站牌**
- `detectSceneSurface` 命中 17 路站牌（radius 内）→
  `{kind:"sign", label:"站牌立柱：牌面有凸字「17」，就是这一班"}`，置位
  `signConfirmed = true`，objective 推进 `find-stop-sign → board-17`；
  命中干扰站牌 → `label:"站牌立柱：凸字「25」，不是这一班"`，不置位。
- 现有 `onSceneReady` 里 1100ms 自动开门的计时**移到 signConfirmed 之后**触发：
  确认站牌后播报"17 路进站"、`audioDirector` 播到站音、延时后 busState 走
  waiting→doorOpen（flow.ts 状态机不改）。
- **顺带实装 `border-hand` 记忆**（MemoryId 已预留）：首次触到 17 路站牌时
  `collectMemory("border-hand")`，文案关联林伯（如"想起林伯教你摸站牌凸字的那个
  下午"）。App.tsx 结局面板"记忆 X / 2"改为"/ 3"，`ENDING_COPY` 不用动。

**③ 等待车门**
- doorOpen 前靠近车门位，prompt 维持"请稍等车门开启"（现逻辑保留）；
  车门 AI overlay 关/开两态贴图，doorOpen 时换图 + `audio.ts` 车门音。

**④ 杖头确认座位边缘后 E 坐下**
- `BusInteriorScene` 加 `seatConfirmed` 标志；`detectSceneSurface` 命中
  `BUS_SEAT_EDGE` → `{kind:"seat", label:"座位边缘：软垫与金属框，可以坐下"}`
  并置位。
- `updateInteraction`：`near && canSit && seatConfirmed` 才显示"E 坐下"；
  未确认时 prompt 为"先用杖头确认座位边缘（Space 或 Shift+A/D）"。

### 4.5 關閘现代素材清单（AI 生成 → 裁切 → warm-image 双态）

用 image-generation 技能（Seedream）生成，**每张登记 ASSET_SOURCES.md**（来源、
日期、提示词要点、裁切处理），提示词沿用 ASSET_SOURCES.md 底部共同约束：原创澳门
像素美术、雨后傍晚、无水印无品牌、**禁止画入盲道/角色/HUD/路线标记**。

| 素材 | 规格建议 | 用途 |
|---|---|---|
| 關閘边检大楼现代立面条带 | 640×80~96，玻璃+混凝土 | bus-stop 上沿 overlay |
| 玻璃候车亭 + 金属栏杆 | ~128×64 | 候车区 overlay |
| 站牌 ×2（17 路 / 25 路） | ~24×48，同模板改数字；数字可后期程序描绘保证像素清晰 | 站牌交互物 |
| 17 路巴士侧面（车门关/开两态） | ~192×72 ×2 | 停靠位 overlay，doorOpen 换图 |
| 车厢内壁+车窗条带 | 640×72 | bus-interior 上沿 overlay |

**⚠️需人工确认**：每批素材生成后把预览给用户过目再裁切集成；后续批次用
image-to-image 以已采用图为风格参考，防止风格漂移。

### 4.6 M2 验收标准

自动（新增单测）：
- `busstop-map.test.ts` / `businterior-map.test.ts`（仿 oldcity-map.test.ts）：
  地图尺寸；PATHS 节点全部 walkable；站牌/座位常量坐标落位正确；路缘+车行道行完整。
- content.test.ts 扩展：`find-stop-sign` objective 存在且序在 board-17 前；
  bus-stop 路径含恰好 1 处 breakBefore（站台→车门）；ROUTE_BRIEFINGS["bus-stop"] 非空。
- flow.test.ts 扩展：`checkpointForScene("bus-stop") === "find-stop-sign"`；
  busState 状态机原有转移不回归。
- `pixel.test.ts`（新）：`toWarmGray` 数值断言（给定输入色，输出饱和度/亮度在
  预期区间）。

人工浏览器：
- 新游戏完整流程：简报播报 → H 复述 → 先摸 25 路（文案区分）→ 摸 17 路（objective
  推进 + border-hand 记忆收集提示）→ 等车门 → E 上车 → 车厢沿盲道到座位 → 杖确认
  座位边缘 → E 坐下 → 过场。
- AI overlay 的灰/暖双态随杖触正确切换。
- old-city 段回归（泛化改造未破坏手感）。
- 结局面板显示"记忆 X / 3"。

---

## 5. 里程碑 3：旧城密度 + 路口瓦片化 + 大三巴终章

### 5.1 old-city-crossing 迁入瓦片层

- **新文件 `src/game/crossing-map.ts`**：`CROSSING_TILEMAP`。斜向路口用瓦片阶梯
  近似：车行道 asphalt 沿对角线排布；新 GroundTileKey `zebra`（斑马线白条纹，
  程序化 drawer，条纹按行交替）；两岸人行区 stone/plaza，路缘 curb；两侧葡式立面
  AI overlay。斑马线瓦片带必须覆盖 `OLD_CITY_CROSSING.requestPoint → farCurb`
  连线走廊。
- `OldCityCrossingScene`：`tileMap()` 返回新图；删除整图背景加载；
  `constrainCrossingPosition`（flow.ts 纯函数，已有测试）继续负责"等待时不可越
  路缘 / 通行时限制在走廊内"，与瓦片碰撞叠加（先 tile walkable、再 crossing 约束）。
- 信号灯杆保留现有 `drawSignal()` 程序化绘制（红绿仍由 crossingState 驱动）。
- **过街引导（已确认）**：删除 `drawCrossingGuide` 的黄色矢量点线；改为**通行态
  （crossingState = walk）时斑马线瓦片整体轻微提亮**（在 `updateGroundColors` 里
  按状态对 zebra 瓦片加一档 tint/换 warm 纹理），红灯态恢复常态。

### 5.2 中断应对新策略（平等策略，不影响结局）

设计原则：与"横扫找路、握扶手"并列的正当策略；**不计 detourScore、不改
`determineEnding`**（flow.ts 结局函数一行不动）。

**① 手机确认位置（2026-08-05 起暂时停用）**
- 新纯函数模块 **`src/game/assist.ts`**：
  - `describePhonePosition(sceneId, player, path, objective): string` —— 由场景
    标签（SCENE_LABELS）+ 目标相对方位（八方位）+ 大致距离档合成播报，示例：
    "手机定位：您在白鸽巢公园附近，目的地在东北方向不远处。"
  - 方位推导函数 `bearingLabel(from, to): string`（"东北方向"等）独立导出，
    供 npcs.ts 复用。
  - 常量 `PHONE_COOLDOWN_MS = 6000`。
- `assist.ts`、`assist.test.ts` 和方位函数继续保留；scenes.ts 不绑定或捕获 F，
  App.tsx 与 TUTORIAL_LINES 不显示手机定位，未来恢复时再统一接回。

**② 礼貌询问路人（复用 E，已确认）**
- 新文件 **`src/game/npcs.ts`**：
  ```ts
  export type NpcDefinition = {
    id: string; x: number; y: number; tint: number;
    idleLabel: string;                       // 杖触表面文案
    hint: (player: {x,y}, objectiveTarget: {x,y}) => string;  // 方向性帮助，复用 bearingLabel
  };
  export const NPC_DEFINITIONS: Partial<Record<SceneId, NpcDefinition[]>>;
  ```
- WalkScene 基类：create 时按 sceneId 渲染 NPC（先用 traveler 帧 + tint 占位，
  M4 换专属 sprite）；`detectSceneSurface` 基类兜底加 NPC 命中
  （kind `"person"`，label "有人站在附近，可以按 E 礼貌询问"）。
- E 冲突处理：基类提供 `protected tryNpcInteraction(): boolean`（靠近 NPC 且按 E
  → announce(hint) → 返回 true），各场景在自己 `updateInteraction` **首行**调用，
  **按距离最近者优先**——玩家同时靠近 NPC 和座位/扶手时，谁近响应谁。
- M3 先在 old-city 与 old-city-crossing 各放 1 个路人。

### 5.3 大三巴独立化 + 终章演出（方案已确认：本场景全彩波 + 字幕流）

- **新文件 `src/game/ruins-map.ts`**：`RUINS_TILEMAP`。大三巴前地：葡式碎石波浪纹
  广场（plaza 变体或新 key `calcada`）、台阶新 key `steps`、上沿大三巴牌坊
  AI overlay（~256×160 居中）。RuinsScene 不再复用 old-city-rework.png。
- **终章流程**（改 RuinsScene.updateInteraction 与基类两个 update 函数）：
  1. 玩家靠近林伯按 E 后**不立即** `finishGame`：进入演出态 `finaleStarted = true`，
     禁用玩家输入（键盘禁用或态位短路 update）。
  2. 以林伯为圆心扩张全彩波：`finaleRadius += delta * speed`；
     `updateGroundColors` / `updateTactileLayer` 各加一个 finaleRadius 覆盖分支——
     波内地面瓦片强制 warm 纹理 + 清 tint，盲道砖强制 lit 纹理。
  3. 同时读取 `getSnapshot().colorMemory` 按 scene 分组，播一段字幕流（announce
     或专用字幕），逐条点亮场景名，示例："關閘的站牌亮了……17 路的车窗亮了……
     白鸽巢的扶手亮了……你走过的路，都亮了起来。"（触点数为 0 的场景跳过）。
  4. `reducedMotion` 开启时：跳过波动画，整屏直接 warm + 完整字幕。
  5. 约 3–4 秒后 `finishGame(ending)` + `gameEvents.emit("ending")`（现逻辑不变，
     ending 判定仍走 `determineEnding`，不受新策略影响）。

### 5.4 旧城密度渐变（old-city 增补）

- oldcity-map.ts 上半部提密：以 AI 立面 overlay 条带压在上沿 wall 行上
  （瓦片本身沿用 wall/stone，不必新增 arcade 瓦片，除非 overlay 覆盖不足）。
- 素材清单（AI 生成，登记 ASSET_SOURCES.md，全部过 warm-image 双态）：

| 素材 | 规格建议 |
|---|---|
| 葡式住宅立面条带 ×2 变体 | 各 ~320×80 |
| 骑楼柱廊 | ~192×80 |
| 旧招牌小件 ×3 | 各 ~24×32 |
| 大三巴牌坊 | ~256×160 |
| 路口转角立面 ×2 | 各 ~160×80 |

**⚠️需人工确认**：同 4.5，素材预览给用户过目；以 M2 已采用素材为 image-to-image
风格参考。

### 5.5 M3 验收标准

自动（新增单测）：
- `crossing-map.test.ts`：尺寸；PATHS 节点 walkable；zebra 瓦片带存在于
  requestPoint→farCurb 连线走廊上；两岸路缘行完整。
- `ruins-map.test.ts`：尺寸；路径节点 walkable；台阶/牌坊 overlay 锚位正确；
  林伯站位 walkable。
- `assist.test.ts`：`bearingLabel` 八方位边界；`describePhonePosition` 各场景文案
  含场景名与方向词；玩家与目标重合时的兜底文案。
- `npcs.test.ts`：每个定义 NPC 的场景，NPC 坐标 walkable；hint 输出含方向词。
- flow.test.ts 回归：determineEnding 原测试不动、依旧全绿（证明新策略零影响）。
- content.test.ts：crossing 路径"点阵只在两岸路缘、不铺过马路"约束在新地图坐标下
  依旧成立（改坐标时同步维护该测试）。

人工浏览器：
- 路口全流程在瓦片层成立：E 请求 → 等待（路缘挡住）→ 双音提示 → 通行（斑马线瓦片
  提亮、走廊约束）→ 对岸 → 切 ruins。黄点线已不存在。
- F 在各场景不响应且操作界面无提示；`assist.test.ts` 继续验证保留的方位算法。
- E 问路：靠近 NPC 按 E 得到方向提示；NPC 与扶手/座位同时在附近时距离近者优先。
- 终章：E 回应林伯 → 全彩波扩散 → 字幕流逐场景点亮 → 结局面板；reducedMotion
  下直接整屏全彩 + 字幕。
- 三种结局各触发一次（正常通关 / 拖时间或多次偏离触发 detour / 暂停菜单请求帮助
  触发 return）。

---

## 6. 里程碑 4：打磨与交付

### 6.1 生活化 NPC（参考图 2/3）

- AI 生成 2–3 个像素 NPC spritesheet（摊主、撑伞行人、遛鸟老人；处理流程同
  traveler：绿幕/纯底生成 → 键控透明 → 裁帧），替换 npcs.ts 的 tint 占位。
- 闲置小动画（yoyo tween 呼吸/摆动），`reducedMotion` 时静止。
- 环境小件：晾衣杆、盆栽、水迹反光贴片（程序化或 AI 小件均可，量力而行）。

### 6.2 章节间像素城市背景（2026-08-05 更新）

- 内置 ImageGen 生成一张 640×360 暖灰雨夜澳门像素城市背景，存
  `src/assets/chapter-map-pixel-v2.png`；画面不含路线圆点、连线或文字。
- **React 层实现**（不进 Phaser）：App.tsx 新增 `ChapterInterstitial` 组件，监听
  现有 `gameEvents.on("scene", ...)`，在章节边界（bus-ride→old-city、
  old-city-crossing→ruins 等）显示 2.5 秒（任意键可跳过）：像素背景 + 起止场景文字卡。
  覆盖层纯展示，场景在其后台正常加载，无阻塞。

### 6.3 收尾盘点与交付检查

- **键位/文案一致性盘点**：tutorial 页 key-grid、TUTORIAL_LINES、App.tsx
  hud-controls、README 操作节，与实际键位逐一核对
  （WASD / Space / Shift+A/D/W/S / E / H / Q / F / Esc）。
- **ASSET_SOURCES.md 全量核对**：每张 AI 素材有来源、日期、提示词、处理记录；
  确认无参考游戏素材混入。
- **Design QA**：暖灰版全场景截图归档，design-qa.md 更新最终结论。
- **废弃资产清理**：从 scenes.ts 移除不再 import 的旧整图（old-city.png 等仅在
  失去全部 import 后才不进构建，逐一确认）。
- **单文件体积检查**：`npm run build:offline`，检查 `offline-dist/index.html`
  大小（所有 PNG 会 base64 内联）；过大时对 AI 素材做索引色压缩（如 pngquant）。
- **交付链**：`npm test` → `npm run build` → `npm run test:sites` → 确认
  `dist/client/index.html`、`dist/server/index.js`、`dist/.openai/hosting.json`
  三件套齐全；Sites 四文件未被改动。
- **⚠️需人工确认**：交付检查全过后向用户报告，公开部署与否由用户决定。

### 6.4 M4 验收

自动：全部单测绿 + `test:sites` 绿。
人工：从菜单不借助 dev-tools 完整通关三种结局各一次；章节地图在正确边界出现且可
跳过；NPC 动画 reducedMotion 下静止；离线单文件双击可玩。

---

## 7. 文件清单汇总

| 里程碑 | 新增 | 修改 |
|---|---|---|
| M1收尾 | — | scenes.ts (G1/G2/G4)、oldcity-map.ts (G3)、content.ts (常量/纯函数)、App.tsx (G6)、design-qa.md (G5)、tactile-tiles.test.ts、oldcity-map.test.ts |
| M2 | tilemap.ts、busstop-map.ts、businterior-map.ts、warm-image.ts、busstop-map.test.ts、businterior-map.test.ts、pixel.test.ts、src/assets/（關閘 AI 素材 5 件） | scenes.ts（钩子泛化、瓦片碰撞、BusStop/BusInterior 重写）、content.ts（PATHS/OBJECTIVES/ROUTE_BRIEFINGS/站牌座位常量）、flow.ts（checkpoint）、types.ts（CaneSurfaceKind/TileMapDefinition）、ground-tiles.ts（concrete/paint/bus-floor/bus-seat）、pixel.ts（toWarmGray）、audio.ts（车门/到站音）、store.ts（存档 v2）、App.tsx（记忆 /3）、oldcity-map.ts（改导出）、各测试、ASSET_SOURCES.md |
| M3 | crossing-map.ts、ruins-map.ts、assist.ts、npcs.ts、crossing-map.test.ts、ruins-map.test.ts、assist.test.ts、npcs.test.ts、src/assets/（旧城/牌坊 AI 素材） | scenes.ts（Crossing/Ruins 瓦片化、F 键、NPC、终章演出、删黄点线）、content.ts、types.ts（person kind）、ground-tiles.ts（zebra/steps/calcada）、App.tsx（F 提示）、content.test.ts、ASSET_SOURCES.md |
| M4 | src/assets/chapter-map-pixel-v2.png、src/assets/bus-window-panorama-pixel.png、NPC spritesheets、ChapterInterstitial（App.tsx 内） | npcs.ts、App.tsx、scenes.ts、design-qa.md、ASSET_SOURCES.md |

## 8. 风险清单与对策

| 风险 | 对策 |
|---|---|
| AI 素材多批次风格漂移（美术最大风险，rework-plan 已指出） | 每批生成用 image-to-image 以已采用图为风格参考；每批先给用户预览再集成；ASSET_SOURCES.md 记录参考链 |
| 瓦片派生碰撞改变 old-city 手感 | M2 前置泛化后立即回归实测；允许"瓦片碰撞 + 场景微调矩形"混合兜底 |
| 单文件构建体积膨胀（PNG base64 内联） | 每里程碑末跑 build:offline 看体积；素材索引色压缩；及时清理废弃 import |
| 存档失配 | 已决策：M2 bump 存档 key v1→v2，旧档作废 |
| 暖灰版 QA 空窗 | M1 G5 先补一轮，M4 终版再补一轮 |
| E 键多义冲突（坐下/扶手/记忆/问路） | 统一"距离最近者优先"，tryNpcInteraction 在各场景 updateInteraction 首行调用并短路 |

---

*本文档编写时的代码状态：分支 assistant/2d-slice，M1 瓦片化模块已在工作区。
执行中若发现文档与代码不符，以代码现状为准做最小调整，方向性冲突问用户。*

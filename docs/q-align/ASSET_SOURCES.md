# 生产素材来源

当前生产构建不再加载整张场景背景或横向建筑条。道路、人行道、盲道、地面、公交、站亭、牌坊和街具由瓦片或代码绘制；位图仅用于角色、章节图和模块化建筑。

## ImageGen 位图

| 项目素材 | 用途 | 生成与处理 |
| --- | --- | --- |
| `src/assets/macau-architecture-base.png` | 建筑默认无彩灰状态 | 由本轮 ImageGen 六模块源图去绿幕、缩至 810×486 后转为灰度 |
| `src/assets/macau-architecture-memory.png` | 触碰后的低饱和记忆状态 | 同一源图保留约 22% 色彩 |
| `src/assets/macau-architecture-warm.png` | 触碰和终章的完整暖色状态 | ImageGen 内置模式生成；`remove_chroma_key.py` 去除统一绿色背景 |
| `docs/q-align/macau-architecture-source.png` | 生成记录与复核源图 | 骑楼正面、转角屋、柱廊、两层住宅、低层住宅、石墙门共六个隔离模块 |
| `src/assets/traveler-no-cane.png` | 角色参考源图（生产已不直接加载） | ImageGen 编辑；实时单杖由代码生成的四向像素精灵绘制 |
| `src/assets/traveler-walk.png` | 玩家四向 × 三帧走路精灵表（64×64/帧） | 内置生图以上一行为参考生成 6×3 透明底原图；脚本按列取向后/侧向/正面三列，最大连通域去杂点，裁切后统一 56px 身高、脚底基线对齐，左向由右向镜像 |
| `docs/q-align/traveler-walk-source.png` | 走路精灵生成记录与复核源图 | 6 列 × 3 行：两列背影、三列右侧向、一列正面；左下角含水印，生产仅取第 2/4/6 列 |
| `src/assets/lam.png` | 林伯三姿态精灵（64×64/帧：站立、挥手、举相机） | 内置生图以走路精灵表为风格参考生成透明底横排原图；`scripts/process_lam_sprite.py` 按连通域检测三个人物、以站姿身高统一缩放、脚底基线对齐 |
| `docs/q-align/lam-source.png` | 林伯生成记录与复核源图 | 白发、橄榄绿外套、颈挂胶片相机；非严格网格，生产按连通域切分 |
| `src/assets/ruins-facade-{base,memory,warm}.png` | 大三巴牌坊终章模块三态（165×200） | 内置生图以建筑图集为风格参考生成透明底竖版原图；`scripts/process_ruins_facade.py` 取最大连通域去水印，base 按 0.24/0.68/0.08 亮度灰度化，memory 保留 34% 色彩（与地砖 TONES 一致） |
| `docs/q-align/ruins-facade-source.png` | 牌坊生成记录与复核源图 | 五层立面、三角山花在位、中央拱窗暖光；程序化矩形版 `ruins-facade` 已退役 |
| `src/assets/npc-spritesheet.png` | 两名问路 NPC | ImageGen 角色表，透明化后使用 |
| `src/assets/chapter-map-pixel-v2.png` | 章节过场像素城市背景（640×360） | 内置 ImageGen 以旧章节图为构图参考、以当前游戏截图为风格参考生成；二次编辑彻底移除五个圆点与连接线，再以 nearest-neighbor 降采样并量化为 96 色；画面不含路线、文字、人物或 HUD |
| `docs/q-align/chapter-map-pixel-source.png` | 新章节背景生成记录与复核源图 | 16:9 暖灰雨夜澳门城市；關閘、候车站、骑楼街区和大三巴仅作环境叙事，场景名称由 React 文字卡叠加 |
| `src/assets/bus-window-panorama-pixel.png` | 巴士过场车窗外街景条（1024×96） | 内置 ImageGen 生成雨夜澳门骑楼横向街景；取原图中段、nearest-neighbor 缩放并量化为 96 色，只在车窗模块中整数像素滚动 |
| `docs/q-align/bus-window-panorama-source.png` | 车窗街景生成记录与复核源图 | 无人物、车辆、标牌、路线、可读文字和 HUD；生产只裁取窄幅街景，不作为全屏背景 |
| `src/assets/traveler-sit.png` | 候车长椅坐姿玩家精灵 | 基于玩家正面像素角色生成并裁切为 64×64；运行时脚底锚定长椅中心，人物整体绘制在长椅前层 |
| `src/assets/traveler-sit-up.png` | 公交车厢下排座椅的向上/背向坐姿玩家精灵 | 内置 ImageGen 参考 `traveler-sit.png` 生成；绿幕去除辅助处理后以 nearest-neighbor 缩至 64×64，无盲杖 |
| `docs/q-align/traveler-sit-up-source.png` | 下排坐姿生成记录与复核源图 | 内置 ImageGen 生成的背向坐姿源图；生产资源仅保留透明像素角色，不含绿幕 |
| `src/assets/bus-passenger-sit-up.png` | 公交车厢下排四个座位的坐姿乘客 NPC | 内置 ImageGen 生成侧向坐姿；绿幕去除、裁切并 nearest-neighbor 缩至 64×64；臀部、弯曲腿和脚点落在座面内 |
| `docs/q-align/bus-passenger-sit-source.png` | 坐姿乘客生成记录与复核源图 | 单个暖灰雨夜像素 NPC 坐姿，无椅子、文字、品牌或 HUD |
| `src/assets/bus-driver-sit.png` | 右下司机位坐姿 NPC | 内置 ImageGen 生成右驾侧面司机，包含驾驶座和方向盘；绿幕去除、裁切并 nearest-neighbor 缩至 64×64 |
| `docs/q-align/bus-driver-sit-source.png` | 坐姿司机生成记录与复核源图 | 右驾侧面坐姿司机，无品牌、文字或 HUD |
| `src/assets/lam-wheelchair.png` | 大三巴终章的轮椅林伯三帧精灵（静止、滚动、挥手） | 内置 ImageGen 参考既有林伯与玩家比例生成背向轮椅姿态；统一绿幕去除、按三等分裁切、nearest-neighbor 缩放为 64×64/帧 |
| `docs/q-align/generated-sources/lam-wheelchair-source.png` | 轮椅林伯生成记录与复核源图 | 三个互不重叠的暖灰像素姿态，纯绿幕，无盲杖、文字、品牌或 HUD |
| `src/assets/lam-daughter-push.png` | 林伯成年女儿三帧精灵（陪伴站立、两帧推行步态） | 内置 ImageGen 参考玩家背向比例生成；绿幕去除后按统一比例缩为 64×64/帧，双手保持在轮椅推把高度 |
| `docs/q-align/generated-sources/lam-daughter-push-source.png` | 女儿推行生成记录与复核源图 | 三个背向推行姿态，纯绿幕，不包含轮椅、文字、品牌或 HUD |
| `src/assets/wheelchair-pushing-tip-pixel.png` | “轮椅推行需要学习”完整横向公益插画（960×480） | 内置 ImageGen 生成三段连续场景：检查脚踏板、平稳上坡、控制下坡；用户参考图仅用于动作关系，不复制人物、排版、文字或水印 |
| `docs/q-align/generated-sources/wheelchair-pushing-tip-source.png` | 轮椅推行贴士生成记录与复核源图 | 暖灰雨夜澳门像素场景，无品牌、可读文字、箭头、HUD 或水印；中文标题与安全说明由 React 叠加 |
| `src/assets/guide-dog-tip-pixel.png` | "导盲犬在澳门"完整横向公益插画（960×480） | Seedream（豆包生图）生成三段连续场景：视障者与导盲犬被挡在贴有禁宠标志的门外、检疫柜台前导盲犬隔离笼与成堆文件、导盲机器人止步于楼梯前；无品牌、可读文字、水印或真实人物元素 |
| `docs/q-align/generated-sources/guide-dog-tip-source.png` | 导盲犬贴士生成记录与复核源图（3072×1536 原图） | 暖灰雨夜澳门像素场景；中文标题与制度说明由 React 叠加 |
| `src/assets/sighted-guide-tutorial-pixel.png` | 口岸序章的扶盲教学三格插图（960×520） | 内置 ImageGen 参考用户提供的动作说明图，仅保留正确动作关系并改为暖灰雨夜像素风；裁去外边距、nearest-neighbor 缩放并量化为 128 色；所有中文说明由 React 叠加 |
| `docs/q-align/sighted-guide-tutorial-source.png` | 扶盲教学图生成记录与复核源图 | 三格分别表现征求同意、盲人主动握肘、引导者领先半步并描述路缘；无图片内文字、箭头、HUD、品牌或水印 |
| `src/assets/bus-accessibility-tip-pixel.png` | 上车前“帮助盲人乘车”公益贴士插图 | 内置 ImageGen 生成暖灰雨夜像素公交站场景；盲人持杖等车、公众主动询问、公交进站；无品牌、可读文字、水印或用户照片人物元素 |
| `src/assets/bus-interior-modules-pixel.png` | 无盲道车厢的模块化雨窗、座椅扶手、扶杆、刷卡机、按铃与顶灯 | 内置 ImageGen 生成透明模块图集；统一绿幕去除、nearest-neighbor 裁切；无品牌、可读文字、路线标记或 HUD |
| `docs/q-align/bus-interior-modules-source.png` | 车厢模块图集生成记录与复核源图 | 仅作 ImageGen 生成记录；生产运行时使用去绿幕后模块图集，不使用整张车厢背景 |
| `src/assets/bus-ride-access-tip-pixel.png` | 公交无障碍贴士完整公益插画 | 内置 ImageGen 生成单张暖灰雨夜像素车厢场景；盲人乘客与公众/司机通过姿态表现先询问、说清楚、再协助；无品牌、可读文字、水印或用户照片元素 |
| `docs/q-align/gate-facade-source.png` | 已退役的关闸立面参考源图 | 仅保留为历史美术参考；生产代码不再导入或裁切该图。关闸现由 parapet/window/wall/canopy/pillar/entrance 六类 16px 程序化瓦片和代码文字牌组成，并进入统一 base/memory/warm 三态 |

本轮建筑与过场提示约束为：雨夜暖灰澳门葡中建筑、16-bit 像素模块、统一比例；禁止 HUD、路线、品牌和非代码可读文字。章节图不含预绘制圆点或连线，车窗图只作为窄幅模块，关闸建筑完全瓦片化且不参与盲道逻辑。扶盲教学图允许人物，但正确动作和中文说明分别由插图与代码承担。

轮椅推行贴士文案根据 [NHS 标准轮椅安全信息](https://www.fhft.nhs.uk/patients-and-visitors/patient-information-library/wheelchair-safety-information-standard-wheelchairs) 与 [WHO 轮椅服务培训资料](https://www.who.int/publications/i/item/9789241512398) 整理，强调先询问、移动前说明、检查脚踏板与轮子周围、全程控制速度，并在坡度或操作超出能力时停止和寻求受训协助；未使用未经核实的统计数字。

导盲犬贴士文案基于项目所有者提供的澳门现况要点整理：法律未承认导盲犬工作犬身份、需以"宠物狗"名义申请入境并经历复杂检疫隔离流程、个案购买需议员协助推动；政府倾向发展"电子导盲犬"（导盲机器人），成本低、无需医疗照护，但无法应对楼梯等复杂地形。文案为定性表述，未使用未经核实的统计数字；正式对外发布前建议由本地无障碍团体复核。

## CC0 环境音

| 项目素材 | 场景 | 来源与许可 |
| --- | --- | --- |
| `src/assets/audio/rain.ogg` | 户外雨后底噪 | OpenGameArt [Rain (loopable)](https://opengameart.org/content/rain-loopable)，Ylmir，CC0；采用包内 `1.ogg` |
| `src/assets/audio/traffic.ogg` | 公交站、旧城道路和路口 | OpenGameArt [High traffic road sounds](https://opengameart.org/content/high-traffic-road-sounds)，IgnasD，CC0 |
| `src/assets/audio/bus-interior.ogg` | 车厢与行驶过场 | Freesound [Interior sound of a bus](https://freesound.org/s/456833/)，florianreichelt，CC0；使用公开 OGG 预览编码 |

三个文件均随构建离线打包；运行时解码或自动播放失败时，程序化盲杖、脚步、提示音和字幕仍可继续工作。

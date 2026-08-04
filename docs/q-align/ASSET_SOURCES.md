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
| `src/assets/chapter-map.png` | 章节过场路线图 | ImageGen 原图；当前节点和中文说明由 React 叠加 |

本轮建筑提示约束为：雨夜暖灰澳门葡中建筑、16-bit 像素模块、3×2 独立排布、统一比例；禁止人物、车辆、HUD、路线、品牌、标牌、可读文字和整张场景背景。最终游戏只裁取独立模块，建筑不参与盲道逻辑。

## CC0 环境音

| 项目素材 | 场景 | 来源与许可 |
| --- | --- | --- |
| `src/assets/audio/rain.ogg` | 户外雨后底噪 | OpenGameArt [Rain (loopable)](https://opengameart.org/content/rain-loopable)，Ylmir，CC0；采用包内 `1.ogg` |
| `src/assets/audio/traffic.ogg` | 公交站、旧城道路和路口 | OpenGameArt [High traffic road sounds](https://opengameart.org/content/high-traffic-road-sounds)，IgnasD，CC0 |
| `src/assets/audio/bus-interior.ogg` | 车厢与行驶过场 | Freesound [Interior sound of a bus](https://freesound.org/s/456833/)，florianreichelt，CC0；使用公开 OGG 预览编码 |

三个文件均随构建离线打包；运行时解码或自动播放失败时，程序化盲杖、脚步、提示音和字幕仍可继续工作。

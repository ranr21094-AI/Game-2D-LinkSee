import { useEffect, useMemo, useRef, useState } from "react";
import { audioDirector } from "./game/audio";
import { OBJECTIVES, SCENE_LABELS, TIP_DEFINITIONS, TUTORIAL_LINES } from "./game/content";
import { destroyGame, pauseGame, resumeGame, startGame } from "./game/engine";
import { gameEvents, type TipSource } from "./game/events";
import { finishGame, getSnapshot, loadSnapshot, patchSnapshot, startNewGame } from "./game/store";
import type { EndingId, GameSettings, GameSnapshotV3, HudState, TipId } from "./game/types";
import type { BusTransitState, SceneId } from "./game/types";
import chapterMapUrl from "./assets/chapter-map-pixel-v2.png";

const EMPTY_HUD: HudState = {
  objective: "沿四纹盲道前往17路车门",
  subtitle: "",
  prompt: "",
  memories: 0,
  detours: 0,
  sceneLabel: "關閘 · 17路候车区",
  hintCooling: false,
  contact: "尚未触碰到物体",
};

const ENDING_COPY: Record<EndingId, { title: string; body: string; quote: string }> = {
  reunion: {
    title: "如期而至",
    body: "雨后的灯光落在牌坊前。林伯没有上前搀扶，只把相机举了起来。",
    quote: "“我就知道，你会自己走到这里。”",
  },
  detour: {
    title: "绕行三小时",
    body: "你绕了远路，也问过几次方向。林伯一直在台阶前等着，约定没有失效。",
    quote: "“路长一点，也一样是你走来的。”",
  },
  return: {
    title: "迷途折返",
    body: "你决定结束今天的旅程，并请求工作人员协助返程。能安全停下，也是一种选择。",
    quote: "“下次我们换一条路，再一起试试。”",
  },
};

type Screen = "menu" | "tutorial" | "playing";
type ChapterTransition = { from: SceneId; to: SceneId };

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [paused, setPaused] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [ending, setEnding] = useState<EndingId | null>(null);
  const [chapter, setChapter] = useState<ChapterTransition | null>(null);
  const [tipModal, setTipModal] = useState<{ id: TipId; source: TipSource } | null>(null);
  const [showTipsList, setShowTipsList] = useState(false);
  const [, setTipsRevision] = useState(0);
  const [saved, setSaved] = useState<GameSnapshotV3 | null>(() => loadSnapshot());
  const [, setSettingsRevision] = useState(0);
  const [showDevTools, setShowDevTools] = useState(import.meta.env.DEV);
  const mountRef = useRef<HTMLDivElement>(null);
  const endingCopy = useMemo(() => (ending ? ENDING_COPY[ending] : null), [ending]);

  useEffect(() => {
    const offHud = gameEvents.on("hud", setHud);
    const offPause = gameEvents.on("pause", (value) => setPaused(value));
    const offEnding = gameEvents.on("ending", (value) => setEnding(value));
    const offChapter = gameEvents.on("chapter", (value) => setChapter(value));
    const offTipOpen = gameEvents.on("tipOpen", (tip) => {
      pauseGame();
      setTipModal(tip);
      setTipsRevision((revision) => revision + 1);
    });
    return () => {
      offHud();
      offPause();
      offEnding();
      offChapter();
      offTipOpen();
      destroyGame();
    };
  }, []);

  useEffect(() => {
    if (!chapter) return;
    const hide = window.setTimeout(() => setChapter(null), 2500);
    const skip = () => setChapter(null);
    window.addEventListener("keydown", skip, { once: true });
    return () => {
      window.clearTimeout(hide);
      window.removeEventListener("keydown", skip);
    };
  }, [chapter]);

  useEffect(() => {
    if (screen !== "playing" || !mountRef.current) return;
    const snapshot = getSnapshot();
    startGame("phaser-game", snapshot.scene);
    return () => destroyGame();
  }, [screen]);

  useEffect(() => {
    if (screen !== "playing") return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || ending || tipModal) return;
      event.preventDefault();
      if (paused) {
        setConfirmReturn(false);
        setPaused(false);
        resumeGame();
      } else {
        pauseGame();
        setPaused(true);
      }
    };
    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [ending, paused, screen, tipModal]);

  const beginNew = () => {
    audioDirector.unlock();
    setEnding(null);
    setPaused(false);
    setSaved(startNewGame());
    setScreen("tutorial");
  };

  const continueSaved = () => {
    audioDirector.unlock();
    const snapshot = loadSnapshot();
    if (!snapshot) return beginNew();
    if (snapshot.ending) {
      setEnding(snapshot.ending);
      setScreen("playing");
      return;
    }
    setSaved(snapshot);
    setScreen("playing");
  };

  const enterGame = () => {
    audioDirector.unlock();
    setScreen("playing");
  };

  const resume = () => {
    setConfirmReturn(false);
    setPaused(false);
    resumeGame();
  };

  const dismissTip = () => {
    if (!tipModal) return;
    const closing = tipModal;
    setTipModal(null);
    gameEvents.emit("tipClosed", closing);
    resumeGame();
  };

  const openTip = (id: TipId) => {
    if (!getSnapshot().unlockedTips.includes(id)) return;
    setShowTipsList(false);
    pauseGame();
    setTipModal({ id, source: "sidebar" });
  };

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    patchSnapshot({ settings: { ...getSnapshot().settings, [key]: value } });
    audioDirector.syncSettings();
    setSettingsRevision((revision) => revision + 1);
  };

  const requestReturn = () => {
    patchSnapshot({ returnRequested: true });
    finishGame("return");
    setConfirmReturn(false);
    setPaused(false);
    setEnding("return");
  };

  const backToMenu = () => {
    destroyGame();
    setSaved(loadSnapshot());
    setEnding(null);
    setPaused(false);
    setScreen("menu");
  };

  const jumpDev = (scene: SceneId, busState: BusTransitState) => {
    sessionStorage.setItem("sound-road-dev-reveal", "hint");
    const stage = scene === "bus-stop" ? (busState === "doorOpen" ? "bus-stop-sign" : "bus-stop-entry") : scene === "bus-interior" ? (busState === "seated" ? "bus-interior-bell" : "bus-interior-entry") : scene === "bus-ride" ? "bus-ride" : scene === "old-city" ? "old-city-entry" : scene === "old-city-crossing" ? "crossing-approach" : "ruins-entry";
    patchSnapshot({ scene, busState, resumeStage: stage, objectiveId: scene === "bus-stop" ? (busState === "doorOpen" ? "board-17" : "find-stop-sign") : scene === "bus-interior" ? (busState === "seated" ? "ring-bell" : "find-card-reader") : scene === "bus-ride" ? "ride-to-camoes" : scene === "old-city" ? "follow-old-city-path" : scene === "old-city-crossing" ? "request-crossing" : "meet-lam" });
    startGame("phaser-game", scene);
  };

  const teleportDev = (x: number, y: number) => gameEvents.emit("devTeleport", { x, y });
  const teleportToCurrentTarget = () => {
    const objective = OBJECTIVES[getSnapshot().objectiveId];
    const target = objective && (objective.target.x !== 0 || objective.target.y !== 0)
      ? objective.target
      : { x: 320, y: 180 };
    teleportDev(target.x, target.y);
    gameEvents.emit("devReveal", "hint");
  };

  return (
    <main className="app-shell">
      {screen === "menu" && (
        <section className="title-screen" aria-labelledby="game-title">
          <div className="title-art" aria-hidden="true" />
          <div className="title-copy pixel-panel">
            <p className="eyebrow">A MACAU SOUND-TOUCH JOURNEY</p>
            <h1 id="game-title">声路·澳门</h1>
            <p className="title-subtitle">用盲杖读懂城市，搭乘17路去赴一场旧约。</p>
            <div className="mode-select" role="group" aria-label="游戏模式">
              <button className={getSnapshot().settings.gameMode === "experience" ? "mode-option is-active" : "mode-option"} onClick={() => updateSetting("gameMode", "experience")}>体验模式</button>
              <button className={getSnapshot().settings.gameMode === "night" ? "mode-option is-active" : "mode-option"} onClick={() => updateSetting("gameMode", "night")}>黑夜模式</button>
            </div>
            <p className="mode-note">黑夜模式：城市全黑，点亮只维持片刻，Q 改为目标点闪光指引</p>
            <div className="title-actions">
              <button className="primary-button" onClick={beginNew}>开始新旅程</button>
              {saved && <button className="secondary-button" onClick={continueSaved}>继续：{saved.scene === "bus-stop" ? "關閘" : saved.scene === "old-city" ? "白鸽巢" : "上次检查点"}</button>}
            </div>
            <p className="disclaimer">桌面键盘游戏 · 建议开启声音体验盲杖与环境反馈</p>
            <p className="access-note">当前版本未经视障人士实测，不代表真实失明体验或无障碍认证。</p>
          </div>
        </section>
      )}

      {screen === "tutorial" && (
        <section className="tutorial-screen" aria-labelledby="tutorial-title">
          <div className="tutorial-card pixel-panel">
            <p className="eyebrow">出发前</p>
            <h2 id="tutorial-title">先读懂脚下的路</h2>
            <div className="tile-examples" aria-label="盲道样式示例">
              <div className="tile-copy"><strong>四条凸纹</strong><span>{TUTORIAL_LINES[0]}</span></div>
              <div className="tile-copy"><strong>4×4凸点</strong><span>{TUTORIAL_LINES[1]}</span></div>
            </div>
            <div className="key-grid">
              <span><kbd>WASD / 方向键</kbd> 行走</span><span><kbd>Space</kbd> 一根盲杖敲击</span>
              <span><kbd>Q</kbd> 方向指引</span><span><kbd>H</kbd> 重复任务</span>
              <span><kbd>G</kbd> 照亮四周</span>
              <span><kbd>E</kbd> 互动</span><span><kbd>Esc</kbd> 暂停</span>
            </div>
            <p className="tutorial-tip">城市以暖灰呈现。杖头触碰处会短暂恢复完整暖色，随后留下淡彩记忆；Q只指出目标方向，不会显示整条路线。</p>
            <button className="primary-button" onClick={enterGame}>从拱北口岸门口出发</button>
          </div>
        </section>
      )}

      {screen === "playing" && (
        <section className="game-stage" aria-label="声路澳门2D游戏">
          <aside className="side-panel" aria-label="旅程功能栏">
            <div className="hud-objective pixel-panel" aria-live="polite">
              <span className="hud-label">当前任务</span>
              <strong>{hud.objective}</strong>
              <small>{hud.sceneLabel}</small>
            </div>
            <div className="hud-memory pixel-panel" aria-label="旅程状态">
              <span>记忆 {String(hud.memories).padStart(2, "0")}</span>
              <span>纠偏 {String(hud.detours).padStart(2, "0")}</span>
            </div>
            <button className="tips-entry pixel-panel" onClick={() => setShowTipsList(true)} aria-label={`盲人小贴士，已解锁${getSnapshot().unlockedTips.length}条`}>
              <span className="tips-entry-icon" aria-hidden="true">✦</span>
              <span><strong>盲人小贴士</strong><small>已解锁 {getSnapshot().unlockedTips.length} 条</small></span>
            </button>
            <div className="hud-contact pixel-panel" aria-live="polite">
              <span className="hud-label">最近触觉 · 一根盲杖</span>
              <strong>{hud.contact}</strong>
            </div>
            <div className="hud-controls pixel-panel" aria-label="操作提示">
              <span><kbd>空格</kbd> 单杖敲击</span>
              <span><kbd>Q</kbd> {hud.hintCooling ? "冷却" : "方向"}</span>
              <span><kbd>G</kbd> 照亮</span><span><kbd>E</kbd> 互动</span>
            </div>
            <button className="pause-button" onClick={() => { pauseGame(); setPaused(true); }} aria-label="暂停游戏">Esc 暂停</button>
            {import.meta.env.DEV && showDevTools && (
              <div className="dev-tools" aria-label="开发流程跳转">
                <button onClick={() => jumpDev("bus-stop", "doorOpen")}>候车</button>
                <button onClick={() => jumpDev("bus-interior", "boarding")}>车厢</button>
                <button onClick={teleportToCurrentTarget}>到目标</button>
                <button onClick={() => gameEvents.emit("devInteract", undefined)}>执行E</button>
                <button onClick={() => jumpDev("bus-ride", "seated")}>过场</button>
                <button onClick={() => jumpDev("old-city", "arrived")}>旧城</button>
                <button onClick={() => jumpDev("old-city-crossing", "alighted")}>路口</button>
                <button onClick={() => jumpDev("ruins", "alighted")}>终点</button>
                <button onClick={() => setShowDevTools(false)}>隐藏测试栏</button>
              </div>
            )}
          </aside>
          <div className="game-view">
            <div id="phaser-game" ref={mountRef} className="phaser-mount" />
            <div className="screen-shade" aria-hidden="true" />
            {(hud.subtitle || hud.prompt) && (
              <div className="dialogue-stack" style={{ fontSize: `${getSnapshot().settings.subtitleScale}em` }}>
                {hud.subtitle && <p className="subtitle pixel-panel" aria-live="assertive">{hud.subtitle}</p>}
                {hud.prompt && <p className="interact-prompt">{hud.prompt}</p>}
              </div>
            )}
            {chapter && (
              <div className={`chapter-interstitial${getSnapshot().settings.reducedMotion ? " is-reduced-motion" : ""}`} role="status" aria-live="polite">
                <img src={chapterMapUrl} alt="澳门章节路线图" />
                <div className="chapter-map-shade" />
                <div className="chapter-copy pixel-panel">
                  <span className="eyebrow">场景切换</span>
                  <strong>{SCENE_LABELS[chapter.from]} → {SCENE_LABELS[chapter.to]}</strong>
                  <small>任意键跳过</small>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {paused && !ending && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <div className="pause-card pixel-panel">
            <p className="eyebrow">旅程暂停</p>
            <h2 id="pause-title">在雨声里停一会儿</h2>
            <button className="primary-button" onClick={resume}>继续行走</button>
            <label className="setting-row">主音量
              <input type="range" min="0" max="1" step="0.05" value={getSnapshot().settings.masterVolume} onChange={(event) => updateSetting("masterVolume", Number(event.target.value))} />
            </label>
            <label className="setting-row">环境音
              <input type="range" min="0" max="1" step="0.05" value={getSnapshot().settings.ambientVolume} onChange={(event) => updateSetting("ambientVolume", Number(event.target.value))} />
            </label>
            <label className="setting-row">效果音
              <input type="range" min="0" max="1" step="0.05" value={getSnapshot().settings.effectsVolume} onChange={(event) => updateSetting("effectsVolume", Number(event.target.value))} />
            </label>
            <label className="setting-row">对话音量
              <input type="range" min="0" max="1" step="0.05" value={getSnapshot().settings.dialogueVolume} onChange={(event) => updateSetting("dialogueVolume", Number(event.target.value))} />
            </label>
            <label className="setting-row">字幕大小
              <input type="range" min="0.9" max="1.5" step="0.1" value={getSnapshot().settings.subtitleScale} onChange={(event) => updateSetting("subtitleScale", Number(event.target.value))} />
            </label>
            <label className="setting-row setting-toggle">减少动态效果
              <input type="checkbox" checked={getSnapshot().settings.reducedMotion} onChange={(event) => updateSetting("reducedMotion", event.target.checked)} />
            </label>
            <label className="setting-row setting-toggle">黑夜模式
              <input type="checkbox" checked={getSnapshot().settings.gameMode === "night"} onChange={(event) => updateSetting("gameMode", event.target.checked ? "night" : "experience")} />
            </label>
            {!confirmReturn ? (
              <button className="quiet-button" onClick={() => setConfirmReturn(true)}>请求帮助并结束旅程</button>
            ) : (
              <div className="confirm-box">
                <p>确定结束今天的旅程并进入“迷途折返”结局吗？</p>
                <button className="danger-button" onClick={requestReturn}>确定结束</button>
                <button className="quiet-button" onClick={() => setConfirmReturn(false)}>取消</button>
              </div>
            )}
            <button className="quiet-button" onClick={backToMenu}>返回主菜单</button>
          </div>
        </div>
      )}

      {showTipsList && !ending && (
        <div className="modal-backdrop tips-list-backdrop" role="dialog" aria-modal="true" aria-labelledby="tips-list-title">
          <article className="tips-list-card pixel-panel">
            <div className="mobility-guide-heading">
              <p className="eyebrow">旅程收集</p>
              <h2 id="tips-list-title">盲人小贴士</h2>
              <p>已经解锁的贴士会留在这里，随时可以重新查看。</p>
            </div>
            <div className="tips-list">
              {getSnapshot().unlockedTips.map((id) => {
                const tip = TIP_DEFINITIONS[id];
                return <button key={id} className="tip-list-item" onClick={() => openTip(id)}><strong>{tip.title}</strong><span>{tip.summary}</span></button>;
              })}
            </div>
            {!getSnapshot().unlockedTips.length && <p className="tips-empty">还没有解锁贴士。继续走走看。</p>}
            <button className="quiet-button" onClick={() => setShowTipsList(false)}>关闭</button>
          </article>
        </div>
      )}

      {tipModal && !ending && (
        <div className="modal-backdrop mobility-guide-backdrop" role="dialog" aria-modal="true" aria-labelledby="mobility-guide-title">
          <article className="mobility-guide-card pixel-panel">
            <div className="mobility-guide-heading">
              <p className="eyebrow">{TIP_DEFINITIONS[tipModal.id].title}</p>
              <h2 id="mobility-guide-title">{TIP_DEFINITIONS[tipModal.id].heading}</h2>
              <p>{TIP_DEFINITIONS[tipModal.id].summary}</p>
            </div>
            <img src={TIP_DEFINITIONS[tipModal.id].image} alt={TIP_DEFINITIONS[tipModal.id].imageAlt} />
            <ol className="mobility-guide-steps">
              {TIP_DEFINITIONS[tipModal.id].steps.map((step) => <li key={step.title}><strong>{step.title}</strong><span>{step.body}</span></li>)}
            </ol>
            <p className="mobility-guide-callout">{TIP_DEFINITIONS[tipModal.id].callout}</p>
            <button className="primary-button" onClick={dismissTip}>{tipModal.source === "intro" ? "我知道了，前往盲道起点" : "关闭贴士"}</button>
          </article>
        </div>
      )}

      {endingCopy && (
        <div className="modal-backdrop ending-backdrop" role="dialog" aria-modal="true" aria-labelledby="ending-title">
          <article className="ending-card pixel-panel">
            <p className="eyebrow">旅程终章</p>
            <h2 id="ending-title">{endingCopy.title}</h2>
            <p>{endingCopy.body}</p>
            <blockquote>{endingCopy.quote}</blockquote>
            <dl className="ending-metrics">
              <div><dt>记忆</dt><dd>{getSnapshot().memories.length} / 3</dd></div>
              <div><dt>纠偏</dt><dd>{getSnapshot().detourScore}</dd></div>
            </dl>
            <button className="primary-button" onClick={backToMenu}>回到主菜单</button>
          </article>
        </div>
      )}
    </main>
  );
}

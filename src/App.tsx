import { useEffect, useMemo, useRef, useState } from "react";
import { audioDirector } from "./game/audio";
import { TUTORIAL_LINES } from "./game/content";
import { destroyGame, pauseGame, resumeGame, startGame } from "./game/engine";
import { gameEvents } from "./game/events";
import { finishGame, getSnapshot, loadSnapshot, patchSnapshot, startNewGame } from "./game/store";
import type { EndingId, GameSnapshotV2, HudState } from "./game/types";
import type { BusTransitState, SceneId } from "./game/types";

const EMPTY_HUD: HudState = {
  objective: "沿四纹盲道前往17路车门",
  subtitle: "",
  prompt: "",
  memories: 0,
  detours: 0,
  sceneLabel: "關閘 · 17路候车区",
  hintCooling: false,
  contact: "尚未触碰到物体",
  caneMode: false,
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

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [paused, setPaused] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [ending, setEnding] = useState<EndingId | null>(null);
  const [saved, setSaved] = useState<GameSnapshotV2 | null>(() => loadSnapshot());
  const [showDevTools, setShowDevTools] = useState(import.meta.env.DEV);
  const mountRef = useRef<HTMLDivElement>(null);
  const endingCopy = useMemo(() => (ending ? ENDING_COPY[ending] : null), [ending]);

  useEffect(() => {
    const offHud = gameEvents.on("hud", setHud);
    const offPause = gameEvents.on("pause", (value) => setPaused(value));
    const offEnding = gameEvents.on("ending", (value) => setEnding(value));
    return () => {
      offHud();
      offPause();
      offEnding();
      destroyGame();
    };
  }, []);

  useEffect(() => {
    if (screen !== "playing" || !mountRef.current) return;
    const snapshot = getSnapshot();
    startGame("phaser-game", snapshot.scene);
    return () => destroyGame();
  }, [screen]);

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
    sessionStorage.setItem("sound-road-dev-reveal", "sweep");
    patchSnapshot({ scene, busState, objectiveId: scene === "bus-stop" ? "board-17" : scene === "bus-interior" ? "find-seat" : scene === "bus-ride" ? "ride-to-camoes" : scene === "old-city" ? "follow-old-city-path" : scene === "old-city-crossing" ? "request-crossing" : "meet-lam" });
    startGame("phaser-game", scene);
  };

  const teleportDev = (x: number, y: number) => gameEvents.emit("devTeleport", { x, y });
  const teleportToCurrentTarget = () => {
    const targetByObjective: Record<string, { x: number; y: number }> = {
      "board-17": { x: 532, y: 188 },
      "find-seat": { x: 350, y: 164 },
      "ride-to-camoes": { x: 320, y: 180 },
      "follow-old-city-path": { x: 395, y: 165 },
      "follow-handrail": { x: 455, y: 120 },
      "request-crossing": { x: 278, y: 288 },
      "wait-crossing": { x: 278, y: 288 },
      "cross-junction": { x: 430, y: 80 },
      "meet-lam": { x: 240, y: 88 },
    };
    const target = targetByObjective[getSnapshot().objectiveId] ?? { x: 320, y: 180 };
    teleportDev(target.x, target.y);
    gameEvents.emit("devReveal", "sweep");
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
              <span><kbd>WASD</kbd> 行走</span><span><kbd>Space</kbd> 精确敲击</span>
              <span><kbd>Shift+A/D</kbd> 手动摆杖</span><span><kbd>Q</kbd> 方向指引</span>
              <span><kbd>E</kbd> 互动</span><span><kbd>H</kbd> 重复任务</span>
            </div>
            <p className="tutorial-tip">城市以暖灰呈现。杖头触碰处会短暂恢复完整暖色，随后留下淡彩记忆；Q只指出目标方向，不会显示整条路线。</p>
            <button className="primary-button" onClick={enterGame}>进入17路候车区</button>
          </div>
        </section>
      )}

      {screen === "playing" && (
        <section className="game-stage" aria-label="声路澳门2D游戏">
          <div id="phaser-game" ref={mountRef} className="phaser-mount" />
          <div className="screen-shade" aria-hidden="true" />
          <aside className="hud-objective pixel-panel" aria-live="polite">
            <span className="hud-label">当前任务</span>
            <strong>{hud.objective}</strong>
            <small>{hud.sceneLabel}</small>
          </aside>
          <aside className="hud-memory pixel-panel" aria-label="旅程状态">
            <span>记忆 {String(hud.memories).padStart(2, "0")}</span>
            <span>纠偏 {String(hud.detours).padStart(2, "0")}</span>
          </aside>
          <aside className={`hud-contact pixel-panel ${hud.caneMode ? "is-active" : ""}`} aria-live="polite">
            <span className="hud-label">{hud.caneMode ? "手动摆杖中 · A/D" : "最近触觉"}</span>
            <strong>{hud.contact}</strong>
          </aside>
          <div className="hud-controls pixel-panel" aria-label="操作提示">
            <span><kbd>空格</kbd> 敲击</span><span><kbd>Shift+A/D</kbd> 摆杖</span>
            <span><kbd>Q</kbd> {hud.hintCooling ? "冷却" : "方向"}</span><span><kbd>E</kbd> 互动</span>
          </div>
          {(hud.subtitle || hud.prompt) && (
            <div className="dialogue-stack" style={{ fontSize: `${getSnapshot().settings.subtitleScale}em` }}>
              {hud.subtitle && <p className="subtitle pixel-panel" aria-live="assertive">{hud.subtitle}</p>}
              {hud.prompt && <p className="interact-prompt">{hud.prompt}</p>}
            </div>
          )}
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
        </section>
      )}

      {paused && !ending && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <div className="pause-card pixel-panel">
            <p className="eyebrow">旅程暂停</p>
            <h2 id="pause-title">在雨声里停一会儿</h2>
            <button className="primary-button" onClick={resume}>继续行走</button>
            <label className="setting-row">字幕大小
              <input type="range" min="0.9" max="1.5" step="0.1" value={getSnapshot().settings.subtitleScale} onChange={(event) => { patchSnapshot({ settings: { ...getSnapshot().settings, subtitleScale: Number(event.target.value) } }); setHud({ ...hud }); }} />
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

      {endingCopy && (
        <div className="modal-backdrop ending-backdrop" role="dialog" aria-modal="true" aria-labelledby="ending-title">
          <article className="ending-card pixel-panel">
            <p className="eyebrow">旅程终章</p>
            <h2 id="ending-title">{endingCopy.title}</h2>
            <p>{endingCopy.body}</p>
            <blockquote>{endingCopy.quote}</blockquote>
            <dl className="ending-metrics">
              <div><dt>记忆</dt><dd>{getSnapshot().memories.length} / 2</dd></div>
              <div><dt>纠偏</dt><dd>{getSnapshot().detourScore}</dd></div>
            </dl>
            <button className="primary-button" onClick={backToMenu}>回到主菜单</button>
          </article>
        </div>
      )}
    </main>
  );
}

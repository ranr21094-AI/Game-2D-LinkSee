import { useEffect, useMemo, useRef, useState } from "react";
import { audioDirector } from "./game/audio";
import { OBJECTIVES, SCENE_LABELS, TIP_DEFINITIONS, TUTORIAL_LINES } from "./game/content";
import { destroyGame, installGameTestHooks, pauseGame, resumeGame, startGame } from "./game/engine";
import { EGG_TART_STALL } from "./game/egg-tart";
import { gameEvents, type TipSource } from "./game/events";
import { checkpointForStage } from "./game/flow";
import { endingChoiceCopy, JOURNEY_GOAL, MEMORY_DEFINITIONS, OPENING_REPLIES, openingReplyEcho } from "./game/journey";
import type { NpcDialogue } from "./game/npcs";
import { finishGame, getSnapshot, loadSnapshot, patchSnapshot, startNewGame } from "./game/store";
import type { EndingId, GameSettings, GameSnapshotV5, HudState, TipId } from "./game/types";
import type { BusTransitState, ResumeStage, SceneId } from "./game/types";
import chapterMapUrl from "./assets/chapter-map-pixel-v2.png";
import oldPhotoUrl from "./assets/old-photo-pixel.png";

const MEMORY_TOTAL = Object.keys(MEMORY_DEFINITIONS).length;
const TIP_TOTAL = Object.keys(TIP_DEFINITIONS).length;

const EMPTY_HUD: HudState = {
  journeyGoal: "赴约：在大三巴与老友林伯会合",
  objective: "沿四纹盲道前往17路车门",
  subtitle: "",
  prompt: "",
  memories: 0,
  detours: 0,
  sceneLabel: "關閘 · 17路候车区",
  hintCooling: false,
  flashCooling: false,
  listenCooling: false,
  listening: false,
  routeChoice: null,
  eggTartBoostRemainingMs: 0,
  contact: "尚未触碰到物体",
  contactHistory: [],
};

const ENDING_COPY: Record<EndingId, { title: string; body: string; quote: string }> = {
  reunion: {
    title: "如期而至",
    body: "雨后的灯光落在牌坊前。林伯没有上前搀扶，只把相机举了起来。",
    quote: "“我就知道，你会自己走到这里。”",
  },
  detour: {
    title: "雨巷绕行",
    body: "你绕过几处陌生路口，也停下来重新确认方向。林伯一直在台阶前等着，约定没有失效。",
    quote: "“路长一点，也一样是你走来的。”",
  },
  return: {
    title: "迷途折返",
    body: "你决定结束今天的旅程，并请求工作人员协助返程。能安全停下，也是一种选择。",
    quote: "“下次我们换一条路，再一起试试。”",
  },
};

type Screen = "menu" | "opening" | "tutorial" | "playing";
type ChapterTransition = { from: SceneId; to: SceneId };
const LIN_VOICE_MESSAGE = "小闻，雨小了。我在大三巴老地方等你。慢慢来，听到牌坊下的雨声就给我消息。";
const routeChoiceLabel = (choice: GameSnapshotV5["routeChoice"]) => choice === "shop-wall" ? "店铺墙侧" : choice === "curb-edge" ? "路缘排水侧" : "尚未选择";

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [paused, setPaused] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [ending, setEnding] = useState<EndingId | null>(null);
  const [chapter, setChapter] = useState<ChapterTransition | null>(null);
  const [tipModal, setTipModal] = useState<{ id: TipId; source: TipSource } | null>(null);
  const [showTipsList, setShowTipsList] = useState(false);
  const [npcDialogue, setNpcDialogue] = useState<NpcDialogue | null>(null);
  const [npcOptionIndex, setNpcOptionIndex] = useState(0);
  const [, setTipsRevision] = useState(0);
  const [saved, setSaved] = useState<GameSnapshotV5 | null>(() => loadSnapshot());
  const [, setSettingsRevision] = useState(0);
  const [showDevTools, setShowDevTools] = useState(import.meta.env.DEV);
  const [tutorialPulse, setTutorialPulse] = useState(false);
  const [openingChoiceMade, setOpeningChoiceMade] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const pausePrimaryRef = useRef<HTMLButtonElement>(null);
  const tipsCloseRef = useRef<HTMLButtonElement>(null);
  const tipCloseRef = useRef<HTMLButtonElement>(null);
  const endingPrimaryRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const npcOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const endingCopy = useMemo(() => {
    if (!ending) return null;
    const base = ENDING_COPY[ending];
    if (ending === "return") return base;
    const snapshot = getSnapshot();
    const choice = endingChoiceCopy(snapshot.endingChoice, snapshot.memories.length);
    return {
      ...base,
      body: `${choice.action}${openingReplyEcho(snapshot.openingReply)}`,
      quote: choice.quote,
    };
  }, [ending]);
  const interactionStateRef = useRef({ screen, paused, ending, tipModal, showTipsList, npcDialogue, npcOptionIndex });
  interactionStateRef.current = { screen, paused, ending, tipModal, showTipsList, npcDialogue, npcOptionIndex };

  useEffect(() => {
    installGameTestHooks();
    const offHud = gameEvents.on("hud", setHud);
    const offPause = gameEvents.on("pause", (value) => setPaused(value));
    const offEnding = gameEvents.on("ending", (value) => setEnding(value));
    const offChapter = gameEvents.on("chapter", (value) => setChapter(value));
    const offTipOpen = gameEvents.on("tipOpen", (tip) => {
      pauseGame();
      setTipModal(tip);
      setTipsRevision((revision) => revision + 1);
    });
    const offNpcDialogue = gameEvents.on("npcDialogueOpen", (dialogue) => {
      setNpcOptionIndex(0);
      setNpcDialogue(dialogue);
    });
    const handleEarlyKeys = (event: KeyboardEvent) => {
      const state = interactionStateRef.current;
      const key = event.key.toLowerCase();
      if (state.npcDialogue) {
        if (key === "arrowdown" || key === "s" || key === "arrowup" || key === "w") {
          event.preventDefault();
          event.stopImmediatePropagation();
          const direction = key === "arrowdown" || key === "s" ? 1 : -1;
          const next = (state.npcOptionIndex + direction + state.npcDialogue.options.length) % state.npcDialogue.options.length;
          setNpcOptionIndex(next);
          window.setTimeout(() => npcOptionRefs.current[next]?.focus(), 0);
          return;
        }
        if (key === "e" || key === "enter" || key === "escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          const fallback = state.npcDialogue.options.findIndex((option) => option.id === "decline" || option.id === "later");
          const index = key === "escape" ? (fallback >= 0 ? fallback : state.npcDialogue.options.length - 1) : state.npcOptionIndex;
          const option = state.npcDialogue.options[index];
          if (option) gameEvents.emit("npcDialogueChoice", { npcId: state.npcDialogue.npcId, optionId: option.id });
          setNpcDialogue(null);
          mountRef.current?.focus();
          return;
        }
      }
      if (state.tipModal && (key === "escape" || key === "e" || key === "enter")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setTipModal(null);
        gameEvents.emit("tipClosed", state.tipModal);
        resumeGame();
        return;
      }
      if (state.showTipsList && key === "escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setShowTipsList(false);
        resumeGame();
        return;
      }
      const modal = document.querySelector<HTMLElement>("[data-modal-active='true']");
      if (modal && key === "tab") {
        const focusable = [...modal.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])")];
        if (!focusable.length) return;
        const current = focusable.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey ? (current <= 0 ? focusable.length - 1 : current - 1) : (current + 1) % focusable.length;
        event.preventDefault();
        event.stopImmediatePropagation();
        focusable[next]?.focus();
        return;
      }
      if (state.screen !== "playing" || state.ending) return;
      if (key === "f" && !state.tipModal && !state.showTipsList && !state.paused) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
        return;
      }
      if (key !== "escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else if (state.paused) {
        setConfirmReturn(false);
        setPaused(false);
        resumeGame();
      } else {
        pauseGame();
        setPaused(true);
      }
    };
    window.addEventListener("keydown", handleEarlyKeys, true);
    return () => {
      window.removeEventListener("keydown", handleEarlyKeys, true);
      offHud();
      offPause();
      offEnding();
      offChapter();
      offTipOpen();
      offNpcDialogue();
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

  const beginNew = () => {
    audioDirector.unlock();
    setEnding(null);
    setPaused(false);
    setSaved(startNewGame());
    setOpeningChoiceMade(false);
    setScreen("opening");
    window.setTimeout(() => audioDirector.playVoicemail(), 120);
  };

  const chooseOpeningReply = (reply: GameSnapshotV5["openingReply"]) => {
    if (!reply) return;
    patchSnapshot({ openingReply: reply });
    setSaved(getSnapshot());
    setOpeningChoiceMade(true);
    audioDirector.speak(OPENING_REPLIES.find((item) => item.id === reply)?.echo ?? JOURNEY_GOAL);
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

  const playTutorialTap = () => {
    audioDirector.caneTap("tactile");
    setTutorialPulse(false);
    window.requestAnimationFrame(() => setTutorialPulse(true));
    window.setTimeout(() => setTutorialPulse(false), 900);
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

  const closeTipsList = () => {
    setShowTipsList(false);
    resumeGame();
  };

  const chooseNpcOption = (optionIndex: number) => {
    if (!npcDialogue) return;
    const option = npcDialogue.options[optionIndex];
    if (!option) return;
    gameEvents.emit("npcDialogueChoice", { npcId: npcDialogue.npcId, optionId: option.id });
    setNpcDialogue(null);
    mountRef.current?.focus();
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

  const jumpDev = (stage: ResumeStage, busState: BusTransitState) => {
    sessionStorage.setItem("sound-road-dev-reveal", "hint");
    const checkpoint = checkpointForStage(stage);
    patchSnapshot({ ...checkpoint, busState });
    startGame("phaser-game", checkpoint.scene);
  };

  const teleportDev = (x: number, y: number) => gameEvents.emit("devTeleport", { x, y });
  const teleportToCurrentTarget = () => {
    const objective = OBJECTIVES[getSnapshot().objectiveId];
    let target = objective && (objective.target.x !== 0 || objective.target.y !== 0)
      ? objective.target
      : { x: 320, y: 180 };
    try {
      const live = window.render_game_to_text?.();
      const liveTarget = live ? (JSON.parse(live) as { objective?: { target?: { x: number; y: number } } }).objective?.target : null;
      if (liveTarget && (liveTarget.x !== 0 || liveTarget.y !== 0)) target = liveTarget;
    } catch {
      // Development helper only: fall back to the saved objective target.
    }
    teleportDev(target.x, target.y);
    gameEvents.emit("devReveal", "hint");
  };

  const modalOpen = paused || showTipsList || !!tipModal || !!endingCopy;
  useEffect(() => {
    if (!modalOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const preferred = tipModal ? tipCloseRef.current : showTipsList ? tipsCloseRef.current : paused ? pausePrimaryRef.current : endingPrimaryRef.current;
    preferred?.focus();
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [modalOpen, paused, showTipsList, tipModal]);

  useEffect(() => {
    if (!npcDialogue) return;
    npcOptionRefs.current[0]?.focus();
  }, [npcDialogue]);

  return (
    <main className="app-shell">
      {screen === "menu" && (
        <section className="title-screen" aria-labelledby="game-title">
          <img className="title-art" src={chapterMapUrl} alt="" aria-hidden="true" />
          <div className="title-copy">
            <p className="eyebrow">A MACAU SOUND-TOUCH JOURNEY</p>
            <h1 id="game-title">声路·澳门</h1>
            <p className="title-subtitle">用盲杖读懂城市，搭乘17路去赴一场旧约。</p>
            <div className="mode-select" role="group" aria-label="游戏模式">
              <button aria-pressed={getSnapshot().settings.gameMode === "experience"} className={getSnapshot().settings.gameMode === "experience" ? "mode-option is-active" : "mode-option"} onClick={() => updateSetting("gameMode", "experience")}>体验模式</button>
              <button aria-pressed={getSnapshot().settings.gameMode === "night"} className={getSnapshot().settings.gameMode === "night" ? "mode-option is-active" : "mode-option"} onClick={() => updateSetting("gameMode", "night")}>黑夜模式</button>
            </div>
            <p className="mode-note">{getSnapshot().settings.gameMode === "night" ? "黑夜模式：未触碰处归于全黑，Q 仍提供方向与语音提示。" : "体验模式：触碰后的街景会留下淡彩记忆，适合首次旅程。"}</p>
            <div className="title-actions">
              <button className="primary-button" onClick={beginNew}>开始新旅程</button>
              {saved && !saved.ending && <button className="secondary-button" onClick={continueSaved}>继续：{saved.scene === "bus-stop" ? "關閘" : saved.scene === "old-city" ? "白鸽巢" : "上次检查点"}</button>}
            </div>
            <p className="disclaimer">桌面键盘游戏 · 建议开启声音体验盲杖与环境反馈</p>
            <p className="access-note">当前版本未经视障人士实测，不代表真实失明体验或无障碍认证。</p>
          </div>
        </section>
      )}

      {screen === "opening" && (
        <section className="opening-screen" aria-labelledby="opening-title">
          <div className="opening-card pixel-panel">
            <div className="old-photo" role="img" aria-label="一张雨后大三巴前的旧合照：年轻时的你与林伯并肩站在牌坊下">
              <img className="photo-img" src={oldPhotoUrl} alt="" aria-hidden="true" />
              <small>大三巴 · 多年前</small>
            </div>
            <div className="opening-copy">
              <p className="eyebrow">一条未读语音 · 林伯</p>
              <h2 id="opening-title">今天，要去见一位老朋友</h2>
              <p className="voice-message">“{LIN_VOICE_MESSAGE}”</p>
              <div className="journey-contract" aria-label="本次旅程目标">
                <span>旅程目标</span>
                <strong>{JOURNEY_GOAL}</strong>
                <small>你是一位低视力出行者。城市不会替你自动寻路；声音、盲杖和自己的判断会组成路线。</small>
              </div>
              <p className="reply-label">选择一条回复：</p>
              <div className="opening-replies">
                {OPENING_REPLIES.map((reply) => (
                  <button
                    key={reply.id}
                    className={getSnapshot().openingReply === reply.id ? "is-active" : ""}
                    aria-pressed={getSnapshot().openingReply === reply.id}
                    onClick={() => chooseOpeningReply(reply.id)}
                  >{reply.label}</button>
                ))}
              </div>
              {openingChoiceMade && (
                <div className="opening-echo" aria-live="polite">
                  <p>{openingReplyEcho(getSnapshot().openingReply)}</p>
                  <button className="primary-button" onClick={() => setScreen("tutorial")}>收好照片，准备出发</button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {screen === "tutorial" && (
        <section className="tutorial-screen" aria-labelledby="tutorial-title">
          <div className="tutorial-card pixel-panel">
            <p className="eyebrow">出发前</p>
            <h2 id="tutorial-title">先读懂脚下的路</h2>
            <div className="tile-examples" aria-label="盲道样式示例">
              <div className="tile-copy"><span className={`tutorial-tile guidance${tutorialPulse ? " is-lit" : ""}`} aria-hidden="true"><i /><i /><i /><i /></span><span><strong>四条凸纹</strong><small>{TUTORIAL_LINES[0]}</small></span></div>
              <div className="tile-copy"><span className={`tutorial-tile decision${tutorialPulse ? " is-lit" : ""}`} aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</span><span><strong>4×4凸点</strong><small>{TUTORIAL_LINES[1]}</small></span></div>
            </div>
            <div className="key-grid">
              <span><kbd>WASD / 方向键</kbd> 行走</span><span><kbd>Space</kbd> 一根盲杖敲击</span>
              <span><kbd>Q</kbd> 方向指引</span><span><kbd>R</kbd> 驻足聆听</span>
              <span><kbd>H</kbd> 重复双层目标</span><span><kbd>G</kbd> 照亮四周</span>
              <span><kbd>E</kbd> 互动</span><span><kbd>Esc</kbd> 暂停</span>
            </div>
            <p className="tutorial-tip">城市以暖灰呈现。杖头触碰处会短暂恢复完整暖色；R 会让你停下 1.2 秒，报告左右与远近。室外离开盲道后，速度严格为盲道上的 35%；Q 只指出目标方向，不会显示整条路线。</p>
            <button className={`tactile-demo${tutorialPulse ? " is-active" : ""}`} onClick={playTutorialTap}><kbd>Space</kbd><span><strong>先试听一次盲杖</strong><small>敲击凸纹，感受材质声音与暖色反馈</small></span></button>
            <button className="primary-button" onClick={enterGame}>从拱北口岸门口出发</button>
          </div>
        </section>
      )}

      {screen === "playing" && (
        <section className={`game-stage${getSnapshot().settings.gameMode === "night" ? " is-night" : ""}`} aria-label="声路澳门2D游戏" aria-hidden={modalOpen || undefined}>
          <aside className="side-panel" aria-label="旅程功能栏">
            <div className="hud-objective pixel-panel" aria-live="polite">
              <span className="hud-label">旅程目标</span>
              <strong className="journey-goal">{hud.journeyGoal}</strong>
              <span className="hud-label immediate-label">眼前一步</span>
              <strong>{hud.objective}</strong>
              <small>{hud.sceneLabel}</small>
            </div>
            <div className="hud-memory pixel-panel" aria-label="旅程状态">
              <span>记忆 {hud.memories} / {MEMORY_TOTAL}</span>
              <span>危险纠偏 {String(hud.detours).padStart(2, "0")}</span>
            </div>
            {hud.eggTartBoostRemainingMs > 0 && (
              <div className="boost-status pixel-panel" role="status" aria-live="polite">
                <span aria-hidden="true">◈</span>
                <strong>蛋挞余温 · +60%</strong>
                <time>{Math.ceil(hud.eggTartBoostRemainingMs / 1000)}s</time>
              </div>
            )}
            <button className="tips-entry" onClick={() => { pauseGame(); setShowTipsList(true); }} aria-label={`盲人小贴士，已解锁${getSnapshot().unlockedTips.length}条`}>
              <span className="tips-entry-icon" aria-hidden="true">✦</span>
              <span><strong>盲人小贴士</strong><small>已解锁 {getSnapshot().unlockedTips.length} / {TIP_TOTAL} 条</small></span>
            </button>
            <div className="hud-contact pixel-panel" aria-live="polite">
              <span className="hud-label">最近触觉 · 一根盲杖</span>
              <strong>{hud.contact}</strong>
              {hud.contactHistory.length > 1 && <ol className="contact-history">{hud.contactHistory.slice(1).map((entry) => <li key={entry}>{entry}</li>)}</ol>}
            </div>
            <div className="hud-controls pixel-panel" aria-label="操作提示">
              <span><kbd>空格</kbd> 单杖敲击</span>
              <span><kbd>Q</kbd> {hud.hintCooling ? "冷却" : "方向"}</span>
              <span><kbd>R</kbd> {hud.listening ? "聆听中" : hud.listenCooling ? "冷却" : "聆听"}</span>
              <span><kbd>H</kbd> 重复目标</span>
              <span><kbd>G</kbd> {hud.flashCooling ? "冷却" : "照亮"}</span><span><kbd>E</kbd> 互动</span>
              <span><kbd>F</kbd> 全屏</span>
            </div>
            <button className="pause-button" onClick={() => { pauseGame(); setPaused(true); }} aria-label="暂停游戏">Esc 暂停</button>
            {import.meta.env.DEV && showDevTools && (
              <div className="dev-tools" aria-label="开发流程跳转">
                <button onClick={() => jumpDev("bus-stop-sign", "doorOpen")}>候车</button>
                <button onClick={() => jumpDev("bus-interior-entry", "boarding")}>车厢</button>
                <button onClick={teleportToCurrentTarget}>到目标</button>
                <button onClick={() => gameEvents.emit("devTap", undefined)}>敲击</button>
                <button onClick={() => gameEvents.emit("devListen", undefined)}>聆听</button>
                <button onClick={() => gameEvents.emit("devInteract", undefined)}>执行E</button>
                <button onClick={() => jumpDev("old-city-entry", "arrived")}>旧城</button>
                <button onClick={() => jumpDev("old-city-street", "alighted")}>商街</button>
                <button onClick={() => teleportDev(EGG_TART_STALL.x, EGG_TART_STALL.y + 24)}>蛋挞</button>
                <button onClick={() => jumpDev("ruins-entry", "alighted")}>终点</button>
                <button onClick={() => setShowDevTools(false)}>隐藏测试栏</button>
              </div>
            )}
          </aside>
          <div className="game-view">
            <div id="phaser-game" ref={mountRef} className="phaser-mount" tabIndex={-1} />
            <div className="screen-shade" aria-hidden="true" />
            {(hud.subtitle || hud.prompt) && (
              <div className="dialogue-stack" style={{ fontSize: `${getSnapshot().settings.subtitleScale}em` }}>
                {hud.subtitle && <p className="subtitle pixel-panel" aria-live="assertive">{hud.subtitle}</p>}
                {hud.prompt && <p className="interact-prompt">{hud.prompt}</p>}
              </div>
            )}
            {npcDialogue && (
              <section className="npc-dialogue pixel-panel" role="dialog" aria-modal="true" aria-labelledby="npc-dialogue-speaker">
                <p className="eyebrow" id="npc-dialogue-speaker">{npcDialogue.speaker}</p>
                <p className="npc-dialogue-prompt">{npcDialogue.prompt}</p>
                <div className="npc-dialogue-options" role="group" aria-label="选择回应">
                  {npcDialogue.options.map((option, index) => (
                    <button
                      key={option.id}
                      ref={(element) => { npcOptionRefs.current[index] = element; }}
                      className={index === npcOptionIndex ? "is-active" : ""}
                      onMouseEnter={() => setNpcOptionIndex(index)}
                      onClick={() => chooseNpcOption(index)}
                    >
                      <kbd>{index + 1}</kbd>{option.label}
                    </button>
                  ))}
                </div>
                <small>W/S 或方向键选择 · E/Enter 确认 · Esc 稍后再说</small>
              </section>
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
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pause-title" data-modal-active="true">
          <div className="pause-card pixel-panel">
            <p className="eyebrow">旅程暂停</p>
            <h2 id="pause-title">在雨声里停一会儿</h2>
            <button ref={pausePrimaryRef} className="primary-button" onClick={resume}>继续行走</button>
            <section className="route-notes" aria-labelledby="memory-list-title">
              <div>
                <span className="hud-label">记忆清单</span>
                <h3 id="memory-list-title">一路上亮起的往事</h3>
              </div>
              <p><strong>旧城走法：</strong>{routeChoiceLabel(getSnapshot().routeChoice)}。笔记只保存线索，不画自动导航路线。</p>
              {getSnapshot().memories.length ? (
                <ol>{getSnapshot().memories.map((id) => <li key={id}><strong>{MEMORY_DEFINITIONS[id]?.title}</strong>：{MEMORY_DEFINITIONS[id]?.description}</li>)}</ol>
              ) : <p className="route-notes-empty">还没有想起往事。途中触碰与聆听，会让它们亮起来。</p>}
            </section>
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
        <div className="modal-backdrop tips-list-backdrop" role="dialog" aria-modal="true" aria-labelledby="tips-list-title" data-modal-active="true">
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
            <button ref={tipsCloseRef} className="quiet-button" onClick={closeTipsList}>关闭</button>
          </article>
        </div>
      )}

      {tipModal && !ending && (
        <div className="modal-backdrop mobility-guide-backdrop" role="dialog" aria-modal="true" aria-labelledby="mobility-guide-title" data-modal-active="true">
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
            <button ref={tipCloseRef} className="primary-button" onClick={dismissTip}>{tipModal.source === "intro" ? "我知道了，前往盲道起点" : "关闭贴士"}</button>
          </article>
        </div>
      )}

      {endingCopy && (
        <div className="modal-backdrop ending-backdrop" role="dialog" aria-modal="true" aria-labelledby="ending-title" data-modal-active="true">
          <article className="ending-card pixel-panel">
            <p className="eyebrow">旅程终章</p>
            <h2 id="ending-title">{endingCopy.title}</h2>
            <p>{endingCopy.body}</p>
            <blockquote>{endingCopy.quote}</blockquote>
            <dl className="ending-metrics">
              <div><dt>记忆</dt><dd>{getSnapshot().memories.length} / {MEMORY_TOTAL}</dd></div>
              <div><dt>危险纠偏</dt><dd>{getSnapshot().detourScore}</dd></div>
              <div><dt>旧城走法</dt><dd>{routeChoiceLabel(getSnapshot().routeChoice)}</dd></div>
            </dl>
            <button ref={endingPrimaryRef} className="primary-button" onClick={backToMenu}>回到主菜单</button>
          </article>
        </div>
      )}
    </main>
  );
}

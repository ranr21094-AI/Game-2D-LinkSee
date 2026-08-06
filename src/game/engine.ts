import Phaser from "phaser";
import { audioDirector } from "./audio";
import { BusInteriorScene, BusStopScene, OldCityScene, RuinsScene } from "./scenes";
import { getSnapshot, pauseActiveTimer, resumeActiveTimer } from "./store";
import type { GameTextState, SceneId } from "./types";

let game: Phaser.Game | null = null;
let resizeHandler: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let visibilityHandler: (() => void) | null = null;
let manuallyPaused = false;

type TextRenderableScene = Phaser.Scene & { renderGameToText?: () => GameTextState };

function sceneKey(scene: SceneId): string {
  return scene;
}

export function startGame(parent: string, initialScene: SceneId): Phaser.Game {
  destroyGame();
  manuallyPaused = false;
  const classes = [BusStopScene, BusInteriorScene, OldCityScene, RuinsScene];
  const classByScene: Record<SceneId, (typeof classes)[number]> = {
    "bus-stop": BusStopScene,
    "bus-interior": BusInteriorScene,
    "old-city": OldCityScene,
    ruins: RuinsScene,
  };
  const initialClass = classByScene[initialScene] ?? BusStopScene;
  const orderedScenes = [initialClass, ...classes.filter((SceneClass) => SceneClass !== initialClass)];
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 640,
    height: 360,
    backgroundColor: getSnapshot().settings.gameMode === "night" ? "#000000" : "#77736b",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    render: { antialias: false, pixelArt: true, roundPixels: true },
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 640,
      height: 360,
    },
    fps: { target: 60 },
    scene: orderedScenes,
    audio: { disableWebAudio: false },
  });
  resizeHandler = () => {
    if (!game) return;
    const host = document.getElementById(parent)?.getBoundingClientRect();
    const ratio = Math.min((host?.width ?? window.innerWidth) / 640, (host?.height ?? window.innerHeight) / 360);
    game.scale.setZoom(Math.max(0.4, ratio));
    game.scale.refresh();
  };
  visibilityHandler = () => {
    if (document.hidden) {
      pauseActiveTimer();
      audioDirector.pause();
    } else if (!manuallyPaused) {
      resumeActiveTimer();
      audioDirector.resume();
    }
  };
  window.addEventListener("resize", resizeHandler);
  const hostElement = document.getElementById(parent);
  if (hostElement && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => resizeHandler?.());
    resizeObserver.observe(hostElement);
  }
  document.addEventListener("visibilitychange", visibilityHandler);
  resizeHandler();
  resumeActiveTimer();
  installGameTestHooks();
  return game;
}

export function renderGameToText(): string {
  const active = game?.scene.getScenes(true).find((scene) => typeof (scene as TextRenderableScene).renderGameToText === "function") as TextRenderableScene | undefined;
  if (active?.renderGameToText) return JSON.stringify(active.renderGameToText());
  const snapshot = getSnapshotForText();
  return JSON.stringify({
    coordinateSystem: "origin top-left; x right; y down; canvas 640x360",
    mode: snapshot.ending ? "ending" : "menu",
    gameMode: snapshot.settings.gameMode,
    scene: snapshot.scene,
    journeyGoal: "赴约：在大三巴与老友林伯会合",
    player: null,
    objective: { id: snapshot.objectiveId, label: snapshot.ending ? "旅程已经完成" : "游戏尚未开始", target: { x: 0, y: 0 } },
    prompt: "",
    subtitle: "",
    contact: "",
    npcs: [],
    nearbySoundLandmarks: [],
    recentEvidence: [],
    routeChoice: snapshot.routeChoice,
    openingReply: snapshot.openingReply,
    movementSurface: "stationary",
    movementSpeedMultiplier: 1,
    eggTartPurchased: snapshot.eggTartPurchased,
    eggTartBoostRemainingMs: snapshot.eggTartBoostRemainingMs,
    insideEggTartScentZone: false,
    eggTartScentPrompted: snapshot.eggTartScentPrompted,
    cooldowns: { hintMs: 0, flashMs: 0, listenMs: 0 },
    flags: { controlsLocked: false, dialogueOpen: false, listening: false, ending: snapshot.ending },
  } satisfies GameTextState);
}

function getSnapshotForText() {
  return getSnapshot();
}

export function advanceGameTime(ms: number): void {
  if (!game || ms <= 0) return;
  const wasRunning = game.loop.running;
  game.loop.sleep();
  const frameMs = 1000 / 60;
  const steps = Math.max(1, Math.ceil(ms / frameMs));
  let time = game.loop.now;
  for (let index = 0; index < steps; index += 1) {
    time += Math.min(frameMs, ms - index * frameMs || frameMs);
    game.loop.step(time);
  }
  if (wasRunning) game.loop.wake();
}

export function installGameTestHooks(): void {
  window.render_game_to_text = renderGameToText;
  window.advanceTime = advanceGameTime;
}

export function pauseGame(): void {
  manuallyPaused = true;
  pauseActiveTimer();
  audioDirector.pause();
  game?.scene.getScenes(true).forEach((scene) => scene.scene.pause());
}

export function resumeGame(): void {
  manuallyPaused = false;
  game?.scene.getScenes(false).forEach((scene) => {
    if (scene.scene.isPaused()) scene.scene.resume();
  });
  resumeActiveTimer();
  audioDirector.resume();
}

export function destroyGame(): void {
  pauseActiveTimer();
  audioDirector.pause();
  if (resizeHandler) window.removeEventListener("resize", resizeHandler);
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
  resizeHandler = null;
  visibilityHandler = null;
  if (!game) return;
  game.destroy(true);
  game = null;
}

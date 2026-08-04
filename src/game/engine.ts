import Phaser from "phaser";
import { audioDirector } from "./audio";
import { BusInteriorScene, BusRideScene, BusStopScene, OldCityCrossingScene, OldCityScene, RuinsScene } from "./scenes";
import { pauseActiveTimer, resumeActiveTimer } from "./store";
import type { SceneId } from "./types";

let game: Phaser.Game | null = null;
let resizeHandler: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let visibilityHandler: (() => void) | null = null;
let manuallyPaused = false;

function sceneKey(scene: SceneId): string {
  return scene;
}

export function startGame(parent: string, initialScene: SceneId): Phaser.Game {
  destroyGame();
  manuallyPaused = false;
  const classes = [BusStopScene, BusInteriorScene, BusRideScene, OldCityScene, OldCityCrossingScene, RuinsScene];
  const classByScene: Record<SceneId, (typeof classes)[number]> = {
    "bus-stop": BusStopScene,
    "bus-interior": BusInteriorScene,
    "bus-ride": BusRideScene,
    "old-city": OldCityScene,
    "old-city-crossing": OldCityCrossingScene,
    ruins: RuinsScene,
  };
  const initialClass = classByScene[initialScene] ?? BusStopScene;
  const orderedScenes = [initialClass, ...classes.filter((SceneClass) => SceneClass !== initialClass)];
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 640,
    height: 360,
    backgroundColor: "#77736b",
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
  return game;
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

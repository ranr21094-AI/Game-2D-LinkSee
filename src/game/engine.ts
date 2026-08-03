import Phaser from "phaser";
import { BusInteriorScene, BusRideScene, BusStopScene, OldCityScene, RuinsScene } from "./scenes";
import type { SceneId } from "./types";

let game: Phaser.Game | null = null;

function sceneKey(scene: SceneId): string {
  return scene;
}

export function startGame(parent: string, initialScene: SceneId): Phaser.Game {
  destroyGame();
  const classes = [BusStopScene, BusInteriorScene, BusRideScene, OldCityScene, RuinsScene];
  const classByScene: Record<SceneId, (typeof classes)[number]> = {
    "bus-stop": BusStopScene,
    "bus-interior": BusInteriorScene,
    "bus-ride": BusRideScene,
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
    backgroundColor: "#061018",
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    render: { antialias: false, pixelArt: true, roundPixels: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 640,
      height: 360,
    },
    fps: { target: 60, forceSetTimeOut: true },
    scene: orderedScenes,
    audio: { disableWebAudio: false },
  });
  return game;
}

export function pauseGame(): void {
  game?.scene.getScenes(true).forEach((scene) => scene.scene.pause());
}

export function resumeGame(): void {
  game?.scene.getScenes(false).forEach((scene) => {
    if (scene.scene.isPaused()) scene.scene.resume();
  });
}

export function destroyGame(): void {
  if (!game) return;
  game.destroy(true);
  game = null;
}

import Phaser from "phaser";
import busStopUrl from "../assets/bus-stop.png";
import busInteriorUrl from "../assets/bus-interior.png";
import busRideUrl from "../assets/bus-ride.png";
import oldCityUrl from "../assets/old-city.png";
import travelerUrl from "../assets/traveler.png";
import { audioDirector } from "./audio";
import { OBJECTIVES, PATHS, REVEAL_PROFILE, SCENE_LABELS } from "./content";
import { gameEvents } from "./events";
import { determineEnding, transitionBus } from "./flow";
import { collectMemory, finishGame, getSnapshot, patchSnapshot, setCheckpoint } from "./store";
import type { BusTransitState, HudState, SceneId, TactilePathDefinition, TactilePathNode } from "./types";

type Facing = "up" | "down" | "left" | "right";
type RevealMode = "tap" | "sweep" | "hint" | null;

const FACE_FRAME: Record<Facing, number> = { up: 0, left: 1, right: 2, down: 3 };
const FACE_VECTOR: Record<Facing, Phaser.Math.Vector2> = {
  up: new Phaser.Math.Vector2(0, -1),
  down: new Phaser.Math.Vector2(0, 1),
  left: new Phaser.Math.Vector2(-1, 0),
  right: new Phaser.Math.Vector2(1, 0),
};

function pointSegmentDistance(point: Phaser.Math.Vector2, a: TactilePathNode, b: TactilePathNode): number {
  const ab = new Phaser.Math.Vector2(b.x - a.x, b.y - a.y);
  const ap = new Phaser.Math.Vector2(point.x - a.x, point.y - a.y);
  const lengthSq = Math.max(1, ab.lengthSq());
  const t = Phaser.Math.Clamp(ap.dot(ab) / lengthSq, 0, 1);
  return Phaser.Math.Distance.Between(point.x, point.y, a.x + ab.x * t, a.y + ab.y * t);
}

abstract class WalkScene extends Phaser.Scene {
  protected abstract sceneId: Exclude<SceneId, "bus-ride">;
  protected abstract backgroundKey: string;
  protected abstract backgroundUrl: string;
  protected abstract spawn: Phaser.Math.Vector2;
  protected abstract objectiveId: string;
  protected player!: Phaser.GameObjects.Sprite;
  protected pathGraphics!: Phaser.GameObjects.Graphics;
  protected revealGraphics!: Phaser.GameObjects.Graphics;
  protected path!: TactilePathDefinition;
  protected facing: Facing = "up";
  protected revealMode: RevealMode = null;
  protected revealUntil = 0;
  protected hintCooldownUntil = 0;
  protected keys!: Record<string, Phaser.Input.Keyboard.Key>;
  protected prompt = "";
  protected subtitle = "";
  private previousHud = "";
  private lastDetourAt = 0;
  private wasOnRoute = true;
  private lastStepAt = 0;
  private devInteractRequested = false;
  private cleanupDevEvents: Array<() => void> = [];

  preload(): void {
    this.load.image(this.backgroundKey, this.backgroundUrl);
    if (!this.textures.exists("traveler")) {
      this.load.spritesheet("traveler", travelerUrl, { frameWidth: 627, frameHeight: 627 });
    }
  }

  create(): void {
    const bg = this.add.image(320, 180, this.backgroundKey).setDisplaySize(640, 360);
    bg.setTint(0xb7c1c6);
    this.add.rectangle(320, 180, 640, 360, 0x061018, 0.18);
    this.path = PATHS[this.sceneId];
    this.pathGraphics = this.add.graphics();
    this.revealGraphics = this.add.graphics();
    this.drawPath(this.pathGraphics, 0x131a19, 0.74);
    this.player = this.add.sprite(this.spawn.x, this.spawn.y, "traveler", FACE_FRAME[this.facing]);
    this.player.setScale(0.16).setDepth(20);
    this.player.setOrigin(0.5, 0.58);
    this.keys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      tap: Phaser.Input.Keyboard.KeyCodes.SPACE,
      sweep: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      hint: Phaser.Input.Keyboard.KeyCodes.Q,
      repeat: Phaser.Input.Keyboard.KeyCodes.H,
      pause: Phaser.Input.Keyboard.KeyCodes.ESC,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard?.addCapture(["SPACE", "SHIFT", "Q", "E"]);
    if (import.meta.env.DEV) {
      this.cleanupDevEvents.push(gameEvents.on("devTeleport", (point) => this.player.setPosition(point.x, point.y)));
      this.cleanupDevEvents.push(gameEvents.on("devInteract", () => { this.devInteractRequested = true; }));
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupDevEvents.splice(0).forEach((off) => off()));
    }
    setCheckpoint(this.sceneId);
    gameEvents.emit("scene", this.sceneId);
    this.onSceneReady();
    if (import.meta.env.DEV && sessionStorage.getItem("sound-road-dev-reveal")) {
      this.revealMode = sessionStorage.getItem("sound-road-dev-reveal") === "sweep" ? "sweep" : "hint";
      this.revealUntil = this.time.now + 60_000;
    }
    this.emitHud();
  }

  protected onSceneReady(): void {}

  update(time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      this.scene.pause();
      gameEvents.emit("pause", true);
      return;
    }
    this.updateMovement(time, delta);
    this.updateReveal(time);
    this.handleActions(time);
    this.checkRoute(time);
    this.updateInteraction(time);
    this.emitHud();
  }

  protected abstract updateInteraction(time: number): void;

  protected isNear(x: number, y: number, radius: number): boolean {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) <= radius;
  }

  protected interactionPressed(): boolean {
    if (this.devInteractRequested) {
      this.devInteractRequested = false;
      return true;
    }
    return Phaser.Input.Keyboard.JustDown(this.keys.interact);
  }

  protected announce(text: string): void {
    this.subtitle = text;
    gameEvents.emit("announce", text);
    this.time.delayedCall(3400, () => {
      if (this.subtitle === text) this.subtitle = "";
    });
  }

  private updateMovement(time: number, delta: number): void {
    let x = Number(this.keys.right.isDown) - Number(this.keys.left.isDown);
    let y = Number(this.keys.down.isDown) - Number(this.keys.up.isDown);
    if (!x && !y) return;
    const length = Math.hypot(x, y) || 1;
    x /= length;
    y /= length;
    const speed = this.revealMode === "sweep" ? 48 : 68;
    this.player.x = Phaser.Math.Clamp(this.player.x + x * speed * (delta / 1000), 24, 616);
    this.player.y = Phaser.Math.Clamp(this.player.y + y * speed * (delta / 1000), 40, 340);
    if (Math.abs(x) > Math.abs(y)) this.facing = x > 0 ? "right" : "left";
    else this.facing = y > 0 ? "down" : "up";
    this.player.setFrame(FACE_FRAME[this.facing]);
    if (!getSnapshot().settings.reducedMotion) {
      this.player.setScale(0.16, 0.16 + Math.sin(time / 85) * 0.004);
    }
    if (time - this.lastStepAt > 360) {
      this.lastStepAt = time;
      audioDirector.caneTap("stone");
    }
  }

  private handleActions(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.tap)) {
      this.revealMode = "tap";
      this.revealUntil = time + REVEAL_PROFILE.tapDurationMs;
      audioDirector.caneTap(this.distanceToRoute() < 22 ? "tactile" : "stone");
      this.player.setAngle(this.facing === "left" ? -4 : 4);
      this.time.delayedCall(140, () => this.player.setAngle(0));
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.sweep)) {
      this.revealMode = "sweep";
      this.revealUntil = time + REVEAL_PROFILE.sweepDurationMs;
      audioDirector.sweep();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.hint) && time >= this.hintCooldownUntil) {
      this.revealMode = "hint";
      this.revealUntil = time + REVEAL_PROFILE.hintDurationMs;
      this.hintCooldownUntil = time + REVEAL_PROFILE.hintCooldownMs;
      audioDirector.hint();
      this.announce(`当前任务：${OBJECTIVES[this.objectiveId].label}`);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.repeat)) {
      const text = `当前任务：${OBJECTIVES[this.objectiveId].label}`;
      this.announce(text);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }
    }
  }

  private updateReveal(time: number): void {
    this.revealGraphics.clear();
    if (time > this.revealUntil) {
      this.revealMode = null;
      return;
    }
    const radius = this.revealMode === "hint" ? 256 : this.revealMode === "sweep" ? 160 : 144;
    this.drawRevealCone(radius);
    this.drawPath(this.revealGraphics, REVEAL_PROFILE.color, 1, (point) => this.pointIsRevealed(point, radius));
  }

  private drawRevealCone(radius: number): void {
    const direction = FACE_VECTOR[this.facing];
    const centerAngle = Math.atan2(direction.y, direction.x);
    const half = this.revealMode === "hint" ? Math.PI : this.revealMode === "sweep" ? Math.PI / 4 : Math.PI / 7;
    const points = [new Phaser.Math.Vector2(this.player.x, this.player.y)];
    for (let i = 0; i <= 24; i += 1) {
      const angle = centerAngle - half + (i / 24) * half * 2;
      points.push(new Phaser.Math.Vector2(this.player.x + Math.cos(angle) * radius, this.player.y + Math.sin(angle) * radius));
    }
    this.revealGraphics.fillStyle(0xf3c85b, this.revealMode === "hint" ? 0.11 : 0.16);
    this.revealGraphics.fillPoints(points, true);
    this.revealGraphics.lineStyle(1.5, 0xffdb77, 0.74);
    this.revealGraphics.strokePoints(points.slice(1), false);
  }

  private pointIsRevealed(point: Phaser.Math.Vector2, radius: number): boolean {
    const offset = new Phaser.Math.Vector2(point.x - this.player.x, point.y - this.player.y);
    if (offset.length() > radius) return false;
    if (this.revealMode === "hint") return true;
    const angleCos = offset.clone().normalize().dot(FACE_VECTOR[this.facing]);
    return angleCos >= (this.revealMode === "sweep" ? Math.SQRT1_2 : 0.8) || offset.length() < 34;
  }

  private drawPath(
    graphics: Phaser.GameObjects.Graphics,
    color: number,
    alpha: number,
    visible?: (point: Phaser.Math.Vector2) => boolean,
  ): void {
    const nodes = this.path?.nodes ?? [];
    for (let index = 0; index < nodes.length - 1; index += 1) {
      const a = nodes[index];
      const b = nodes[index + 1];
      const vector = new Phaser.Math.Vector2(b.x - a.x, b.y - a.y).normalize();
      const perpendicular = new Phaser.Math.Vector2(-vector.y, vector.x);
      const distance = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const steps = visible ? Math.max(1, Math.ceil(distance / 10)) : 1;
      for (let step = 0; step < steps; step += 1) {
        const startT = step / steps;
        const endT = (step + 1) / steps;
        const start = new Phaser.Math.Vector2(Phaser.Math.Linear(a.x, b.x, startT), Phaser.Math.Linear(a.y, b.y, startT));
        const end = new Phaser.Math.Vector2(Phaser.Math.Linear(a.x, b.x, endT), Phaser.Math.Linear(a.y, b.y, endT));
        const midpoint = start.clone().lerp(end, 0.5);
        if (visible && !visible(midpoint)) continue;
        [-6, -2, 2, 6].forEach((offset) => {
          graphics.lineStyle(2, color, alpha);
          graphics.lineBetween(start.x + perpendicular.x * offset, start.y + perpendicular.y * offset, end.x + perpendicular.x * offset, end.y + perpendicular.y * offset);
        });
      }
    }
    nodes.filter((node) => node.kind === "decision").forEach((node) => {
      if (visible && !visible(new Phaser.Math.Vector2(node.x, node.y))) return;
      graphics.fillStyle(color, alpha);
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          graphics.fillCircle(node.x + (col - 1.5) * 5, node.y + (row - 1.5) * 5, 1.7);
        }
      }
    });
  }

  private distanceToRoute(): number {
    const point = new Phaser.Math.Vector2(this.player.x, this.player.y);
    let distance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < this.path.nodes.length - 1; index += 1) {
      distance = Math.min(distance, pointSegmentDistance(point, this.path.nodes[index], this.path.nodes[index + 1]));
    }
    return distance;
  }

  private checkRoute(time: number): void {
    const onRoute = this.distanceToRoute() < 66;
    if (!onRoute && this.wasOnRoute && time - this.lastDetourAt > 3500) {
      this.lastDetourAt = time;
      const score = getSnapshot().detourScore + 1;
      patchSnapshot({ detourScore: score });
      this.announce("脚下没有凸纹。可以按 Q 显示附近路线。重回盲道后继续前进。");
    }
    this.wasOnRoute = onRoute;
  }

  private emitHud(): void {
    const snapshot = getSnapshot();
    const state: HudState = {
      objective: OBJECTIVES[this.objectiveId].label,
      subtitle: this.subtitle,
      prompt: this.prompt,
      memories: snapshot.memories.length,
      detours: snapshot.detourScore,
      sceneLabel: SCENE_LABELS[this.sceneId],
      hintCooling: this.time.now < this.hintCooldownUntil,
    };
    const serialized = JSON.stringify(state);
    if (serialized !== this.previousHud) {
      this.previousHud = serialized;
      gameEvents.emit("hud", state);
    }
  }
}

export class BusStopScene extends WalkScene {
  protected sceneId = "bus-stop" as const;
  protected backgroundKey = "bus-stop-bg";
  protected backgroundUrl = busStopUrl;
  protected spawn = new Phaser.Math.Vector2(96, 318);
  protected objectiveId = "board-17";

  constructor() {
    super("bus-stop");
  }

  protected onSceneReady(): void {
    const snapshot = getSnapshot();
    if (snapshot.busState === "waiting") {
      this.announce("雨刚停。17路正缓缓进站，稍等车门开启。");
      this.time.delayedCall(1100, () => {
        patchSnapshot({ busState: transitionBus(getSnapshot().busState, "openDoor") });
        audioDirector.door();
        this.announce("17路车门已开。沿盲道前往车门，靠近后按 E 上车。");
      });
    }
  }

  protected updateInteraction(): void {
    const objective = OBJECTIVES[this.objectiveId];
    const near = this.isNear(objective.target.x, objective.target.y, objective.triggerRadius);
    this.prompt = near ? (getSnapshot().busState === "doorOpen" ? "E  上车" : "请稍等车门开启") : "";
    if (near && getSnapshot().busState === "doorOpen" && this.interactionPressed()) {
      audioDirector.interact();
      patchSnapshot({ busState: transitionBus("doorOpen", "board"), objectiveId: "find-seat", scene: "bus-interior" });
      this.scene.start("bus-interior");
    }
  }
}

export class BusInteriorScene extends WalkScene {
  protected sceneId = "bus-interior" as const;
  protected backgroundKey = "bus-interior-bg";
  protected backgroundUrl = busInteriorUrl;
  protected spawn = new Phaser.Math.Vector2(530, 314);
  protected objectiveId = "find-seat";

  constructor() {
    super("bus-interior");
  }

  protected onSceneReady(): void {
    if (getSnapshot().busState === "doorOpen") patchSnapshot({ busState: "boarding" });
    this.announce("你已上车。沿车厢四纹盲道前进，点阵旁就是空座。");
  }

  protected updateInteraction(): void {
    const seat = OBJECTIVES[this.objectiveId];
    const near = this.isNear(seat.target.x, seat.target.y, seat.triggerRadius);
    const canSit = getSnapshot().busState === "boarding";
    this.prompt = near ? (canSit ? "E  坐下" : "座位暂不可用") : "";
    if (near && canSit && this.interactionPressed()) {
      audioDirector.interact();
      const seated = transitionBus(getSnapshot().busState, "sit");
      patchSnapshot({ busState: seated, selectedSeatId: "seat-a2", objectiveId: "ride-to-camoes", scene: "bus-ride" });
      this.announce("你收起盲杖，在座位上坐稳。");
      this.time.delayedCall(520, () => this.scene.start("bus-ride"));
    }
  }
}

export class BusRideScene extends Phaser.Scene {
  private startedAt = 0;
  private ended = false;
  private keys!: { skip: Phaser.Input.Keyboard.Key; pause: Phaser.Input.Keyboard.Key };

  constructor() {
    super("bus-ride");
  }

  preload(): void {
    this.load.image("bus-ride-bg", busRideUrl);
  }

  create(): void {
    const bg = this.add.image(324, 180, "bus-ride-bg").setDisplaySize(660, 371);
    if (!getSnapshot().settings.reducedMotion) this.tweens.add({ targets: bg, x: 316, duration: 9000, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.add.rectangle(320, 180, 640, 360, 0x04101a, 0.18);
    const state = getSnapshot().busState === "seated" ? transitionBus("seated", "depart") : "riding";
    patchSnapshot({ busState: state as BusTransitState, scene: "bus-ride", objectiveId: "ride-to-camoes" });
    this.keys = {
      skip: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      pause: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };
    this.startedAt = this.time.now;
    gameEvents.emit("scene", "bus-ride");
    gameEvents.emit("hud", {
      objective: "坐稳，下一站白鸽巢",
      subtitle: "引擎低鸣，雨珠在车窗上缓缓后退。",
      prompt: "3秒后可按 E 跳过过场",
      memories: getSnapshot().memories.length,
      detours: getSnapshot().detourScore,
      sceneLabel: SCENE_LABELS["bus-ride"],
      hintCooling: false,
    });
    this.time.delayedCall(5200, () => this.say("车内报站：下一站，白鸽巢總站。"));
    this.time.delayedCall(10500, () => {
      collectMemory("bus-rain");
      this.say("记忆回声：林伯曾说，听见雨落在玻璃上，就知道离家不远了。");
    });
    this.time.delayedCall(16400, () => this.say("17路驶入旧城，车速慢了下来。"));
    this.time.delayedCall(21000, () => this.finishRide());
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      this.scene.pause();
      gameEvents.emit("pause", true);
    }
    if (this.time.now - this.startedAt > 3000 && Phaser.Input.Keyboard.JustDown(this.keys.skip)) this.finishRide();
  }

  private say(text: string): void {
    gameEvents.emit("hud", {
      objective: "坐稳，下一站白鸽巢",
      subtitle: text,
      prompt: "E  跳过过场",
      memories: getSnapshot().memories.length,
      detours: getSnapshot().detourScore,
      sceneLabel: SCENE_LABELS["bus-ride"],
      hintCooling: false,
    });
  }

  private finishRide(): void {
    if (this.ended) return;
    this.ended = true;
    const arrived = transitionBus(getSnapshot().busState, "arrive");
    patchSnapshot({ busState: arrived, scene: "old-city", objectiveId: "follow-old-city-path" });
    this.scene.start("old-city");
  }
}

export class OldCityScene extends WalkScene {
  protected sceneId = "old-city" as const;
  protected backgroundKey = "old-city-bg";
  protected backgroundUrl = oldCityUrl;
  protected spawn = new Phaser.Math.Vector2(326, 320);
  protected objectiveId = "follow-old-city-path";

  constructor() {
    super("old-city");
  }

  protected onSceneReady(): void {
    if (getSnapshot().busState === "arrived") patchSnapshot({ busState: transitionBus("arrived", "alight") });
    this.announce("你在白鸽巢下车。雨后的石路很亮，盲道从脚下延向旧城。");
  }

  protected updateInteraction(): void {
    const memory = { x: 445, y: 266 };
    const exit = OBJECTIVES[this.objectiveId].target;
    const nearMemory = this.isNear(memory.x, memory.y, 30) && !getSnapshot().memories.includes("old-city-bell");
    const nearExit = this.isNear(exit.x, exit.y, 34);
    this.prompt = nearMemory ? "E  聆听记忆回声" : nearExit ? "E  走上大三巴前地" : "";
    if (nearMemory && this.interactionPressed()) {
      collectMemory("old-city-bell");
      audioDirector.interact();
      this.announce("记忆回声：钟声穿过窄巷，林伯笑说，会走错路也算澳门的一部分。");
    } else if (nearExit && this.interactionPressed()) {
      audioDirector.interact();
      patchSnapshot({ scene: "ruins", objectiveId: "meet-lam" });
      this.scene.start("ruins");
    }
  }
}

export class RuinsScene extends WalkScene {
  protected sceneId = "ruins" as const;
  protected backgroundKey = "ruins-bg";
  protected backgroundUrl = oldCityUrl;
  protected spawn = new Phaser.Math.Vector2(326, 290);
  protected objectiveId = "meet-lam";

  constructor() {
    super("ruins");
  }

  protected onSceneReady(): void {
    const lam = this.add.sprite(240, 88, "traveler", 3).setScale(0.13).setTint(0xd7a85d).setDepth(18);
    if (!getSnapshot().settings.reducedMotion) this.tweens.add({ targets: lam, y: 86, duration: 900, yoyo: true, repeat: -1 });
    this.announce("牌坊前的台阶反着灯光。林伯就在盲道尽头等你。");
  }

  protected updateInteraction(): void {
    const target = OBJECTIVES[this.objectiveId].target;
    const near = this.isNear(target.x, target.y, 38);
    this.prompt = near ? "E  回应林伯" : "";
    if (near && this.interactionPressed()) {
      audioDirector.interact();
      const snapshot = getSnapshot();
      const elapsedSeconds = snapshot.elapsedBeforeResume + Math.max(0, (Date.now() - snapshot.startedAt) / 1000);
      const ending = determineEnding({ elapsedSeconds, detourScore: snapshot.detourScore, returnRequested: snapshot.returnRequested });
      finishGame(ending);
      gameEvents.emit("ending", ending);
      this.scene.pause();
    }
  }
}

import Phaser from "phaser";
import busStopUrl from "../assets/bus-stop.png";
import busInteriorUrl from "../assets/bus-interior.png";
import busRideUrl from "../assets/bus-ride.png";
import crossingUrl from "../assets/old-city-crossing.png";
import oldCityUrl from "../assets/old-city.png";
import travelerUrl from "../assets/traveler.png";
import { audioDirector } from "./audio";
import { OBJECTIVES, OLD_CITY_CROSSING, OLD_CITY_HANDRAIL, PATHS, REVEAL_PROFILE, SCENE_LABELS } from "./content";
import { gameEvents } from "./events";
import { constrainCrossingPosition, determineEnding, transitionBus, transitionCrossing } from "./flow";
import { collectMemory, finishGame, getSnapshot, patchSnapshot, setCheckpoint } from "./store";
import type { BusTransitState, CrossingState, HudState, SceneId, TactilePathDefinition, TactilePathNode } from "./types";

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

function projectToSegment(point: Phaser.Math.Vector2, start: { x: number; y: number }, end: { x: number; y: number }): { point: Phaser.Math.Vector2; t: number; distance: number } {
  const segment = new Phaser.Math.Vector2(end.x - start.x, end.y - start.y);
  const relative = new Phaser.Math.Vector2(point.x - start.x, point.y - start.y);
  const t = Phaser.Math.Clamp(relative.dot(segment) / Math.max(1, segment.lengthSq()), 0, 1);
  const projected = new Phaser.Math.Vector2(start.x + segment.x * t, start.y + segment.y * t);
  return { point: projected, t, distance: Phaser.Math.Distance.Between(point.x, point.y, projected.x, projected.y) };
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
  protected trackDetours = true;
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
      this.cleanupDevEvents.push(gameEvents.on("devTeleport", (point) => {
        this.player.setPosition(point.x, point.y);
        this.revealMode = "sweep";
        this.revealUntil = this.time.now + 5000;
        this.onSweep(this.time.now);
      }));
      this.cleanupDevEvents.push(gameEvents.on("devInteract", () => { this.devInteractRequested = true; }));
      this.cleanupDevEvents.push(gameEvents.on("devReveal", (mode) => {
        this.revealMode = mode;
        this.revealUntil = this.time.now + 5000;
        if (mode === "sweep") this.onSweep(this.time.now);
        else this.onHint(this.time.now);
      }));
      const cleanup = () => this.cleanupDevEvents.splice(0).forEach((off) => off());
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    }
    setCheckpoint(this.sceneId);
    gameEvents.emit("scene", this.sceneId);
    this.onSceneReady();
    if (import.meta.env.DEV && sessionStorage.getItem("sound-road-dev-reveal")) {
      this.revealMode = sessionStorage.getItem("sound-road-dev-reveal") === "sweep" ? "sweep" : "hint";
      this.revealUntil = this.time.now + 60_000;
      if (this.revealMode === "sweep") this.onSweep(this.time.now);
      else this.onHint(this.time.now);
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

  protected getMovementInput(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
      Number(this.keys.down.isDown) - Number(this.keys.up.isDown),
    );
  }

  protected constrainMovement(_current: Phaser.Math.Vector2, next: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(Phaser.Math.Clamp(next.x, 24, 616), Phaser.Math.Clamp(next.y, 40, 340));
  }

  protected suspendRouteTracking(): boolean {
    return false;
  }

  protected repeatTaskText(): string {
    return `当前任务：${OBJECTIVES[this.objectiveId].label}`;
  }

  protected onTap(_time: number): void {}

  protected onSweep(_time: number): void {}

  protected onHint(_time: number): void {}

  private updateMovement(time: number, delta: number): void {
    const input = this.getMovementInput();
    if (!input.lengthSq()) return;
    input.normalize();
    let x = input.x;
    let y = input.y;
    const speed = this.revealMode === "sweep" ? 48 : 68;
    const current = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const next = this.constrainMovement(current, new Phaser.Math.Vector2(
      this.player.x + x * speed * (delta / 1000),
      this.player.y + y * speed * (delta / 1000),
    ));
    this.player.setPosition(next.x, next.y);
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
      this.onTap(time);
      this.player.setAngle(this.facing === "left" ? -4 : 4);
      this.time.delayedCall(140, () => this.player.setAngle(0));
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.sweep)) {
      this.revealMode = "sweep";
      this.revealUntil = time + REVEAL_PROFILE.sweepDurationMs;
      audioDirector.sweep();
      this.onSweep(time);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.hint) && time >= this.hintCooldownUntil) {
      this.revealMode = "hint";
      this.revealUntil = time + REVEAL_PROFILE.hintDurationMs;
      this.hintCooldownUntil = time + REVEAL_PROFILE.hintCooldownMs;
      audioDirector.hint();
      this.onHint(time);
      this.announce(this.repeatTaskText());
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.repeat)) {
      const text = this.repeatTaskText();
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
      if (b.breakBefore) continue;
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
      if (this.path.nodes[index + 1].breakBefore) continue;
      distance = Math.min(distance, pointSegmentDistance(point, this.path.nodes[index], this.path.nodes[index + 1]));
    }
    return distance;
  }

  protected checkRoute(time: number): void {
    if (!this.trackDetours || this.suspendRouteTracking()) return;
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
  private railHeld = false;
  private railRevealedUntil = 0;
  private railBase!: Phaser.GameObjects.Graphics;
  private railReveal!: Phaser.GameObjects.Graphics;
  private leaving = false;

  constructor() {
    super("old-city");
  }

  protected onSceneReady(): void {
    if (getSnapshot().busState === "arrived") patchSnapshot({ busState: transitionBus("arrived", "alight") });
    this.railBase = this.add.graphics().setDepth(12);
    this.railReveal = this.add.graphics().setDepth(15);
    this.drawRail(this.railBase, 0x0b1115, 0.92);
    this.announce("你在白鸽巢下车。沿盲道进入旧城；窄巷前需要改用扶手定位。");
  }

  protected getMovementInput(): Phaser.Math.Vector2 {
    if (!this.railHeld) return super.getMovementInput();
    const amount = Number(this.keys.up.isDown) - Number(this.keys.down.isDown);
    if (!amount) return new Phaser.Math.Vector2();
    const direction = new Phaser.Math.Vector2(
      OLD_CITY_HANDRAIL.end.x - OLD_CITY_HANDRAIL.start.x,
      OLD_CITY_HANDRAIL.end.y - OLD_CITY_HANDRAIL.start.y,
    ).normalize();
    return direction.scale(amount);
  }

  protected constrainMovement(current: Phaser.Math.Vector2, next: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const bounded = super.constrainMovement(current, next);
    if (!this.railHeld) return bounded;
    return projectToSegment(bounded, OLD_CITY_HANDRAIL.start, OLD_CITY_HANDRAIL.end).point;
  }

  protected suspendRouteTracking(): boolean {
    const distance = projectToSegment(new Phaser.Math.Vector2(this.player.x, this.player.y), OLD_CITY_HANDRAIL.start, OLD_CITY_HANDRAIL.end).distance;
    return this.railHeld || distance < 46;
  }

  protected repeatTaskText(): string {
    if (this.railHeld) return "当前任务：按 W 沿扶手前进，按 S 后退，按 E 可以松开。";
    if (this.objectiveId === "follow-handrail") return "当前任务：横扫寻找右侧扶手，靠近后按 E 握住。";
    return "当前任务：沿盲道前进；到点阵后停下，右侧约两步有连续扶手。";
  }

  protected onSweep(time: number): void {
    this.revealRail(time);
  }

  protected onHint(time: number): void {
    this.revealRail(time);
  }

  protected updateInteraction(time: number): void {
    this.railReveal.clear();
    if (time < this.railRevealedUntil || this.railHeld) this.drawRail(this.railReveal, OLD_CITY_HANDRAIL.revealColor, 1);

    const memory = { x: 445, y: 266 };
    const nearMemory = this.isNear(memory.x, memory.y, 30) && !getSnapshot().memories.includes("old-city-bell");
    const railProjection = projectToSegment(new Phaser.Math.Vector2(this.player.x, this.player.y), OLD_CITY_HANDRAIL.start, OLD_CITY_HANDRAIL.end);
    const nearRail = railProjection.distance <= OLD_CITY_HANDRAIL.engageRadius;
    const railVisible = import.meta.env.DEV || time < this.railRevealedUntil || this.railHeld;

    this.prompt = nearMemory
      ? "E  聆听记忆回声"
      : this.railHeld
        ? "E  松开扶手"
        : nearRail
          ? railVisible ? "E  握住扶手" : "Shift  横扫寻找扶手"
          : "";

    if (nearMemory && this.interactionPressed()) {
      collectMemory("old-city-bell");
      audioDirector.interact();
      this.announce("记忆回声：钟声穿过窄巷，林伯笑说，会走错路也算澳门的一部分。");
      return;
    }

    if (this.railHeld && this.interactionPressed()) {
      this.railHeld = false;
      audioDirector.interact();
      this.announce("你松开扶手。需要时可以再次横扫并握住。");
      return;
    }

    if (!this.railHeld && nearRail && railVisible && this.interactionPressed()) {
      this.railHeld = true;
      this.objectiveId = "follow-handrail";
      this.player.setPosition(railProjection.point.x, railProjection.point.y);
      patchSnapshot({ objectiveId: "follow-handrail" });
      audioDirector.interact();
      this.announce("你握住右侧扶手。按 W 前进，按 S 后退，按 E 松开。");
      return;
    }

    if (this.railHeld && railProjection.t >= 0.97 && !this.leaving) {
      this.leaving = true;
      this.railHeld = false;
      this.player.setPosition(OLD_CITY_HANDRAIL.end.x, OLD_CITY_HANDRAIL.end.y);
      patchSnapshot({ scene: "old-city-crossing", objectiveId: "request-crossing" });
      this.announce("扶手在点阵砖旁结束。前方是斜向路口，请先到路缘请求通行。");
      this.time.delayedCall(700, () => this.scene.start("old-city-crossing"));
    }
  }

  private revealRail(time: number): void {
    const projection = projectToSegment(new Phaser.Math.Vector2(this.player.x, this.player.y), OLD_CITY_HANDRAIL.start, OLD_CITY_HANDRAIL.end);
    if (projection.distance > 150) return;
    this.railRevealedUntil = time + 4500;
    audioDirector.caneTap("metal");
  }

  private drawRail(graphics: Phaser.GameObjects.Graphics, color: number, alpha: number): void {
    const { start, end } = OLD_CITY_HANDRAIL;
    graphics.lineStyle(5, color, alpha);
    graphics.lineBetween(start.x, start.y, end.x, end.y);
    graphics.fillStyle(color, alpha);
    [0, 0.5, 1].forEach((t) => {
      const x = Phaser.Math.Linear(start.x, end.x, t);
      const y = Phaser.Math.Linear(start.y, end.y, t);
      graphics.fillRect(x - 2, y - 2, 4, 11);
    });
  }
}

export class OldCityCrossingScene extends WalkScene {
  protected sceneId = "old-city-crossing" as const;
  protected backgroundKey = "old-city-crossing-bg";
  protected backgroundUrl = crossingUrl;
  protected spawn = new Phaser.Math.Vector2(180, 326);
  protected objectiveId = "request-crossing";
  protected trackDetours = false;
  private crossingState: CrossingState = "approach";
  private signalGraphics!: Phaser.GameObjects.Graphics;
  private guideGraphics!: Phaser.GameObjects.Graphics;
  private leaving = false;

  constructor() {
    super("old-city-crossing");
  }

  protected onSceneReady(): void {
    this.signalGraphics = this.add.graphics().setDepth(17);
    this.guideGraphics = this.add.graphics().setDepth(14);
    this.drawSignal();
    this.announce("前方是斜向路口。沿盲道到点阵处，按 E 请求通行。");
  }

  protected repeatTaskText(): string {
    if (this.crossingState === "requested") return "当前任务：留在点阵砖旁等待；收到文字和双音提示后再前进。";
    if (this.crossingState === "walk") return "当前任务：可以通行。斑马线从脚下斜向右前方，沿引导线走到对岸点阵。";
    return "当前任务：向前到点阵砖，按 E 请求通行。斑马线斜向右前方。";
  }

  protected constrainMovement(current: Phaser.Math.Vector2, next: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const bounded = super.constrainMovement(current, next);
    const constrained = constrainCrossingPosition(this.crossingState, bounded, OLD_CITY_CROSSING);
    return new Phaser.Math.Vector2(constrained.x, constrained.y);
  }

  protected updateInteraction(): void {
    const request = OLD_CITY_CROSSING.requestPoint;
    const nearRequest = this.isNear(request.x, request.y, 34);
    this.drawCrossingGuide();

    this.prompt = this.crossingState === "approach" && nearRequest
      ? "E  请求通行"
      : this.crossingState === "requested"
        ? "请留在路缘等候"
        : this.crossingState === "walk"
          ? "沿斜向右前方通过"
          : "";

    if (this.crossingState === "approach" && nearRequest && this.interactionPressed()) {
      this.crossingState = transitionCrossing(this.crossingState, "request");
      this.objectiveId = "wait-crossing";
      patchSnapshot({ objectiveId: "wait-crossing" });
      audioDirector.crossingWait();
      this.announce("通行请求已收到。请留在路缘等候文字和双音提示。");
      this.drawSignal();
      this.time.delayedCall(OLD_CITY_CROSSING.waitMs, () => {
        if (this.crossingState !== "requested") return;
        this.crossingState = transitionCrossing(this.crossingState, "allow");
        this.objectiveId = "cross-junction";
        patchSnapshot({ objectiveId: "cross-junction" });
        audioDirector.crossingWalk();
        this.announce("可以通行。斑马线从脚下斜向右前方，沿引导线走到对岸点阵。");
        this.drawSignal();
      });
      return;
    }

    if (this.crossingState === "walk" && this.isNear(OLD_CITY_CROSSING.farCurb.x, OLD_CITY_CROSSING.farCurb.y, 30) && !this.leaving) {
      this.leaving = true;
      this.crossingState = transitionCrossing(this.crossingState, "finish");
      patchSnapshot({ scene: "ruins", objectiveId: "meet-lam" });
      this.announce("你抵达对岸点阵。前方盲道通向大三巴牌坊。");
      this.time.delayedCall(650, () => this.scene.start("ruins"));
    }
  }

  private drawSignal(): void {
    if (!this.signalGraphics) return;
    this.signalGraphics.clear();
    this.signalGraphics.lineStyle(4, 0x151c20, 1);
    this.signalGraphics.lineBetween(235, 282, 235, 234);
    this.signalGraphics.fillStyle(0x11171b, 1);
    this.signalGraphics.fillRoundedRect(223, 220, 24, 34, 3);
    const color = this.crossingState === "walk" || this.crossingState === "crossed" ? 0x73c98b : 0xc85d52;
    this.signalGraphics.fillStyle(color, 1);
    this.signalGraphics.fillCircle(235, 237, 6);
  }

  private drawCrossingGuide(): void {
    this.guideGraphics.clear();
    if (this.crossingState !== "walk") return;
    const { requestPoint, farCurb } = OLD_CITY_CROSSING;
    this.guideGraphics.lineStyle(3, 0xf6ca55, 0.82);
    this.guideGraphics.lineBetween(requestPoint.x, requestPoint.y, farCurb.x, farCurb.y);
    this.guideGraphics.fillStyle(0xffdc7a, 0.92);
    for (let t = 0.15; t < 1; t += 0.17) {
      this.guideGraphics.fillCircle(
        Phaser.Math.Linear(requestPoint.x, farCurb.x, t),
        Phaser.Math.Linear(requestPoint.y, farCurb.y, t),
        2.5,
      );
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

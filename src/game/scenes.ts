import Phaser from "phaser";
import busStopUrl from "../assets/bus-stop.png";
import busInteriorUrl from "../assets/bus-interior.png";
import busRideUrl from "../assets/bus-ride.png";
import crossingUrl from "../assets/old-city-crossing.png";
import oldCityUrl from "../assets/old-city-rework.png";
import travelerUrl from "../assets/traveler-no-cane.png";
import borderGateStripUrl from "../assets/m2-border-gate-strip.png";
import busInteriorStripUrl from "../assets/m2-bus-interior-strip.png";
import busShelterUrl from "../assets/m2-bus-shelter.png";
import busSideStatesUrl from "../assets/m2-bus-side-states.png";
import busStopSignUrl from "../assets/m2-bus-stop-sign.png";
import npcSpritesheetUrl from "../assets/npc-spritesheet.png";
import oldCityHouseLeftUrl from "../assets/m3-oldcity-house-left.png";
import oldCityHouseRightUrl from "../assets/m3-oldcity-house-right.png";
import oldCityArcadeUrl from "../assets/m3-oldcity-arcade-corner.png";
import crossingCornerLeftUrl from "../assets/m3-crossing-corner-left.png";
import crossingCornerRightUrl from "../assets/m3-crossing-corner-right.png";
import ruinsLowriseWallUrl from "../assets/m4-ruins-lowrise-wall.png";
import { audioDirector } from "./audio";
import { describePhonePosition, PHONE_COOLDOWN_MS } from "./assist";
import { composeRepeatText, OBJECTIVES, OLD_CITY_CROSSING, OLD_CITY_HANDRAIL, PATHS, REVEAL_PROFILE, SCENE_LABELS, TACTILE_LIT_MS } from "./content";
import { CROSSING_TILEMAP } from "./crossing-map";
import { gameEvents } from "./events";
import { constrainCrossingPosition, determineEnding, mergeColorMemory, transitionBus, transitionCrossing } from "./flow";
import { ensureGroundTextures, GROUND_TEXTURE, TREE_TEXTURE, type GroundTileKey } from "./ground-tiles";
import { BUS_INTERIOR_DOOR, BUS_INTERIOR_TILEMAP, BUS_SEAT_EDGE } from "./businterior-map";
import { BUS_STOP_DECOY_SIGNS, BUS_STOP_DOOR, BUS_STOP_SIGN, BUS_STOP_TILEMAP } from "./busstop-map";
import { MAP_OFFSET_Y, MAP_TILE_SIZE, OLD_CITY_TILEMAP, OLD_CITY_TREES } from "./oldcity-map";
import { NPC_DEFINITIONS, type NpcDefinition } from "./npcs";
import { RUINS_TILEMAP } from "./ruins-map";
import { collectMemory, finishGame, getSnapshot, patchSnapshot, setCheckpoint } from "./store";
import { ensureTactileTextures, TACTILE_TEXTURE } from "./tactile-layer";
import { describeDecisionBrick, rasterizeTactilePath, type TactileBrick } from "./tactile-tiles";
import { isWalkable, tileUnderPoint, type TileMapDefinition } from "./tilemap";
import type { BusTransitState, CaneSurfaceKind, CrossingState, HudState, SceneId, TactilePathDefinition, TactilePathNode, TilePoint } from "./types";

type Facing = "up" | "down" | "left" | "right";
type RevealMode = "tap" | "hint" | null;
type CaneSurface = {
  kind: CaneSurfaceKind;
  label: string;
  point: Phaser.Math.Vector2;
};

type ColorPulse = TilePoint & { expiresAt: number; radius: number };

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
  protected revealGraphics!: Phaser.GameObjects.Graphics;
  protected caneGraphics!: Phaser.GameObjects.Graphics;
  protected path!: TactilePathDefinition;
  protected facing: Facing = "up";
  protected revealMode: RevealMode = null;
  protected revealUntil = 0;
  protected hintCooldownUntil = 0;
  protected keys!: Record<string, Phaser.Input.Keyboard.Key>;
  protected prompt = "";
  protected subtitle = "";
  protected trackDetours = true;
  protected contact = "尚未触碰到物体";
  protected phoneCooldownUntil = 0;
  private colorPersistentMask?: Phaser.GameObjects.Graphics;
  private colorPulseMask?: Phaser.GameObjects.Graphics;
  private colorPersistentImage?: Phaser.GameObjects.Image;
  private colorPulseImage?: Phaser.GameObjects.Image;
  private groundSprites: Array<{ sprite: Phaser.GameObjects.Image; normal: string; warm: string; x: number; y: number }> = [];
  private colorPulses: ColorPulse[] = [];
  private tactileBricks: TactileBrick[] = [];
  private tactileSprites: Phaser.GameObjects.Image[] = [];
  private tactileLitUntil: number[] = [];
  private tactileBaseTint: number[] = [];
  private tactileRemembered = new Set<number>();
  private sparks: Array<{ x: number; y: number; bornAt: number }> = [];
  private lastContactKey = "";
  private lastContactAt = 0;
  private tapExtensionUntil = 0;
  private previousHud = "";
  private lastDetourAt = 0;
  private wasOnRoute = true;
  private lastStepAt = 0;
  private devInteractRequested = false;
  private cleanupDevEvents: Array<() => void> = [];
  private npcSprites: Array<{ definition: NpcDefinition; sprite: Phaser.GameObjects.Sprite }> = [];

  preload(): void {
    if (!this.tileMap()) this.load.image(this.backgroundKey, this.backgroundUrl);
    if (!this.textures.exists("traveler")) {
      this.load.spritesheet("traveler", travelerUrl, { frameWidth: 627, frameHeight: 627 });
    }
    if (!this.textures.exists("npc-spritesheet")) {
      this.load.spritesheet("npc-spritesheet", npcSpritesheetUrl, { frameWidth: 362, frameHeight: 362 });
    }
  }

  create(): void {
    const map = this.tileMap();
    if (map) {
      this.buildGround(map);
    } else {
      const bg = this.add.image(320, 180, this.backgroundKey).setDisplaySize(640, 360);
      bg.setTint(0xe6e1d6);
      bg.postFX?.addColorMatrix().grayscale(1);
      this.colorPersistentImage = this.add.image(320, 180, this.backgroundKey).setDisplaySize(640, 360).setAlpha(0.38).setDepth(1);
      this.colorPulseImage = this.add.image(320, 180, this.backgroundKey).setDisplaySize(640, 360).setDepth(2);
      this.colorPersistentMask = this.make.graphics({}, false);
      this.colorPulseMask = this.make.graphics({}, false);
      this.colorPersistentImage.setMask(this.colorPersistentMask.createGeometryMask());
      this.colorPulseImage.setMask(this.colorPulseMask.createGeometryMask());
    }
    this.path = PATHS[this.sceneId];
    ensureTactileTextures(this);
    this.tactileBricks = rasterizeTactilePath(this.path);
    const rememberedPoints = getSnapshot().colorMemory.filter((point) => point.scene === this.sceneId);
    const toneVariants = [0xffffff, 0xf5f0e4, 0xece6d6, 0xf9f4ea];
    this.tactileSprites = this.tactileBricks.map((brick, index) => {
      const texture = brick.kind === "decision" ? TACTILE_TEXTURE.decision : TACTILE_TEXTURE.guidance;
      const sprite = this.add.image(brick.x, brick.y, texture).setDepth(10);
      if (brick.kind === "guidance") sprite.setRotation(brick.orientation + Math.PI / 2);
      const baseTint = toneVariants[(index * 7 + 3) % toneVariants.length];
      this.tactileBaseTint.push(baseTint);
      const remembered = rememberedPoints.some((point) => Phaser.Math.Distance.Between(point.x, point.y, brick.x, brick.y) <= point.radius);
      if (remembered) this.tactileRemembered.add(index);
      const initialTint = remembered ? 0xd9c79c : baseTint;
      if (initialTint !== 0xffffff) sprite.setTint(initialTint);
      return sprite;
    });
    this.tactileLitUntil = this.tactileBricks.map(() => 0);
    this.revealGraphics = this.add.graphics().setDepth(26);
    this.player = this.add.sprite(this.spawn.x, this.spawn.y, "traveler", FACE_FRAME[this.facing]);
    this.player.setScale(0.16).setDepth(20);
    this.player.setOrigin(0.5, 0.58);
    this.renderNpcs();
    this.caneGraphics = this.add.graphics().setDepth(23);
    this.keys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      tap: Phaser.Input.Keyboard.KeyCodes.SPACE,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      hint: Phaser.Input.Keyboard.KeyCodes.Q,
      repeat: Phaser.Input.Keyboard.KeyCodes.H,
      phone: Phaser.Input.Keyboard.KeyCodes.F,
      pause: Phaser.Input.Keyboard.KeyCodes.ESC,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard?.addCapture(["SPACE", "Q", "E", "F"]);
    if (import.meta.env.DEV) {
      this.cleanupDevEvents.push(gameEvents.on("devTeleport", (point) => {
        this.player.setPosition(point.x, point.y);
        this.revealMode = "hint";
        this.revealUntil = this.time.now + 5000;
        this.onHint(this.time.now);
      }));
      this.cleanupDevEvents.push(gameEvents.on("devInteract", () => { this.devInteractRequested = true; }));
      this.cleanupDevEvents.push(gameEvents.on("devReveal", (mode) => {
        this.revealMode = mode;
        this.revealUntil = this.time.now + 5000;
        this.onHint(this.time.now);
      }));
      const cleanup = () => this.cleanupDevEvents.splice(0).forEach((off) => off());
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    }
    setCheckpoint(this.sceneId);
    gameEvents.emit("scene", this.sceneId);
    this.onSceneReady();
    if (import.meta.env.DEV && sessionStorage.getItem("sound-road-dev-reveal")) {
      this.revealMode = "hint";
      this.revealUntil = this.time.now + 60_000;
      this.onHint(this.time.now);
    }
    this.emitHud();
  }

  protected onSceneReady(): void {}

  /** Scenes with a procedural ground provide a shared tilemap definition. */
  protected tileMap(): TileMapDefinition | null {
    return null;
  }

  protected walkableTiles(): ReadonlySet<GroundTileKey> {
    return new Set(["stone", "plaza", "concrete", "asphalt", "zebra", "curb", "dirt", "bus-floor"]);
  }

  private buildGround(map: TileMapDefinition): void {
    ensureGroundTextures(this);
    map.rows.forEach((row, rowIndex) => {
      [...row].forEach((char, colIndex) => {
        const key = map.legend[char] ?? "stone";
        const textures = GROUND_TEXTURE[key];
        const x = colIndex * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
        const y = rowIndex * MAP_TILE_SIZE + map.offsetY + MAP_TILE_SIZE / 2;
        const sprite = this.add.image(x, y, textures.normal).setDepth(0);
        this.groundSprites.push({ sprite, normal: textures.normal, warm: textures.warm, x, y });
      });
    });
  }

  protected registerGroundOverlay(sprite: Phaser.GameObjects.Image, normal: string, warm: string, x: number, y: number): void {
    this.groundSprites.push({ sprite, normal, warm, x, y });
  }

  private updateGroundColors(): void {
    if (!this.groundSprites.length) return;
    const pulses = this.colorPulses;
    const memory = getSnapshot().colorMemory.filter((point) => point.scene === this.sceneId);
    for (const tile of this.groundSprites) {
      const lit = pulses.some((pulse) => Phaser.Math.Distance.Between(tile.x, tile.y, pulse.x, pulse.y) <= pulse.radius);
      const key = lit ? tile.warm : tile.normal;
      if (tile.sprite.texture.key !== key) tile.sprite.setTexture(key);
      const remembered = !lit && memory.some((point) => Phaser.Math.Distance.Between(tile.x, tile.y, point.x, point.y) <= point.radius);
      if (remembered && !tile.sprite.isTinted) tile.sprite.setTint(0xdccfa8);
      else if (!remembered && tile.sprite.isTinted) tile.sprite.clearTint();
    }
  }

  update(time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      this.scene.pause();
      gameEvents.emit("pause", true);
      return;
    }
    this.updateMovement(time, delta);
    this.updateCane(time, delta);
    this.colorPulses = this.colorPulses.filter((pulse) => pulse.expiresAt > time);
    this.updateReveal(time);
    this.updateColorMasks();
    this.updateGroundColors();
    this.handleActions(time);
    this.checkRoute(time);
    if (this.tryNpcInteraction()) {
      this.emitHud();
      return;
    }
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
    const bounded = new Phaser.Math.Vector2(Phaser.Math.Clamp(next.x, 24, 616), Phaser.Math.Clamp(next.y, 40, 340));
    const map = this.tileMap();
    return map && !isWalkable(map, bounded, this.walkableTiles()) ? _current.clone() : bounded;
  }

  protected suspendRouteTracking(): boolean {
    return false;
  }

  protected repeatTaskText(): string {
    return `当前任务：${OBJECTIVES[this.objectiveId].label}`;
  }

  protected onTap(_time: number): void {}

  protected onHint(_time: number): void {}

  protected onSurfaceContact(_surface: CaneSurface, _time: number): void {}

  protected detectSceneSurface(_tip: Phaser.Math.Vector2): CaneSurface | null {
    const npc = this.nearestNpc(_tip, 24);
    if (npc) return { kind: "person", label: `${npc.definition.idleLabel}：按 E 询问方向`, point: new Phaser.Math.Vector2(npc.definition.x, npc.definition.y) };
    return null;
  }

  private renderNpcs(): void {
    NPC_DEFINITIONS.filter((definition) => definition.scene === this.sceneId).forEach((definition) => {
      const frame = definition.scene === "old-city" ? 0 : 4;
      const sprite = this.add.sprite(definition.x, definition.y, "npc-spritesheet", frame).setScale(0.2).setDepth(18);
      if (!getSnapshot().settings.reducedMotion) this.tweens.add({ targets: sprite, y: definition.y - 2, duration: 760, yoyo: true, repeat: -1 });
      this.npcSprites.push({ definition, sprite });
    });
  }

  protected nearestNpc(point: Phaser.Math.Vector2, radius: number): { definition: NpcDefinition; sprite: Phaser.GameObjects.Sprite } | null {
    return this.npcSprites
      .map((entry) => ({ entry, distance: Phaser.Math.Distance.Between(point.x, point.y, entry.definition.x, entry.definition.y) }))
      .filter((entry) => entry.distance <= radius)
      .sort((a, b) => a.distance - b.distance)[0]?.entry ?? null;
  }

  private tryNpcInteraction(): boolean {
    const near = this.nearestNpc(new Phaser.Math.Vector2(this.player.x, this.player.y), 34);
    if (!near || !this.interactionPressed()) return false;
    const target = OBJECTIVES[this.objectiveId].target;
    audioDirector.interact();
    this.announce(near.definition.hint({ x: this.player.x, y: this.player.y }, target));
    return true;
  }

  private updateMovement(time: number, delta: number): void {
    const input = this.getMovementInput();
    if (!input.lengthSq()) return;
    input.normalize();
    let x = input.x;
    let y = input.y;
    const speed = 68;
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
      audioDirector.footstep();
    }
  }

  private handleActions(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.tap)) {
      this.revealMode = "tap";
      this.revealUntil = time + 260;
      this.tapExtensionUntil = time + 180;
      this.performCaneContact(time, 30);
      this.onTap(time);
      this.player.setAngle(this.facing === "left" ? -4 : 4);
      this.time.delayedCall(140, () => this.player.setAngle(0));
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.hint) && time >= this.hintCooldownUntil) {
      this.revealMode = "hint";
      this.revealUntil = time + REVEAL_PROFILE.hintDurationMs;
      this.hintCooldownUntil = time + REVEAL_PROFILE.hintCooldownMs;
      audioDirector.hint();
      this.onHint(time);
      this.announce(`方向提示：目标在${this.directionToObjective()}。${OBJECTIVES[this.objectiveId].label}`);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.phone) && time >= this.phoneCooldownUntil) {
      this.phoneCooldownUntil = time + PHONE_COOLDOWN_MS;
      const target = OBJECTIVES[this.objectiveId].target;
      const text = describePhonePosition(this.sceneId, { x: this.player.x, y: this.player.y }, this.path, target);
      audioDirector.hint();
      this.announce(`手机辅助：${text}`);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.repeat)) {
      const text = composeRepeatText(this.contact, this.repeatTaskText());
      this.announce(text);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }
    }
  }

  private updateReveal(time: number): void {
    this.revealGraphics.clear();
    this.sparks = this.sparks.filter((spark) => time - spark.bornAt < 420);
    this.sparks.forEach((spark) => {
      const progress = (time - spark.bornAt) / 420;
      this.revealGraphics.fillStyle(0xf6ca55, 0.85 * (1 - progress));
      this.revealGraphics.fillCircle(spark.x, spark.y, 1.6 + progress * 2.2);
    });
    if (this.revealMode === "hint" && time <= this.revealUntil) this.drawDirectionArrow();
    if (time > this.revealUntil) this.revealMode = null;
    this.updateTactileLayer(time);
  }

  private updateTactileLayer(time: number): void {
    for (let index = 0; index < this.tactileSprites.length; index += 1) {
      const lit = time < this.tactileLitUntil[index];
      const brick = this.tactileBricks[index];
      const sprite = this.tactileSprites[index];
      const key = brick.kind === "decision"
        ? lit ? TACTILE_TEXTURE.decisionLit : TACTILE_TEXTURE.decision
        : lit ? TACTILE_TEXTURE.guidanceLit : TACTILE_TEXTURE.guidance;
      if (sprite.texture.key !== key) sprite.setTexture(key);
      const rememberedTint = !lit && this.tactileRemembered.has(index) ? 0xd9c79c : null;
      const baseTint = this.tactileBaseTint[index] ?? 0xffffff;
      const desiredTint = rememberedTint ?? (lit || baseTint === 0xffffff ? null : baseTint);
      if (desiredTint === null && sprite.isTinted) sprite.clearTint();
      else if (desiredTint !== null && (!sprite.isTinted || sprite.tintTopLeft !== desiredTint)) sprite.setTint(desiredTint);
    }
  }

  private enhanceTactileAt(point: Phaser.Math.Vector2, time: number): void {
    const nearest = this.tactileBricks
      .map((brick, index) => ({ index, distance: Phaser.Math.Distance.Between(point.x, point.y, brick.x, brick.y) }))
      .filter((entry) => entry.distance <= 30)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4);
    nearest.forEach(({ index }) => {
      this.tactileLitUntil[index] = time + TACTILE_LIT_MS;
      this.tactileRemembered.add(index);
    });
    for (let count = 0; count < 5; count += 1) {
      this.sparks.push({ x: point.x + Phaser.Math.Between(-7, 7), y: point.y + Phaser.Math.Between(-7, 7), bornAt: time });
    }
  }

  protected decisionHint(nodeIndex: number): string {
    return describeDecisionBrick(this.path, nodeIndex);
  }

  private updateCane(time: number, _delta: number): void {
    this.drawCane(time);
  }

  private drawCane(time: number): void {
    this.caneGraphics.clear();
    const direction = FACE_VECTOR[this.facing].clone();
    const origin = new Phaser.Math.Vector2(this.player.x + 2, this.player.y + 4);
    const length = time < this.tapExtensionUntil ? 48 : 38;
    const tip = origin.clone().add(direction.scale(length));
    this.caneGraphics.lineStyle(5, 0x171717, 1);
    this.caneGraphics.lineBetween(origin.x, origin.y, Phaser.Math.Linear(origin.x, tip.x, 0.3), Phaser.Math.Linear(origin.y, tip.y, 0.3));
    this.caneGraphics.lineStyle(3, 0xf1eee3, 1);
    this.caneGraphics.lineBetween(Phaser.Math.Linear(origin.x, tip.x, 0.28), Phaser.Math.Linear(origin.y, tip.y, 0.28), tip.x, tip.y);
    this.caneGraphics.lineStyle(3, 0xc94f44, 1);
    this.caneGraphics.lineBetween(Phaser.Math.Linear(origin.x, tip.x, 0.68), Phaser.Math.Linear(origin.y, tip.y, 0.68), Phaser.Math.Linear(origin.x, tip.x, 0.78), Phaser.Math.Linear(origin.y, tip.y, 0.78));
    this.caneGraphics.fillStyle(0x5d6463, 1);
    this.caneGraphics.fillCircle(tip.x, tip.y, 2.4);
  }

  private caneTip(distance: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.player.x + 2, this.player.y + 4)
      .add(FACE_VECTOR[this.facing].clone().scale(distance));
  }

  private performCaneContact(time: number, distance: number): void {
    const tip = this.caneTip(distance);
    const surface = this.detectCaneSurface(tip);
    const key = `${surface.kind}:${Math.round(surface.point.x / 12)}:${Math.round(surface.point.y / 12)}`;
    if (key === this.lastContactKey && time - this.lastContactAt < 360) return;
    this.lastContactKey = key;
    this.lastContactAt = time;
    this.contact = surface.label;
    const sound = surface.kind === "guidance" || surface.kind === "decision"
      ? "tactile"
      : surface.kind === "metal" || surface.kind === "sign" || surface.kind === "door"
        ? "metal"
        : surface.kind === "obstacle" || surface.kind === "person"
          ? "obstacle"
          : "stone";
    audioDirector.caneTap(sound);
    this.enhanceTactileAt(surface.point, time);
    this.colorPulses.push({ x: surface.point.x, y: surface.point.y, radius: 42, expiresAt: time + TACTILE_LIT_MS });
    const snapshot = getSnapshot();
    const colorMemory = mergeColorMemory(snapshot.colorMemory, { scene: this.sceneId, x: surface.point.x, y: surface.point.y, radius: 38 }, 25);
    if (colorMemory !== snapshot.colorMemory) patchSnapshot({ colorMemory });
    this.onSurfaceContact(surface, time);
  }

  private detectCaneSurface(tip: Phaser.Math.Vector2): CaneSurface {
    const sceneSurface = this.detectSceneSurface(tip);
    if (sceneSurface) return sceneSurface;
    const decisionIndex = this.path.nodes.findIndex((node) => node.kind === "decision" && Phaser.Math.Distance.Between(tip.x, tip.y, node.x, node.y) <= 15);
    if (decisionIndex >= 0) {
      const node = this.path.nodes[decisionIndex];
      return { kind: "decision", label: this.decisionHint(decisionIndex), point: new Phaser.Math.Vector2(node.x, node.y) };
    }

    for (let index = 0; index < this.path.nodes.length - 1; index += 1) {
      const a = this.path.nodes[index];
      const b = this.path.nodes[index + 1];
      if (b.breakBefore) continue;
      const projection = projectToSegment(tip, a, b);
      if (projection.distance <= 11) return { kind: "guidance", label: "四条连续凸纹：沿纹路继续", point: projection.point };
    }

    const tile = tileUnderPoint(this.tileMap() ?? { rows: [], legend: {}, offsetY: MAP_OFFSET_Y }, tip);
    if (tile === "curb") return { kind: "curb", label: "路缘：台面升高，靠近后注意边界", point: tip };
    if (tile === "wall" || tile === "fence" || tile === "bush") return { kind: "obstacle", label: "前方是阻挡物：请停下并回到凸纹", point: tip };
    if (tile === "dirt") return { kind: "stone", label: "碎土：材质与主路不同", point: tip };
    if (tile === "bus-seat") return { kind: "seat", label: "座位边缘：先确认软垫与金属框", point: tip };
    return { kind: "stone", label: tile === "concrete" ? "混凝土平台：没有连续凸纹" : "普通石板：没有连续凸纹", point: tip };
  }

  private updateColorMasks(): void {
    const persistentMask = this.colorPersistentMask;
    const pulseMask = this.colorPulseMask;
    if (!persistentMask || !pulseMask) return;
    persistentMask.clear();
    persistentMask.fillStyle(0xffffff, 1);
    getSnapshot().colorMemory
      .filter((point) => point.scene === this.sceneId)
      .forEach((point) => persistentMask.fillCircle(point.x, point.y, point.radius));
    pulseMask.clear();
    pulseMask.fillStyle(0xffffff, 1);
    this.colorPulses.forEach((pulse) => pulseMask.fillCircle(pulse.x, pulse.y, pulse.radius));
  }

  private drawDirectionArrow(): void {
    const target = OBJECTIVES[this.objectiveId].target;
    const direction = new Phaser.Math.Vector2(target.x - this.player.x, target.y - this.player.y);
    if (direction.lengthSq() < 4) return;
    direction.normalize();
    const start = new Phaser.Math.Vector2(this.player.x, this.player.y).add(direction.clone().scale(24));
    const end = start.clone().add(direction.clone().scale(58));
    const perpendicular = new Phaser.Math.Vector2(-direction.y, direction.x);
    this.revealGraphics.lineStyle(4, 0xf3c85b, 0.92);
    this.revealGraphics.lineBetween(start.x, start.y, end.x, end.y);
    this.revealGraphics.fillStyle(0xffdd79, 1);
    this.revealGraphics.fillTriangle(
      end.x + direction.x * 9,
      end.y + direction.y * 9,
      end.x - direction.x * 6 + perpendicular.x * 7,
      end.y - direction.y * 6 + perpendicular.y * 7,
      end.x - direction.x * 6 - perpendicular.x * 7,
      end.y - direction.y * 6 - perpendicular.y * 7,
    );
  }

  private directionToObjective(): string {
    const target = OBJECTIVES[this.objectiveId].target;
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const horizontal = Math.abs(dx) > 24 ? (dx > 0 ? "右" : "左") : "";
    const vertical = Math.abs(dy) > 24 ? (dy > 0 ? "下" : "上") : "";
    const direction = `${vertical}${horizontal}`;
    return direction ? `${direction}方` : "附近";
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
      contact: this.contact,
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
  protected spawn = new Phaser.Math.Vector2(96, 286);
  protected objectiveId = "find-stop-sign";
  private signConfirmed = false;

  constructor() {
    super("bus-stop");
  }

  preload(): void {
    super.preload();
    this.load.image("m2-border-gate-strip", borderGateStripUrl);
    this.load.image("m2-bus-shelter", busShelterUrl);
    this.load.image("m2-bus-side-states", busSideStatesUrl);
    this.load.image("m2-bus-stop-sign", busStopSignUrl);
  }

  protected onSceneReady(): void {
    const snapshot = getSnapshot();
    this.drawBusStopBackdrop();
    this.drawStopSigns();
    if (snapshot.objectiveId === "board-17") this.signConfirmed = true;
    if (snapshot.busState === "waiting" && !this.signConfirmed) {
      this.announce("雨刚停。先沿四纹盲道找到站牌，确认凸字17；站台右侧还有写着25的相似站牌。");
    } else if (snapshot.busState === "doorOpen") {
      this.announce("17路车门已开。沿盲道前往车门，靠近后按 E 上车。");
      this.time.delayedCall(1100, () => {
        if (getSnapshot().busState === "waiting" && this.signConfirmed) {
          patchSnapshot({ busState: transitionBus(getSnapshot().busState, "openDoor") });
          audioDirector.door();
          this.announce("17路车门已开。沿盲道前往车门，靠近后按 E 上车。");
        }
      });
    }
  }

  protected tileMap(): TileMapDefinition | null {
    return BUS_STOP_TILEMAP;
  }

  protected detectSceneSurface(tip: Phaser.Math.Vector2): CaneSurface | null {
    if (Phaser.Math.Distance.Between(tip.x, tip.y, BUS_STOP_SIGN.x, BUS_STOP_SIGN.y) <= 22) {
      return { kind: "sign", label: "站牌立柱：牌面有凸字「17」，确认这一班车", point: new Phaser.Math.Vector2(BUS_STOP_SIGN.x, BUS_STOP_SIGN.y) };
    }
    const decoy = BUS_STOP_DECOY_SIGNS.find((sign) => Phaser.Math.Distance.Between(tip.x, tip.y, sign.x, sign.y) <= 22);
    if (decoy) return { kind: "sign", label: `相似站牌：牌面是凸字「${decoy.route}」，不是17路`, point: new Phaser.Math.Vector2(decoy.x, decoy.y) };
    if (Phaser.Math.Distance.Between(tip.x, tip.y, BUS_STOP_DOOR.x, BUS_STOP_DOOR.y) <= 20) {
      return { kind: "door", label: "车门边缘：确认站牌后，靠近按 E 上车", point: new Phaser.Math.Vector2(BUS_STOP_DOOR.x, BUS_STOP_DOOR.y) };
    }
    return null;
  }

  protected onSurfaceContact(surface: CaneSurface): void {
    if (surface.kind !== "sign" || this.signConfirmed || surface.point.x !== BUS_STOP_SIGN.x) return;
    this.signConfirmed = true;
    collectMemory("border-hand");
    patchSnapshot({ objectiveId: "board-17" });
    audioDirector.interact();
    this.announce("确认：这是17路站牌。现在沿盲道向右前方到车门；车门将在站牌确认后开启。");
    this.time.delayedCall(1100, () => {
      if (getSnapshot().busState !== "waiting") return;
      patchSnapshot({ busState: transitionBus(getSnapshot().busState, "openDoor") });
      audioDirector.door();
      this.announce("17路车门已开。靠近车门后按 E 上车。");
    });
  }

  private drawStopSigns(): void {
    const draw = (point: { x: number; y: number }, route: string, correct: boolean): void => {
      const sign = this.add.image(point.x, point.y, "m2-bus-stop-sign").setDisplaySize(24, 48).setDepth(7);
      this.add.text(point.x, point.y - 8, route, { color: "#242321", fontFamily: "monospace", fontSize: "14px", fontStyle: "bold" }).setOrigin(0.5).setDepth(8);
      sign.setName(correct ? "bus-stop-sign-17" : "bus-stop-sign-25");
    };
    draw(BUS_STOP_SIGN, "17", true);
    BUS_STOP_DECOY_SIGNS.forEach((sign) => draw(sign, sign.route, false));
  }

  private drawBusStopBackdrop(): void {
    this.add.image(320, 58, "m2-border-gate-strip").setDisplaySize(640, 108).setDepth(2).setAlpha(0.84);
    this.add.image(320, 150, "m2-bus-shelter").setDisplaySize(240, 120).setDepth(3).setAlpha(0.82);
    this.add.image(492, 270, "m2-bus-side-states").setCrop(887, 0, 887, 887).setDisplaySize(192, 96).setDepth(3).setAlpha(0.75).setName("m2-bus-open-state");
  }

  protected decisionHint(nodeIndex: number): string {
    if (this.path.nodes[nodeIndex]?.taskId === "board-17") return "4×4凸点：17路车门在右前方，靠近后按 E";
    return super.decisionHint(nodeIndex);
  }

  protected updateInteraction(): void {
    const objective = OBJECTIVES[this.objectiveId];
    const near = this.isNear(objective.target.x, objective.target.y, objective.triggerRadius);
    this.prompt = near ? (getSnapshot().busState === "doorOpen" ? "E  上车" : "请稍等车门开启") : "";
    if (near && getSnapshot().busState === "doorOpen" && this.interactionPressed()) {
      audioDirector.interact();
      patchSnapshot({ busState: transitionBus("doorOpen", "board"), objectiveId: "find-seat", scene: "bus-interior" });
      gameEvents.emit("chapter", { from: "bus-stop", to: "bus-interior" });
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
  private seatConfirmed = false;

  constructor() {
    super("bus-interior");
  }

  preload(): void {
    super.preload();
    this.load.image("m2-bus-interior-strip", busInteriorStripUrl);
  }

  protected onSceneReady(): void {
    if (getSnapshot().busState === "doorOpen") patchSnapshot({ busState: "boarding" });
    this.drawInteriorDetails();
    this.announce("你已上车。沿车厢四纹盲道前进，用盲杖确认座位边缘后再坐下。");
  }

  protected tileMap(): TileMapDefinition | null {
    return BUS_INTERIOR_TILEMAP;
  }

  protected detectSceneSurface(tip: Phaser.Math.Vector2): CaneSurface | null {
    if (Phaser.Math.Distance.Between(tip.x, tip.y, BUS_SEAT_EDGE.x, BUS_SEAT_EDGE.y) <= 24) {
      return { kind: "seat", label: "座位边缘：软垫与金属框，可以坐下", point: new Phaser.Math.Vector2(BUS_SEAT_EDGE.x, BUS_SEAT_EDGE.y) };
    }
    if (Phaser.Math.Distance.Between(tip.x, tip.y, BUS_INTERIOR_DOOR.x, BUS_INTERIOR_DOOR.y) <= 22) {
      return { kind: "door", label: "车门边缘：已经上车，沿中央盲道前进", point: new Phaser.Math.Vector2(BUS_INTERIOR_DOOR.x, BUS_INTERIOR_DOOR.y) };
    }
    return null;
  }

  protected onSurfaceContact(surface: CaneSurface): void {
    if (surface.kind !== "seat") return;
    this.seatConfirmed = true;
    audioDirector.interact();
    this.announce("座位边缘已确认：软垫和金属框就在旁边，靠近后按 E 坐下。");
  }

  private drawInteriorDetails(): void {
    this.add.image(320, 42, "m2-bus-interior-strip").setDisplaySize(640, 72).setDepth(3).setAlpha(0.72);
    this.add.rectangle(320, 42, 610, 26, 0x4f5b5e, 0.22).setDepth(4);
    this.add.rectangle(320, 42, 560, 12, 0x9b9a8e, 0.25).setDepth(5);
    this.add.rectangle(BUS_SEAT_EDGE.x - 18, BUS_SEAT_EDGE.y, 32, 12, 0x876f56, 0.9).setDepth(5);
    this.add.rectangle(BUS_SEAT_EDGE.x - 18, BUS_SEAT_EDGE.y - 8, 32, 8, 0xb4986c, 0.9).setDepth(5);
  }

  protected decisionHint(nodeIndex: number): string {
    if (this.path.nodes[nodeIndex]?.taskId === "find-seat") return "4×4凸点：空座就在旁边，可按 E 坐下";
    return super.decisionHint(nodeIndex);
  }

  protected updateInteraction(): void {
    const seat = OBJECTIVES[this.objectiveId];
    const near = this.isNear(seat.target.x, seat.target.y, seat.triggerRadius);
    const canSit = getSnapshot().busState === "boarding" && this.seatConfirmed;
    this.prompt = near ? (canSit ? "E  坐下" : "请先用盲杖确认座位边缘") : "";
    if (near && canSit && this.interactionPressed()) {
      audioDirector.interact();
      const seated = transitionBus(getSnapshot().busState, "sit");
      patchSnapshot({ busState: seated, selectedSeatId: "seat-a2", objectiveId: "ride-to-camoes", scene: "bus-ride" });
      this.announce("你收起盲杖，在座位上坐稳。");
      this.time.delayedCall(520, () => { gameEvents.emit("chapter", { from: "bus-interior", to: "bus-ride" }); this.scene.start("bus-ride"); });
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
      contact: "车厢行驶中",
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
      contact: "车厢行驶中",
    });
  }

  private finishRide(): void {
    if (this.ended) return;
    this.ended = true;
    const arrived = transitionBus(getSnapshot().busState, "arrive");
    patchSnapshot({ busState: arrived, scene: "old-city", objectiveId: "follow-old-city-path" });
    gameEvents.emit("chapter", { from: "bus-ride", to: "old-city" });
    this.scene.start("old-city");
  }
}

export class OldCityScene extends WalkScene {
  protected sceneId = "old-city" as const;
  protected backgroundKey = "old-city-bg";
  protected backgroundUrl = oldCityUrl;
  protected spawn = new Phaser.Math.Vector2(330, 330);
  protected objectiveId = "follow-old-city-path";
  private railHeld = false;
  private railRevealedUntil = 0;
  private railBase!: Phaser.GameObjects.Graphics;
  private railReveal!: Phaser.GameObjects.Graphics;
  private leaving = false;
  private deadEndFound = false;

  constructor() {
    super("old-city");
  }

  preload(): void {
    super.preload();
    this.load.image("m3-oldcity-house-left", oldCityHouseLeftUrl);
    this.load.image("m3-oldcity-house-right", oldCityHouseRightUrl);
    this.load.image("m3-oldcity-arcade-corner", oldCityArcadeUrl);
  }

  protected tileMap(): TileMapDefinition | null {
    return OLD_CITY_TILEMAP;
  }

  protected onSceneReady(): void {
    if (getSnapshot().busState === "arrived") patchSnapshot({ busState: transitionBus("arrived", "alight") });
    this.add.image(106, 82, "m3-oldcity-house-left").setDisplaySize(218, 109).setDepth(3).setAlpha(0.92);
    this.add.image(534, 82, "m3-oldcity-house-right").setDisplaySize(218, 109).setDepth(3).setAlpha(0.92);
    this.add.image(320, 52, "m3-oldcity-arcade-corner").setDisplaySize(180, 101).setDepth(4).setAlpha(0.96);
    OLD_CITY_TREES.forEach((tree) => {
      const canopy = this.add.image(tree.x, tree.y, TREE_TEXTURE.normal).setOrigin(0, 0).setDepth(15);
      this.registerGroundOverlay(canopy, TREE_TEXTURE.normal, TREE_TEXTURE.warm, tree.x + 12, tree.y + 12);
    });
    this.railBase = this.add.graphics().setDepth(12);
    this.railReveal = this.add.graphics().setDepth(15);
    this.drawRail(this.railBase, 0x5f6662, 0.92);
    this.announce("你在白鸽巢下车。城市是灰色的；用 Space 敲击面前的一根盲杖，触碰过的地方会留下暖色记忆。");
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
    if (this.railHeld) return projectToSegment(bounded, OLD_CITY_HANDRAIL.start, OLD_CITY_HANDRAIL.end).point;
    return bounded;
  }

  protected suspendRouteTracking(): boolean {
    const distance = projectToSegment(new Phaser.Math.Vector2(this.player.x, this.player.y), OLD_CITY_HANDRAIL.start, OLD_CITY_HANDRAIL.end).distance;
    return this.railHeld || distance < 46;
  }

  protected repeatTaskText(): string {
    if (this.railHeld) return "当前任务：按 W 沿扶手前进，按 S 后退，按 E 可以松开。";
    if (this.objectiveId === "follow-handrail") return "当前任务：用 Space 敲击确认金属扶手，靠近后按 E 握住。";
    return "当前任务：用一根盲杖判断四纹和点阵；支路不对时请自己返回，Q 可显示目标方向。";
  }

  protected decisionHint(nodeIndex: number): string {
    if (this.path.nodes[nodeIndex]?.taskId === "follow-old-city-path") return "4×4凸点：盲道在此暂停，右侧有金属扶手";
    return super.decisionHint(nodeIndex);
  }

  protected onSurfaceContact(surface: CaneSurface, time: number): void {
    if (surface.kind === "metal") this.revealRail(time);
    if (surface.kind === "obstacle" && !this.deadEndFound) {
      this.deadEndFound = true;
      collectMemory("old-city-bell");
      this.announce("杖头碰到封闭围栏，脚下也没有连续凸纹。这是短支路，请转身返回刚才的点阵。");
    }
  }

  protected detectSceneSurface(tip: Phaser.Math.Vector2): CaneSurface | null {
    const npc = this.nearestNpc(tip, 24);
    if (npc) return { kind: "person", label: `${npc.definition.idleLabel}：按 E 询问方向`, point: new Phaser.Math.Vector2(npc.definition.x, npc.definition.y) };
    const rail = projectToSegment(tip, OLD_CITY_HANDRAIL.start, OLD_CITY_HANDRAIL.end);
    if (rail.distance <= 9) return { kind: "metal", label: "金属扶手：可靠近后按 E 握住", point: rail.point };
    if (tip.x >= 500 && tip.y >= 190 && tip.y <= 275) return { kind: "obstacle", label: "封闭围栏：这条支路无法继续", point: tip };
    return null;
  }

  protected updateInteraction(time: number): void {
    this.railReveal.clear();
    if (time < this.railRevealedUntil || this.railHeld) this.drawRail(this.railReveal, OLD_CITY_HANDRAIL.revealColor, 1);

    const memory = { x: 500, y: 230 };
    const nearMemory = this.isNear(memory.x, memory.y, 30) && !getSnapshot().memories.includes("old-city-bell");
    const railProjection = projectToSegment(new Phaser.Math.Vector2(this.player.x, this.player.y), OLD_CITY_HANDRAIL.start, OLD_CITY_HANDRAIL.end);
    const nearRail = railProjection.distance <= OLD_CITY_HANDRAIL.engageRadius;
    const railVisible = time < this.railRevealedUntil || this.railHeld;

    this.prompt = nearMemory
      ? "E  聆听记忆回声"
      : this.railHeld
        ? "E  松开扶手"
        : nearRail
          ? railVisible ? "E  握住扶手" : "Space 敲击寻找扶手"
          : "";

    if (nearMemory && this.interactionPressed()) {
      collectMemory("old-city-bell");
      audioDirector.interact();
      this.announce("记忆回声：支路尽头传来钟声。林伯笑说，会走错路也算澳门的一部分。");
      return;
    }

    if (this.railHeld && this.interactionPressed()) {
      this.railHeld = false;
      audioDirector.interact();
      this.announce("你松开扶手。需要时可以再次用 Space 敲击确认它的位置。");
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
      this.announce("扶手在点阵砖旁结束。前方是直行斑马线，请先到路缘请求通行。");
      this.time.delayedCall(700, () => { gameEvents.emit("chapter", { from: "old-city", to: "old-city-crossing" }); this.scene.start("old-city-crossing"); });
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

  preload(): void {
    super.preload();
    this.load.image("m3-crossing-corner-left", crossingCornerLeftUrl);
    this.load.image("m3-crossing-corner-right", crossingCornerRightUrl);
  }

  protected onSceneReady(): void {
    this.add.image(78, 104, "m3-crossing-corner-left").setDisplaySize(158, 126).setDepth(3).setAlpha(0.94);
    this.add.image(562, 104, "m3-crossing-corner-right").setDisplaySize(158, 126).setDepth(3).setAlpha(0.94);
    this.signalGraphics = this.add.graphics().setDepth(17);
    this.guideGraphics = this.add.graphics().setDepth(14);
    this.drawSignal();
    this.announce("前方是直行路口。沿盲道到点阵处，按 E 请求通行。");
  }

  protected tileMap(): TileMapDefinition | null {
    return CROSSING_TILEMAP;
  }

  protected decisionHint(nodeIndex: number): string {
    const taskId = this.path.nodes[nodeIndex]?.taskId;
    if (taskId === "request-crossing") return "4×4凸点：前方是路缘，可按 E 请求通行";
    if (taskId === "cross-junction") return "4×4凸点：对岸路缘，盲道向前继续";
    return super.decisionHint(nodeIndex);
  }

  protected repeatTaskText(): string {
    if (this.crossingState === "requested") return "当前任务：留在点阵砖旁等待；收到文字和双音提示后再前进。";
    if (this.crossingState === "walk") return "当前任务：可以通行。沿垂直斑马线直行到对岸，再向右转。";
    return "当前任务：向前到点阵砖，按 E 请求通行。斑马线直行通过路口。";
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
          ? "沿直线斑马线通过"
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
        this.announce("可以通行。沿垂直斑马线直行到对岸，再向右转。");
        this.drawSignal();
      });
      return;
    }

    if (this.crossingState === "walk" && this.isNear(OLD_CITY_CROSSING.farCurb.x, OLD_CITY_CROSSING.farCurb.y, 30) && !this.leaving) {
      this.leaving = true;
      this.crossingState = transitionCrossing(this.crossingState, "finish");
      patchSnapshot({ scene: "ruins", objectiveId: "meet-lam" });
      this.announce("你抵达对岸点阵。前方盲道通向大三巴牌坊。");
      this.time.delayedCall(650, () => { gameEvents.emit("chapter", { from: "old-city-crossing", to: "ruins" }); this.scene.start("ruins"); });
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
    this.guideGraphics.fillStyle(0xffd477, 0.22);
    CROSSING_TILEMAP.rows.forEach((row, rowIndex) => [...row].forEach((char, colIndex) => {
      if (char !== "z") return;
      this.guideGraphics.fillRect(colIndex * 16, rowIndex * 16 + CROSSING_TILEMAP.offsetY, 16, 16);
    }));
  }
}

export class RuinsScene extends WalkScene {
  protected sceneId = "ruins" as const;
  protected backgroundKey = "ruins-bg";
  protected backgroundUrl = oldCityUrl;
  protected spawn = new Phaser.Math.Vector2(326, 290);
  protected objectiveId = "meet-lam";
  private finaleStarted = false;
  private finaleFinished = false;
  private finaleGraphics!: Phaser.GameObjects.Graphics;
  private lam!: Phaser.GameObjects.Sprite;

  constructor() {
    super("ruins");
  }

  preload(): void {
    super.preload();
    this.load.image("m4-ruins-lowrise-wall", ruinsLowriseWallUrl);
  }

  protected onSceneReady(): void {
    this.add.image(320, 128, "m4-ruins-lowrise-wall").setDisplaySize(620, 180).setDepth(3).setAlpha(0.94);
    this.drawRuinsFacade();
    this.finaleGraphics = this.add.graphics().setDepth(16);
    this.lam = this.add.sprite(240, 88, "traveler", 3).setScale(0.13).setTint(0xd7a85d).setDepth(18);
    if (!getSnapshot().settings.reducedMotion) this.tweens.add({ targets: this.lam, y: 86, duration: 900, yoyo: true, repeat: -1 });
    this.announce("牌坊前的台阶反着灯光。林伯就在盲道尽头等你。");
  }

  protected tileMap(): TileMapDefinition | null {
    return RUINS_TILEMAP;
  }

  protected getMovementInput(): Phaser.Math.Vector2 {
    return this.finaleStarted ? new Phaser.Math.Vector2() : super.getMovementInput();
  }

  private drawRuinsFacade(): void {
    this.add.rectangle(320, 48, 300, 58, 0x55504a, 0.84).setDepth(2).setStrokeStyle(3, 0x24272a, 0.9);
    this.add.rectangle(320, 70, 246, 10, 0xb89a6e, 0.62).setDepth(3);
    this.add.rectangle(320, 90, 190, 8, 0x6f665b, 0.8).setDepth(3);
    this.add.text(320, 48, "大三巴牌坊", { color: "#e2c994", fontFamily: "monospace", fontSize: "16px", fontStyle: "bold" }).setOrigin(0.5).setDepth(4);
  }

  protected decisionHint(nodeIndex: number): string {
    if (this.path.nodes[nodeIndex]?.taskId === "meet-lam") return "4×4凸点：台阶在前，林伯在盲道尽头等你";
    return super.decisionHint(nodeIndex);
  }

  protected updateInteraction(): void {
    if (this.finaleStarted) {
      this.drawFinaleWave();
      this.prompt = "正在回放触碰过的暖色记忆";
      return;
    }
    const target = OBJECTIVES[this.objectiveId].target;
    const near = this.isNear(target.x, target.y, 38);
    this.prompt = near ? "E  回应林伯" : "";
    if (near && this.interactionPressed()) {
      audioDirector.interact();
      this.startFinale();
    }
  }

  private startFinale(): void {
    this.finaleStarted = true;
    this.prompt = "正在回放触碰过的暖色记忆";
    const snapshot = getSnapshot();
    const memoryScenes = ["bus-stop", "bus-interior", "old-city", "old-city-crossing"] as const;
    const lines: string[] = memoryScenes
      .filter((scene) => snapshot.colorMemory.some((point) => point.scene === scene))
      .map((scene) => `${SCENE_LABELS[scene]}：你触碰过的地方，正在恢复暖色。`);
    const reducedMotion = snapshot.settings.reducedMotion;
    if (reducedMotion || lines.length === 0) {
      this.drawFinaleWave(true);
      this.time.delayedCall(reducedMotion ? 250 : 3000, () => this.finishFinale());
      return;
    }
    lines.forEach((line, index) => this.time.delayedCall(index * 650, () => this.announce(line)));
    this.time.delayedCall(Math.min(4000, Math.max(3000, lines.length * 650 + 600)), () => this.finishFinale());
  }

  private drawFinaleWave(full = false): void {
    if (!this.finaleGraphics || !this.lam) return;
    const progress = full ? 1 : Math.min(1, (this.time.now % 2300) / 2300);
    this.finaleGraphics.clear();
    this.finaleGraphics.fillStyle(0xd5ae68, full ? 0.34 : 0.14);
    this.finaleGraphics.fillCircle(this.lam.x, this.lam.y, full ? 420 : 65 + progress * 300);
    this.finaleGraphics.lineStyle(3, 0xf2d790, full ? 0.5 : 0.22);
    this.finaleGraphics.strokeCircle(this.lam.x, this.lam.y, full ? 420 : 65 + progress * 300);
  }

  private finishFinale(): void {
    if (this.finaleFinished) return;
    this.finaleFinished = true;
    const snapshot = getSnapshot();
    const elapsedSeconds = snapshot.elapsedBeforeResume + Math.max(0, (Date.now() - snapshot.startedAt) / 1000);
    const ending = determineEnding({ elapsedSeconds, detourScore: snapshot.detourScore, returnRequested: snapshot.returnRequested });
    finishGame(ending);
    gameEvents.emit("ending", ending);
    this.scene.pause();
  }
}

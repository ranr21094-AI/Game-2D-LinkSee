import Phaser from "phaser";
import busWindowPanoramaUrl from "../assets/bus-window-panorama-pixel.png";
import travelerWalkUrl from "../assets/traveler-walk.png";
import travelerSitUrl from "../assets/traveler-sit.png";
import lamUrl from "../assets/lam.png";
import npcSpritesheetUrl from "../assets/npc-spritesheet.png";
import { audioDirector } from "./audio";
import { composeRepeatText, OBJECTIVES, OLD_CITY_CROSSING, OLD_CITY_HANDRAIL, PATHS, REVEAL_PROFILE, SCENE_LABELS, TACTILE_LIT_MS } from "./content";
import { CROSSING_TILEMAP } from "./crossing-map";
import { ensureCaneTextures, preloadEnvironmentAssets, renderMapDecoration, type EnvironmentSprite } from "./environment-art";
import { gameEvents } from "./events";
import { constrainCrossingPosition, determineEnding, mergeColorMemory, resumePointForStage, transitionBus, transitionCrossing } from "./flow";
import { deterministicTileVariant, ensureGroundTextures, GROUND_TEXTURE, type GroundTileKey, type GroundVisualState } from "./ground-tiles";
import { BUS_INTERIOR_DOOR, BUS_INTERIOR_TILEMAP, BUS_SEAT_EDGE } from "./businterior-map";
import { BUS_STOP_DECOY_SIGNS, BUS_STOP_DOOR, BUS_STOP_GATE_ENTRY, BUS_STOP_PATH_START, BUS_STOP_SIGN, BUS_STOP_SIGN_PROBE_RADIUS, BUS_STOP_TILEMAP } from "./busstop-map";
import { MAP_TILE_SIZE, OLD_CITY_TILEMAP } from "./oldcity-map";
import { NPC_DEFINITIONS, type NpcDefinition } from "./npcs";
import { RUINS_TILEMAP } from "./ruins-map";
import { collectMemory, finishGame, getActiveElapsedMs, getSnapshot, patchSnapshot, setCheckpoint, unlockTip } from "./store";
import { ensureTactileTextures, TACTILE_TEXTURE } from "./tactile-layer";
import { describeDecisionBrick, rasterizeTactilePath, type TactileBrick } from "./tactile-tiles";
import { isWalkable, movementUnderPoint, nearestSafeWalkablePoint, solidDecorationAt, tileUnderPoint, type MapDecoration, type TileMapDefinition } from "./tilemap";
import type { BusTransitState, CaneSurfaceKind, ColorMemoryPoint, CrossingState, HudState, SceneId, TactilePathDefinition, TactilePathNode, TilePoint } from "./types";

type Facing = "up" | "down" | "left" | "right";
type RevealMode = "tap" | "hint" | null;
type CaneSurface = {
  kind: CaneSurfaceKind;
  label: string;
  point: Phaser.Math.Vector2;
};

type ColorPulse = TilePoint & { expiresAt: number; radius: number };

const FACE_FRAME: Record<Facing, number> = { up: 1, left: 4, right: 7, down: 10 };
const FACE_ROW: Record<Facing, number> = { up: 0, left: 1, right: 2, down: 3 };
const NIGHT_GROUND_TINT = 0x000000;
const NIGHT_TACTILE_TINT = 0x000000;
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

function solidSurfaceLabel(kind: MapDecoration["kind"]): string {
  if (kind === "gate-building") return "口岸墙体：实心建筑，无法穿过";
  if (kind === "bench") return "长椅边缘：实心座位，请绕行";
  if (kind === "stop-sign-17" || kind === "stop-sign-25") return "站牌立柱：金属立杆，牌面在上方";
  return "实心障碍物：请绕行";
}

abstract class WalkScene extends Phaser.Scene {
  protected abstract sceneId: Exclude<SceneId, "bus-ride">;
  protected abstract spawn: Phaser.Math.Vector2;
  protected abstract objectiveId: string;
  protected player!: Phaser.GameObjects.Sprite;
  protected revealGraphics!: Phaser.GameObjects.Graphics;
  protected caneSprite!: Phaser.GameObjects.Image;
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
  private flashCooldownUntil = 0;
  private flashUntil = 0;
  private lastDarkHintAt = -4000;
  protected groundSprites: Array<{ sprite: Phaser.GameObjects.Image; textures: Record<GroundVisualState, string>; frames?: Record<GroundVisualState, string>; x: number; y: number; environment: boolean }> = [];
  private colorPulses: ColorPulse[] = [];
  private cachedMemorySource: ColorMemoryPoint[] | null = null;
  private cachedSceneMemory: ColorMemoryPoint[] = [];
  private warmFades: Array<{ overlay: Phaser.GameObjects.Image; bornAt: number; duration: number }> = [];
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
  private offRouteSince = 0;
  private lastStepAt = 0;
  private lastTapAt = -1000;
  private roadEnteredAt = 0;
  private roadWarnedAt = -2000;
  private roadReturning = false;
  private devInteractRequested = false;
  private cleanupDevEvents: Array<() => void> = [];
  private npcSprites: Array<{ definition: NpcDefinition; sprite: Phaser.GameObjects.Sprite }> = [];

  preload(): void {
    preloadEnvironmentAssets(this);
    if (!this.textures.exists("traveler-walk")) {
      this.load.spritesheet("traveler-walk", travelerWalkUrl, { frameWidth: 64, frameHeight: 64 });
    }
    if (!this.textures.exists("traveler-sit")) {
      this.load.image("traveler-sit", travelerSitUrl);
    }
    if (!this.textures.exists("npc-spritesheet")) {
      this.load.spritesheet("npc-spritesheet", npcSpritesheetUrl, { frameWidth: 362, frameHeight: 362 });
    }
    if (!this.textures.exists("lam")) {
      this.load.spritesheet("lam", lamUrl, { frameWidth: 64, frameHeight: 64 });
    }
  }

  create(): void {
    const map = this.tileMap();
    if (!map) throw new Error(`${this.sceneId} requires a complete tile map`);
    ensureGroundTextures(this);
    ensureCaneTextures(this);
    this.buildGround(map);
    map.decorations.forEach((decoration) => {
      const rendered = renderMapDecoration(this, decoration);
      if (!rendered) return;
      (Array.isArray(rendered) ? rendered : [rendered]).forEach((sprite) => this.registerEnvironmentSprite(sprite));
    });
    const snapshot = getSnapshot();
    if (snapshot.scene === this.sceneId && OBJECTIVES[snapshot.objectiveId]?.scene === this.sceneId) this.objectiveId = snapshot.objectiveId;
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
    const resumePoint = snapshot.scene === this.sceneId ? resumePointForStage(snapshot.resumeStage) : this.spawn;
    (Object.keys(FACE_ROW) as Facing[]).forEach((facing) => {
      const key = `walk-${facing}`;
      if (this.anims.exists(key)) return;
      const row = FACE_ROW[facing] * 3;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers("traveler-walk", { frames: [row, row + 1, row + 2, row + 1] }),
        frameRate: 7,
        repeat: -1,
      });
    });
    this.player = this.add.sprite(resumePoint.x, resumePoint.y, "traveler-walk", FACE_FRAME[this.facing]);
    this.player.setDepth(resumePoint.y + 1);
    this.player.setOrigin(0.5, 1);
    this.renderNpcs();
    this.caneSprite = this.add.image(this.player.x + 2, this.player.y - 28, "cane-up-idle").setDepth(this.player.y + 3);
    this.colorPulses.push({ x: resumePoint.x, y: resumePoint.y, radius: 60, expiresAt: this.time.now + 3200 });
    this.keys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      tap: Phaser.Input.Keyboard.KeyCodes.SPACE,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      hint: Phaser.Input.Keyboard.KeyCodes.Q,
      repeat: Phaser.Input.Keyboard.KeyCodes.H,
      flash: Phaser.Input.Keyboard.KeyCodes.G,
      pause: Phaser.Input.Keyboard.KeyCodes.ESC,
      arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
      arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
      arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
      arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard?.addCapture(["SPACE", "Q", "E", "G", "UP", "DOWN", "LEFT", "RIGHT"]);
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
    gameEvents.emit("scene", this.sceneId);
    audioDirector.enterScene(this.sceneId);
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

  private buildGround(map: TileMapDefinition): void {
    map.groundRows.forEach((row, rowIndex) => {
      [...row].forEach((char, colIndex) => {
        const key = map.legend[char] ?? "stone";
        const textures = GROUND_TEXTURE[key];
        const variant = deterministicTileVariant(map.id, colIndex, rowIndex, key);
        const x = colIndex * MAP_TILE_SIZE + MAP_TILE_SIZE / 2;
        const y = rowIndex * MAP_TILE_SIZE + map.offsetY + MAP_TILE_SIZE / 2;
        const selected = { base: textures.base[variant], memory: textures.memory[variant], warm: textures.warm[variant] };
        const sprite = this.add.image(x, y, selected.base).setDepth(0);
        this.groundSprites.push({ sprite, textures: selected, x, y, environment: false });
      });
    });
  }

  private registerEnvironmentSprite(rendered: EnvironmentSprite): void {
    this.groundSprites.push({ ...rendered, environment: true });
  }

  private sceneColorMemory(): ColorMemoryPoint[] {
    const source = getSnapshot().colorMemory;
    if (source !== this.cachedMemorySource) {
      this.cachedMemorySource = source;
      this.cachedSceneMemory = source.filter((point) => point.scene === this.sceneId);
    }
    return this.cachedSceneMemory;
  }

  private updateGroundColors(): void {
    if (!this.groundSprites.length) return;
    const pulses = this.colorPulses;
    const night = this.isNightMode();
    const memory = night ? [] : this.sceneColorMemory();
    const flashed = this.time.now < this.flashUntil;
    for (const tile of this.groundSprites) {
      const lit = flashed || pulses.some((pulse) => Phaser.Math.Distance.Between(tile.x, tile.y, pulse.x, pulse.y) <= pulse.radius);
      const remembered = !lit && memory.some((point) => Phaser.Math.Distance.Between(tile.x, tile.y, point.x, point.y) <= point.radius);
      const state: GroundVisualState = this.forceWarmForTile(tile) || lit ? "warm" : remembered ? "memory" : "base";
      const texture = tile.textures[state];
      const frame = tile.frames?.[state];
      if (tile.sprite.texture.key !== texture || (frame && tile.sprite.frame.name !== frame)) tile.sprite.setTexture(texture, frame);
      const tint = night && state !== "warm" ? NIGHT_GROUND_TINT : null;
      if (tint === null && tile.sprite.isTinted) tile.sprite.clearTint();
      else if (tint !== null && (!tile.sprite.isTinted || tile.sprite.tintTopLeft !== tint)) tile.sprite.setTint(tint);
    }
  }

  protected forceWarmForTile(_tile: { x: number; y: number; environment: boolean }): boolean { return false; }

  /**
   * When a color pulse expires, affected tiles crossfade from the warm texture back
   * to their memory/base state instead of popping. A fading warm overlay is placed
   * just above each tile and dissolved over ~750ms.
   */
  private spawnWarmFade(pulse: ColorPulse, time: number): void {
    if (getSnapshot().settings.reducedMotion) return;
    if (pulse.radius > 100) return;
    let spawned = 0;
    for (const tile of this.groundSprites) {
      if (spawned >= 96) break;
      if (Phaser.Math.Distance.Between(tile.x, tile.y, pulse.x, pulse.y) > pulse.radius) continue;
      if (this.forceWarmForTile(tile)) continue;
      const stillLit = this.colorPulses.some((active) => Phaser.Math.Distance.Between(tile.x, tile.y, active.x, active.y) <= active.radius);
      if (stillLit) continue;
      const overlay = this.add.image(tile.sprite.x, tile.sprite.y, tile.textures.warm, tile.frames?.warm)
        .setOrigin(tile.sprite.originX, tile.sprite.originY)
        .setDisplaySize(tile.sprite.displayWidth, tile.sprite.displayHeight)
        .setFlipX(tile.sprite.flipX)
        .setDepth(tile.sprite.depth + 0.01);
      this.warmFades.push({ overlay, bornAt: time, duration: 750 });
      spawned += 1;
    }
    while (this.warmFades.length > 240) this.warmFades.shift()?.overlay.destroy();
  }

  private updateWarmFades(time: number): void {
    if (!this.warmFades.length) return;
    this.warmFades = this.warmFades.filter((fade) => {
      const progress = (time - fade.bornAt) / fade.duration;
      if (progress >= 1) {
        fade.overlay.destroy();
        return false;
      }
      fade.overlay.setAlpha(1 - progress);
      return true;
    });
  }

  update(time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      this.scene.pause();
      gameEvents.emit("pause", true);
      return;
    }
    this.updateMovement(time, delta);
    this.updateCane(time, delta);
    const expiredPulses = this.colorPulses.filter((pulse) => pulse.expiresAt <= time);
    if (expiredPulses.length) {
      this.colorPulses = this.colorPulses.filter((pulse) => pulse.expiresAt > time);
      expiredPulses.forEach((pulse) => this.spawnWarmFade(pulse, time));
    }
    this.updateWarmFades(time);
    this.updateReveal(time);
    this.updateGroundColors();
    this.handleActions(time);
    this.checkRoute(time);
    if (this.tryNpcInteraction()) {
      this.emitHud();
      return;
    }
    this.updateInteraction(time);
    this.player.setDepth(this.playerRenderDepth());
    this.caneSprite.setDepth(this.facing === "up" ? this.player.y - 1 : this.player.y + 3);
    this.npcSprites.forEach(({ definition, sprite }) => sprite.setDepth(definition.y + 1));
    this.emitHud();
  }

  protected abstract updateInteraction(time: number): void;

  protected playerRenderDepth(): number {
    return this.player.y + 1;
  }

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
    audioDirector.speak(text);
    this.time.delayedCall(3400, () => {
      if (this.subtitle === text) this.subtitle = "";
    });
  }

  protected getMovementInput(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(
      Number(this.keys.right.isDown || this.keys.arrowRight.isDown) - Number(this.keys.left.isDown || this.keys.arrowLeft.isDown),
      Number(this.keys.down.isDown || this.keys.arrowDown.isDown) - Number(this.keys.up.isDown || this.keys.arrowUp.isDown),
    );
  }

  protected constrainMovement(_current: Phaser.Math.Vector2, next: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const bounded = new Phaser.Math.Vector2(Phaser.Math.Clamp(next.x, 24, 616), Phaser.Math.Clamp(next.y, 40, 340));
    const map = this.tileMap();
    if (map && !isWalkable(map, bounded)) return _current.clone();
    if (this.requiresBrightGround() && !this.isBrightGround(bounded)) {
      this.onDarkGroundBlocked();
      return _current.clone();
    }
    return bounded;
  }

  /** Whether this scene only allows stepping onto brightly lit (warm) ground. */
  protected requiresBrightGround(): boolean {
    return true;
  }

  /** A point is bright when an active color pulse covers it or the tile is forced warm. */
  protected isBrightGround(point: Phaser.Math.Vector2): boolean {
    if (this.colorPulses.some((pulse) => Phaser.Math.Distance.Between(point.x, point.y, pulse.x, pulse.y) <= pulse.radius)) return true;
    return this.forceWarmForTile({ x: point.x, y: point.y, environment: false });
  }

  private onDarkGroundBlocked(): void {
    const now = this.time.now;
    if (now - this.lastDarkHintAt < 4000) return;
    this.lastDarkHintAt = now;
    this.announce("脚下太暗，看不清路面。按 Space 敲击点亮前方，或按 G 用手机照亮四周。");
  }

  protected suspendRouteTracking(): boolean {
    return false;
  }

  /** On the tactile path (or an equivalent guide like the handrail) movement keeps full speed. */
  protected onGuidedPath(): boolean {
    return this.distanceToRoute() <= 13;
  }

  /** When true, movement and cane taps are disabled (flash light or seated on a bench). */
  protected controlsLocked(): boolean {
    return this.time.now < this.flashUntil;
  }

  /** Night mode: fully black city, short-lived cane light, no persistent color memory. */
  protected isNightMode(): boolean {
    return getSnapshot().settings.gameMode === "night";
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
      const sprite = this.add.sprite(definition.x, definition.y, "npc-spritesheet", frame).setScale(0.16).setDepth(definition.y + 1);
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
    if (this.roadReturning || this.controlsLocked()) return;
    const input = this.getMovementInput();
    if (!input.lengthSq()) {
      if (this.player.anims.isPlaying) this.player.anims.stop();
      this.player.setFrame(FACE_FRAME[this.facing]);
      this.updateRoadBoundary(time);
      return;
    }
    input.normalize();
    let x = input.x;
    let y = input.y;
    const map = this.tileMap();
    const onRoad = map ? movementUnderPoint(map, { x: this.player.x, y: this.player.y }) === "road" : false;
    const speed = 68 * (onRoad ? 0.4 : this.onGuidedPath() ? 1 : 0.35);
    const current = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const next = this.constrainMovement(current, new Phaser.Math.Vector2(
      this.player.x + x * speed * (delta / 1000),
      this.player.y + y * speed * (delta / 1000),
    ));
    this.player.setPosition(next.x, next.y);
    this.updateRoadBoundary(time);
    if (Math.abs(x) > Math.abs(y)) this.facing = x > 0 ? "right" : "left";
    else this.facing = y > 0 ? "down" : "up";
    if (!getSnapshot().settings.reducedMotion) {
      const animKey = `walk-${this.facing}`;
      if (this.player.anims.currentAnim?.key !== animKey) this.player.play(animKey);
    } else {
      if (this.player.anims.isPlaying) this.player.anims.stop();
      this.player.setFrame(FACE_FRAME[this.facing]);
    }
    if (time - this.lastStepAt > 360) {
      this.lastStepAt = time;
      audioDirector.footstep(map ? tileUnderPoint(map, next) : null);
    }
  }

  private updateRoadBoundary(time: number): void {
    const map = this.tileMap();
    if (!map) return;
    const movement = movementUnderPoint(map, { x: this.player.x, y: this.player.y });
    if (movement !== "road") {
      this.roadEnteredAt = 0;
      audioDirector.setTrafficDanger(false);
      return;
    }
    audioDirector.setTrafficDanger(true);
    if (!this.roadEnteredAt) this.roadEnteredAt = time;
    if (time - this.roadEnteredAt < 400 || this.roadReturning) return;
    if (time - this.roadWarnedAt >= 1500) {
      this.roadWarnedAt = time;
      audioDirector.trafficWarning();
      this.announce("车流声突然靠近。这里不是过街区，正在带你退回最近的人行道。");
    }
    const safe = nearestSafeWalkablePoint(map, { x: this.player.x, y: this.player.y });
    if (!safe) return;
    this.roadReturning = true;
    this.tweens.add({
      targets: this.player,
      x: safe.x,
      y: safe.y,
      duration: getSnapshot().settings.reducedMotion ? 1 : 240,
      ease: "Sine.out",
      onComplete: () => { this.roadReturning = false; this.roadEnteredAt = 0; audioDirector.setTrafficDanger(false); },
    });
  }

  private handleActions(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.tap) && !this.controlsLocked() && time - this.lastTapAt >= 220) {
      this.lastTapAt = time;
      this.revealMode = "tap";
      this.revealUntil = time + 180;
      this.tapExtensionUntil = time + 180;
      this.performCaneContact(time);
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.flash) && time >= this.flashCooldownUntil) {
      this.flashCooldownUntil = time + 8000;
      this.performFlash(time);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.repeat)) {
      const text = composeRepeatText(this.contact, this.repeatTaskText());
      this.announce(text);
    }
  }

  /**
   * G key: a brief phone-torch flash that lights the whole screen for ~1.5s.
   * While the light lasts the player cannot move or tap (controlsLocked); it does
   * not write color memory and does not affect walkability rules.
   */
  private performFlash(time: number): void {
    this.flashUntil = time + 1500;
    audioDirector.hint();
    this.announce("你打开手机闪光灯，四周霎时亮了起来。亮光散去前你无法移动。");
    if (getSnapshot().settings.reducedMotion) return;
    const overlay = this.add.rectangle(320, 180, 640, 360, 0xffe6b0, 0).setDepth(1000);
    this.tweens.add({
      targets: overlay,
      alpha: 0.22,
      duration: 160,
      yoyo: true,
      hold: 700,
      onComplete: () => overlay.destroy(),
    });
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
    const night = this.isNightMode();
    for (let index = 0; index < this.tactileSprites.length; index += 1) {
      const lit = time < this.tactileLitUntil[index] || time < this.flashUntil;
      const brick = this.tactileBricks[index];
      const sprite = this.tactileSprites[index];
      const key = brick.kind === "decision"
        ? lit ? TACTILE_TEXTURE.decisionLit : TACTILE_TEXTURE.decision
        : lit ? TACTILE_TEXTURE.guidanceLit : TACTILE_TEXTURE.guidance;
      if (sprite.texture.key !== key) sprite.setTexture(key);
      const rememberedTint = !night && !lit && this.tactileRemembered.has(index) ? 0xd9c79c : null;
      const baseTint = this.tactileBaseTint[index] ?? 0xffffff;
      const desiredTint = rememberedTint ?? (night && !lit ? NIGHT_TACTILE_TINT : lit || baseTint === 0xffffff ? null : baseTint);
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
    const backView = this.facing === "up";
    this.caneSprite.setAngle(this.facing === "right" ? 38 : this.facing === "left" ? -38 : backView ? -20 : 0);
    this.caneSprite.setPosition(Math.round(this.player.x + (backView ? 10 : 2)), Math.round(this.player.y - 28));
    this.caneSprite.setTexture(`cane-${this.facing}-${time < this.tapExtensionUntil ? "tap" : "idle"}`);
  }

  private caneTip(distance: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.player.x + 2, this.player.y + 4)
      .add(FACE_VECTOR[this.facing].clone().scale(distance));
  }

  private performCaneContact(time: number): void {
    const forwardProbes = [18, 24, 30, 36, 42].map((distance) => this.detectCaneSurface(this.caneTip(distance)));
    const underfoot = this.detectCaneSurface(this.caneTip(0));
    const surface = forwardProbes.find((candidate) => candidate.kind !== "stone")
      ?? (underfoot.kind !== "stone" ? underfoot : forwardProbes[forwardProbes.length - 1]);
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
    const feet = this.caneTip(0);
    if (Phaser.Math.Distance.Between(surface.point.x, surface.point.y, feet.x, feet.y) > 8) {
      this.enhanceTactileAt(feet, time);
      this.colorPulses.push({ x: feet.x, y: feet.y, radius: 30, expiresAt: time + TACTILE_LIT_MS });
    }
    const snapshot = getSnapshot();
    if (!this.isNightMode()) {
      const colorMemory = mergeColorMemory(snapshot.colorMemory, { scene: this.sceneId, x: surface.point.x, y: surface.point.y, radius: 38 }, 32);
      if (colorMemory !== snapshot.colorMemory) patchSnapshot({ colorMemory });
    }
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

    const map = this.tileMap();
    const solid = map ? solidDecorationAt(map, tip) : null;
    if (solid) return { kind: "obstacle", label: solidSurfaceLabel(solid.kind), point: tip };
    const tile = map ? tileUnderPoint(map, tip) : null;
    if (tile === "curb") return { kind: "curb", label: "路缘：台面升高，靠近后注意边界", point: tip };
    if (tile === "wall" || tile === "building" || tile === "fence" || tile === "bush") return { kind: "obstacle", label: "前方是阻挡物：请停下并回到凸纹", point: tip };
    if (tile === "dirt") return { kind: "stone", label: "碎土：材质与主路不同", point: tip };
    if (tile === "bus-seat") return { kind: "seat", label: "座位边缘：先确认软垫与金属框", point: tip };
    if (tile === "asphalt" || tile === "lane") return { kind: "stone", label: "粗糙沥青：前方是机动车道", point: tip };
    if (tile === "drain" || tile === "manhole") return { kind: "metal", label: "排水金属纹：靠近路缘，请留意车流", point: tip };
    return { kind: "stone", label: tile === "concrete" || tile === "sidewalk" ? "人行道铺面：没有连续凸纹" : "普通石板：没有连续凸纹", point: tip };
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
    const distance = this.distanceToRoute();
    if (distance <= 32) {
      this.wasOnRoute = true;
      this.offRouteSince = 0;
      return;
    }
    if (distance < 44) return;
    if (!this.offRouteSince) this.offRouteSince = time;
    if (this.wasOnRoute && time - this.offRouteSince >= 600 && time - this.lastDetourAt > 3500) {
      this.lastDetourAt = time;
      const score = getSnapshot().detourScore + 1;
      patchSnapshot({ detourScore: score });
      this.announce("脚下没有凸纹。可以按 Q 显示附近路线。重回盲道后继续前进。");
      this.wasOnRoute = false;
    }
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
  protected spawn = new Phaser.Math.Vector2(BUS_STOP_PATH_START.x, BUS_STOP_PATH_START.y);
  protected objectiveId = "find-stop-sign";
  private signConfirmed = false;
  private seatedBench: { x: number; y: number } | null = null;
  private standUpPoint: Phaser.Math.Vector2 | null = null;
  private gateIntroState: "inactive" | "approaching" | "offer" = "inactive";
  private gateHelper: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super("bus-stop");
  }

  protected onSceneReady(): void {
    const snapshot = getSnapshot();
    const closeTip = gameEvents.on("tipClosed", (tip) => {
      if (tip.fromIntro && tip.id === "sighted-guide") this.finishGateIntro();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, closeTip);
    this.events.once(Phaser.Scenes.Events.DESTROY, closeTip);
    if (snapshot.objectiveId === "board-17") this.signConfirmed = true;
    if (!snapshot.mobilityGuideSeen && snapshot.resumeStage === "bus-stop-entry" && snapshot.busState === "waiting" && !this.signConfirmed) {
      this.startGateIntro();
      return;
    }
    if (snapshot.busState === "waiting" && !this.signConfirmed) {
      this.announce("雨刚停。先沿四纹盲道找到站牌，确认凸字17；沿途还有写着25的相似站牌。");
    } else if (snapshot.busState === "waiting" && this.signConfirmed) {
      this.announce("17路站牌已经确认。车门即将开启，请沿盲道前往候车区右侧。");
      this.time.delayedCall(700, () => {
        if (getSnapshot().busState !== "waiting") return;
        patchSnapshot({ busState: transitionBus("waiting", "openDoor") });
        audioDirector.door();
        this.announce("17路车门已开。沿盲道前往车门，靠近后按 E 上车。");
      });
    } else if (snapshot.busState === "doorOpen") {
      this.announce("17路车门已开。沿盲道前往车门，靠近后按 E 上车。");
    }
  }

  protected tileMap(): TileMapDefinition | null {
    return BUS_STOP_TILEMAP;
  }

  protected detectSceneSurface(tip: Phaser.Math.Vector2): CaneSurface | null {
    if (Phaser.Math.Distance.Between(tip.x, tip.y, BUS_STOP_SIGN.x, BUS_STOP_SIGN.y) <= BUS_STOP_SIGN_PROBE_RADIUS) {
      return { kind: "sign", label: "站牌立柱：牌面有凸字「17」，确认这一班车", point: new Phaser.Math.Vector2(BUS_STOP_SIGN.x, BUS_STOP_SIGN.y) };
    }
    const decoy = BUS_STOP_DECOY_SIGNS.find((sign) => Phaser.Math.Distance.Between(tip.x, tip.y, sign.x, sign.y) <= BUS_STOP_SIGN_PROBE_RADIUS);
    if (decoy) return { kind: "sign", label: `相似站牌：牌面是凸字「${decoy.route}」，不是17路`, point: new Phaser.Math.Vector2(decoy.x, decoy.y) };
    if (Phaser.Math.Distance.Between(tip.x, tip.y, BUS_STOP_DOOR.x, BUS_STOP_DOOR.y) <= 20) {
      return { kind: "door", label: "车门边缘：确认站牌后，靠近按 E 上车", point: new Phaser.Math.Vector2(BUS_STOP_DOOR.x, BUS_STOP_DOOR.y) };
    }
    return null;
  }

  protected onSurfaceContact(surface: CaneSurface): void {
    if (surface.kind !== "sign" || this.signConfirmed || surface.point.x !== BUS_STOP_SIGN.x) return;
    this.signConfirmed = true;
    this.objectiveId = "board-17";
    collectMemory("border-hand");
    setCheckpoint("bus-stop-sign");
    audioDirector.interact();
    this.announce("确认：这是17路站牌。现在沿盲道向右前方到车门；车门将在站牌确认后开启。");
    this.time.delayedCall(1100, () => {
      if (getSnapshot().busState !== "waiting") return;
      patchSnapshot({ busState: transitionBus(getSnapshot().busState, "openDoor") });
      audioDirector.door();
      this.announce("17路车门已开。靠近车门后按 E 上车。");
    });
  }

  protected decisionHint(nodeIndex: number): string {
    if (this.path.nodes[nodeIndex]?.taskId === "board-17") return "4×4凸点：17路车门在右前方，靠近后按 E";
    return super.decisionHint(nodeIndex);
  }

  protected updateInteraction(): void {
    if (this.gateIntroState !== "inactive") {
      this.prompt = this.gateIntroState === "offer" ? "E  查看扶盲说明" : "";
      if (this.gateIntroState === "offer" && this.interactionPressed()) {
        unlockTip("sighted-guide");
        gameEvents.emit("tipOpen", { id: "sighted-guide", fromIntro: true });
      }
      return;
    }
    if (this.seatedBench) {
      this.prompt = "E  站起";
      if (this.interactionPressed()) this.standUp();
      return;
    }
    const bench = this.nearestBench(34);
    if (bench) {
      this.prompt = "E  坐下休息";
      if (this.interactionPressed()) {
        this.sitDown(bench);
        return;
      }
    }
    const objective = OBJECTIVES[this.objectiveId];
    const near = this.isNear(objective.target.x, objective.target.y, objective.triggerRadius);
    const snapshot = getSnapshot();
    const doorOpen = snapshot.busState === "doorOpen";
    if (!bench && near && doorOpen && !snapshot.unlockedTips.includes("bus-access")) {
      unlockTip("bus-access");
      this.prompt = "已解锁：帮助盲人乘车";
      gameEvents.emit("tipOpen", { id: "bus-access", fromIntro: false });
      return;
    }
    if (!bench) this.prompt = near ? (doorOpen ? "E  上车" : "请稍等车门开启") : "";
    if (near && doorOpen && this.interactionPressed()) {
      audioDirector.interact();
      patchSnapshot({ busState: transitionBus("doorOpen", "board"), objectiveId: "find-seat", scene: "bus-interior", resumeStage: "bus-interior-entry" });
      gameEvents.emit("chapter", { from: "bus-stop", to: "bus-interior" });
      this.scene.start("bus-interior");
    }
  }

  protected suspendRouteTracking(): boolean {
    return !!this.seatedBench || this.gateIntroState !== "inactive";
  }

  protected controlsLocked(): boolean {
    return !!this.seatedBench || this.gateIntroState !== "inactive" || super.controlsLocked();
  }

  protected playerRenderDepth(): number {
    return this.seatedBench ? this.seatedBench.y + 2 : super.playerRenderDepth();
  }

  private nearestBench(radius: number): { x: number; y: number } | null {
    const map = this.tileMap();
    if (!map) return null;
    return map.decorations
      .filter((decoration) => decoration.kind === "bench")
      .map((bench) => ({ bench, distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, bench.x, bench.y) }))
      .filter((entry) => entry.distance <= radius)
      .sort((a, b) => a.distance - b.distance)[0]?.bench ?? null;
  }

  private sitDown(bench: { x: number; y: number }): void {
    this.standUpPoint = new Phaser.Math.Vector2(this.player.x, this.player.y);
    this.seatedBench = bench;
    this.player.setPosition(bench.x, bench.y - 8);
    this.facing = "down";
    if (this.player.anims.isPlaying) this.player.anims.stop();
    this.player.setTexture("traveler-sit");
    this.caneSprite.setVisible(false);
    audioDirector.interact();
    this.announce("你在长椅上坐下，听雨点敲在站亭顶上。");
  }

  private standUp(): void {
    const back = this.standUpPoint;
    this.seatedBench = null;
    this.standUpPoint = null;
    if (back) this.player.setPosition(back.x, back.y);
    this.player.setTexture("traveler-walk", FACE_FRAME[this.facing]);
    this.caneSprite.setVisible(true);
    audioDirector.interact();
    this.announce("你站起身，握紧盲杖。");
  }

  private startGateIntro(): void {
    this.gateIntroState = "approaching";
    this.player.setPosition(BUS_STOP_GATE_ENTRY.x, BUS_STOP_GATE_ENTRY.y);
    this.facing = "down";
    this.player.setFrame(FACE_FRAME.down);
    this.caneSprite.setVisible(true);
    this.gateHelper = this.add.sprite(476, 164, "npc-spritesheet", 4).setScale(0.16).setFlipX(true).setDepth(165);
    this.announce("你刚走出拱北口岸，在门前停下。一名工作人员从右侧走来。");
    this.tweens.add({
      targets: this.gateHelper,
      x: 364,
      y: 128,
      duration: getSnapshot().settings.reducedMotion ? 1 : 1800,
      ease: "Stepped",
      easeParams: [14],
      onUpdate: () => this.gateHelper?.setDepth((this.gateHelper?.y ?? 128) + 1),
      onComplete: () => {
        if (!this.gateHelper) return;
        this.gateHelper.setFlipX(true);
        this.gateIntroState = "offer";
        this.announce("工作人员：你好，我是口岸工作人员。需要我带你到盲道起点吗？我会先把手臂递给你，并把前方路况说清楚。");
      },
    });
  }

  private finishGateIntro(): void {
    if (this.gateIntroState !== "offer") return;
    patchSnapshot({ mobilityGuideSeen: true });
    this.player.setPosition(this.spawn.x, this.spawn.y);
    this.facing = "right";
    this.player.setTexture("traveler-walk", FACE_FRAME.right);
    this.caneSprite.setVisible(true);
    this.gateHelper?.destroy();
    this.gateHelper = null;
    this.gateIntroState = "inactive";
    this.cameras.main.fadeIn(getSnapshot().settings.reducedMotion ? 1 : 180, 58, 55, 49);
    this.announce("工作人员把你送到盲道起点：前方是四条凸纹，沿线可到17路候车区。你向他道谢，重新握好盲杖。");
  }
}

export class BusInteriorScene extends WalkScene {
  protected sceneId = "bus-interior" as const;
  protected spawn = new Phaser.Math.Vector2(536, 316);
  protected objectiveId = "find-seat";
  private seatConfirmed = false;

  constructor() {
    super("bus-interior");
  }

  protected onSceneReady(): void {
    if (getSnapshot().busState === "doorOpen") patchSnapshot({ busState: "boarding" });
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
      patchSnapshot({ busState: seated, selectedSeatId: "seat-a2", objectiveId: "ride-to-camoes", scene: "bus-ride", resumeStage: "bus-ride" });
      this.announce("你收起盲杖，在座位上坐稳。");
      this.time.delayedCall(520, () => { gameEvents.emit("chapter", { from: "bus-interior", to: "bus-ride" }); this.scene.start("bus-ride"); });
    }
  }
}

export class BusRideScene extends Phaser.Scene {
  private startedAt = 0;
  private ended = false;
  private keys!: { skip: Phaser.Input.Keyboard.Key; pause: Phaser.Input.Keyboard.Key };
  private panorama!: Phaser.GameObjects.TileSprite;
  private scrollAccumulator = 0;
  private shakeAccumulator = 0;
  private shakeOffset = 0;

  constructor() {
    super("bus-ride");
  }

  preload(): void {
    if (!this.textures.exists("bus-window-panorama")) this.load.image("bus-window-panorama", busWindowPanoramaUrl);
  }

  create(): void {
    ensureGroundTextures(this);
    BUS_INTERIOR_TILEMAP.groundRows.forEach((row, rowIndex) => [...row].forEach((char, colIndex) => {
      const key = BUS_INTERIOR_TILEMAP.legend[char] ?? "bus-floor";
      const variant = deterministicTileVariant("bus-ride", colIndex, rowIndex, key);
      this.add.image(colIndex * 16 + 8, rowIndex * 16 + 12, GROUND_TEXTURE[key].base[variant]);
    }));
    this.panorama = this.add.tileSprite(320, 82, 620, 96, "bus-window-panorama").setDepth(80);
    const windowFrame = this.add.graphics().setDepth(82);
    windowFrame.fillStyle(0x302d29, 1);
    windowFrame.fillRect(4, 28, 632, 8);
    windowFrame.fillRect(4, 130, 632, 8);
    windowFrame.fillRect(4, 28, 8, 110);
    windowFrame.fillRect(628, 28, 8, 110);
    [160, 320, 480].forEach((x) => windowFrame.fillRect(x - 3, 34, 6, 96));
    windowFrame.fillStyle(0x8d887e, 0.9);
    windowFrame.fillRect(12, 36, 616, 2);
    [132, 252, 388, 508].forEach((x) => renderMapDecoration(this, { kind: "bus-pole", x, y: 356, width: 10, height: 220, depth: 200 }));
    this.add.rectangle(320, 180, 640, 360, 0x6b6257, 0.06).setDepth(300);
    const state = getSnapshot().busState === "seated" ? transitionBus("seated", "depart") : "riding";
    patchSnapshot({ busState: state as BusTransitState, scene: "bus-ride", objectiveId: "ride-to-camoes" });
    this.keys = {
      skip: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      pause: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };
    this.startedAt = this.time.now;
    gameEvents.emit("scene", "bus-ride");
    audioDirector.enterScene("bus-ride");
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

  update(_time: number, delta: number): void {
    if (!getSnapshot().settings.reducedMotion) {
      this.scrollAccumulator += delta;
      while (this.scrollAccumulator >= 120) {
        this.scrollAccumulator -= 120;
        this.panorama.tilePositionX = Math.round(this.panorama.tilePositionX + 2);
      }
      this.shakeAccumulator += delta;
      if (this.shakeAccumulator >= 240) {
        this.shakeAccumulator %= 240;
        this.shakeOffset = this.shakeOffset ? 0 : 1;
        this.cameras.main.setScroll(0, this.shakeOffset);
      }
    } else if (this.cameras.main.scrollY !== 0) {
      this.cameras.main.setScroll(0, 0);
    }
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
    // Skipping the ride before the 10.5s narration must not cost the memory.
    collectMemory("bus-rain");
    const arrived = transitionBus(getSnapshot().busState, "arrive");
    patchSnapshot({ busState: arrived, scene: "old-city", objectiveId: "follow-old-city-path", resumeStage: "old-city-entry" });
    gameEvents.emit("chapter", { from: "bus-ride", to: "old-city" });
    this.scene.start("old-city");
  }
}

export class OldCityScene extends WalkScene {
  protected sceneId = "old-city" as const;
  protected spawn = new Phaser.Math.Vector2(328, 284);
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

  protected tileMap(): TileMapDefinition | null {
    return OLD_CITY_TILEMAP;
  }

  protected onSceneReady(): void {
    if (getSnapshot().busState === "arrived") patchSnapshot({ busState: transitionBus("arrived", "alight") });
    this.railBase = this.add.graphics().setDepth(12);
    this.railReveal = this.add.graphics().setDepth(15);
    this.drawRail(this.railBase, 0x5f6662, 0.92);
    if (getSnapshot().resumeStage === "old-city-rail") this.railRevealedUntil = this.time.now + 4500;
    this.announce("你在白鸽巢下车。城市是灰色的；用 Space 敲击面前的一根盲杖，触碰过的地方会留下暖色记忆。");
  }

  protected getMovementInput(): Phaser.Math.Vector2 {
    if (!this.railHeld) return super.getMovementInput();
    const amount = Number(this.keys.up.isDown || this.keys.arrowUp.isDown) - Number(this.keys.down.isDown || this.keys.arrowDown.isDown);
    if (!amount) return new Phaser.Math.Vector2();
    const direction = new Phaser.Math.Vector2(
      OLD_CITY_HANDRAIL.end.x - OLD_CITY_HANDRAIL.start.x,
      OLD_CITY_HANDRAIL.end.y - OLD_CITY_HANDRAIL.start.y,
    ).normalize();
    return direction.scale(amount);
  }

  protected requiresBrightGround(): boolean {
    return !this.railHeld;
  }

  protected onGuidedPath(): boolean {
    return this.railHeld || super.onGuidedPath();
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
      setCheckpoint("old-city-rail");
      audioDirector.interact();
      this.announce("你握住右侧扶手。按 W 前进，按 S 后退，按 E 松开。");
      return;
    }

    if (this.railHeld && railProjection.t >= 0.97 && !this.leaving) {
      this.leaving = true;
      this.railHeld = false;
      this.player.setPosition(OLD_CITY_HANDRAIL.end.x, OLD_CITY_HANDRAIL.end.y);
      patchSnapshot({ scene: "old-city-crossing", objectiveId: "request-crossing", resumeStage: "crossing-approach" });
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
  protected spawn = new Phaser.Math.Vector2(136, 316);
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
    if (getSnapshot().resumeStage === "crossing-wait") this.crossingState = "requested";
    if (getSnapshot().resumeStage === "crossing-go") this.crossingState = "walk";
    this.drawSignal();
    if (this.crossingState === "requested") {
      this.announce("通行请求已经记录。请留在路缘，重新等待可通行提示。");
      this.scheduleCrossingWait();
    } else if (this.crossingState === "walk") {
      this.announce("可以通行。沿垂直斑马线直行到对岸，再向右转。");
    } else this.announce("前方是直行路口。沿盲道到点阵处，按 E 请求通行。");
  }

  protected tileMap(): TileMapDefinition | null {
    return CROSSING_TILEMAP;
  }

  protected decisionHint(nodeIndex: number): string {
    const taskId = this.path.nodes[nodeIndex]?.taskId;
    if (taskId === "request-crossing") return "4×4凸点：前方是路缘，可按 E 请求通行";
    if (taskId === "cross-junction") return "4×4凸点：对岸路缘，盲道向前继续";
    if (taskId === "leave-crossing") return "4×4凸点：沿对岸人行道离开路口";
    return super.decisionHint(nodeIndex);
  }

  protected repeatTaskText(): string {
    if (this.crossingState === "requested") return "当前任务：留在点阵砖旁等待；收到文字和双音提示后再前进。";
    if (this.crossingState === "walk") return "当前任务：可以通行。沿垂直斑马线直行到对岸，再向右转。";
    if (this.crossingState === "crossed") return "当前任务：已经抵达对岸，请向右沿盲道离开路口。";
    return "当前任务：向前到点阵砖，按 E 请求通行。斑马线直行通过路口。";
  }

  protected requiresBrightGround(): boolean {
    return this.crossingState === "approach" || this.crossingState === "requested";
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
      setCheckpoint("crossing-wait");
      audioDirector.crossingWait();
      this.announce("通行请求已收到。请留在路缘等候文字和双音提示。");
      this.drawSignal();
      this.scheduleCrossingWait();
      return;
    }

    if (this.crossingState === "walk" && this.isNear(OLD_CITY_CROSSING.farCurb.x, OLD_CITY_CROSSING.farCurb.y, 30)) {
      this.crossingState = transitionCrossing(this.crossingState, "finish");
      this.objectiveId = "leave-crossing";
      patchSnapshot({ objectiveId: "leave-crossing" });
      this.announce("你抵达对岸点阵。向右转，沿人行道盲道离开路口。");
    }

    const exit = OBJECTIVES["leave-crossing"].target;
    if (this.crossingState === "crossed" && this.isNear(exit.x, exit.y, 30) && !this.leaving) {
      this.leaving = true;
      patchSnapshot({ scene: "ruins", objectiveId: "meet-lam", resumeStage: "ruins-entry" });
      this.announce("路口已经在身后。前方盲道通向大三巴牌坊。");
      this.time.delayedCall(650, () => { gameEvents.emit("chapter", { from: "old-city-crossing", to: "ruins" }); this.scene.start("ruins"); });
    }
  }

  private scheduleCrossingWait(): void {
    this.time.delayedCall(OLD_CITY_CROSSING.waitMs, () => {
      if (this.crossingState !== "requested") return;
      this.crossingState = transitionCrossing(this.crossingState, "allow");
      this.objectiveId = "cross-junction";
      setCheckpoint("crossing-go");
      audioDirector.crossingWalk();
      this.announce("可以通行。沿垂直斑马线直行到对岸，再向右转。");
      this.drawSignal();
    });
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
    CROSSING_TILEMAP.groundRows.forEach((row, rowIndex) => [...row].forEach((char, colIndex) => {
      if (char !== "z") return;
      this.guideGraphics.fillRect(colIndex * 16, rowIndex * 16 + CROSSING_TILEMAP.offsetY, 16, 16);
    }));
  }
}

export class RuinsScene extends WalkScene {
  protected sceneId = "ruins" as const;
  protected spawn = new Phaser.Math.Vector2(328, 284);
  protected objectiveId = "meet-lam";
  private finaleStarted = false;
  private finaleFinished = false;
  private finaleGraphics!: Phaser.GameObjects.Graphics;
  private lam!: Phaser.GameObjects.Sprite;
  private finaleStartedAt = 0;
  private finaleWarmProgress = 0;
  private finaleTier = 0;

  constructor() {
    super("ruins");
  }

  protected onSceneReady(): void {
    this.finaleGraphics = this.add.graphics().setDepth(16);
    this.lam = this.add.sprite(232, 108, "lam", 0).setTint(0x9b968d).setDepth(109);
    this.lam.setOrigin(0.5, 1);
    if (!this.anims.exists("lam-finale")) {
      this.anims.create({
        key: "lam-finale",
        frames: this.anims.generateFrameNumbers("lam", { frames: [1, 1, 2, 2] }),
        frameRate: 2,
        repeat: -1,
      });
    }
    if (!getSnapshot().settings.reducedMotion) this.tweens.add({ targets: this.lam, y: 106, duration: 900, yoyo: true, repeat: -1 });
    this.announce("牌坊前的台阶反着灯光。林伯就在盲道尽头等你。");
  }

  protected tileMap(): TileMapDefinition | null {
    return RUINS_TILEMAP;
  }

  protected getMovementInput(): Phaser.Math.Vector2 {
    return this.finaleStarted ? new Phaser.Math.Vector2() : super.getMovementInput();
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
    this.finaleStartedAt = this.time.now;
    this.prompt = "正在回放触碰过的暖色记忆";
    const snapshot = getSnapshot();
    this.finaleTier = snapshot.memories.length;
    const reducedMotion = snapshot.settings.reducedMotion;
    if (reducedMotion) {
      this.lam.setFrame(2);
      this.drawFinaleWave(true);
      this.time.delayedCall(250, () => this.finishFinale());
      return;
    }
    this.lam.play("lam-finale");
    const line = this.finaleTier >= 3
      ? "一路留下的三段记忆同时亮起：道路、石墙、房屋和牌坊都恢复了雨后的暖色。"
      : this.finaleTier === 2
        ? "盲道的暖光爬上石墙与两侧房屋，林伯在台阶前向你挥手。"
        : "盲道、林伯和牌坊先亮了起来，足够照见约定的终点。";
    this.time.delayedCall(850, () => this.announce(line));
    this.time.delayedCall(2100, () => this.finishFinale());
  }

  private drawFinaleWave(full = false): void {
    if (!this.finaleGraphics || !this.lam) return;
    const progress = full ? 1 : Math.min(1, (this.time.now - this.finaleStartedAt) / 1800);
    this.finaleWarmProgress = progress;
    this.finaleGraphics.clear();
    this.finaleGraphics.fillStyle(0xe0bd72, 0.1 + progress * 0.16);
    this.finaleGraphics.fillCircle(this.lam.x, this.lam.y - 24, 18 + progress * 28);
    this.lam.setTint(progress >= 0.35 ? 0xd7a85d : 0x9b968d);
  }

  protected forceWarmForTile(tile: { x: number; y: number; environment: boolean }): boolean {
    if (!this.finaleStarted || this.finaleWarmProgress <= 0) return false;
    const distance = Phaser.Math.Distance.Between(tile.x, tile.y, this.lam?.x ?? 232, this.lam?.y ?? 108);
    const route = PATHS.ruins.nodes.some((node, index, nodes) => index < nodes.length - 1 && pointSegmentDistance(new Phaser.Math.Vector2(tile.x, tile.y), node, nodes[index + 1]) <= 25);
    if (this.finaleTier >= 3) return distance <= this.finaleWarmProgress * 720;
    if (this.finaleTier === 2) return (route || tile.environment) && distance <= this.finaleWarmProgress * 520;
    const facade = tile.environment && tile.y <= 110;
    return (route || facade) && distance <= this.finaleWarmProgress * 360;
  }

  private finishFinale(): void {
    if (this.finaleFinished) return;
    this.finaleFinished = true;
    const snapshot = getSnapshot();
    const elapsedSeconds = getActiveElapsedMs() / 1000;
    const ending = determineEnding({ elapsedSeconds, detourScore: snapshot.detourScore, returnRequested: snapshot.returnRequested });
    finishGame(ending);
    gameEvents.emit("ending", ending);
    this.scene.pause();
  }
}

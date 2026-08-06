import Phaser from "phaser";
import busWindowPanoramaUrl from "../assets/bus-window-panorama-pixel.png";
import travelerWalkUrl from "../assets/traveler-walk.png";
import travelerSitUrl from "../assets/traveler-sit.png";
import travelerSitUpUrl from "../assets/traveler-sit-up.png";
import busPassengerSitUpUrl from "../assets/bus-passenger-sit-up.png";
import busDriverSitUrl from "../assets/bus-driver-sit.png";
import lamWheelchairUrl from "../assets/lam-wheelchair.png";
import lamDaughterPushUrl from "../assets/lam-daughter-push.png";
import npcSpritesheetUrl from "../assets/npc-spritesheet.png";
import { audioDirector } from "./audio";
import { composeRepeatText, OBJECTIVES, OLD_CITY_CROSSING, PATHS, REVEAL_PROFILE, SCENE_LABELS, TACTILE_LIT_MS } from "./content";
import { EGG_TART_BOOST_MS, EGG_TART_STALL, eggTartBoostFactor, isInsideEggTartScentZone } from "./egg-tart";
import { ensureCaneTextures, ensureEggTartVendorTextures, preloadEnvironmentAssets, renderBusBellDecoration, renderMapDecoration, type EnvironmentSprite } from "./environment-art";
import { gameEvents } from "./events";
import { BELL_ANNOUNCEMENT_DELAY_MS, busRideCheckpointAfterBell, constrainCrossingPosition, determineEnding, effectiveWalkSpeed, mergeColorMemory, movementSpeedMultiplier, resumePointForStage, shouldStartWheelchairProcession, transitionBus, transitionCrossing } from "./flow";
import { deterministicTileVariant, ensureGroundTextures, GROUND_TEXTURE, type GroundTileKey, type GroundVisualState } from "./ground-tiles";
import { BUS_BELL_DETECTION_RADIUS, BUS_CARD_READER, BUS_DRIVER_SEAT, BUS_INTERIOR_DOOR, BUS_INTERIOR_TILEMAP, BUS_SEATED_SPRITE_KEYS, BUS_SEAT_SPOTS, isBusBellInRange, pickBusBellSpot, type BusBellSpot, type BusSeatSpot } from "./businterior-map";
import { BUS_STOP_DECOY_SIGNS, BUS_STOP_DOOR, BUS_STOP_GATE_ENTRY, BUS_STOP_PATH_START, BUS_STOP_SIGN, BUS_STOP_SIGN_PROBE_RADIUS, BUS_STOP_TILEMAP } from "./busstop-map";
import { isInsideVerticalInteractionZone, MAP_TILE_SIZE, OLD_CITY_MEMORY_POINT, OLD_CITY_TILEMAP, PET_SHOP_INTERACTION_ZONE, SHOP_SIGNS } from "./oldcity-map";
import { NPC_DEFINITIONS, type NpcDefinition, type NpcDialogue } from "./npcs";
import { RUINS_DAUGHTER_END, RUINS_DAUGHTER_START, RUINS_LAM_END, RUINS_LAM_START, RUINS_PLAYER_END, RUINS_PLAYER_START, RUINS_PROCESSION_DURATION_MS, RUINS_TILEMAP, ruinsProcessionPositions } from "./ruins-map";
import { JOURNEY_GOAL } from "./journey";
import { listeningReport, nearbySoundLandmarks, type SoundLandmark } from "./sound-landmarks";
import { collectMemory, discoverLandmark, finishGame, getActiveElapsedMs, getSnapshot, patchSnapshot, recordNpcChoice, setCheckpoint, unlockTip } from "./store";
import { ensureTactileTextures, TACTILE_TEXTURE } from "./tactile-layer";
import { describeDecisionBrick, rasterizeTactilePath, type TactileBrick } from "./tactile-tiles";
import { isWalkable, movementUnderPoint, nearestSafeWalkablePoint, solidDecorationAt, tileUnderPoint, type MapDecoration, type TileMapDefinition } from "./tilemap";
import type { BusRideLandmarkId, BusTransitState, CaneSurfaceKind, ColorMemoryPoint, CrossingState, GameTextState, HudState, KnownLandmarkId, RouteChoice, SceneId, TactilePathDefinition, TactilePathNode, TilePoint } from "./types";

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
  if (kind === "bus-driver-seat") return "司机座位：前方是驾驶区，请绕行";
  if (kind === "bus-seat-row") return "座椅边缘：实心座位，请绕行";
  if (kind === "bus-rail") return "扶杆：金属立柱，请绕行";
  if (kind === "ramp-rail") return "坡道护栏：金属边界，请沿中央坡道前进";
  if (kind === "stop-sign-17" || kind === "stop-sign-25") return "站牌立柱：金属立杆，牌面在上方";
  if (kind === "egg-tart-stall") return "木制蛋挞摊车：暖烘烘的炉门与盛放蛋挞的托盘";
  return "实心障碍物：请绕行";
}

abstract class WalkScene extends Phaser.Scene {
  protected abstract sceneId: Exclude<SceneId, "bus-ride">;
  protected abstract spawn: Phaser.Math.Vector2;
  protected abstract objectiveId: string;
  protected player!: Phaser.GameObjects.Sprite;
  protected revealGraphics!: Phaser.GameObjects.Graphics;
  protected caneSprite!: Phaser.GameObjects.Image;
  protected path: TactilePathDefinition | null = null;
  protected facing: Facing = "up";
  protected revealMode: RevealMode = null;
  protected revealUntil = 0;
  protected hintCooldownUntil = 0;
  protected keys!: Record<string, Phaser.Input.Keyboard.Key>;
  protected prompt = "";
  protected subtitle = "";
  protected trackDetours = true;
  protected contact = "尚未触碰到物体";
  private contactHistory: string[] = [];
  private flashCooldownUntil = 0;
  private flashUntil = 0;
  private listenCooldownUntil = 0;
  private listeningUntil = 0;
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
  private lastCooldownFeedbackAt = -1000;
  private roadEnteredAt = 0;
  private roadWarnedAt = -2000;
  private roadReturning = false;
  private roadIncidentRecorded = false;
  private devInteractRequested = false;
  private devTapRequested = false;
  private devListenRequested = false;
  private cleanupDevEvents: Array<() => void> = [];
  private npcSprites: Array<{ definition: NpcDefinition; sprite: Phaser.GameObjects.Sprite; textures?: Record<GroundVisualState, string>; warmUntil: number }> = [];
  private activeDialogue: NpcDialogue | null = null;
  private recentEvidence: Array<{ id: string; label: string; expiresAt: number }> = [];
  private currentSoundLandmarks: Array<SoundLandmark & { distance: number; direction: string }> = [];
  private movementSurface: GameTextState["movementSurface"] = "stationary";
  private movementMultiplier = 1;
  private eggTartRemainingMs = 0;
  private lastPersistedBoostSecond = -1;

  preload(): void {
    preloadEnvironmentAssets(this);
    if (!this.textures.exists("traveler-walk")) {
      this.load.spritesheet("traveler-walk", travelerWalkUrl, { frameWidth: 64, frameHeight: 64 });
    }
    if (!this.textures.exists("traveler-sit")) {
      this.load.image("traveler-sit", travelerSitUrl);
    }
    if (!this.textures.exists(BUS_SEATED_SPRITE_KEYS.lower)) {
      this.load.image(BUS_SEATED_SPRITE_KEYS.lower, travelerSitUpUrl);
    }
    if (!this.textures.exists("bus-passenger-sit-up")) {
      this.load.image("bus-passenger-sit-up", busPassengerSitUpUrl);
    }
    if (!this.textures.exists("bus-driver-sit")) {
      this.load.image("bus-driver-sit", busDriverSitUrl);
    }
    if (!this.textures.exists("npc-spritesheet")) {
      this.load.spritesheet("npc-spritesheet", npcSpritesheetUrl, { frameWidth: 362, frameHeight: 362 });
    }
    if (!this.textures.exists("lam-wheelchair")) {
      this.load.spritesheet("lam-wheelchair", lamWheelchairUrl, { frameWidth: 64, frameHeight: 64 });
    }
    if (!this.textures.exists("lam-daughter-push")) {
      this.load.spritesheet("lam-daughter-push", lamDaughterPushUrl, { frameWidth: 64, frameHeight: 64 });
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
    this.eggTartRemainingMs = snapshot.eggTartBoostRemainingMs;
    this.lastPersistedBoostSecond = Math.ceil(this.eggTartRemainingMs / 1000);
    if (snapshot.scene === this.sceneId && OBJECTIVES[snapshot.objectiveId]?.scene === this.sceneId) this.objectiveId = snapshot.objectiveId;
    this.path = this.sceneId === "bus-interior" ? null : PATHS[this.sceneId];
    ensureTactileTextures(this);
    this.tactileBricks = this.path ? rasterizeTactilePath(this.path) : [];
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
      listen: Phaser.Input.Keyboard.KeyCodes.R,
      pause: Phaser.Input.Keyboard.KeyCodes.ESC,
      arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
      arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
      arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
      arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard?.addCapture(["SPACE", "Q", "E", "G", "R", "H", "UP", "DOWN", "LEFT", "RIGHT"]);
    const offDialogueChoice = gameEvents.on("npcDialogueChoice", ({ npcId, optionId }) => {
      if (!this.activeDialogue || this.activeDialogue.npcId !== npcId) return;
      const dialogue = this.activeDialogue;
      const option = dialogue.options.find((candidate) => candidate.id === optionId) ?? dialogue.options[dialogue.options.length - 1];
      this.activeDialogue = null;
      recordNpcChoice(npcId, optionId);
      if (option?.response) this.announce(option.response);
      this.onNpcDialogueChoice(npcId, optionId);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offDialogueChoice);
    this.events.once(Phaser.Scenes.Events.DESTROY, offDialogueChoice);
    const persistBoost = () => {
      if (Math.round(getSnapshot().eggTartBoostRemainingMs) !== Math.round(this.eggTartRemainingMs)) patchSnapshot({ eggTartBoostRemainingMs: Math.max(0, this.eggTartRemainingMs) });
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, persistBoost);
    this.events.once(Phaser.Scenes.Events.DESTROY, persistBoost);
    if (import.meta.env.DEV) {
      this.cleanupDevEvents.push(gameEvents.on("devTeleport", (point) => {
        this.player.setPosition(point.x, point.y);
        this.revealMode = "hint";
        this.revealUntil = this.time.now + 5000;
        this.onHint(this.time.now);
      }));
      this.cleanupDevEvents.push(gameEvents.on("devInteract", () => { this.devInteractRequested = true; }));
      this.cleanupDevEvents.push(gameEvents.on("devTap", () => { this.devTapRequested = true; }));
      this.cleanupDevEvents.push(gameEvents.on("devListen", () => { this.devListenRequested = true; }));
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

  protected onPlayerPositionUpdate(_time: number): void {}

  protected onListen(_landmarks: Array<SoundLandmark & { distance: number; direction: string }>, _time: number): void {}

  protected insideEggTartScentZone(): boolean { return false; }

  protected addEvidence(id: string, label: string, time = this.time.now): void {
    this.recentEvidence = [{ id, label, expiresAt: time + 8000 }, ...this.recentEvidence.filter((entry) => entry.id !== id && entry.expiresAt > time)].slice(0, 6);
  }

  protected hasEvidence(id: string, time = this.time.now): boolean {
    return this.recentEvidence.some((entry) => entry.id === id && entry.expiresAt > time);
  }

  protected activateEggTartBoost(): void {
    if (getSnapshot().eggTartPurchased) return;
    this.eggTartRemainingMs = EGG_TART_BOOST_MS;
    this.lastPersistedBoostSecond = 60;
    patchSnapshot({ eggTartPurchased: true, eggTartBoostRemainingMs: EGG_TART_BOOST_MS });
  }

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

  protected registerEnvironmentSprite(rendered: EnvironmentSprite): void {
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
    if (this.activeDialogue) {
      this.updateCane(time, delta);
      this.updateReveal(time);
      this.updateGroundColors();
      this.updateNpcColors(time);
      this.player.setDepth(this.playerRenderDepth());
      this.emitHud();
      return;
    }
    this.recentEvidence = this.recentEvidence.filter((entry) => entry.expiresAt > time);
    this.updateEggTartBoost(delta);
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
    this.updateNpcColors(time);
    this.handleActions(time);
    this.checkRoute(time);
    if (this.tryNpcInteraction()) {
      this.emitHud();
      return;
    }
    this.updateInteraction(time);
    const nearbyNpc = this.nearestNpc(new Phaser.Math.Vector2(this.player.x, this.player.y), 34);
    if (nearbyNpc && !this.prompt) this.prompt = `E  与${nearbyNpc.definition.idleLabel}交谈`;
    this.onPlayerPositionUpdate(time);
    this.player.setDepth(this.playerRenderDepth());
    this.caneSprite.setDepth(this.facing === "up" ? this.player.y - 1 : this.player.y + 3);
    this.npcSprites.forEach(({ sprite, textures }) => sprite.setDepth(textures ? 260 : sprite.y + 1));
    this.emitHud();
  }

  private updateEggTartBoost(delta: number): void {
    if (this.eggTartRemainingMs <= 0 || this.boostClockFrozen()) return;
    this.eggTartRemainingMs = Math.max(0, this.eggTartRemainingMs - Math.max(0, delta));
    const second = Math.ceil(this.eggTartRemainingMs / 1000);
    if (second === this.lastPersistedBoostSecond) return;
    this.lastPersistedBoostSecond = second;
    patchSnapshot({ eggTartBoostRemainingMs: this.eggTartRemainingMs });
    if (this.eggTartRemainingMs <= 0) this.announce("蛋挞的余温渐渐散去，你的脚步恢复了原来的速度。");
  }

  protected abstract updateInteraction(time: number): void;

  /**
   * The bonus counts down whenever the player is actively in control, including
   * deliberate listening/flash actions. Dialogue pauses the clock; Phaser scene
   * pauses and non-walking cutscenes do not call this update at all.
   */
  protected boostClockFrozen(): boolean {
    return !!this.activeDialogue;
  }

  protected playerRenderDepth(): number {
    return this.player.y + 1;
  }

  protected isNear(x: number, y: number, radius: number): boolean {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) <= radius;
  }

  protected isNearObjective(objectiveId = this.objectiveId): boolean {
    const objective = OBJECTIVES[objectiveId];
    return this.isNear(objective.target.x, objective.target.y, objective.triggerRadius);
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
    if (this.npcSprites.some(({ sprite }) => Phaser.Math.Distance.Between(bounded.x, bounded.y, sprite.x, sprite.y) < 13)) return _current.clone();
    if (this.requiresBrightGround() && !this.isBrightGround(bounded)) {
      this.onDarkGroundBlocked();
      return _current.clone();
    }
    return bounded;
  }

  /** Whether this scene only allows stepping onto brightly lit (warm) ground. */
  protected requiresBrightGround(): boolean {
    return this.tileMap()?.requiresBrightGround ?? true;
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
    return this.time.now < this.flashUntil || this.time.now < this.listeningUntil || !!this.activeDialogue;
  }

  /** Night mode: fully black city, short-lived cane light, no persistent color memory. */
  protected isNightMode(): boolean {
    return getSnapshot().settings.gameMode === "night";
  }

  protected repeatTaskText(): string {
    return `当前任务：${this.objectiveLabel()}`;
  }

  protected objectiveLabel(): string {
    return OBJECTIVES[this.objectiveId].label;
  }

  protected onTap(_time: number): void {}

  protected onHint(_time: number): void {}

  protected onSurfaceContact(_surface: CaneSurface, _time: number): void {}

  protected onNpcDialogueChoice(_npcId: string, _optionId: string): void {}

  protected openNpcDialogue(dialogue: NpcDialogue): void {
    if (this.activeDialogue) return;
    this.activeDialogue = dialogue;
    this.prompt = "选择回应";
    audioDirector.speak(dialogue.prompt);
    gameEvents.emit("npcDialogueOpen", dialogue);
  }

  protected detectSceneSurface(_tip: Phaser.Math.Vector2): CaneSurface | null {
    const npc = this.nearestNpc(_tip, 24);
    if (npc) return { kind: "person", label: `${npc.definition.idleLabel}：按 E 交谈`, point: new Phaser.Math.Vector2(npc.sprite.x, npc.sprite.y) };
    return null;
  }

  private renderNpcs(): void {
    NPC_DEFINITIONS.filter((definition) => definition.scene === this.sceneId).forEach((definition) => {
      const textures = definition.visual === "egg-tart" ? ensureEggTartVendorTextures(this) : undefined;
      const sprite = textures
        ? this.add.sprite(definition.x, definition.y, textures.base)
        : this.add.sprite(definition.x, definition.y, "npc-spritesheet", definition.frame);
      sprite.setOrigin(0.5, 1).setDisplaySize(64, 64).setDepth(textures ? 260 : definition.y + 1);
      if (!textures) sprite.setTint(0x8b8882);
      if (!getSnapshot().settings.reducedMotion) {
        const patrol = definition.patrol;
        this.tweens.add({
          targets: sprite,
          x: patrol?.axis === "x" ? definition.x + patrol.distance : definition.x,
          y: patrol?.axis === "y" ? definition.y + patrol.distance : definition.y - 2,
          duration: patrol?.durationMs ?? 760,
          ease: "Sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      }
      this.npcSprites.push({ definition, sprite, textures, warmUntil: 0 });
    });
  }

  private updateNpcColors(time: number): void {
    const night = this.isNightMode();
    const flashed = time < this.flashUntil;
    this.npcSprites.forEach((entry) => {
      const pulsed = this.colorPulses.some((pulse) => Phaser.Math.Distance.Between(entry.sprite.x, entry.sprite.y, pulse.x, pulse.y) <= pulse.radius);
      const lit = flashed || pulsed || time < entry.warmUntil;
      if (entry.textures) {
        const texture = lit ? entry.textures.warm : night ? entry.textures.base : entry.textures.memory;
        if (entry.sprite.texture.key !== texture) entry.sprite.setTexture(texture);
        if (night && !lit) entry.sprite.setTint(0x000000);
        else if (entry.sprite.isTinted) entry.sprite.clearTint();
        return;
      }
      const tint = lit ? entry.definition.tint : night ? 0x000000 : 0x8b8882;
      if (!entry.sprite.isTinted || entry.sprite.tintTopLeft !== tint) entry.sprite.setTint(tint);
    });
  }

  protected nearestNpc(point: Phaser.Math.Vector2, radius: number): { definition: NpcDefinition; sprite: Phaser.GameObjects.Sprite } | null {
    return this.npcSprites
      .map((entry) => ({ entry, distance: Phaser.Math.Distance.Between(point.x, point.y, entry.sprite.x, entry.sprite.y) }))
      .filter((entry) => entry.distance <= radius)
      .sort((a, b) => a.distance - b.distance)[0]?.entry ?? null;
  }

  private tryNpcInteraction(): boolean {
    if (this.activeDialogue) return true;
    const near = this.nearestNpc(new Phaser.Math.Vector2(this.player.x, this.player.y), 34);
    if (!near || !this.interactionPressed()) return false;
    const entry = this.npcSprites.find((candidate) => candidate.definition.id === near.definition.id);
    if (entry) entry.warmUntil = this.time.now + TACTILE_LIT_MS;
    const target = OBJECTIVES[this.objectiveId].target;
    audioDirector.interact();
    this.openNpcDialogue(near.definition.dialogue({
      objectiveId: this.objectiveId,
      player: { x: this.player.x, y: this.player.y },
      objectiveTarget: target,
      eggTartPurchased: getSnapshot().eggTartPurchased,
    }));
    return true;
  }

  private updateMovement(time: number, delta: number): void {
    if (this.roadReturning || this.controlsLocked()) return;
    const map = this.tileMap();
    const onRoad = map ? movementUnderPoint(map, { x: this.player.x, y: this.player.y }) === "road" : false;
    const guided = this.onGuidedPath();
    const terrainMultiplier = movementSpeedMultiplier({ onRoad, hasPath: !!this.path, onGuidedPath: guided });
    const boostMultiplier = eggTartBoostFactor(this.eggTartRemainingMs);
    this.movementMultiplier = terrainMultiplier * boostMultiplier;
    this.movementSurface = !this.path ? "pathless" : onRoad ? "road" : guided ? "tactile" : "off-path";
    const input = this.getMovementInput();
    if (!input.lengthSq()) {
      if (this.player.anims.isPlaying) this.player.anims.stop();
      this.player.setFrame(FACE_FRAME[this.facing]);
      this.updateRoadBoundary(time);
      return;
    }
    input.normalize();
    const x = input.x;
    const y = input.y;
    const speed = effectiveWalkSpeed(terrainMultiplier, boostMultiplier);
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
      this.roadIncidentRecorded = false;
      audioDirector.setTrafficDanger(false);
      return;
    }
    audioDirector.setTrafficDanger(true);
    if (!this.roadEnteredAt) this.roadEnteredAt = time;
    if (time - this.roadEnteredAt < 400 || this.roadReturning) return;
    if (!this.roadIncidentRecorded) {
      this.roadIncidentRecorded = true;
      patchSnapshot({ detourScore: getSnapshot().detourScore + 1 });
    }
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
    const tapRequested = this.devTapRequested || Phaser.Input.Keyboard.JustDown(this.keys.tap);
    this.devTapRequested = false;
    if (tapRequested && !this.controlsLocked() && time - this.lastTapAt >= 220) {
      this.lastTapAt = time;
      this.revealMode = "tap";
      this.revealUntil = time + 180;
      this.tapExtensionUntil = time + 180;
      this.performCaneContact(time);
      this.onTap(time);
      this.player.setAngle(this.facing === "left" ? -4 : 4);
      this.time.delayedCall(140, () => this.player.setAngle(0));
    }
    const listenRequested = this.devListenRequested || Phaser.Input.Keyboard.JustDown(this.keys.listen);
    this.devListenRequested = false;
    if (listenRequested) {
      if (time < this.flashUntil) {
        this.announce("手机闪光仍亮着，等光线收起后再驻足聆听。");
      } else if (time >= this.listenCooldownUntil) {
        this.listeningUntil = time + 1200;
        this.listenCooldownUntil = time + 2000;
        this.performListen(time);
      } else {
        this.reportCooldown("驻足聆听", this.listenCooldownUntil - time, time);
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.hint)) {
      if (time >= this.hintCooldownUntil) {
        this.revealMode = "hint";
        this.revealUntil = time + REVEAL_PROFILE.hintDurationMs;
        this.hintCooldownUntil = time + REVEAL_PROFILE.hintCooldownMs;
        audioDirector.hint();
        this.onHint(time);
        this.announce(`方向提示：目标在${this.directionToObjective()}。${OBJECTIVES[this.objectiveId].label}`);
      } else {
        this.reportCooldown("方向提示", this.hintCooldownUntil - time, time);
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.flash)) {
      if (time >= this.flashCooldownUntil) {
        this.flashCooldownUntil = time + 8000;
        this.performFlash(time);
      } else {
        this.reportCooldown("照亮四周", this.flashCooldownUntil - time, time);
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.repeat)) {
      const text = composeRepeatText(this.contact, this.repeatTaskText(), JOURNEY_GOAL);
      this.announce(text);
    }
  }

  private performListen(time: number): void {
    this.currentSoundLandmarks = nearbySoundLandmarks(this.sceneId, { x: this.player.x, y: this.player.y }, this.facing);
    this.currentSoundLandmarks.forEach((landmark, index) => {
      discoverLandmark(landmark.id);
      this.addEvidence(`sound:${landmark.id}`, landmark.label, time);
      const pan = landmark.direction === "左侧" ? -0.72 : landmark.direction === "右侧" ? 0.72 : 0;
      this.time.delayedCall(index * 210, () => audioDirector.listenCue(landmark.tone, pan));
    });
    this.announce(listeningReport(this.currentSoundLandmarks));
    // Scene-specific combination feedback is more actionable than the generic
    // report and must remain visible instead of being overwritten immediately.
    this.onListen(this.currentSoundLandmarks, time);
  }

  private reportCooldown(action: string, remainingMs: number, time: number): void {
    if (time - this.lastCooldownFeedbackAt < 450) return;
    this.lastCooldownFeedbackAt = time;
    audioDirector.cooldown();
    this.announce(`${action}仍在冷却，约 ${Math.max(1, Math.ceil(remainingMs / 1000))} 秒后可用。`);
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
    if (time < this.listeningUntil) {
      const progress = 1 - (this.listeningUntil - time) / 1200;
      this.revealGraphics.lineStyle(1, 0xd9b45b, 0.48 * (1 - progress));
      this.revealGraphics.strokeCircle(this.player.x, this.player.y - 20, 18 + progress * 70);
      if (progress > 0.28) this.revealGraphics.strokeCircle(this.player.x, this.player.y - 20, 10 + (progress - 0.28) * 54);
    }
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
    return this.path ? describeDecisionBrick(this.path, nodeIndex) : "前方需要继续摸索";
  }

  protected objectiveTarget(): TilePoint {
    return OBJECTIVES[this.objectiveId].target;
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
    this.addEvidence(`touch:${surface.kind}`, surface.label, time);
    this.contactHistory = [surface.label, ...this.contactHistory.filter((entry) => entry !== surface.label)].slice(0, 3);
    if (surface.kind === "person") {
      const npc = this.nearestNpc(surface.point, 28);
      const entry = npc && this.npcSprites.find((candidate) => candidate.definition.id === npc.definition.id);
      if (entry) entry.warmUntil = time + TACTILE_LIT_MS;
    }
    const sound = surface.kind === "guidance" || surface.kind === "decision"
      ? "tactile"
      : surface.kind === "seat"
        ? "fabric"
      : surface.kind === "metal" || surface.kind === "sign" || surface.kind === "door" || surface.kind === "card-reader" || surface.kind === "bell"
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
    if (!this.path) {
      const map = this.tileMap();
      const solid = map ? solidDecorationAt(map, tip) : null;
      if (solid) return { kind: "obstacle", label: solidSurfaceLabel(solid.kind), point: tip };
      const tile = map ? tileUnderPoint(map, tip) : null;
      if (tile === "bus-seat") return { kind: "seat", label: "座位边缘：先确认软垫与金属框", point: tip };
      if (tile === "metal-floor") return { kind: "metal", label: "车厢金属地面：材质冰凉而平整", point: tip };
      if (tile === "wall" || tile === "building" || tile === "fence" || tile === "bush") return { kind: "obstacle", label: "前方是车厢结构：请停下并绕行", point: tip };
      return { kind: "stone", label: tile === "bus-floor" ? "车厢地面：没有连续凸纹" : "普通车厢材质", point: tip };
    }
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
    if (tile === "zebra") return { kind: "stone", label: "斑马线涂装：过街区，请沿信号提示直行", point: tip };
    if (tile === "asphalt" || tile === "lane") return { kind: "stone", label: "粗糙沥青：前方是机动车道", point: tip };
    if (tile === "drain" || tile === "manhole") return { kind: "metal", label: "排水金属纹：靠近路缘，请留意车流", point: tip };
    return { kind: "stone", label: tile === "concrete" || tile === "sidewalk" ? "人行道铺面：没有连续凸纹" : "普通石板：没有连续凸纹", point: tip };
  }

  private drawDirectionArrow(): void {
    const target = this.objectiveTarget();
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
    const target = this.objectiveTarget();
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const horizontal = Math.abs(dx) > 24 ? (dx > 0 ? "右" : "左") : "";
    const vertical = Math.abs(dy) > 24 ? (dy > 0 ? "下" : "上") : "";
    const direction = `${vertical}${horizontal}`;
    return direction ? `${direction}方` : "附近";
  }

  private distanceToRoute(): number {
    if (!this.path) return Number.POSITIVE_INFINITY;
    const point = new Phaser.Math.Vector2(this.player.x, this.player.y);
    let distance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < this.path.nodes.length - 1; index += 1) {
      if (this.path.nodes[index + 1].breakBefore) continue;
      distance = Math.min(distance, pointSegmentDistance(point, this.path.nodes[index], this.path.nodes[index + 1]));
    }
    return distance;
  }

  protected checkRoute(time: number): void {
    if (!this.trackDetours || !this.path || this.suspendRouteTracking()) return;
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
      this.announce("脚下没有凸纹。这里可以安全探索；按 Q 可确认目标方向，回到盲道会走得更快。");
      this.wasOnRoute = false;
    }
  }

  private emitHud(): void {
    const snapshot = getSnapshot();
    const state: HudState = {
      objective: this.objectiveLabel(),
      journeyGoal: JOURNEY_GOAL,
      subtitle: this.subtitle,
      prompt: this.prompt,
      memories: snapshot.memories.length,
      detours: snapshot.detourScore,
      sceneLabel: SCENE_LABELS[this.sceneId],
      hintCooling: this.time.now < this.hintCooldownUntil,
      flashCooling: this.time.now < this.flashCooldownUntil,
      listenCooling: this.time.now < this.listenCooldownUntil,
      listening: this.time.now < this.listeningUntil,
      knownLandmarks: snapshot.knownLandmarks,
      routeChoice: snapshot.routeChoice,
      eggTartBoostRemainingMs: Math.max(0, Math.round(this.eggTartRemainingMs)),
      contact: this.contact,
      contactHistory: this.contactHistory,
    };
    const serialized = JSON.stringify(state);
    if (serialized !== this.previousHud) {
      this.previousHud = serialized;
      gameEvents.emit("hud", state);
    }
  }

  public renderGameToText(): GameTextState {
    const target = this.objectiveTarget();
    const snapshot = getSnapshot();
    const nearby = nearbySoundLandmarks(this.sceneId, { x: this.player.x, y: this.player.y }, this.facing);
    return {
      coordinateSystem: "origin top-left; x right; y down; canvas 640x360",
      mode: this.activeDialogue ? "dialogue" : this.scene.isPaused() ? "paused" : "playing",
      gameMode: snapshot.settings.gameMode,
      scene: this.sceneId,
      journeyGoal: JOURNEY_GOAL,
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y), facing: this.facing },
      objective: { id: this.objectiveId, label: this.objectiveLabel(), target: { x: target.x, y: target.y } },
      prompt: this.prompt,
      subtitle: this.subtitle,
      contact: this.contact,
      npcs: this.npcSprites.map(({ definition }) => ({
        id: definition.id,
        label: definition.idleLabel,
        x: Math.round(this.npcSprites.find((entry) => entry.definition.id === definition.id)?.sprite.x ?? definition.x),
        y: Math.round(this.npcSprites.find((entry) => entry.definition.id === definition.id)?.sprite.y ?? definition.y),
        distance: Math.round(Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npcSprites.find((entry) => entry.definition.id === definition.id)?.sprite.x ?? definition.x, this.npcSprites.find((entry) => entry.definition.id === definition.id)?.sprite.y ?? definition.y)),
      })),
      nearbySoundLandmarks: nearby.map(({ id, label, direction, distance }) => ({ id, label, direction, distance })),
      recentEvidence: this.recentEvidence.filter((entry) => entry.expiresAt > this.time.now).map((entry) => entry.label),
      knownLandmarks: snapshot.knownLandmarks,
      routeChoice: snapshot.routeChoice,
      openingReply: snapshot.openingReply,
      movementSurface: this.movementSurface,
      movementSpeedMultiplier: Number(this.movementMultiplier.toFixed(3)),
      eggTartPurchased: snapshot.eggTartPurchased,
      eggTartBoostRemainingMs: Math.max(0, Math.round(this.eggTartRemainingMs)),
      insideEggTartScentZone: this.insideEggTartScentZone(),
      eggTartScentPrompted: snapshot.eggTartScentPrompted,
      cooldowns: {
        hintMs: Math.max(0, Math.round(this.hintCooldownUntil - this.time.now)),
        flashMs: Math.max(0, Math.round(this.flashCooldownUntil - this.time.now)),
        listenMs: Math.max(0, Math.round(this.listenCooldownUntil - this.time.now)),
      },
      flags: { controlsLocked: this.controlsLocked(), dialogueOpen: !!this.activeDialogue, listening: this.time.now < this.listeningUntil, ending: snapshot.ending },
    };
  }
}

export class BusStopScene extends WalkScene {
  protected sceneId = "bus-stop" as const;
  protected spawn = new Phaser.Math.Vector2(BUS_STOP_PATH_START.x, BUS_STOP_PATH_START.y);
  protected objectiveId = "find-stop-sign";
  private signConfirmed = false;
  private signTouched = false;
  private routeEngineHeard = false;
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
      if (tip.source === "intro" && tip.id === "sighted-guide") this.finishGateIntro();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, closeTip);
    this.events.once(Phaser.Scenes.Events.DESTROY, closeTip);
    if (snapshot.objectiveId === "board-17") {
      this.signConfirmed = true;
      this.signTouched = true;
      this.routeEngineHeard = true;
    }
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
    this.signTouched = true;
    this.addEvidence("stop:sign-17", "手杖确认站牌凸字「17」");
    this.announce(this.routeEngineHeard
      ? "凸字17与右前方的巴士引擎声相互印证：这就是要乘坐的17路。"
      : "手杖确认了凸字17。再按 R 听辨附近车辆声音，确认对应的车门。");
    this.tryConfirmStop();
  }

  protected onListen(landmarks: Array<SoundLandmark & { distance: number; direction: string }>): void {
    if (!landmarks.some((landmark) => landmark.id === "route-17-engine") || this.signConfirmed) return;
    this.routeEngineHeard = true;
    this.addEvidence("stop:engine-17", "听见17路巴士低沉的引擎声");
    this.tryConfirmStop();
  }

  private tryConfirmStop(): void {
    if (this.signConfirmed || !this.signTouched || !this.routeEngineHeard) return;
    this.signConfirmed = true;
    this.objectiveId = "board-17";
    collectMemory("border-hand");
    setCheckpoint("bus-stop-sign");
    audioDirector.interact();
    this.announce("组合确认完成：凸字17、对应引擎声与车门方向一致。现在沿盲道向右前方到车门。");
    this.time.delayedCall(1100, () => {
      if (getSnapshot().busState !== "waiting") return;
      patchSnapshot({ busState: transitionBus(getSnapshot().busState, "openDoor") });
      audioDirector.door();
      this.announce("17路车门已开。靠近车门后按 E 上车。");
    });
  }

  protected decisionHint(nodeIndex: number): string {
    if (this.path?.nodes[nodeIndex]?.taskId === "board-17") return "4×4凸点：17路车门在右前方，靠近后按 E";
    return super.decisionHint(nodeIndex);
  }

  protected updateInteraction(): void {
    if (this.gateIntroState !== "inactive") {
      this.prompt = this.gateIntroState === "offer" ? "E  查看扶盲说明" : "";
      if (this.gateIntroState === "offer" && this.interactionPressed()) {
        this.openNpcDialogue({
          npcId: "gate-helper",
          speaker: "口岸工作人员",
          prompt: "需要我带你到盲道起点吗？我会先把手臂递给你，再把前方路况说清楚。",
          options: [
            { id: "accept", label: "好，请先告诉我正确的扶盲方式。", response: "工作人员说：当然。是否接受协助由你决定，我们先看三个要点。" },
            { id: "directions", label: "请只告诉我盲道起点的位置。", response: "工作人员说：可以。起点在你右前方，我会用声音陪你走到旁边，不碰你的身体。" },
            { id: "decline", label: "谢谢，我想自己找到起点。", response: "工作人员说：好的。我退到右侧，把盲道起点方向说给你听。" },
          ],
        });
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
    const near = this.isNearObjective();
    const snapshot = getSnapshot();
    const doorOpen = snapshot.busState === "doorOpen";
    if (!bench && near && doorOpen && !snapshot.unlockedTips.includes("bus-access")) {
      unlockTip("bus-access");
      this.prompt = "已解锁：帮助盲人乘车";
      gameEvents.emit("tipOpen", { id: "bus-access", source: "bus-door" });
      return;
    }
    if (!bench) this.prompt = near ? (doorOpen ? "E  上车" : "请稍等车门开启") : "";
    if (near && doorOpen && this.interactionPressed()) {
      audioDirector.interact();
      patchSnapshot({ busState: transitionBus("doorOpen", "board"), objectiveId: "find-card-reader", scene: "bus-interior", resumeStage: "bus-interior-entry" });
      gameEvents.emit("chapter", { from: "bus-stop", to: "bus-interior" });
      this.scene.start("bus-interior");
    }
  }

  protected suspendRouteTracking(): boolean {
    return !!this.seatedBench || this.gateIntroState !== "inactive";
  }

  protected objectiveLabel(): string {
    if (this.gateIntroState === "approaching") return "等待工作人员走近并说明来意";
    if (this.gateIntroState === "offer") return "按 E 回应工作人员的引导询问";
    return super.objectiveLabel();
  }

  protected repeatTaskText(): string {
    if (this.gateIntroState !== "inactive") return `当前任务：${this.objectiveLabel()}`;
    return super.repeatTaskText();
  }

  protected onNpcDialogueChoice(npcId: string, optionId: string): void {
    if (npcId !== "gate-helper") return;
    if (optionId === "accept") {
      unlockTip("sighted-guide");
      gameEvents.emit("tipOpen", { id: "sighted-guide", source: "intro" });
      return;
    }
    this.time.delayedCall(650, () => this.finishGateIntro());
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
    this.gateHelper = this.add.sprite(476, 164, "npc-spritesheet", 4)
      .setOrigin(0.5, 1)
      .setDisplaySize(64, 64)
      .setFlipX(true)
      .setTint(this.isNightMode() ? 0x000000 : 0x8b8882)
      .setDepth(165);
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
        this.gateHelper.setTint(0xb78a62);
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
  protected spawn = new Phaser.Math.Vector2(BUS_INTERIOR_DOOR.x, BUS_INTERIOR_DOOR.y);
  protected objectiveId = "find-card-reader";
  protected trackDetours = false;
  private cardConfirmed = false;
  private cardContacted = false;
  private cardReaderHeard = false;
  private seatConfirmed = false;
  private bellConfirmed = false;
  private bellReady = false;
  private bellPressed = false;
  private activeBellSpot: BusBellSpot | null = null;
  private activeSeatSpot: BusSeatSpot | null = null;
  private transitioningAfterBell = false;
  private passengerSprites = new Map<string, Phaser.GameObjects.Image>();

  constructor() {
    super("bus-interior");
  }

  protected onSceneReady(): void {
    if (getSnapshot().busState === "doorOpen") patchSnapshot({ busState: "boarding" });
    this.renderBusOccupants();
    const snapshot = getSnapshot();
    this.cardConfirmed = snapshot.objectiveId !== "find-card-reader";
    this.cardReaderHeard = this.cardConfirmed || snapshot.knownLandmarks.includes("bus-card-reader");
    this.seatConfirmed = snapshot.objectiveId === "ring-bell" || snapshot.busState === "seated";
    this.activeSeatSpot = BUS_SEAT_SPOTS.find((spot) => spot.id === snapshot.selectedSeatId && !spot.occupied) ?? null;
    const closeTip = gameEvents.on("tipClosed", (tip) => {
      if (tip.source === "bell" && tip.id === "bus-ride-access") this.finishAfterBell();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, closeTip);
    this.events.once(Phaser.Scenes.Events.DESTROY, closeTip);
    if (snapshot.busState === "seated" || snapshot.objectiveId === "ring-bell") {
      this.enterSeatedState(false);
    } else if (snapshot.objectiveId === "find-seat") {
      this.announce("刷卡完成。车厢没有连续盲道，请自由摸索座位，听到座位边缘后按 E 坐下。");
    } else {
      this.announce("你已上车。车厢没有连续盲道，请自由摸索刷卡机；用 Space 确认后按 E 刷卡。");
    }
  }

  protected tileMap(): TileMapDefinition | null {
    return BUS_INTERIOR_TILEMAP;
  }

  protected detectSceneSurface(tip: Phaser.Math.Vector2): CaneSurface | null {
    const objective = getSnapshot().objectiveId;
    if (objective === "find-card-reader" && Phaser.Math.Distance.Between(tip.x, tip.y, BUS_CARD_READER.x, BUS_CARD_READER.y) <= 30) {
      return { kind: "card-reader", label: "刷卡机边缘：位置不在统一标准处，确认后按 E 刷卡", point: new Phaser.Math.Vector2(BUS_CARD_READER.x, BUS_CARD_READER.y) };
    }
    if (objective === "find-seat") {
      const seat = this.nearestSeatSurface(tip);
      if (seat) return { kind: "seat", label: "座位边缘：软垫与金属框，可以坐下", point: new Phaser.Math.Vector2(seat.surface.x, seat.surface.y) };
    }
    if (objective === "ring-bell" && this.bellReady && this.activeBellSpot && isBusBellInRange(this.player, this.activeBellSpot, BUS_BELL_DETECTION_RADIUS)) {
      return { kind: "bell", label: "下车按铃：位置在空位附近，确认后按 E 按铃", point: new Phaser.Math.Vector2(this.activeBellSpot.x, this.activeBellSpot.y) };
    }
    if (Phaser.Math.Distance.Between(tip.x, tip.y, BUS_INTERIOR_DOOR.x, BUS_INTERIOR_DOOR.y) <= 22) {
      return { kind: "door", label: "车门边缘：已经上车，车厢内没有连续盲道", point: new Phaser.Math.Vector2(BUS_INTERIOR_DOOR.x, BUS_INTERIOR_DOOR.y) };
    }
    return null;
  }

  protected onSurfaceContact(surface: CaneSurface): void {
    if (surface.kind === "card-reader") {
      this.cardContacted = true;
      this.addEvidence("bus:reader-touch", "手杖确认刷卡机边缘");
      audioDirector.interact();
      this.announce(this.cardReaderHeard ? "触觉与电子音位置一致，可以按 E 刷卡。" : "摸到刷卡机边缘。再按 R 听辨电子音，完成位置确认。");
    } else if (surface.kind === "seat") {
      this.activeSeatSpot = this.nearestSeatSurface(surface.point) ?? this.activeSeatSpot;
      this.seatConfirmed = true;
      discoverLandmark("bus-seat");
      this.addEvidence("bus:seat-touch", "确认座椅软垫与金属框");
      audioDirector.interact();
      this.announce("座位边缘已确认：软垫和金属框就在旁边，靠近后按 E 坐下。");
    } else if (surface.kind === "bell") {
      this.bellConfirmed = true;
      discoverLandmark("bus-bell");
      audioDirector.interact();
      this.announce("按铃位置已确认：没有倒计时，靠近后按 E 按铃。");
    }
  }

  protected onListen(landmarks: Array<SoundLandmark & { distance: number; direction: string }>): void {
    if (landmarks.some((landmark) => landmark.id === "bus-card-reader")) {
      this.cardReaderHeard = true;
      this.addEvidence("bus:reader-sound", "听见刷卡机短促电子音");
      if (this.cardContacted) this.announce("电子音与刚才摸到的机身位置一致，可以按 E 刷卡。");
    }
    if (landmarks.some((landmark) => landmark.id === "bus-seat")) discoverLandmark("bus-seat");
    if (landmarks.some((landmark) => landmark.id === "bus-bell")) discoverLandmark("bus-bell");
  }

  protected updateInteraction(_time: number): void {
    const snapshot = getSnapshot();
    const passenger = snapshot.busState === "boarding" ? this.nearestOccupiedPassenger(this.player.x, this.player.y) : null;
    if (passenger && this.isNear(passenger.approach.x, passenger.approach.y, 32)) {
      this.prompt = "E  与同车乘客交谈";
      if (this.interactionPressed()) {
        audioDirector.interact();
        this.passengerSprites.get(passenger.id)?.setTint(0xb78a62);
        this.openNpcDialogue({
          npcId: `bus-passenger-${passenger.id}`,
          speaker: "同车乘客",
          prompt: "乘客把随身袋子收向膝前，留出通道，等你决定是否询问。",
          options: [
            { id: "layout", label: "请问刷卡机和空座在哪里？", response: "乘客说：刷卡机在车头右侧。刷卡后，上排四个座位目前都是空的；我只告诉你方向，不拉你过去。" },
            { id: "stop", label: "到白鸽巢时可以提醒我吗？", response: "乘客说：可以。车内也会报站，报站后扶手附近的按铃会亮起，你可以先用盲杖确认位置。" },
            { id: "decline", label: "谢谢，我先自己熟悉车厢。", response: "乘客说：好的。过道留给你，慢慢来。" },
          ],
        });
      }
      return;
    }
    if (snapshot.objectiveId === "find-card-reader") {
      const near = this.isNearObjective("find-card-reader");
      const verified = this.cardContacted && this.cardReaderHeard;
      this.prompt = near ? (verified ? "E  刷卡" : "Space  探测机身 · R  听电子音") : "自由摸索刷卡机，Space 探测 · R 聆听";
      if (near && verified && this.interactionPressed()) this.confirmCard();
      return;
    }
    if (snapshot.busState === "boarding" && snapshot.objectiveId === "find-seat") {
      const nearbySeat = this.activeSeatSpot ?? this.nearestSeatApproach(this.player.x, this.player.y);
      const near = this.activeSeatSpot
        ? this.isNear(this.activeSeatSpot.approach.x, this.activeSeatSpot.approach.y, 34)
        : BUS_SEAT_SPOTS.some((spot) => !spot.occupied && this.isNear(spot.approach.x, spot.approach.y, 34));
      this.prompt = near ? (this.seatConfirmed ? "E  坐下" : "Space  探测座位边缘") : "自由摸索座位，Space 探测";
      if (near && this.seatConfirmed && this.interactionPressed()) this.sitDownForRide(nearbySeat);
      return;
    }
    if (snapshot.busState !== "seated") {
      this.prompt = "";
      return;
    }
    if (!this.bellReady || !this.activeBellSpot) {
      this.prompt = "等待白鸽巢报站";
      return;
    }
    const near = isBusBellInRange(this.player, this.activeBellSpot, BUS_BELL_DETECTION_RADIUS);
    this.prompt = near
      ? (this.bellConfirmed ? "E  按铃" : "Space  探测按铃")
      : "自由摸索按铃，Space 探测";
    if (near && this.bellConfirmed && this.interactionPressed()) this.pressBell();
  }

  protected controlsLocked(): boolean {
    return super.controlsLocked() || (getSnapshot().busState === "seated" && !this.bellReady);
  }

  protected onNpcDialogueChoice(npcId: string): void {
    if (!npcId.startsWith("bus-passenger-")) return;
    const id = npcId.slice("bus-passenger-".length);
    this.passengerSprites.get(id)?.setTint(this.isNightMode() ? 0x000000 : 0x8b8882);
  }

  protected objectiveTarget(): TilePoint {
    if (getSnapshot().objectiveId === "find-seat") {
      const seat = this.activeSeatSpot ?? this.nearestSeatApproach(this.player.x, this.player.y);
      return seat.approach;
    }
    if (getSnapshot().objectiveId === "ring-bell") {
      return this.activeBellSpot ?? { x: this.player.x, y: this.player.y };
    }
    return super.objectiveTarget();
  }

  private confirmCard(): void {
    if (!this.cardContacted || !this.cardReaderHeard) return;
    audioDirector.interact();
    this.cardConfirmed = true;
    this.objectiveId = "find-seat";
    patchSnapshot({ objectiveId: "find-seat", resumeStage: "bus-interior-seat" });
    setCheckpoint("bus-interior-seat");
    this.announce("组合确认完成：机身边缘与电子音来自同一位置。刷卡完成，请自由寻找座位。");
  }

  private sitDownForRide(seat: BusSeatSpot): void {
    audioDirector.interact();
    const seated = transitionBus(getSnapshot().busState, "sit");
    this.objectiveId = "ring-bell";
    this.activeSeatSpot = seat;
    patchSnapshot({ busState: seated, selectedSeatId: seat.id, objectiveId: "ring-bell", scene: "bus-interior", resumeStage: "bus-interior-bell" });
    setCheckpoint("bus-interior-bell");
    this.enterSeatedState(true);
  }

  private enterSeatedState(announceSit: boolean): void {
    this.bellReady = false;
    this.bellPressed = false;
    this.bellConfirmed = false;
    this.activeBellSpot = null;
    const seat = this.activeSeatSpot ?? BUS_SEAT_SPOTS[3];
    this.activeSeatSpot = seat;
    this.player.setPosition(seat.sit.x, seat.sit.y);
    if (this.player.anims.isPlaying) this.player.anims.stop();
    this.player.setTexture(seat.row === "lower" ? BUS_SEATED_SPRITE_KEYS.lower : BUS_SEATED_SPRITE_KEYS.upper);
    this.caneSprite.setVisible(false);
    if (announceSit) this.announce("你坐下了。车内会在报站后给出按铃提示。");
    this.time.delayedCall(BELL_ANNOUNCEMENT_DELAY_MS, () => this.beginBellWindow());
  }

  private beginBellWindow(): void {
    if (getSnapshot().busState !== "seated" || this.bellPressed) return;
    this.activeBellSpot = pickBusBellSpot();
    const bell = renderBusBellDecoration(this, this.activeBellSpot);
    if (bell) this.registerEnvironmentSprite(bell);
    this.bellReady = true;
    const seat = this.activeSeatSpot ?? BUS_SEAT_SPOTS[3];
    this.player.setPosition(seat.approach.x, seat.approach.y);
    this.facing = seat.row === "upper" ? "down" : "up";
    this.player.setTexture("traveler-walk", FACE_FRAME[this.facing]);
    this.caneSprite.setVisible(true);
    this.announce("车内报站：下一站，白鸽巢总站。没有时间惩罚，请确认按铃位置后再按 E。");
  }

  private nearestSeatSurface(point: Phaser.Math.Vector2 | { x: number; y: number }): BusSeatSpot | null {
    return BUS_SEAT_SPOTS
      .filter((spot) => !spot.occupied)
      .map((spot) => ({ spot, distance: Phaser.Math.Distance.Between(point.x, point.y, spot.surface.x, spot.surface.y) }))
      .filter((entry) => entry.distance <= 26)
      .sort((a, b) => a.distance - b.distance)[0]?.spot ?? null;
  }

  private renderBusOccupants(): void {
    const npcTint = this.isNightMode() ? 0x000000 : 0x8b8882;
    BUS_SEAT_SPOTS.filter((spot) => spot.occupied).forEach((spot, index) => {
      const sprite = this.add.image(spot.surface.x, 276, "bus-passenger-sit-up")
        .setOrigin(0.5, 1)
        .setTint(npcTint)
        .setDepth(spot.surface.y + 58 + index * 0.01);
      this.passengerSprites.set(spot.id, sprite);
    });
    this.add.image(BUS_DRIVER_SEAT.x, BUS_DRIVER_SEAT.y, "bus-driver-sit")
      .setOrigin(0.5, 1)
      .setTint(npcTint)
      .setDepth(BUS_DRIVER_SEAT.y + 4);
  }

  private nearestSeatApproach(x: number, y: number): BusSeatSpot {
    return BUS_SEAT_SPOTS
      .filter((spot) => !spot.occupied)
      .map((spot) => ({ spot, distance: Phaser.Math.Distance.Between(x, y, spot.approach.x, spot.approach.y) }))
      .sort((a, b) => a.distance - b.distance)[0]?.spot ?? BUS_SEAT_SPOTS[3];
  }

  private nearestOccupiedPassenger(x: number, y: number): BusSeatSpot | null {
    return BUS_SEAT_SPOTS
      .filter((spot) => spot.occupied)
      .map((spot) => ({ spot, distance: Phaser.Math.Distance.Between(x, y, spot.approach.x, spot.approach.y) }))
      .sort((a, b) => a.distance - b.distance)[0]?.spot ?? null;
  }

  private pressBell(): void {
    if (this.bellPressed) return;
    this.bellPressed = true;
    audioDirector.interact();
    this.announce("按铃已确认，车辆将在白鸽巢停靠。");
    unlockTip("bus-ride-access");
    gameEvents.emit("tipOpen", { id: "bus-ride-access", source: "bell" });
  }

  private finishAfterBell(): void {
    if (!this.bellPressed || this.transitioningAfterBell) return;
    this.transitioningAfterBell = true;
    patchSnapshot(busRideCheckpointAfterBell(getSnapshot().busState));
    gameEvents.emit("chapter", { from: "bus-interior", to: "bus-ride" });
    // The React tip layer resumes the paused scene immediately after emitting
    // tipClosed. Let that resume finish before starting the next Phaser scene.
    this.time.delayedCall(1, () => this.scene.start("bus-ride"));
  }
}

export class BusRideScene extends Phaser.Scene {
  private startedAt = 0;
  private ended = false;
  private keys!: { listen: Phaser.Input.Keyboard.Key; mark: Phaser.Input.Keyboard.Key; repeat: Phaser.Input.Keyboard.Key; pause: Phaser.Input.Keyboard.Key };
  private panorama!: Phaser.GameObjects.TileSprite;
  private scrollAccumulator = 0;
  private shakeAccumulator = 0;
  private shakeOffset = 0;
  private cueIndex = 0;
  private heardCurrent = false;
  private subtitle = "车轮碾过湿润的石路。沿途的声音可以成为返程线索。";
  private readonly cues: Array<{ id: BusRideLandmarkId; label: string; tone: number; pan: number }> = [
    { id: "elevated-rain", label: "雨珠密密敲在右侧车窗", tone: 520, pan: 0.68 },
    { id: "harbor-horn", label: "远处港湾传来低沉船笛", tone: 176, pan: -0.62 },
    { id: "bakery-bell", label: "旧城面包店的门铃从左侧掠过", tone: 840, pan: -0.76 },
  ];

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
      listen: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      mark: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      repeat: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H),
      pause: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };
    this.startedAt = this.time.now;
    gameEvents.emit("scene", "bus-ride");
    audioDirector.enterScene("bus-ride");
    this.emitRideHud();
    this.time.delayedCall(5200, () => this.advanceCue(1, "车内报站：下一站，白鸽巢总站。新的声音从窗外靠近。"));
    this.time.delayedCall(10400, () => this.advanceCue(2, "17路转入旧城。你可以继续听，也可以只坐稳感受车身减速。"));
    this.time.delayedCall(16800, () => this.finishRide());
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
    if (Phaser.Input.Keyboard.JustDown(this.keys.listen)) this.listenCurrentCue();
    if (Phaser.Input.Keyboard.JustDown(this.keys.mark)) this.markCurrentCue();
    if (Phaser.Input.Keyboard.JustDown(this.keys.repeat)) {
      this.subtitle = `${JOURNEY_GOAL}。当前任务：听辨车窗外的声音，并按 E 记下可识别的地标。`;
      audioDirector.speak(this.subtitle);
      this.emitRideHud();
    }
  }

  private emitRideHud(): void {
    const snapshot = getSnapshot();
    gameEvents.emit("hud", {
      objective: "沿途听辨声音，前往白鸽巢",
      journeyGoal: JOURNEY_GOAL,
      subtitle: this.subtitle,
      prompt: "R  聆听当前声音  ·  E  记下声音  ·  H  重复目标",
      memories: snapshot.memories.length,
      detours: snapshot.detourScore,
      sceneLabel: SCENE_LABELS["bus-ride"],
      hintCooling: false,
      flashCooling: false,
      listenCooling: false,
      listening: false,
      knownLandmarks: snapshot.knownLandmarks,
      routeChoice: snapshot.routeChoice,
      eggTartBoostRemainingMs: snapshot.eggTartBoostRemainingMs,
      contact: "车厢行驶中",
      contactHistory: [],
    });
  }

  private advanceCue(index: number, narration: string): void {
    this.cueIndex = index;
    this.heardCurrent = false;
    this.subtitle = narration;
    audioDirector.speak(narration);
    this.emitRideHud();
  }

  private listenCurrentCue(): void {
    const cue = this.cues[this.cueIndex];
    this.heardCurrent = true;
    audioDirector.listenCue(cue.tone, cue.pan);
    this.subtitle = `你专注聆听：${cue.label}。若想把它作为路线笔记，按 E 记下。`;
    audioDirector.speak(this.subtitle);
    this.emitRideHud();
  }

  private markCurrentCue(): void {
    const cue = this.cues[this.cueIndex];
    if (!this.heardCurrent) {
      this.subtitle = "先按 R 驻足聆听，再决定是否把这段声音写进路线笔记。";
      audioDirector.cooldown();
      this.emitRideHud();
      return;
    }
    const recognized = Array.from(new Set([...getSnapshot().busRideRecognized, cue.id]));
    patchSnapshot({ busRideRecognized: recognized });
    if (cue.id === "harbor-horn") discoverLandmark("harbor-horn");
    collectMemory("bus-rain");
    this.subtitle = `已记下：${cue.label}。这不是限时题，下一段声音出现后仍可继续听辨。`;
    audioDirector.interact();
    this.emitRideHud();
  }

  private finishRide(): void {
    if (this.ended) return;
    this.ended = true;
    const arrived = transitionBus(getSnapshot().busState, "arrive");
    patchSnapshot({ busState: arrived, scene: "old-city", objectiveId: "request-crossing", resumeStage: "old-city-entry" });
    gameEvents.emit("chapter", { from: "bus-ride", to: "old-city" });
    this.scene.start("old-city");
  }

  public renderGameToText(): GameTextState {
    const snapshot = getSnapshot();
    const cue = this.cues[this.cueIndex];
    return {
      coordinateSystem: "origin top-left; x right; y down; canvas 640x360",
      mode: this.scene.isPaused() ? "paused" : "playing",
      gameMode: snapshot.settings.gameMode,
      scene: "bus-ride",
      journeyGoal: JOURNEY_GOAL,
      player: null,
      objective: { id: "ride-to-camoes", label: "沿途听辨声音，前往白鸽巢", target: { x: 0, y: 0 } },
      prompt: "R 聆听当前声音；E 记下声音",
      subtitle: this.subtitle,
      contact: "车厢行驶中",
      npcs: [],
      nearbySoundLandmarks: [{ id: cue.id, label: cue.label, direction: cue.pan < 0 ? "左侧" : "右侧", distance: 0 }],
      recentEvidence: snapshot.busRideRecognized.map((id) => this.cues.find((candidate) => candidate.id === id)?.label ?? id),
      knownLandmarks: snapshot.knownLandmarks,
      routeChoice: snapshot.routeChoice,
      openingReply: snapshot.openingReply,
      movementSurface: "stationary",
      movementSpeedMultiplier: 1,
      eggTartPurchased: snapshot.eggTartPurchased,
      eggTartBoostRemainingMs: snapshot.eggTartBoostRemainingMs,
      insideEggTartScentZone: false,
      eggTartScentPrompted: snapshot.eggTartScentPrompted,
      cooldowns: { hintMs: 0, flashMs: 0, listenMs: 0 },
      flags: { controlsLocked: true, dialogueOpen: false, listening: this.heardCurrent, ending: snapshot.ending },
    };
  }
}
export class OldCityScene extends WalkScene {
  protected sceneId = "old-city" as const;
  protected spawn = new Phaser.Math.Vector2(40, 284);
  protected objectiveId = "request-crossing";
  private crossingState: CrossingState = "approach";
  private signalGraphics!: Phaser.GameObjects.Graphics;
  private guideGraphics!: Phaser.GameObjects.Graphics;
  private leaving = false;
  private deadEndFound = false;
  private petTipOpen = false;
  private crossingCurbConfirmed = false;
  private crossingSignalHeard = false;
  private routeChoicePending = false;
  private scentWasInside = false;

  constructor() {
    super("old-city");
  }

  protected tileMap(): TileMapDefinition | null {
    return OLD_CITY_TILEMAP;
  }

  protected onSceneReady(): void {
    if (getSnapshot().busState === "arrived") patchSnapshot({ busState: transitionBus("arrived", "alight") });
    const closeTip = gameEvents.on("tipClosed", (tip) => {
      if (tip.source !== "pet-shop" || tip.id !== "guide-dog-access") return;
      this.petTipOpen = false;
      this.objectiveId = "reach-terminus";
      patchSnapshot({ objectiveId: "reach-terminus" });
      this.announce("盲道向北继续，银号门前就是街口终点。");
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, closeTip);
    this.events.once(Phaser.Scenes.Events.DESTROY, closeTip);
    this.signalGraphics = this.add.graphics().setDepth(17);
    this.guideGraphics = this.add.graphics().setDepth(14);
    const stage = getSnapshot().resumeStage;
    if (stage === "old-city-wait") this.crossingState = "requested";
    if (stage === "old-city-go") this.crossingState = "walk";
    if (stage === "old-city-street") this.crossingState = "crossed";
    if (this.crossingState !== "approach") {
      this.crossingCurbConfirmed = true;
      this.crossingSignalHeard = true;
    }
    this.drawSignal();
    if (this.crossingState === "requested") {
      this.announce("通行请求已经记录。请留在路缘，重新等待可通行提示。");
      this.scheduleCrossingWait();
    } else if (this.crossingState === "walk") {
      this.announce("可以通行。沿斑马线向东直行到对岸路缘。");
    } else if (this.crossingState === "crossed") {
      this.announce("你已经过了马路。沿盲道穿过商铺街——向南、向东、再向北。");
    } else {
      this.announce("你在白鸽巢下车。城市是灰色的；用 Space 敲击盲杖，先沿盲道向北，到路缘点阵按 E 请求通行。");
    }
  }

  protected requiresBrightGround(): boolean {
    return this.crossingState !== "walk";
  }

  protected suspendRouteTracking(): boolean {
    return this.crossingState === "walk";
  }

  protected insideEggTartScentZone(): boolean {
    return isInsideEggTartScentZone({ x: this.player.x, y: this.player.y });
  }

  protected onPlayerPositionUpdate(): void {
    const inside = this.insideEggTartScentZone();
    if (inside && !this.scentWasInside && !getSnapshot().eggTartScentPrompted) {
      patchSnapshot({ eggTartScentPrompted: true });
      this.announce("你被蛋挞的香气环绕。");
    }
    this.scentWasInside = inside;
  }

  protected constrainMovement(current: Phaser.Math.Vector2, next: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const bounded = super.constrainMovement(current, next);
    const constrained = constrainCrossingPosition(this.crossingState, bounded, OLD_CITY_CROSSING);
    return new Phaser.Math.Vector2(constrained.x, constrained.y);
  }

  protected repeatTaskText(): string {
    if (this.crossingState === "requested") return "当前任务：留在点阵砖旁等待；收到文字和双音提示后再前进。";
    if (this.crossingState === "walk") return "当前任务：可以通行。沿斑马线向东直行到对岸路缘。";
    if (this.crossingState === "crossed") return `当前任务：${this.objectiveLabel()}。路线笔记会保留你选择的地标，但不会自动带路。`;
    return "当前任务：沿盲道向北到点阵砖，按 E 请求通行。Q 可显示目标方向。";
  }

  protected decisionHint(nodeIndex: number): string {
    const taskId = this.path?.nodes[nodeIndex]?.taskId;
    if (taskId === "request-crossing") return "4×4凸点：路缘请求点，可按 E 请求通行";
    if (taskId === "cross-junction") return "4×4凸点：对岸路缘，右侧有新盲道向南";
    if (taskId === "visit-pet-shop") return "4×4凸点：猫记宠物门前，可按 E 了解导盲犬";
    if (taskId === "reach-terminus") return "4×4凸点：街口终点，前方通向大三巴";
    return super.decisionHint(nodeIndex);
  }

  protected detectSceneSurface(tip: Phaser.Math.Vector2): CaneSurface | null {
    const request = OLD_CITY_CROSSING.requestPoint;
    if (this.crossingState === "approach" && Phaser.Math.Distance.Between(tip.x, tip.y, request.x, request.y) <= 24) {
      return { kind: "curb", label: "过街请求点：路缘与4×4点阵相接，先听信号再请求通行", point: new Phaser.Math.Vector2(request.x, request.y) };
    }
    const base = super.detectSceneSurface(tip);
    if (base) return base;
    const sign = SHOP_SIGNS.find((entry) => Phaser.Math.Distance.Between(tip.x, tip.y, entry.touch.x, entry.touch.y) <= 26);
    if (sign) return { kind: "sign", label: sign.hint, point: new Phaser.Math.Vector2(sign.touch.x, sign.touch.y) };
    return null;
  }

  protected onSurfaceContact(surface: CaneSurface, _time: number): void {
    if (surface.kind === "curb" && this.crossingState === "approach") {
      this.crossingCurbConfirmed = true;
      this.addEvidence("crossing:curb", "确认路缘与过街请求点阵");
      this.announce(this.crossingSignalHeard
        ? "路缘点阵与刚才听到的过街双音来自同一处，可以按 E 请求通行。"
        : "已确认路缘请求点。按 R 听辨过街双音后，再按 E 请求通行。");
      return;
    }
    if (surface.kind !== "obstacle" || this.deadEndFound) return;
    if (Phaser.Math.Distance.Between(surface.point.x, surface.point.y, OLD_CITY_MEMORY_POINT.x, OLD_CITY_MEMORY_POINT.y) > 48) return;
    this.deadEndFound = true;
    collectMemory("old-city-bell");
    this.announce("杖头碰到封闭围栏，脚下是碎土。这是商铺间的短巷，请转身返回商铺街的盲道。");
  }

  protected onListen(landmarks: Array<SoundLandmark & { distance: number; direction: string }>): void {
    if (landmarks.some((landmark) => landmark.id === "old-city-crossing")) {
      this.crossingSignalHeard = true;
      this.addEvidence("crossing:signal", "听见路口过街信号双音");
      if (this.crossingCurbConfirmed && this.crossingState === "approach") this.announce("双音位置与杖头确认的路缘点阵一致，可以按 E 请求通行。");
    }
    if (landmarks.some((landmark) => landmark.id === "egg-tart-oven")) discoverLandmark("egg-tart-oven");
    if (landmarks.some((landmark) => landmark.id === "pet-shop-bell")) discoverLandmark("pet-shop-bell");
  }

  protected updateInteraction(_time: number): void {
    this.drawCrossingGuide();
    const nearRequest = this.isNearObjective("request-crossing");
    const nearMemory = this.isNear(OLD_CITY_MEMORY_POINT.x, OLD_CITY_MEMORY_POINT.y, 30) && !getSnapshot().memories.includes("old-city-bell");

    this.prompt = nearMemory
      ? "E  聆听记忆回声"
      : this.crossingState === "approach" && nearRequest
        ? (this.crossingCurbConfirmed && this.crossingSignalHeard ? "E  请求通行" : "Space  确认路缘 · R  听信号")
        : this.crossingState === "requested"
          ? "请留在路缘等候"
          : this.crossingState === "walk"
            ? "沿斑马线向东通过"
            : "";

    if (nearMemory && this.interactionPressed()) {
      this.deadEndFound = true;
      collectMemory("old-city-bell");
      audioDirector.interact();
      this.announce("记忆回声：小巷尽头传来饼家的风铃。林伯笑说，会走错路也算澳门的一部分。");
      return;
    }

    // Read JustDown exactly once. Calling interactionPressed in two consecutive
    // conditions consumed the verified press before the request branch ran.
    const crossingRequestPressed = this.crossingState === "approach" && nearRequest && this.interactionPressed();
    if (crossingRequestPressed && (!this.crossingCurbConfirmed || !this.crossingSignalHeard)) {
      this.announce("请先用 Space 确认路缘点阵，并按 R 听辨过街信号；两条线索一致后再请求通行。");
      return;
    }

    if (crossingRequestPressed) {
      this.crossingState = transitionCrossing(this.crossingState, "request");
      this.objectiveId = "wait-crossing";
      setCheckpoint("old-city-wait");
      audioDirector.crossingWait();
      this.announce("组合确认完成。通行请求已收到，请留在路缘等候文字和双音提示。");
      this.drawSignal();
      this.scheduleCrossingWait();
      return;
    }

    if (this.crossingState === "walk" && this.isNearObjective("cross-junction")) {
      this.crossingState = transitionCrossing(this.crossingState, "finish");
      this.objectiveId = "follow-street-south";
      setCheckpoint("old-city-street");
      this.drawSignal();
      this.announce("你抵达对岸点阵。右侧出现新盲道，沿它向南进入商铺街。");
      return;
    }

    if (this.crossingState !== "crossed" || this.leaving) return;
    if (this.objectiveId === "follow-street-south" && this.isNearObjective()) {
      const savedRoute = getSnapshot().routeChoice;
      if (savedRoute) {
        this.applyRouteChoice(savedRoute);
      } else if (!this.routeChoicePending) {
        this.routeChoicePending = true;
        this.openNpcDialogue({
          npcId: "route-choice",
          speaker: "路线判断",
          prompt: "商铺街口的点阵分出两条都安全、最终会合流的走法。你想用哪类线索确认这一段？",
          options: [
            { id: "shop-wall", label: "靠店铺一侧，沿墙脚与风铃前进。", response: "你选择靠店铺一侧：墙脚、烤炉铃与店门风铃会连续出现。" },
            { id: "curb-edge", label: "靠街道一侧，沿路缘与排水纹前进。", response: "你选择靠街道一侧：路缘与排水金属纹会保持在杖侧。" },
          ],
        });
      }
      return;
    }
    if ((this.objectiveId === "follow-shop-wall" || this.objectiveId === "follow-curb-edge") && this.isNearObjective()) {
      this.objectiveId = "follow-street-east";
      patchSnapshot({ objectiveId: "follow-street-east" });
      this.announce("两条走法在饼家门前重新合流。继续向东，到街尾点阵再向北转。");
      return;
    }
    if (this.objectiveId === "follow-street-east" && this.isNearObjective()) {
      this.objectiveId = "visit-pet-shop";
      patchSnapshot({ objectiveId: "visit-pet-shop" });
      this.announce("街尾的点阵。盲道向北转，宠物店就在右侧，先到门前停一停。");
      return;
    }
    if (this.objectiveId === "visit-pet-shop" && isInsideVerticalInteractionZone(this.player, PET_SHOP_INTERACTION_ZONE)) {
      this.prompt = "E  与宠物店员交谈";
      if (!this.petTipOpen && this.interactionPressed()) {
        audioDirector.interact();
        this.openNpcDialogue({
          npcId: "pet-shop-clerk",
          speaker: "宠物店员",
          prompt: "店员听见盲杖停在门边，主动说明这里没有可供登记的导盲犬服务。",
          options: [
            { id: "learn", label: "我想了解导盲犬在澳门的处境。", response: "店员说：这不只是训练和购买的问题，制度仍把导盲犬当作普通宠物。" },
            { id: "question", label: "电子导盲设备能完全替代吗？", response: "店员说：它们可以补充方向信息，但楼梯、临时障碍和复杂人流仍很难处理。" },
            { id: "later", label: "我先在门外整理一下方向。", response: "店员说：好的。你准备好时再按 E，我会把资料读给你听。" },
          ],
        });
      }
      return;
    }
    if (this.objectiveId === "reach-terminus" && this.isNearObjective()) {
      this.leaving = true;
      patchSnapshot({ scene: "ruins", objectiveId: "meet-lam", resumeStage: "ruins-entry" });
      this.announce("银号门前的盲道到了尽头。前方街口通向大三巴牌坊。");
      this.time.delayedCall(650, () => { gameEvents.emit("chapter", { from: "old-city", to: "ruins" }); this.scene.start("ruins"); });
    }
  }

  private scheduleCrossingWait(): void {
    this.time.delayedCall(OLD_CITY_CROSSING.waitMs, () => {
      if (this.crossingState !== "requested") return;
      this.crossingState = transitionCrossing(this.crossingState, "allow");
      this.objectiveId = "cross-junction";
      setCheckpoint("old-city-go");
      audioDirector.crossingWalk();
      this.announce("可以通行。沿斑马线向东直行到对岸路缘。");
      this.drawSignal();
    });
  }

  protected onNpcDialogueChoice(npcId: string, optionId: string): void {
    if (npcId === "route-choice" && (optionId === "shop-wall" || optionId === "curb-edge")) {
      this.applyRouteChoice(optionId);
      return;
    }
    if (npcId === "egg-tart-vendor" && optionId === "buy" && !getSnapshot().eggTartPurchased) {
      this.activateEggTartBoost();
      discoverLandmark("egg-tart-oven");
      this.announce("你吃下暖热的蛋挞。接下来可控制的60秒内，移动速度提升60%；暂停、对话和过场不会消耗时间。");
      return;
    }
    if (npcId !== "pet-shop-clerk" || optionId === "later") return;
    this.petTipOpen = true;
    unlockTip("guide-dog-access");
    gameEvents.emit("tipOpen", { id: "guide-dog-access", source: "pet-shop" });
  }

  private applyRouteChoice(choice: RouteChoice): void {
    this.routeChoicePending = false;
    this.objectiveId = choice === "shop-wall" ? "follow-shop-wall" : "follow-curb-edge";
    patchSnapshot({ routeChoice: choice, objectiveId: this.objectiveId });
    this.announce(choice === "shop-wall"
      ? "路线笔记：靠店铺一侧，先听烤炉铃，再听饼家风铃；两条路线会在前方合流。"
      : "路线笔记：靠街道一侧，让路缘和排水金属纹保持在左侧；两条路线会在前方合流。");
  }

  /** Two pedestrian signals: one beside the west request point, one on the far curb. */
  private drawSignal(): void {
    if (!this.signalGraphics) return;
    this.signalGraphics.clear();
    const color = this.crossingState === "walk" || this.crossingState === "crossed" ? 0x73c98b : 0xc85d52;
    [{ x: 24, base: 112 }, { x: 196, base: 150 }].forEach(({ x, base }) => {
      const boxTop = base - 68;
      this.signalGraphics.lineStyle(4, 0x151c20, 1);
      this.signalGraphics.lineBetween(x, base, x, boxTop + 34);
      this.signalGraphics.fillStyle(0x11171b, 1);
      this.signalGraphics.fillRoundedRect(x - 12, boxTop, 24, 34, 3);
      this.signalGraphics.fillStyle(color, 1);
      this.signalGraphics.fillCircle(x, boxTop + 17, 6);
    });
  }

  /** While the walk phase lasts, the zebra tiles glow slightly instead of any vector guide line. */
  private drawCrossingGuide(): void {
    this.guideGraphics.clear();
    if (this.crossingState !== "walk") return;
    this.guideGraphics.fillStyle(0xffd477, 0.22);
    OLD_CITY_TILEMAP.groundRows.forEach((row, rowIndex) => [...row].forEach((char, colIndex) => {
      if (char !== "z") return;
      this.guideGraphics.fillRect(colIndex * 16, rowIndex * 16 + OLD_CITY_TILEMAP.offsetY, 16, 16);
    }));
  }
}

export class RuinsScene extends WalkScene {
  protected sceneId = "ruins" as const;
  protected spawn = new Phaser.Math.Vector2(RUINS_PLAYER_START.x, RUINS_PLAYER_START.y);
  protected objectiveId = "meet-lam";
  private processionStarted = false;
  private processionActive = false;
  private wheelchairTipOpen = false;
  private finaleStarted = false;
  private finaleFinished = false;
  private finaleGraphics!: Phaser.GameObjects.Graphics;
  private lam!: Phaser.GameObjects.Sprite;
  private daughter!: Phaser.GameObjects.Sprite;
  private finaleStartedAt = 0;
  private finaleWarmProgress = 0;
  private finaleTier = 0;
  private wheelchairConfirmed = false;
  private wheelchairHeard = false;

  constructor() {
    super("ruins");
  }

  protected onSceneReady(): void {
    this.finaleGraphics = this.add.graphics().setDepth(16);
    const npcTint = this.isNightMode() ? 0x000000 : 0x9b968d;
    this.lam = this.add.sprite(RUINS_LAM_START.x, RUINS_LAM_START.y, "lam-wheelchair", 0).setTint(npcTint);
    this.lam.setOrigin(0.5, 1);
    this.daughter = this.add.sprite(RUINS_DAUGHTER_START.x, RUINS_DAUGHTER_START.y, "lam-daughter-push", 0).setTint(npcTint);
    this.daughter.setOrigin(0.5, 1);
    this.updateProcessionDepths();
    if (!this.anims.exists("lam-wheelchair-roll")) {
      this.anims.create({
        key: "lam-wheelchair-roll",
        frames: this.anims.generateFrameNumbers("lam-wheelchair", { frames: [0, 1] }),
        frameRate: 4,
        repeat: -1,
      });
    }
    if (!this.anims.exists("lam-wheelchair-finale")) {
      this.anims.create({
        key: "lam-wheelchair-finale",
        frames: this.anims.generateFrameNumbers("lam-wheelchair", { frames: [2, 2, 0, 0] }),
        frameRate: 2,
        repeat: -1,
      });
    }
    if (!this.anims.exists("lam-daughter-push-walk")) {
      this.anims.create({
        key: "lam-daughter-push-walk",
        frames: this.anims.generateFrameNumbers("lam-daughter-push", { frames: [1, 2] }),
        frameRate: 5,
        repeat: -1,
      });
    }
    const closeTip = gameEvents.on("tipClosed", (tip) => {
      if (!shouldStartWheelchairProcession(tip)) return;
      this.wheelchairTipOpen = false;
      this.time.delayedCall(0, () => this.startProcession());
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, closeTip);
    this.events.once(Phaser.Scenes.Events.DESTROY, closeTip);
    if (getSnapshot().resumeStage === "ruins-procession") {
      this.wheelchairConfirmed = true;
      this.wheelchairHeard = true;
      this.time.delayedCall(0, () => this.startProcession());
      return;
    }
    this.announce("路边传来轮椅轻响。林伯和女儿正在中央坡道入口等你。");
  }

  protected tileMap(): TileMapDefinition | null {
    return RUINS_TILEMAP;
  }

  protected getMovementInput(): Phaser.Math.Vector2 {
    return this.processionActive || this.finaleStarted ? new Phaser.Math.Vector2() : super.getMovementInput();
  }

  protected controlsLocked(): boolean {
    return this.processionActive || this.finaleStarted || super.controlsLocked();
  }

  protected boostClockFrozen(): boolean {
    return this.processionActive || this.finaleStarted || super.boostClockFrozen();
  }

  protected suspendRouteTracking(): boolean {
    return this.processionActive || this.finaleStarted;
  }

  protected decisionHint(nodeIndex: number): string {
    if (this.path?.nodes[nodeIndex]?.taskId === "meet-lam") return "4×4凸点：林伯的轮椅就在坡道入口前";
    if (this.path?.nodes[nodeIndex]?.taskId === "follow-wheelchair") return "4×4凸点：中央坡道抵达牌坊平台";
    return super.decisionHint(nodeIndex);
  }

  protected detectSceneSurface(tip: Phaser.Math.Vector2): CaneSurface | null {
    if (Phaser.Math.Distance.Between(tip.x, tip.y, RUINS_LAM_START.x, RUINS_LAM_START.y) <= 30) {
      return { kind: "metal", label: "轮椅脚踏板旁的金属边缘：林伯就在坡道入口", point: new Phaser.Math.Vector2(RUINS_LAM_START.x, RUINS_LAM_START.y) };
    }
    return super.detectSceneSurface(tip);
  }

  protected onSurfaceContact(surface: CaneSurface): void {
    if (surface.kind !== "metal" || Phaser.Math.Distance.Between(surface.point.x, surface.point.y, RUINS_LAM_START.x, RUINS_LAM_START.y) > 8) return;
    this.wheelchairConfirmed = true;
    this.addEvidence("ruins:wheelchair-touch", "确认轮椅脚踏板与坡道入口");
    this.announce(this.wheelchairHeard
      ? "轮椅轻响与脚踏板位置一致，确认林伯就在面前。可以按 E 问候。"
      : "杖头确认了轮椅脚踏板。再按 R 听清轮椅轻响的位置，然后问候。");
  }

  protected onListen(landmarks: Array<SoundLandmark & { distance: number; direction: string }>): void {
    if (landmarks.some((landmark) => landmark.id === "ruins-wheelchair")) {
      this.wheelchairHeard = true;
      discoverLandmark("ruins-wheelchair");
      this.addEvidence("ruins:wheelchair-sound", "听见林伯轮椅的轻响");
      if (this.wheelchairConfirmed) this.announce("轮椅轻响与杖头确认的脚踏板位置一致。可以按 E 问候林伯。");
    }
    if (landmarks.some((landmark) => landmark.id === "ruins-rain")) discoverLandmark("ruins-rain");
  }

  protected updateInteraction(): void {
    // A backgrounded browser can occasionally reach the tween's last rendered
    // frame without delivering onComplete. The endpoint is authoritative, so
    // advance on the next scene update instead of trapping the player forever.
    if (this.processionActive && Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      RUINS_PLAYER_END.x,
      RUINS_PLAYER_END.y,
    ) <= 1.5) {
      this.startFinale();
    }
    if (this.processionActive) {
      this.prompt = "正紧随林伯和女儿沿坡道上行";
      return;
    }
    if (this.finaleStarted) {
      this.drawFinaleWave();
      this.prompt = "正在回放触碰过的暖色记忆";
      return;
    }
    const near = this.isNearObjective();
    const verified = this.wheelchairConfirmed && this.wheelchairHeard;
    this.prompt = near ? (verified ? "E  问候林伯和女儿" : "Space  确认轮椅 · R  听轻响") : "";
    if (near && !verified && this.interactionPressed()) {
      this.announce("先用 Space 确认轮椅脚踏板，并按 R 听清轻响的位置，再自然地向林伯问候。");
      return;
    }
    if (near && verified && !this.wheelchairTipOpen && this.interactionPressed()) {
      audioDirector.interact();
      this.lam.setTint(0xd7a85d);
      this.daughter.setTint(0xc9a36c);
      this.openNpcDialogue({
        npcId: "lam-reunion",
        speaker: "林伯和女儿",
        prompt: "林伯听见你的脚步，笑着问：约定的地方到了。我们先做什么？",
        options: [
          { id: "photo", label: "拿出旧照片，在相同的位置再拍一张。", response: "林伯摸到照片边缘：还是这个地方，只是我们都多走了一段路。" },
          { id: "listen-rain", label: "先一起听牌坊下的雨声。", response: "三个人安静下来。雨沿石墙落下，和语音留言里的背景声重合。" },
          { id: "share-memories", label: "把一路记下的声音和触感讲给林伯。", response: "林伯听完笑了：原来你把整座城带到了约定里。" },
        ],
      });
    }
  }

  protected onNpcDialogueChoice(npcId: string, optionId: string): void {
    if (npcId !== "lam-reunion") return;
    if (optionId !== "photo" && optionId !== "listen-rain" && optionId !== "share-memories") return;
    patchSnapshot({ endingChoice: optionId });
    this.wheelchairTipOpen = true;
    unlockTip("wheelchair-pushing");
    gameEvents.emit("tipOpen", { id: "wheelchair-pushing", source: "wheelchair" });
  }

  private startProcession(): void {
    if (this.processionStarted || this.finaleStarted) return;
    this.processionStarted = true;
    this.processionActive = true;
    this.objectiveId = "follow-wheelchair";
    setCheckpoint("ruins-procession");
    this.setProcessionPositions(0);
    this.facing = "up";
    this.player.setTexture("traveler-walk", FACE_FRAME.up).setAngle(0);
    this.caneSprite.setVisible(true);
    const reducedMotion = getSnapshot().settings.reducedMotion;
    this.announce(reducedMotion
      ? "女儿稳稳推着林伯到达牌坊前，你紧随其后。"
      : "女儿说明要沿中央坡道上行。她稳稳推着林伯，你紧随其后。");
    if (reducedMotion) {
      this.setProcessionPositions(1);
      this.time.delayedCall(250, () => this.startFinale());
      return;
    }
    this.lam.play("lam-wheelchair-roll");
    this.daughter.play("lam-daughter-push-walk");
    this.player.play("walk-up", true);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: RUINS_PROCESSION_DURATION_MS,
      ease: "Sine.inOut",
      onUpdate: (tween) => {
        const progress = Number(tween.getValue() ?? 0);
        this.setProcessionPositions(progress);
        if (progress >= 0.999) this.startFinale();
      },
      onComplete: () => this.startFinale(),
    });
  }

  private setProcessionPositions(progress: number): void {
    const positions = ruinsProcessionPositions(progress);
    this.lam.setPosition(positions.lam.x, positions.lam.y);
    this.daughter.setPosition(positions.daughter.x, positions.daughter.y);
    this.player.setPosition(positions.player.x, positions.player.y);
    this.updateProcessionDepths();
  }

  private updateProcessionDepths(): void {
    this.lam.setDepth(this.lam.y + 1);
    this.daughter.setDepth(this.daughter.y + 2);
    this.player.setDepth(this.player.y + 3);
  }

  private startFinale(): void {
    if (this.finaleStarted) return;
    this.setProcessionPositions(1);
    this.processionActive = false;
    this.finaleStarted = true;
    this.finaleStartedAt = this.time.now;
    this.prompt = "正在回放触碰过的暖色记忆";
    const snapshot = getSnapshot();
    this.finaleTier = snapshot.memories.length;
    const reducedMotion = snapshot.settings.reducedMotion;
    if (reducedMotion) {
      this.lam.setFrame(2);
      this.daughter.setFrame(0);
      this.drawFinaleWave(true);
      this.time.delayedCall(250, () => this.finishFinale());
      return;
    }
    this.player.anims.stop();
    this.player.setFrame(FACE_FRAME.up);
    this.daughter.anims.stop();
    this.daughter.setFrame(0);
    this.lam.play("lam-wheelchair-finale");
    const line = this.finaleTier >= 3
      ? "一路留下的三段记忆同时亮起：道路、石墙、房屋和牌坊都恢复了雨后的暖色。"
      : this.finaleTier === 2
        ? "盲道的暖光爬上石墙与两侧房屋，林伯在轮椅上向你挥手。"
        : "盲道、林伯、女儿和牌坊先亮了起来，足够照见约定的终点。";
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
    this.daughter.setTint(progress >= 0.55 ? 0xc9a36c : 0x9b968d);
  }

  protected forceWarmForTile(tile: { x: number; y: number; environment: boolean }): boolean {
    if (!this.finaleStarted || this.finaleWarmProgress <= 0) return false;
    const distance = Phaser.Math.Distance.Between(tile.x, tile.y, this.lam?.x ?? RUINS_LAM_END.x, this.lam?.y ?? RUINS_LAM_END.y);
    const route = PATHS.ruins.nodes.some((node, index, nodes) => index < nodes.length - 1 && pointSegmentDistance(new Phaser.Math.Vector2(tile.x, tile.y), node, nodes[index + 1]) <= 25);
    if (this.finaleTier >= 3) return distance <= this.finaleWarmProgress * 720;
    if (this.finaleTier === 2) return (route || tile.environment) && distance <= this.finaleWarmProgress * 520;
    const facade = tile.environment && tile.y <= 110;
    return (route || facade) && distance <= this.finaleWarmProgress * 360;
  }

  private finishFinale(): void {
    if (this.finaleFinished) return;
    this.finaleFinished = true;
    if (!getSnapshot().endingChoice) patchSnapshot({ endingChoice: "share-memories" });
    const snapshot = getSnapshot();
    const elapsedSeconds = getActiveElapsedMs() / 1000;
    const ending = determineEnding({ elapsedSeconds, detourScore: snapshot.detourScore, returnRequested: snapshot.returnRequested });
    finishGame(ending);
    gameEvents.emit("ending", ending);
    this.scene.pause();
  }
}

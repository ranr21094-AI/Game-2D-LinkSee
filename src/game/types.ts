export type SceneId = "bus-stop" | "bus-interior" | "bus-ride" | "old-city" | "ruins";

export type TilePoint = { x: number; y: number };

export type TactileTileKind = "guidance" | "decision";

export type CaneSurfaceKind = "guidance" | "decision" | "stone" | "metal" | "obstacle" | "sign" | "seat" | "door" | "curb" | "person" | "card-reader" | "bell" | "stall";

export type ColorMemoryPoint = TilePoint & {
  scene: SceneId;
  radius: number;
};

export type TactilePathNode = TilePoint & {
  kind: TactileTileKind;
  taskId?: string;
  breakBefore?: boolean;
};

export type TactilePathDefinition = {
  scene: SceneId;
  nodes: TactilePathNode[];
};

export type CrossingState = "approach" | "requested" | "walk" | "crossed";

export type CrossingDefinition = {
  scene: SceneId;
  requestPoint: TilePoint;
  farCurb: TilePoint;
  nearSideBoundary: { maxX: number; minY: number };
  corridorWidth: number;
  waitMs: number;
};

export type ObjectiveStep2D = {
  id: string;
  scene: SceneId;
  label: string;
  target: TilePoint;
  triggerRadius: number;
  interaction: "approach" | "interact";
  checkpoint?: boolean;
};

export type RevealProfile = {
  tapForwardTiles: number;
  tapBackTiles: number;
  tapDurationMs: number;
  hintTiles: number;
  hintDurationMs: number;
  hintCooldownMs: number;
  color: number;
};

export type BusTransitState =
  | "waiting"
  | "doorOpen"
  | "boarding"
  | "seated"
  | "riding"
  | "arrived"
  | "alighted";

export type MemoryId = "bus-rain" | "old-city-bell" | "border-hand";
export type EndingId = "reunion" | "detour" | "return";
export type TipId = "sighted-guide" | "bus-access" | "bus-ride-access" | "wheelchair-pushing" | "guide-dog-access";

export type TipDefinition = {
  id: TipId;
  title: string;
  heading: string;
  summary: string;
  image: string;
  imageAlt: string;
  steps: readonly { title: string; body: string }[];
  callout: string;
};

export type GameMode = "experience" | "night";

export type OpeningReply = "old-place" | "careful" | "call-nearby";
export type EndingChoice = "photo" | "listen-rain" | "share-memories";
export type RouteChoice = "shop-wall" | "curb-edge";

export type KnownLandmarkId =
  | "gate-rain"
  | "route-17-engine"
  | "bus-card-reader"
  | "bus-seat"
  | "bus-bell"
  | "harbor-horn"
  | "old-city-crossing"
  | "flower-bell"
  | "egg-tart-oven"
  | "pet-shop-bell"
  | "ruins-wheelchair"
  | "ruins-rain";

export type BusRideLandmarkId = "elevated-rain" | "harbor-horn" | "bakery-bell";

export type GameSettings = {
  masterVolume: number;
  ambientVolume: number;
  effectsVolume: number;
  dialogueVolume: number;
  subtitleScale: number;
  reducedMotion: boolean;
  gameMode: GameMode;
};

export type ResumeStage =
  | "bus-stop-entry"
  | "bus-stop-sign"
  | "bus-interior-entry"
  | "bus-interior-seat"
  | "bus-interior-bell"
  | "bus-ride"
  | "old-city-entry"
  | "old-city-wait"
  | "old-city-go"
  | "old-city-street"
  | "ruins-entry"
  | "ruins-procession";

export type GameSnapshotV5 = {
  version: 5;
  mobilityGuideSeen: boolean;
  unlockedTips: TipId[];
  objectiveId: string;
  scene: SceneId;
  resumeStage: ResumeStage;
  busState: BusTransitState;
  selectedSeatId: string | null;
  memories: MemoryId[];
  detourScore: number;
  activeElapsedMs: number;
  returnRequested: boolean;
  ending: EndingId | null;
  colorMemory: ColorMemoryPoint[];
  openingReply: OpeningReply | null;
  endingChoice: EndingChoice | null;
  routeChoice: RouteChoice | null;
  knownLandmarks: KnownLandmarkId[];
  busRideRecognized: BusRideLandmarkId[];
  npcChoices: Record<string, string>;
  eggTartPurchased: boolean;
  eggTartBoostRemainingMs: number;
  eggTartScentPrompted: boolean;
  settings: GameSettings;
};

export type EndingMetrics = {
  elapsedSeconds: number;
  detourScore: number;
  returnRequested: boolean;
};

export type HudState = {
  journeyGoal: string;
  objective: string;
  subtitle: string;
  prompt: string;
  memories: number;
  detours: number;
  sceneLabel: string;
  hintCooling: boolean;
  flashCooling: boolean;
  listenCooling: boolean;
  listening: boolean;
  contact: string;
  contactHistory: string[];
  knownLandmarks: KnownLandmarkId[];
  routeChoice: RouteChoice | null;
  eggTartBoostRemainingMs: number;
};

export type GameTextState = {
  coordinateSystem: "origin top-left; x right; y down; canvas 640x360";
  mode: "menu" | "tutorial" | "playing" | "paused" | "dialogue" | "ending";
  gameMode: GameMode;
  scene: SceneId;
  journeyGoal: string;
  player: { x: number; y: number; facing: "up" | "down" | "left" | "right" } | null;
  objective: { id: string; label: string; target: TilePoint };
  prompt: string;
  subtitle: string;
  contact: string;
  npcs: Array<{ id: string; label: string; x: number; y: number; distance: number }>;
  nearbySoundLandmarks: Array<{ id: string; label: string; direction: string; distance: number }>;
  recentEvidence: string[];
  knownLandmarks: KnownLandmarkId[];
  routeChoice: RouteChoice | null;
  openingReply: OpeningReply | null;
  movementSurface: "tactile" | "off-path" | "road" | "pathless" | "stationary";
  movementSpeedMultiplier: number;
  eggTartPurchased: boolean;
  eggTartBoostRemainingMs: number;
  insideEggTartScentZone: boolean;
  eggTartScentPrompted: boolean;
  cooldowns: { hintMs: number; flashMs: number; listenMs: number };
  flags: { controlsLocked: boolean; dialogueOpen: boolean; listening: boolean; ending: EndingId | null };
};

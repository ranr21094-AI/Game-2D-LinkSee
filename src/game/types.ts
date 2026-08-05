export type SceneId = "bus-stop" | "bus-interior" | "bus-ride" | "old-city" | "ruins";

export type TilePoint = { x: number; y: number };

export type TactileTileKind = "guidance" | "decision";

export type CaneSurfaceKind = "guidance" | "decision" | "stone" | "metal" | "obstacle" | "sign" | "seat" | "door" | "curb" | "person" | "card-reader" | "bell";

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

export type GameSnapshotV4 = {
  version: 4;
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
  settings: GameSettings;
};

export type EndingMetrics = {
  elapsedSeconds: number;
  detourScore: number;
  returnRequested: boolean;
};

export type HudState = {
  objective: string;
  subtitle: string;
  prompt: string;
  memories: number;
  detours: number;
  sceneLabel: string;
  hintCooling: boolean;
  contact: string;
};

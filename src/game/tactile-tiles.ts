import type { TactilePathDefinition, TactilePathNode } from "./types";

export const TACTILE_BRICK_SIZE = 16;

export type TactileBrickKind = "guidance" | "decision";

export interface TactileBrick {
  /** brick center in world pixels */
  x: number;
  y: number;
  kind: TactileBrickKind;
  /** travel direction in radians, screen coordinates (y axis points down) */
  orientation: number;
  /** index into the source path nodes, only for decision bricks */
  nodeIndex?: number;
  taskId?: string;
}

function nearNode(x: number, y: number, node: TactilePathNode, radius: number): boolean {
  return Math.hypot(x - node.x, y - node.y) <= radius;
}

/**
 * Rasterize a tactile path definition into 16px bricks.
 * Guidance bricks carry their travel direction; decision nodes become 4x4 dot bricks
 * that replace any guidance brick overlapping them.
 */
export function rasterizeTactilePath(path: TactilePathDefinition, brickSize = TACTILE_BRICK_SIZE): TactileBrick[] {
  const nodes = path.nodes;
  const decisions = nodes
    .map((node, nodeIndex) => ({ node, nodeIndex }))
    .filter((entry) => entry.node.kind === "decision");

  const bricks: TactileBrick[] = decisions.map(({ node, nodeIndex }) => ({
    x: node.x,
    y: node.y,
    kind: "decision",
    orientation: 0,
    nodeIndex,
    taskId: node.taskId,
  }));

  for (let index = 0; index < nodes.length - 1; index += 1) {
    const a = nodes[index];
    const b = nodes[index + 1];
    if (b.breakBefore) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) continue;
    const orientation = Math.atan2(dy, dx);
    const steps = Math.max(1, Math.round(distance / brickSize));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const x = a.x + dx * t;
      const y = a.y + dy * t;
      if (decisions.some(({ node }) => nearNode(x, y, node, brickSize * 0.75))) continue;
      if (bricks.some((brick) => brick.kind === "guidance" && Math.hypot(brick.x - x, brick.y - y) < brickSize * 0.5)) continue;
      bricks.push({ x, y, kind: "guidance", orientation });
    }
  }
  return bricks;
}

/**
 * Describe what a decision brick means, derived from path topology.
 * Screen coordinates have y pointing down, so a positive turn delta is a visual right turn.
 */
export function describeDecisionBrick(path: TactilePathDefinition, nodeIndex: number): string {
  const nodes = path.nodes;
  const node = nodes[nodeIndex];
  if (!node) return "4×4凸点：停下判断方向";
  const prev = nodes[nodeIndex - 1];
  const next = nodes[nodeIndex + 1];
  if (!next || next.breakBefore) return "4×4凸点：盲道在此中断，停下脚步";
  const incoming = prev
    ? Math.atan2(node.y - prev.y, node.x - prev.x)
    : Math.atan2(next.y - node.y, next.x - node.x);
  const outgoing = Math.atan2(next.y - node.y, next.x - node.x);
  let delta = outgoing - incoming;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) < Math.PI / 5) return "4×4凸点：前方继续，凸纹方向不变";
  return delta > 0 ? "4×4凸点：右侧出现新盲道" : "4×4凸点：左侧出现新盲道";
}

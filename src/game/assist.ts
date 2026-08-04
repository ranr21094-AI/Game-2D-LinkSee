import type { SceneId, TactilePathDefinition, TilePoint } from "./types";

export const PHONE_COOLDOWN_MS = 6000;

const DIRECTION_LABELS = ["右", "右下", "下", "左下", "左", "左上", "上", "右上"];

export function bearingLabel(from: TilePoint, to: TilePoint): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const index = Math.round(angle / (Math.PI / 4) + 8) % 8;
  return `${DIRECTION_LABELS[index]}方`;
}

export function describePhonePosition(sceneId: SceneId, player: TilePoint, path: TactilePathDefinition, objective: TilePoint): string {
  const nearest = path.nodes.reduce<{ node: TilePoint; distance: number } | null>((best, node) => {
    const distance = Math.hypot(player.x - node.x, player.y - node.y);
    return !best || distance < best.distance ? { node, distance } : best;
  }, null);
  const routeHint = nearest && nearest.distance <= 54 ? "你在凸纹附近" : "脚下暂时没有连续凸纹";
  return `${sceneId}：目标在${bearingLabel(player, objective)}，${routeHint}。`;
}

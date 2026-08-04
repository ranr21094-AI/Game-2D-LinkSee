import type { EndingId, HudState, SceneId, TilePoint } from "./types";

type EventMap = {
  hud: HudState;
  pause: boolean;
  ending: EndingId;
  scene: SceneId;
  announce: string;
  devTeleport: TilePoint;
  devInteract: undefined;
  devReveal: "hint";
  chapter: { from: SceneId; to: SceneId };
};

type Handler<T> = (payload: T) => void;

class TypedEventBus {
  private listeners = new Map<keyof EventMap, Set<Handler<never>>>();

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(handler as Handler<never>);
    this.listeners.set(event, set);
    return () => set.delete(handler as Handler<never>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners.get(event)?.forEach((handler) => (handler as Handler<EventMap[K]>)(payload));
  }
}

export const gameEvents = new TypedEventBus();

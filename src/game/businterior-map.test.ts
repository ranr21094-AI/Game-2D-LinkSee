import { describe, expect, it } from "vitest";
import { BUS_BELL_DETECTION_RADIUS, BUS_BELL_SPOTS, BUS_CARD_READER, BUS_INTERIOR_DOOR, BUS_INTERIOR_TILEMAP, BUS_SEATED_SPRITE_KEYS, BUS_SEAT_EDGE, BUS_SEAT_SPOTS, BUS_SEAT_SURFACE, isBusBellInRange, pickBusBellSpot } from "./businterior-map";
import { PATHS } from "./content";
import { isWalkable, solidDecorationAt, validateTileMap } from "./tilemap";

describe("bus interior free-exploration map", () => {
  it("is a complete 40 by 22 map without a tactile route", () => {
    expect(validateTileMap(BUS_INTERIOR_TILEMAP)).toEqual([]);
    expect(BUS_INTERIOR_TILEMAP.groundRows).toHaveLength(22);
    expect(BUS_INTERIOR_TILEMAP.groundRows.every((row) => row.length === 40)).toBe(true);
    expect(BUS_INTERIOR_TILEMAP.movementRows.every((row) => row.length === 40)).toBe(true);
    expect(BUS_INTERIOR_TILEMAP.requiresBrightGround).toBe(true);
    expect(PATHS).not.toHaveProperty("bus-interior");
  });

  it("keeps the upper-right door, card reader and seat edge reachable", () => {
    [BUS_INTERIOR_DOOR, BUS_CARD_READER, BUS_SEAT_EDGE].forEach((point) => {
      expect(isWalkable(BUS_INTERIOR_TILEMAP, point)).toBe(true);
      expect(solidDecorationAt(BUS_INTERIOR_TILEMAP, point)).toBeNull();
    });
    expect(isWalkable(BUS_INTERIOR_TILEMAP, BUS_SEAT_SURFACE)).toBe(false);
    expect(solidDecorationAt(BUS_INTERIOR_TILEMAP, BUS_SEAT_SURFACE)?.kind).toBe("bus-seat-row");
    expect(BUS_SEAT_SPOTS).toHaveLength(8);
    expect(BUS_SEAT_SPOTS.filter((spot) => !spot.occupied)).toHaveLength(4);
    expect(BUS_SEAT_SPOTS.filter((spot) => spot.occupied)).toHaveLength(4);
    BUS_SEAT_SPOTS.forEach((spot) => {
      expect(isWalkable(BUS_INTERIOR_TILEMAP, spot.approach), `${spot.id} approach`).toBe(true);
      expect(solidDecorationAt(BUS_INTERIOR_TILEMAP, spot.approach), `${spot.id} approach collision`).toBeNull();
      expect(solidDecorationAt(BUS_INTERIOR_TILEMAP, spot.surface), `${spot.id} surface collision`).toMatchObject({ kind: "bus-seat-row" });
    });
  });

  it("uses four walkable aisle bell spots and keeps the bell hidden in the map", () => {
    expect(BUS_INTERIOR_TILEMAP.decorations.filter((decoration) => decoration.kind === "bus-bell")).toHaveLength(0);
    BUS_BELL_SPOTS.forEach((spot) => {
      expect(isWalkable(BUS_INTERIOR_TILEMAP, spot)).toBe(true);
      expect(solidDecorationAt(BUS_INTERIOR_TILEMAP, spot)).toBeNull();
    });
    expect(pickBusBellSpot(0).id).toBe("front-left");
    expect(pickBusBellSpot(0.99).id).toBe("rear-right");
  });

  it("detects the active bell in every direction within 42px", () => {
    const bell = BUS_BELL_SPOTS[0];
    expect(BUS_BELL_DETECTION_RADIUS).toBe(42);
    [
      { x: bell.x + 42, y: bell.y },
      { x: bell.x - 42, y: bell.y },
      { x: bell.x, y: bell.y + 42 },
      { x: bell.x, y: bell.y - 42 },
      { x: bell.x + 29, y: bell.y + 29 },
    ].forEach((player) => expect(isBusBellInRange(player, bell)).toBe(true));
    expect(isBusBellInRange({ x: bell.x + 43, y: bell.y }, bell)).toBe(false);
  });

  it("shows four upper windows, two seat rows and a driver seat", () => {
    const windows = BUS_INTERIOR_TILEMAP.decorations.filter((decoration) => decoration.kind === "bus-window");
    const seats = BUS_INTERIOR_TILEMAP.decorations.filter((decoration) => decoration.kind === "bus-seat-row");
    expect(windows).toHaveLength(4);
    expect(windows.every((window) => window.y < 120)).toBe(true);
    expect(seats).toHaveLength(8);
    expect(seats.filter((seat) => seat.orientation === "upper")).toHaveLength(4);
    expect(seats.filter((seat) => seat.orientation === "lower")).toHaveLength(4);
    expect(BUS_SEATED_SPRITE_KEYS.upper).toBe("traveler-sit");
    expect(BUS_SEATED_SPRITE_KEYS.lower).toBe("traveler-sit-up");
    expect(BUS_INTERIOR_TILEMAP.decorations.some((decoration) => decoration.kind === "bus-driver-seat")).toBe(true);
    expect(BUS_INTERIOR_TILEMAP.decorations.find((decoration) => decoration.kind === "bus-driver-seat")?.orientation).toBe("driver");
    expect(solidDecorationAt(BUS_INTERIOR_TILEMAP, { x: 552, y: 300 })?.kind).toBe("bus-driver-seat");
    expect(isWalkable(BUS_INTERIOR_TILEMAP, { x: 320, y: 188 })).toBe(true);
  });
});

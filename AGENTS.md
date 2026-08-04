# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable visual direction

- 2026-08-04 superseded: the target is now a high-density 32px-feel top-down pixel town (reference images archived in `docs/q-align/`, modern blocks from refs 4/5, material richness from refs 2/3), brighter than the retired deep-indigo concept 3.
- The city base is a bright readable warm gray (bright dusk / overcast, never near-black, never horror). Cane contact restores the full warm Macau-after-rain color for about two seconds, then fades to a persistent ~35% pale-tint color memory.
- Keep the HUD in the corners with thin brass pixel frames; Chinese body copy must remain comfortably readable rather than using an all-pixel display face.
- The desktop game canvas is 640x360 with nearest-neighbor scaling and integer pixel alignment.

## 2026-08-04 rework decisions

- Replace the near-black presentation with a readable warm-gray city. Cane contact restores the original warm color for roughly two seconds, then leaves a persistent low-saturation color memory.
- Build a modern-to-old-city transition: the Barrier Gate is contemporary; Camoes Garden through the Ruins gradually becomes denser Portuguese-Chinese old town.
- Tactile paving is a semantic game layer, never baked into a background image. Guidance modules show four raised ridges; decision modules show a 4x4 dot grid with pixel highlights, shadows, and cane collision.
- Cane input is deliberately simple: one visible cane, Space for a precise 18–42px forward probe, and no Shift sweep mode. WASD and arrow keys both move the player.
- Short wrong branches are explorable and require the player to notice mismatched surfaces and return. There is no automatic reset.
- Q remains an optional direction arrow toward the current objective; it must not recolor or expose the full tactile route. The route-memory map idea is cut.
- Preserve the existing protagonist, Lam, route 17, memories, endings, and story. Rework the existing project in place and validate locally before any public deployment.

## 2026-08-04 complete-map decisions (confirmed with owner)

- Keep every level as a fixed 640×360 single screen. Every 40×22 cell has a ground material and movement meaning; outdoor scenes must visibly include building footprints, sidewalks, tactile paving, curbs, drainage and a carriageway.
- Maps use separate `groundRows`, `movementRows` and `decorations`. Architecture never decides walkability, and tactile paving remains its own semantic overlay.
- Main routes may be rearranged but every segment stays horizontal or vertical with 90° corners. Interaction points and resume points are snapped to 16px tile centers.
- Roads outside the marked zebra crossing are soft boundaries: traffic feedback grows, movement slows, then the player is eased back to the nearest sidewalk without failure or story reset.
- Whole-image scene backgrounds and permanent full-color facade strips are retired. Generated architecture may only enter the game as isolated modular sprites with base, memory and warm states.
- Saves use explicit safe resume stages and active-play elapsed time. Pauses, hidden tabs and offline gaps never count toward the ending timer.
- Ambient rain, traffic and bus recordings are bundled CC0 files; tactile and footstep signatures remain procedural fallbacks.

## 2026-08-04 tile-layer decisions (confirmed with owner)

- Maps are built as a true tilemap with standalone tile assets (no more single whole-image backgrounds as the scene). Tactile paving is a real, always-visible tile layer embedded in the pavement — 16px bricks whose four ridges / 4x4 dots are drawn with a chunkier 32px feel, with a 1px top highlight, 1–2px bottom shadow, and pavement seams. Cane contact only enhances the 2–4 bricks near the tip; nothing summons glowing route lines.
- Player and cane sprites depth-sort above the tactile layer so feet and cane tip occlude the bricks.
- Decision bricks trigger a short tactile-judgment readout derived from path topology (continue ahead / new path left / rail right / curb ahead).
- Interruption strategies are equal options: Space-probe to find the path, hold the rail, use phone location, or ask passersby. Pre-departure route briefing remains part of the bus segment.
- Milestone order: M1 validates the Camoes Garden segment (alight → tactile turn → find the rail); M2 bus segment; M3 old city density, crossing, full-color finale at the Ruins; M4 NPCs and delivery. Full plan: `docs/q-align/rework-plan.md`.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable visual direction

- 2026-08-04 superseded: the target is now a high-density 32px-feel top-down pixel town (reference images archived in `docs/q-align/`, modern blocks from refs 4/5, material richness from refs 2/3), brighter than the retired deep-indigo concept 3.
- The city base is a bright readable warm gray (bright dusk / overcast, never near-black, never horror). Cane contact restores the full warm Macau-after-rain color for about two seconds, then fades to a persistent ~35% pale-tint color memory.
- Keep the HUD in the corners with thin brass pixel frames; Chinese body copy must remain comfortably readable rather than using an all-pixel display face.
- The desktop game canvas is 640x360 with nearest-neighbor scaling and integer pixel alignment.

## 2026-08-05 lighting-rule and layout decisions (confirmed with owner)

- Page layout superseded the corner HUD: all function panels (objective, memory, contact, controls, pause, dev tools) live in a left sidebar (~1/4 width); the game canvas fills the right ~3/4, still integer-scaled at the native 16:9 ratio. Subtitles and chapter interstitials stay overlaid on the game view.
- F phone-position assistance is temporarily disabled and hidden from input capture, tutorial copy and HUD controls. Keep `assist.ts` and its tests available for a future re-enable.
- Chapter interstitials use a 640×360 warm-gray rainy pixel-city background with no route dots, route lines or in-image text; only the React from/to text card is overlaid. The bus ride uses a narrow pixel panorama inside the window and advances it in integer-pixel steps.
- Movement is restricted to brightly lit (warm) ground only: active color pulses (cane-tap radius 42 / 2s, spawn pulse, G flash) and forced-warm tiles are walkable; pale color memory and base gray are not. Exceptions: holding the old-city handrail, and the crossing walk/crossed states. Blocked moves announce a throttled hint instead of failing.
- G key is a phone-torch flash: radius-220 warm pulse for 1.8s plus a brief full-screen warm overlay, 8s cooldown.
- The cane sprite is anchored at the hand (y-28 with the feet-anchored 56px protagonist), tilted ±38° when facing left/right; when facing up (back view) the anchor shifts to the right-hand edge (x+10) and uses the UP texture tilted -20° so the cane visually points FORWARD (up-screen, the facing direction) from the right hand, depth-sorted behind the body so the grip stays occluded — never let the back-view cane point down-screen (that reads as backward). The logical probe point stays at the feet. Every Space tap also lights and reads the tile under the feet; forward probes (18–42px) keep priority so standing on a decision brick never masks objects ahead.
- Space probe range stays 18–42px (owner reviewed a 24–56px proposal and chose to keep the current tuning).
- Canvas zoom fits the right pane proportionally at the native 16:9 ratio (fractional zoom allowed, nearest-neighbor rendering kept) — strict integer zoom left the canvas tiny at common browser zoom levels such as 150%. A ResizeObserver on the mount recomputes the zoom on any layout change.
- Decorations support `solid` (plus `solidWidth`/`solidHeight` for a smaller blocked strip at the base): solid footprints are non-walkable via `isWalkable` and read as obstacles to the cane. The Barrier Gate, both benches and both stop-sign poles are solid in the bus-stop map.
- Stop signs are map decorations (`stop-sign-17` / `stop-sign-25` programmatic sprites with warm/memory states), placed beside — never on — the tactile route; cane reading points stay within a Space probe of the route. The find-stop-sign objective target is the walkable approach point next to the sign, not the plate itself.
- The Barrier Gate is now built entirely from repeated 16px programmatic facade tiles (parapet, window, wall, canopy, pillar and entrance modules), plus a code-rendered "拱北口岸" sign module. The old generated facade is reference-only and must never be loaded at runtime.
- A new journey begins at the Barrier Gate entrance with movement and cane taps locked. A staff NPC walks over, faces the player, identifies themself and asks consent. The player must press E to open the manual-close sighted-guide teaching card; closing it fades the scene to the existing tactile-path start and records `mobilityGuideSeen`. The same guide is saved as the first data-driven `盲人小贴士` and can be reviewed from the left sidebar. The card emphasizes offering an elbow, walking half a step ahead and describing visible road conditions.
- The bus interior intentionally has no tactile path, decision bricks, continuous ridges or route-deviation scoring. After boarding, the player freely explores with the cane to locate the card reader, seat edge and stop-request bell; Space confirms a surface and E performs the action.
- Bus-stop benches are interactive: near a solid bench the prompt offers E 坐下; sitting teleports the player onto the seat facing the road, locks movement and cane taps (Q/G/H still work), suspends detour tracking and hides the cane; E 站起 returns the player to the pre-sit walkable spot. Sitting swaps the player to a dedicated AI-generated sitting sprite (`traveler-sit.png`, transparent 64x64) instead of reusing the standing frame; standing up restores the walk spritesheet frame.
- The bus shelter and its bench were shifted 4 tiles (+64px) right as one assembly; the shelter drops its middle post, and its back-panel board is widened to carry the centered canvas text "澳门欢迎您" in all three visual states.

## 2026-08-05 game-mode decisions (confirmed with owner)

- Two game modes selectable on the title screen and in the pause menu (`settings.gameMode`): the existing presentation is 体验模式 (experience); 黑夜模式 (night) starts fully black — unlit ground and tactile bricks render pure black (tints 0x000000, completely invisible), cane light lasts the usual ~2s then fades back to black with NO persistent color memory (mergeColorMemory is skipped). Q behaves identically in both modes: the direction arrow toward the objective plus the spoken direction text (the night-mode objective-light-pulse variant was reverted).
- `startNewGame` preserves settings (mode and volumes) instead of resetting to defaults.
- Both modes: full speed only on the tactile path (within 13px of a route segment, or while holding the old-city handrail); off-path walkable/crossing ground slows to 50%. The road keeps its own 0.4 penalty without stacking.
- Both modes: G (flash) lights the WHOLE screen for ~1.5s — every ground tile renders warm and every tactile brick renders lit with no radius limit — and locks movement and cane taps for the duration (Q/H still work); cooldown 8s. It no longer pushes a radius-220 color pulse and never writes color memory.

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

# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable visual direction

- The selected target is concept option 3: a top-down chunky 16-bit Macau streetscape after rain at dusk.
- Use deep indigo/slate scenery, restrained warm amber windows, a warm-gold cane reveal cone, continuous four-ridge tactile paths, and 4x4 decision dots.
- Keep the HUD in the corners with thin brass pixel frames; Chinese body copy must remain comfortably readable rather than using an all-pixel display face.
- The mood is quiet, warm, and dignified—never horror.
- The desktop game canvas is 640x360 with nearest-neighbor scaling and integer pixel alignment.

## 2026-08-04 rework decisions

- Replace the near-black presentation with a readable warm-gray city. Cane contact restores the original warm color for roughly two seconds, then leaves a persistent low-saturation color memory.
- Build a modern-to-old-city transition: the Barrier Gate is contemporary; Camoes Garden through the Ruins gradually becomes denser Portuguese-Chinese old town.
- Tactile paving is a semantic game layer, never baked into a background image. Guidance modules show four raised ridges; decision modules show a 4x4 dot grid with pixel highlights, shadows, and cane collision.
- Manual cane mode: hold Shift, use A/D to swing the cane, and use W/S for careful forward/back steps. Space remains a precise forward tap.
- Short wrong branches are explorable and require the player to notice mismatched surfaces and return. There is no automatic reset.
- Q remains an optional direction arrow toward the current objective; it must not recolor or expose the full tactile route.
- Preserve the existing protagonist, Lam, route 17, memories, endings, and story. Rework the existing project in place and validate locally before any public deployment.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

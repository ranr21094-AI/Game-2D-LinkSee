# Design QA

## Evidence

- Source visual truth: `C:\Users\10127\.codex\generated_images\019fbb02-4d10-7761-8593-5ff0b86f3527\exec-b1a19eb4-8278-4fd7-96ad-d2411b80c109.png`
- Browser implementation capture: `C:\Users\10127\OneDrive\文档\LinkSee\web-game-2d\qa-game-old-city-final.png`
- Side-by-side comparison: `C:\Users\10127\OneDrive\文档\LinkSee\web-game-2d\qa-comparison.png`
- Browser URL: `http://127.0.0.1:4173/`
- Viewport: 1280 × 720 CSS pixels, device scale factor 1
- Source pixels: 1672 × 941; normalized to 1280 × 720 with nearest-neighbor resampling for comparison
- Implementation pixels: 1280 × 720
- State: Old City scene, character on tactile route, 90-degree cane sweep active, developer jump controls hidden

## Full-view comparison evidence

The implementation retains the selected concept's top-down chunky pixel composition, dark indigo rain-wet Macau, warm amber windows, Ruins of St. Paul destination, brass-framed corner HUD, warm-gold reveal, white cane and beige-coated traveler. The gameplay version intentionally uses a 90-degree sweep sector and reveals only path fragments inside the sector, matching the approved mechanic rather than treating the concept's larger glow as a static decoration.

## Focused-region comparison evidence

The normalized 1280×720 comparison keeps the top-left task panel, top-right memory panel, player/cane silhouette, four-ridge path and 4×4 decision dots readable in the full image, so separate crops were not needed. These regions were checked individually in the combined image.

## Required fidelity surfaces

- Fonts and typography: serif display Chinese and readable sans-serif support text reproduce the concept hierarchy; small HUD copy remains legible.
- Spacing and layout rhythm: task, memory and control panels occupy the same three corners without obscuring the playable center.
- Colors and visual tokens: deep navy/slate base, restrained amber scenery and warm-gold interaction state match the target.
- Image quality and asset fidelity: all scenery and character art are raster assets in one coherent pixel-art direction; nearest-neighbor rendering is enabled and no placeholder or CSS-drawn game art remains.
- Copy and content: the concept's short destination label is expanded to actionable task copy because the game must explain decision tiles without relying on sound.

## Comparison history

### Pass 1 — blocked

- P2: the old-city player spawned too close to the lower edge and the feet/cane were clipped.
- P2: the developer-wide hint drew entire route segments outside the intended reveal area, visually overwhelming the scene.

Fixes made:

- Moved the old-city spawn and first route node upward.
- Subdivided tactile route segments and clipped every subsection to the active reveal sector.
- Recaptured the implementation at the same viewport and state with developer controls hidden.

### Pass 2 — passed

- No actionable P0/P1/P2 differences remain.
- P3 follow-up: the selected concept uses a broader, softer semicircular echo volume, while the playable sweep is a stricter 90-degree sector. This is an intentional mechanic difference and can be softened later without changing range.

## Primary interactions tested

- Start menu → tutorial → playable bus stop
- Bus interior in `boarding` state → seat prompt → direct `E` interaction → `seated` → ride cutscene
- Ride cutscene → arrived checkpoint → White Dove Garden / Old City
- Old City target → Ruins scene → Lin interaction → ending
- Pause → request help → second confirmation → “迷途折返” ending
- Console checked after the startup fix; no new runtime errors appeared in the verified flow

## Findings

No actionable P0/P1/P2 findings remain.

## Follow-up polish

- P3: add a slightly softer outer dither edge to the sweep sector after gameplay timing is locked.
- P3: add two-frame walk cycles for each direction while retaining the generated character proportions.

final result: passed

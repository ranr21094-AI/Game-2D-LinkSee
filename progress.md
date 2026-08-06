Original prompt: 请你在本地进行修改，按照plan1.md

# Progress

## Design baseline

- Visual thesis: 雨后的澳门沉入温暖的灰色，白杖、声音和记忆让城市局部重新显色。
- Content plan: 强识别主菜单 → 可操作的触觉教程 → 以白杖和声音为核心的旅程 → 有回应的角色重逢。
- Interaction thesis: 白杖触碰形成局部暖色脉冲；NPC 依任务阶段回应且允许拒绝帮助；场景转换和弹窗使用短促像素式进出场。
- Scope: improve the normal game only; do not add demo-only shortcuts, jump flows, or a demo mode.
- Core invariants: preserve the 640×360 canvas, 16px tilemap, Space probe range, tactile-path semantics, two game modes, and no automatic route completion.

## Current work

- 2026-08-06: Removed the 17路途中 bus-ride cutscene. Ringing the cabin bell now jumps directly to old-city (白鸽巢) with no riding scene; `oldCityCheckpointAfterBell` lands on `busState: "arrived"` so the old-city entry alights the passenger and plays "你在白鸽巢下车". Deleted the `BusRideScene` class, `bus-ride` SceneId/resume-stage/checkpoint, the `ride-to-camoes` objective, `BusRideLandmarkId`/`busRideRecognized` fields, the window-panorama asset and its source docs. The `bus-ride-access` tip, bell flow, and bus state machine are unchanged. Verified with `npx tsc -b`, 107/107 vitest, `npx vite build`, and a headless-Chrome bell→old-city smoke test (chapter label "17路 · 车厢 → 白鸽巢 · 旧城街市").
- 2026-08-06: Removed the sound-landmark collection system (knownLandmarks persistence, discoverLandmark, HUD 声音地标 counter, pause notes list, ending metric) while keeping the R-listen mechanic and its four touch+sound combo gates. Memories trimmed to three (old-city-bell, egg-tart 暖掌葡挞, ruins-rain 牌坊雨声) with a new MEMORY_DEFINITIONS catalog and pause-panel 记忆清单; HUD shows 记忆 n/3 and tips n/5; removed bus-rain and border-hand memories.
- 2026-08-06: Read `plan1.md`, `AGENTS.md`, core scene state machines, NPC definitions, UI, styles, tests, and current screenshots.
- Confirmed starting branch `main` tracks `origin/main`; no pre-existing source changes.
- Added deterministic `window.render_game_to_text()` and `window.advanceTime(ms)` hooks for browser verification.
- Fixed the main-flow bus ride checkpoint, modal keyboard/focus behavior, gate-intro objective, Q during G flash, movement tiers, NPC color state/collision, completed-save menu behavior, and stale README content.
- Added contextual three-choice dialogue for the gate worker, crossing traveler, flower vendor, bus passengers, pet-shop clerk, and reunion; accepting or declining assistance preserves the normal route.
- Added recent tactile history, F fullscreen handling, explicit Q/G cooldown feedback, fabric seat audio, mode-accurate copy, and non-time-punitive ending logic.
- Reworked the title composition, tactile tutorial samples, HUD hierarchy, dialogue layer, shared modal styling, and low-height scrolling while retaining the existing pixel assets and 640×360 canvas.
- Browser verification found and fixed a real input-order bug: Phaser could intercept the second E before React's late NPC/modal listeners. Keyboard routing is now registered before the game engine; E/Enter/Esc, focus restoration, F fullscreen, and Esc fullscreen exit were re-tested in Chromium.
- A normal-state-machine journey (development teleport used only to shorten walking) now completes menu → gate dialogue → 17 sign → boarding → card reader → seat → bell → bus ride → crossing → pet-shop knowledge beat → ruins reunion, ending with `reunion` and no console errors.
- Visual screenshots were inspected for 1280×720, 1440×900, 1024×640, experience mode, night mode, all five scenes, dialogue, knowledge guide, cooldown state, and ending.
- Final checks: `npm test` passes 83/83; `npm run build`, `build:offline`, `build:sites`, and `test:sites` all pass. Vite still reports the repository's intentionally large inlined bundle warning.

## Completed audit

- No demo mode, production jump control, auto-route completion, generated art, dependency file, screenshot, or cache was added to the tracked tree.
- Preserved the 640×360 canvas, 16px tilemap, Space probe distance, two-second cane color response, normal/night mode semantics, and required pet-shop knowledge beat.
- No commit or push was performed; all changes remain local for owner review.

## Plan 2 planning handoff

- 2026-08-06: Drafted `../plan2.md` for an opening appointment with Lin, a persistent journey goal, and richer perception-driven play.
- The proposed core loop is listen, probe, infer, choose, receive feedback, and retain a route memory; it does not add demo-only shortcuts or auto-navigation.
- Recommended implementation order is narrative bookending, active listening and combined clues, converging route choices, then final visual/audio polish.
- No gameplay source code, commit, or push was performed during this planning step.

## Plan 2 addendum

- 2026-08-06: Expanded `../plan2.md` with an original old-city egg-tart stall, a one-minute +25% movement boost, and deterministic timer/save rules.
- Owner-defined movement rule is now explicit: in outdoor maps that contain tactile paving, every traversable non-tactile surface is exactly 35% of tactile-path speed; the intentionally pathless bus interior remains full speed.
- Added a required visual acceptance pass: standing characters use the same 64×64 logical scale as the protagonist, while seated/wheelchair bodies retain matching human proportions.
- This update changes planning documentation only; gameplay source, commits, and remotes remain untouched.
- Owner revision: the egg-tart boost now means a 60% increase over current movement speed (`1.60×`), superseding the earlier `1.25×` draft while preserving the exact 0.35 off-path/path ratio.
- Owner revision: the stall now has an explicit walkable scent-tile zone (planned as a clipped 6×3 grid in front of the counter). First entry announces “你被蛋挞的香气环绕”; staying inside does not retrigger it.

## Plan 2 implementation

- 2026-08-06 baseline: `npm.cmd test` passed 83/83 and `npm.cmd run build` passed before Plan 2 implementation.
- Added the v5 data model, V4 migration path, journey/ending copy helpers, data-driven sound landmarks, explicit egg-tart constants and pure tests.
- Locked movement math to 0.35 off tactile paving and 1.60x during the planned one-minute egg-tart boost; new pure tests cover the exact 108.8px/s and 38.08px/s values.
- Frontend direction remains the existing warm-gray rain city with one brass-gold sensory accent; the new opening, listening state and boost UI should remain sparse and subordinate to the 640x360 game canvas.
- This entry records the implementation baseline; completion and acceptance results follow below.

## Plan 2 completed and accepted

- 2026-08-06: Completed the appointment opening, old-photo callback, three tone-only opening replies, persistent journey/current-action HUD, `H` repeat behavior, and three equally successful reunion choices.
- Added global `R` listening (1.2-second focus, directional/distance subtitles, two-second cooldown), recent perception evidence, confirmed landmark notes, and touch + sound combination checks at the 17 stop, card reader, old-city crossing, and ruins wheelchair approach.
- Added converging shop-wall/curb-edge old-city routes, non-QTE bus sound recognition, reciprocal tourist help, remembered NPC choices, and separated safe exploration from dangerous road incursions.
- Added the original 96×64 pixel egg-tart stall and 64×64 vendor, explicit reachable 6×3 scent tiles, the exact one-time announcement `你被蛋挞的香气环绕。`, near-only purchase, and a one-purchase 60-second `+60%` boost that persists across scenes/saves without stacking or refreshing.
- Locked outdoor movement to exactly `1.00` on tactile guidance and `0.35` everywhere else, with the pathless bus interior at `1.00`; the boost multiplies both tiers by `1.60`, preserving the exact `0.35` ratio.
- Unified standing characters to 64×64 logical frames and visually checked the protagonist, workers, pedestrians, passengers, egg-tart vendor, tourist, Lin's daughter, and wheelchair proportions. New UI/art follows the existing warm-gray rain, brass-gold sensory highlight, hard-pixel, nearest-neighbor language.
- Browser acceptance exercised opening/tutorial, bus/card-reader clues, crossing clues, both egg-tart interactions, scent prompt, timer freeze/resume, pause notes, bus ride, ruins clue/reunion, reduced-motion finale, and ending. Page console warnings/errors filtered to the local app were empty.
- Visual acceptance passed at 1024×640, 1280×720, and 1440×900. The low-height pause panel scrolls internally; HUD, canvas, dialogue, stall, characters, and ending remain readable without clipping.
- Final checks: `npm.cmd test` passes 94/94; `npm.cmd run build`, `build:offline`, `build:sites`, and `test:sites` all pass (Sites 4/4). Vite retains the known large single-bundle warning because the game intentionally ships embedded art/audio and an offline single-file build.
- No dependency manifest changed, no commit was created, and nothing was pushed. All implementation remains in the local working tree pending owner review and explicit main-push permission.

## Post-acceptance blocker fixes

- 2026-08-06: Fixed the old-city crossing soft lock. The verified `E` press was read once by the “missing evidence” condition and then read a second time by the request branch; Phaser's `JustDown` had already been consumed. The interaction now reads once and routes that single press to either guidance or a valid crossing request.
- Corrected the bus card-reader sound landmark from the door coordinate to the physical reader coordinate, and reordered listening feedback so scene-specific combination success remains visible instead of being immediately replaced by the generic listening report.
- Added a regression assertion anchoring the sound landmark to `BUS_CARD_READER`. Final checks pass: 95/95 unit tests, production build, browser card-reader chain, browser crossing chain, screenshot inspection, and an empty local-app console error/warning filter.
- The existing local development server remains available at `http://127.0.0.1:5173`. No commit or push was performed.

## Pet-shop interaction and trigger audit

- 2026-08-06: Replaced the pet shop's pixel-tight circular check with a vertical frontage interaction zone aligned to the full visible `猫记宠物` sign (y=132..196) and the adjacent walkable tactile corridor. The E prompt now appears at the original decision brick and at the lower doorway/sign frontage.
- Added save-state self-healing for scene/objective mismatches. Old-city objectives now restore the matching crossing/street stage; the same audit also repairs `board-17` and `follow-wheelchair` resume stages. This prevents a displayed downstream objective from being silently gated by an earlier scene state after migration, refresh or development navigation.
- Centralized fixed objective proximity checks through each objective's declared `triggerRadius`, removing duplicated hard-coded values in the bus card reader, crossing, old-city turns, terminus and ruins reunion checks.
- Added regression coverage for the full pet-shop frontage, exclusion from the preceding turn and bank terminus, mismatched-stage repair, and walkability of every concrete objective target.
- Acceptance passed: 99/99 unit tests, production build, and headless-Chrome gameplay at `(536,140)` and `(536,191)`. Both positions showed `E  与宠物店员交谈`; E opened the clerk dialogue. The deliberately mismatched save normalized to `old-city-street`, screenshots were visually inspected, and browser warnings/errors were empty.
- No commit or push was performed.

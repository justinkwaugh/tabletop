# YINSH: review notes (temporary)

> Delete this file in the commit that finishes the readiness fixes. It guides the review and is not part of the title.

> "The author" below is the title's author, who opened this PR. Where a fix would change a choice marked as theirs, ask on the PR before changing it.

This branch has had only two readiness commits: the move to upstream's Rolldown/Vite 8/ESLint 10 tooling (`dba98c22c`) and "Ready YINSH for review: visibility, randomness, WebP cover" (`24e043093`). The four GIPF project titles already on `main` (GIPF, MATRX GIPF, GIPF with Potentials, ZÈRTZ) needed the fixes below; each cited commit is on `main` and shows a worked fix. The statuses come from reading this branch, not from running the review, so run `game-pr-readiness` as usual and treat these as leads. Harness port 5204.

## Preserve

Rule readings agreed with the author (seed `games/yinsh/docs/rules-interpretations.md` from these; Rio Grande 2016 rules, which gipf.com agrees with):

- Two versions: Standard (three rings to win, default) and Blitz (the first ring taken wins).
- First player plays White (rule C2), whatever the seating.
- A player none of whose rings can move passes; if neither player can move, the game ends as on an empty pool: most rings removed wins, equal counts draw (both players recorded as winners).
- The empty-pool check comes after the move and every row and ring removal it caused, for both players. A row made with the last marker returns its markers, and play goes on.
- The mover resolves their own rows first and wins on their third ring even if the opponent's third row formed in the same move; the opponent then takes their rows and rings before moving. Crossing rows let the remover choose; a run longer than five lets them choose any five adjacent.

Looks the author chose (do not restyle):

- One matte board in the printed board's colours: table `#8fb3ca`, play area `#d6e4eb`, dark table ink. No storm, no clouds, no dark mode, no theme toggle. The pale area ends exactly at the outer lines, notches included; no spots at line nodes; whiskers 0.15 of a step.
- Pieces: straight sides, flat tops, light edge rounding (not GIPF-round); ring 0.46 × spacing; marker face 90% inside a blue lip as tall as a ring, faces sitting slightly down inside it. Specks on ring faces, sides and inner walls, and on the markers' blue lips and sides; black and white marker faces stay clear. Each piece's specks are its own and follow the piece (rings by ring id).
- Ring spaces: White's top-left, Black's bottom-right for every viewer, painted in the play colour at 0.7 opacity, shifted inward (`SLOT_SHIFT`). Player cards draw removed rings with the board's seeds (`removedRingSeed`) and empty slots as the board's ring space.
- White panels with soft shadows (action bar, cards with a small ring beside the name and no colour band, history list and playback strip with disabled `#a9bac8`). BoardSpace labels: letters below columns, numbers before lines. Markers-left count centred in the header (white marker over black).
- Marks: cyan two-tone rings on pieces, cyan destination spots, orange dashed rings for rings to remove. Shadows are radial gradients (a blur filter left stale pixels on the iPhone).

Motion the author chose:

- Ring placement drops with a small bounce (`DROP`).
- Choosing a ring drops the staged marker into it (`dropIn`); the marker is drawn over the ring once above it. Letting go (tap again, tap off, Undo, choosing another) lifts it back out (`liftOut`, 0.18 s).
- A move: the ring lifts off over the marker it leaves, flies with LYNGK's claim motion (touch down short, skip, slide in, `ringFlight.ts`), and blows over the markers it passes just behind it, each turning along the ring's path. Nearer pieces cover the low flier (occluders hidden with `display`, not `visibility`).
- Taken row markers float up one after another; a removed ring flies to its space in 0.5 + 0.065·√spaces s.
- Undo of your own move flies the ring back around the marker it left, which stays standing, and re-chooses the ring with the marker in it (`restaged`); the next Undo lifts the marker out. Undo of a row removal drops the markers back in. Choosing the ring again by hand drops the marker in afresh.
- Tap off the choices lets go of the chosen ring or row end. A row is taken by tapping a marker that settles one row, or one end and then the other.

Preferences: only `showCoordinates` (the icon-only A1 toggle, default on). YINSH has no stack limit and no far-side toggle; do not add them.

Conflicts to watch: B5 against the agreed "neither can move" ending; D8's "fade in where they stand" against the drop-back and fly-back Undo motions; F2 and F6/F7 against the flight, flip and speck looks. Each is noted at its item.

## Fixes

### Metadata and logic

- **A1 `hasScores: false`: applies.** `games/yinsh/src/definition/info.ts:7-20` has none. Example: gipf `7dd4828da`.
- **A2 Win/loss `finalScores`: applies.** `games/yinsh/src/definition/scoring.ts:5-8` returns `ringsRemoved`. Winner 1, loser 0, a draw 1 each (`winningPlayerIds` holds both). The end panel reads rings removed from state, so it is unaffected. Example: gipf `9824eb4b5`, zertz `b2a9b91fb` (draw).
- **A3 Turn series keeps the latest turn: applies.** Nothing reads past turns (only `currentTurn()`). Set `turnManager.seriesKeeps = 'latest'` after `HydratedTurnManager.generate` in `games/yinsh/src/definition/initializer.ts:29-33`, with a playout test that the series stays short (gipf `game.spec.ts:337`). Example: gipf `36405defd`.
- **A4 Config normalised and validated: applies.** `versionFromConfig` (`config.ts:44-49`) reads an unknown version as Standard. Reject it instead. Example: GP `4497039ac`.
- **A5 Per-choice descriptions: applies.** The `version` option (`config.ts:24-36`) has only the combined text. Give Standard and Blitz each a `description` and keep the combined one. Example: gipf `d0c84518d` (see `games/gipf/src/definition/config.ts`).
- **A7 BoardGameGeek link: applies.** Add `bggId` to `info.ts` (YINSH is 7854 on BGG; confirm). Example: zertz `e35ef711b`.
- **B1 State keeps only what play changes: applies.** `YinshBoard` stores all 85 points with optional fields (`board.ts:9-20`, `emptyBoard` at `:31-33`). Store only occupied points (ring with player and id, marker with player) and take the points from `POINTS`. Once B6 makes ids required, `ringsRemoved` repeats `removedRingIds.length` (`playerState.ts:10-12`), so keep one. Check with the author whether `resolvingPlayerIds` (`gameState.ts:34`, `turnFlow.ts:5-18`) should go: it is always `[turn holder, opponent]` minus whoever has no row left, which the turn manager and board already give (gipf dropped `moverId` for the same reason). Regenerate the scenarios (`scripts/build-scenarios.mjs`). Example: gipf `f05f55d97`, matrx `c0b02ff0c`, `908d7a0e9`.
- **B2 One rule, one helper: applies.** The board's lines are rebuilt in `Board.svelte:39-48` by walking `includesCoords(POINTS, …)`, and the missing corners again in UI `board/geometry.ts:141-144`. Both repeat logic `geometry.ts` (`lineFrom`, `isPoint`, the private `CORNERS`); export and reuse those. `HydratedYinshGameState.moveRing` (`gameState.ts:104-108`) repeats the checks `HydratedMoveRing.isValid` already makes. Example: zertz `ffc841dbb`.
- **B3 Shared helpers, asserts, no casts: applies.**
    - Logic `ringDistance` (`geometry.ts:31-33`) is `distanceAxial(coords, origin)` from `@tabletop/common`.
    - The UI keys points with its own string `coordsKey` (`board/geometry.ts:137`); the merged titles use `coordinatesToNumber`.
    - Silent fallbacks to turn into asserts: `currentTurn()?.playerId === undefined ? []` in `movingRing.ts:28-29` and `placingRings.ts:27-28`; `action.metadata?.flipped.length ?? 0` and the skipped `RemoveRing` branch in `history/historyEntries.ts:59,77-82`; the optional `ringsRemoved` in `entryText.ts:154-156` and the `ordinal` fallback at `:162`; `?? members[0]` in `board/coordinates.ts:27`; `GameEndPanel.svelte:183-186`, which treats any non-`PoolEmpty` reason as "Neither player could move".
    - Casts: `as Rgb` in `board/pieceShape.ts:212` (zertz added a `mapRgb` helper) and `(this.flierParts as Record<string, Element>)` in `animators/boardAnimator.svelte.ts:169`. The `+page.svelte` cast is template code shared by every title; leave it.
    - Examples: gipf `4296ad4c4`, zertz `0c7bc289d`, `d3d5d3bda`, matrx `28c413199`.
- **B4 Unread metadata dropped: applies.** `RemoveRing` metadata `won` (`removeRing.ts:11,49`) is never read. `RemoveRow` metadata `markers` (`removeRow.ts:8-10,50`) is `pointsBetween(from, to)`, which the animator could read instead (`boardAnimator.svelte.ts:239`); ask before dropping it. Example: matrx `2fca25a7f`, `27cf1927c`.
- **B5 Unreachable branches: check, conflicts with an author choice.** `state.markersInPool() > 0` in `HydratedMoveRing.isValid` (`moveRing.ts:56`) cannot fail, because the game ends when the pool empties; probe it and delete it if it never fires. The `NoMoves` ending (`turnFlow.ts:29-32`) is the agreed rule and is practically unreachable (the author knows). Do not delete it: test it from a constructed position (B7), or ask the author. Example: matrx `19f475a13`.
- **B6 No compatibility code: applies.** `ringId` (`board.ts:13`) and `removedRingIds` (`playerState.ts:12`) are optional "for games saved before ids", although the title was never deployed. Make them required and remove the fallbacks: `board.ts:84-88,123`, `gameState.ts:116-121`, `ringSeed`/`removedRingSeed` in UI `board/ringSeeds.ts:6-17`, and the test "gives no ids to a game saved without them" (`game.spec.ts:290`). Example: matrx `c0b02ff0c`.
- **B7 Every rule reading recorded and tested: applies.** `games/yinsh/docs/rules-interpretations.md` is missing; write it from the Preserve list. Tests cover passing, mover-first wins, draws and the empty pool, but not the `NoMoves` ending. Add a test that the first player is White without a `startingPositions` assignment: every test passes `[W, B]` (`game.spec.ts:56`). Example: gipf `45eaf4ced`, `bb8e1b48b`.
- **B8 Competition spec: applies.** Add `games/yinsh/src/definition/competition.spec.ts` and `tests/playthrough.ts` over Standard and Blitz. Example: gipf `9824eb4b5`, matrx `4893fac3f`.

### Session and staged selection

- **C1 `localSelections`, no `undo()` override: applies.** `YinshGameSession.undo` (`model/session.svelte.ts:113-121`) pops the selection itself, and `Header.svelte:45` reads `hasManualSelection()`. Register `undoableStagedSelection(YinshStageOrder, …)` in the constructor and have the Undo button read `hasLocalSelection`. Keep the lift-out: the setter must still set `lifting` when the popped stage was `from`, as `undo()` does now. Example: gipf `f527b9e17`, zertz `158cc765a`.
- **C2 Stage-order spec: applies (test only).** No decision takes several taps (choosing another ring replaces `from`), so no stacked stage is needed. Add the test that a stage outside `YinshStageOrder` throws to `model/stagedSelection.spec.ts`. Example: gipf `c91b44ce8`.
- **C3 Selection belongs to its maker: applies.** There is no `selectionOwner`. A restaged ring (`beforeNewState`, `session.svelte.ts:131-137`) is set whoever views. The harness's Non-active view sees nothing (`chosenFrom` needs `movable`) but still gets an Undo button that pops an invisible selection. Add `selectionOwner`/`ownSelection`, as gipf `session.svelte.ts:53-60,247-263` does. Example: gipf `ec35a3152`.
- **C4 No taps while a move plays: applies.** `isClickable`/`choosePoint` (`session.svelte.ts:148-175`) never check `updatingVisibleState`. The selection outlives the move's animation (`beforeNewState` runs after it), so destinations stay tappable while your ring is still flying. Example: matrx `bb1ad8e0c`.
- **C5 Header names the player to act: applies.** `Header.svelte:9,27` shows `turnManager.currentTurn()`. When a move makes a row for the opponent, the opponent takes it during the mover's turn (`RemovingRow`/`RemovingRing` set `activePlayerIds` from `resolvingPlayerIds`), and the header names the mover. Use `activePlayerIds[0]`. Example: matrx `13b3e5cbd`.
- **C6 Restage on your own Undo only, checked against the incoming state: applies.** `willUndo` sets `undoingMove`, which is cleared only by a later non-undo transition's `beforeNewState` (`session.svelte.ts:127-137`). Because `beforeNewState` runs after the animation, `keepsMarker` (`:140-142`, read at `boardAnimator.svelte.ts:412`) can still see a stale move during the next history step. Restage, and keep the marker, only when the undone move's `index` equals the incoming state's `actionCount`, and not in the Non-active view: copy gipf's `restagedPush` (`games/gipf-ui/src/lib/model/session.svelte.ts:240-245`). Example: gipf `b277355f5`, zertz `5bbd25aed`.

### Animation

- **D3 Guard `afterAnimations`: applies.** `boardAnimator.svelte.ts:264-272` always sets `pieces` and `removed` from `to`. Capture `this.session.gameState` at the start and skip those writes if another state was shown since. Example: gipf `e40541610`.
- **D4 The session can stop a move: applies (abandon only).** There is no `moveInterrupter`. Add `abandon()` on `view-switch` in `beforeNewState`, landing the context's timeline with `progress(1)`. There is no far-side toggle, so `interrupt()` has no caller, and A1 moves nothing. `fly()` and `flip()` drive their poses from `onUpdate`/`onStart`/`onComplete` (`boardAnimator.svelte.ts:493-499,540-557`), which a seek skips; F2's setter-driven poses fix that too. Example: gipf `79f0d563c`, zertz `bbb329009`.
- **D7 Actionless steps within 0.2 s: check.** The quick path looks within budget: `QUICK` 0.18 s for flights, flips and lifts, markers staggered to finish by 0.18 s, `liftOut` 0.18 s, one `await tick()`. Nothing measures it; add the spec (G2). Example: matrx `4c9d54c1a`, (M) `cd2ef6b20`, zertz `e60bc9cce`.
- **D8 Lift-off only when the player lets go: check, partly conflicts with an author choice.** The staged marker already lifts out only on the player's own paths (`chooseRing`, `letGo`, the Undo pop). A cleared selection removes it without motion because it has no outro. Once C3 lands, add the owner check, as gipf's `releasedByPlayer` does. Do not apply "pieces an Undo puts back fade in where they stand": the author chose markers that drop back in on Undo of a row and a ring that flies back on Undo of a move (`fallback`, `boardAnimator.svelte.ts:349-422`). Keep those within D7's budget and record them in the visual contract. Example: gipf `c7d160278`.
- **D10 A piece is drawn once: applies.** `PoolCount.svelte:80` counts `session.gameState.markersInPool()`. The shown state still counts the staged marker sitting in the chosen ring, and keeps counting it through the move until the state lands. Leave the staged marker out of the count, and set the landing count as a step that places or returns markers starts, like `landingReserves`. Also check the cards (`PlayerTray.svelte:146-151`): they fill a slot only when the state lands, while the board's slot fills as the ring lands, and they show a returning ring until the Undo lands. Example: gipf `c29b32285`.
- **D11 Committed move from a mid-drop staged marker: check.** If the player taps a destination during `dropIn` (0.32 s, `Board.svelte:190-201`), the chosen ring leaves the drawn pieces (`boardAnimator.svelte.ts:220-226`), and the committed marker appears at rest because own moves skip its drop (`:233`). The marker probably snaps; look at the frames. Example: zertz `8f9341c11`, `57698b3e9`.
- **D12 A multi-move history jump flies the ring start to end: applies.** `boardDiff` pairs a moved ring only when exactly one ring left, one arrived and the two points lie on one line (`board/boardDiff.ts:40-52`). Anything else fades out and drops in. With required ring ids (B6), pair every departing and arriving ring by id. Example: zertz `7f69bb931`.

### Specks and piece identity through history

Ring specks are seeded by `ringId` in State, removed rings by `removedRingIds`, and markers by their point (markers never move). The animator reads no `session.actions`, so E2–E6 do not arise.

- **E1 A piece's seed during its own move: applies.** `inBetween` draws every arriving ring with `ringSeed(undefined, coords)` (`boardAnimator.svelte.ts:290-294`). A placed ring therefore drops in with point-seeded specks and swaps to its `ring-<id>` specks as it lands, and history drops in rings the same way. Read the id from `to.board.ringIdAt(coords)`. The flier already reads from `from` (`:321`). Example: zertz `8f9341c11`.
- **E7 Frame-by-frame speck spec: applies.** A Playwright spec that a ring keeps its specks through placement, a move, removal to its space, Undo and history steps would have caught E1. Example: zertz `f0f7831c7`.

### Phone rendering (gate 16)

- **F1 SVG text: applies.** The `.coordinate-label` CSS (`Board.svelte:407-415`) uses `dominant-baseline: central` and `letter-spacing: 0.04em`. Use the alphabetic baseline with `dy` = 0.35 × 15 and `letter-spacing` in px, and check that `VIEW.labelBeside` placements still sit where the author approved them. Example: gipf `a2aea2931`, (M) GP `487466baf`.
- **F2 No GSAP `matrix()` on moving SVG: applies.** Every tween sets GSAP `x`/`y`/`scale` on SVG `<g>`s with `svgOrigin` (`boardAnimator.svelte.ts:146,168,269,481-486,559-570,585-621,636-646`). Copy `games/gipf-ui/src/lib/animators/svgPose.ts`, and drive the flight and flip poses from setters rather than `onUpdate`. Keep the flight's shape (`ringFlight.ts`) and the flip path (`flipPose.ts`) unchanged. Add `tests/motion.spec.ts`, which fails on `matrix(` in the board. The staged marker's `dropIn`/`liftOut` are CSS `translate()/scale()` transitions on `.drop` with `transform-box: fill-box`; include them in the motion spec's sampling. Example: gipf `09ee9f3ba`, `dbb96354f`, zertz `4f9df9475`.
- **F6 Measure with `tools/webkit-probe`: check.** Every speck is a live SVG ellipse: about 105 face specks per white ring plus sides and walls, and about 58 per marker, so a full board approaches 4,000 nodes. Record memory and repaint against the reference (+53 to +82 MB, 32 ms).
- **F7 Pre-rendered looks: check, depends on F6.** None exist now. If gate 16 needs them, pre-render piece bodies and size them by `maxFitScale` × 2.5 px per board unit, but keep each piece's own spread specks (the PÜNCT approach: pre-rendered bodies, per-piece specks); shared speck patterns are against the author's taste. Show the author the measured difference first. Example: zertz `2dd120bd7`.

### Tests, accessibility, docs

- **G1 Playwright smoke spec: applies.** `playwright.config.ts:3-9` builds and previews on 4173, and `tests/` does not exist. Copy `games/gipf-ui/playwright.config.ts` on port 5204 and a `tests/table.spec.ts`. Example: gipf `231406f9d`.
- **G2 Undo-timing and motion specs: applies.** Add `tests/undo-timing.spec.ts` (D7) and `tests/motion.spec.ts` (F2). Example: matrx `4c9d54c1a`, zertz `e60bc9cce`.
- **G3 Fresh builds: applies (process).** Run checks after `pnpm --filter @tabletop/yinsh-ui^... build`, and regenerate the scenarios after B1/B6.
- **H1 Tap-off wrapper: applies.** `Board.svelte:258-269` puts `onclick` on the `<svg>` under a `svelte-ignore`. Move it to `<div class="tap-off" role="presentation">` around the SVG, keeping the `closest('[role="button"]')` test. Example: zertz `a5afb8f2c`, gipf `c29b32285`.
- **H2 Visual contract: applies.** `docs/ui-interaction-visual-contract.md:37` describes the `undo()` override and the restage. Update it in the same changes as C1/C3/C4/C6/D10, and record the drop-back and fly-back Undo motions (D8). Example: gipf `0a583ac4c`.
- **H3 Comments give reasons only: check.** Most comments give reasons. Read the animator and Board comments with policy #38–41 in mind. Example: gipf `38496f671`.
- **H4 Board geometry out of `Board.svelte`: applies.** Move the line and whisker build (`Board.svelte:31-48`) and the mark geometry (`:124-144`) into `board/boardLines.ts` and `board/marks.ts`, as the merged titles do.

### Not applicable

- A6: `YinshVersion` lives in `config.ts`, which imports only typebox and `@tabletop/common`, no geometry.
- A8: already `Alpha`; leave it.
- B9: the rules' only choices (rows to take, five of a longer run, ring to remove) are all offered.
- C7: `session.spec.ts` and `stagedSelection.spec.ts` exist, and `vitest.config.ts` sets `root: projectRoot(...)`.
- D1: `ANIMATED_KINDS` (`boardAnimator.svelte.ts:28-34`) leaves out `initial`, `reconciliation`, `view-switch` and `edit`.
- D2: no element is both GSAP-tweened and Svelte-transitioned; the staged marker's intros sit on their own `.drop` wrappers, and there are no outros.
- D5: another player's Undo arrives as `undo` without `willUndo`, so nothing restages; the ring flies back and the marker lifts off in 0.18 s. The stale `undoingMove` case is under C6.
- D6: one step's boards always name the source (a lone collinear ring pair, or ring counts for removals).
- D9: no `historyMove`/`historyAction`.
- D13: no `$effect` keeps shown state.
- D14: the animator's helpers are already private methods; `pieceKey`/`pieceId` are exported for `Board.svelte`.
- D15: nothing transitions in History View (no marks are shown there).
- E2–E6: seeds come from State, and the animator never reads `session.actions`; there is no lazy cache.
- F3: shadows are radial gradients (`PieceDefs.svelte:79-103`).
- F4: no board- or table-sized masks or filters.
- F5: no `feTurbulence`; the storm texture was removed.

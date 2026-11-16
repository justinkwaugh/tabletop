# DVONN: review notes (temporary)

> Delete this file in the commit that finishes the readiness fixes. It guides the review and is not part of the title.

> "The author" below is the title's author, who opened this PR. Where a fix would change a choice marked as theirs, ask on the PR before changing it.

This branch has had only two readiness commits: the move to upstream's Rolldown, Vite 8 and ESLint 10 tooling (`b56f8a3d0`) and "Ready DVONN for review: visibility, randomness, WebP cover" (`18ad7a15c`). The four GIPF project titles already on main (GIPF, MATRX GIPF, GIPF with Potentials, ZÈRTZ) needed the fixes below. Each cited commit is on main and shows a worked fix to copy from. The statuses come from reading this branch, not from running the review, so run `game-pr-readiness` as usual and treat them as leads. Harness and Playwright port: 5205.

## Preserve

Rule readings agreed with the author. They also seed the missing `games/dvonn/docs/rules-interpretations.md`. Rule numbers follow the Rio Grande 2017 rulebook, which matches gipf.com word for word.

- Two versions: **Standard** (the default) and **Random placement**. Random placement is the author's variant, not a rulebook one: all 49 spaces, including the 3 DVONN pieces, are filled at random, stacking starts at once and White moves first (`initializer.ts` `randomBoard`, `beginMovingStacks`).
- **White**: White places first and is listed first. Placement order is fixed: White, Black, White place the three DVONN pieces, then each player places their own colour (D1). White, who places the last piece, also makes the first move (E1). At game creation the option `whitePlayer` picks who plays White: Random (the default, standing in for the rulebook's "draw lots"), Game creator or Opponent. The creator is the seat whose `userId` is the game's `ownerId`. In a local game that is the first seat. If the creator is not seated, the choice falls back to random (`initializer.ts:69-83`).
- **Passing is automatic** (E8, G1). The engine passes a player who has no legal move, records it as `passedPlayerId` in the action metadata, and the history and banner show it ("X cannot move; move again"). A player who was passed must move again once a move opens up. The game ends when neither player can move.
- **Scoring** (G2, G3): a player's score is every piece in the stacks they control, DVONN pieces included. Equal scores are a draw, with both players recorded as winners.
- **Other readings**: a lone DVONN piece never moves (E7), but any stack holding one moves with whoever controls it. An isolated DVONN piece stays on the board (F3). A stack on the edge has fewer than six neighbours and is never surrounded (E6). Every stack cut off from the DVONN pieces leaves the board, whoever owns it (F1, F2).

Looks the author chose:

- **Pieces** are nested donuts. The top is dished down to a flat floor and the underside bulges to match. The side is straight, with corners rounded at 0.22 of the thickness (0.15 at the hole edge). The hole is 0.34 of the radius, the thickness 0.20 R, the seam gap 0.05 R and the rise off the board 0.06 R. There is no catch-light (`StackShape` `catchLight = 0`).
- **Lighting and specks**: each colour's look is pre-rendered, with DVONN's own lighting rule (a slope facing you catches the light). The dish shading is gain 2.2, light 0.85, shade 0.7, floor 0. White stays very white. Specks are spread evenly on every surface: top, side, hole walls and thinned bands. They are seeded by the `placedAt` key plus the tone. When the board is turned, the side and the hole wall show their other half (`seed + 1`, `specks.ts:154-186`).
- **Table and board**: the table is the rulebook's red-orange glow (#e8772f → #cf4128 → #a11e17). Panels and cards are sand #e3ddd0, and each card keeps its coloured name band. The sand board with its imprinted rings is the default. The graph board, with whiskers at 0.225, is a toggle.
- **Marks**: cyan two-tone rings just inside the top piece's rim. The chosen stack gets a thicker ring. Destinations are dashed, each dash outlined. Once a stack is chosen, the other movable stacks' rings are **hidden**, as the visual contract says. The author keeps this here, so they are not mistaken for valid destinations.
- **Height badges**: TZAAR's size (r 0.27 R), on by default (`heightBadges`). A badge sits at the top's far right, moves to the far left if a nearer stack covers that, and to the far middle if both are covered (`badgeSpot.ts`). Badges are drawn over the rings and move with the body (the animator's `badge` node). A badge is forced on for a stack shrunk past the cap.
- **Toggles**, all icon-only: A1 coordinates, board style, far side (`turned`, a 180° turn; the labels stay below and on the left and only their text changes), stack limit (`shrinkStacks`, **off by default**, cap 13 when on) and height badges. The frame keeps room for a 30-high stack in the far row (`FRAMED_HEIGHT`), so the board never moves when a toggle changes. On phones with coordinates off, the board grows into the labels' room.
- **Cards**: tallies in stacks of 10. Both cards are drawn at one size. The captions "left" and "high" share one width so the tally keeps its size. The end panel reads "stack height x to y".
- **Motion**:
    - A placement drops in: it falls from -50 over 0.26 s while gathering speed, then wobbles at -4 and -1.5, while its shadow waits on the space and darkens.
    - Undo of a placement lifts the piece off in reverse.
    - A move hops in one arc over the stacks between, clearing them, in 0.32 s plus 0.04 s per space, at most 0.52 s. It lands with a mostly vertical bounce. Nearer stacks cover the flier through the occluder copies.
    - Stacks that are cut off float up and fade, staggered, after the landing. Undo drops them back in from above, then hops the stack home.
    - A move past the cap, with the limit on, lands and bounces at full height, then shrinks over 0.3 s (`shrink`, `modelAt`).
    - Undo and history play quickly, without bounces.
- **Interaction**:
    - Placements and moves are sent on the tap that completes them; nothing is staged.
    - Undo of a move restages the stack as chosen (the author's choice). The next Undo lets go of it.
    - Re-tapping the chosen stack lets go, and so does tapping off the targets (`letGo`).

Where a catalogue fix could flatten these:

- **B1 against `placedAt`.** Reshape the board to hold only the occupied stacks, but keep `placedAt` on every piece. It is the piece's identity: the specks, `boardDiff`'s exact stack matching and the card tally all read it. A Random placement game has no placement actions, so the identity cannot be read from actions. MATRX kept its disc ids for the same reason (`908d7a0e9`).
- **D7 against DVONN's sequenced Undo and history.** Both run two phases in a row: drop-back then hop, or hop then cut-off. Each phase is 0.18 s, so each takes 0.36 s. Overlap and shorten the phases to fit 0.2 s, keeping both motions (the author's decision).
- **D8's "fade in where they stand".** DVONN's Undo drops cut-off stacks back in, the reverse of their float-up, and the contract's regression checklist expects that. Keep the drop and only shorten it, unless the author agrees to a fade.
- **C1 / C3 / C6.** Moving to `localSelections` must keep the Undo restage and the re-tap and tap-off let-go.
- **F2.** The pose rewrite must keep the occluders, the shrink and the drop wobble.
- **F7.** Smaller looks soften the pieces at full zoom. The author accepted this on the merged titles, but show the before and after.

## Author's decisions

- **Undo and actionless steps:** overlap and shorten the title's own motions until each step ends within 0.2 s (D7). Keep every motion; do not drop one or swap it for a fade.
- **Pieces an Undo or step back puts back:** keep the title's own return motion. gipf `c7d160278` fades such pieces in only because GIPF's taken rows had no motion and popped in; it is not a rule for titles that already move them back.
- **Win or lose:** DVONN is a win/lose game, although the stack totals decide it. Treat it like the merged titles: `hasScores: false` and winner 1, loser 0 (A1, A2). The totals stay on the cards and in the end panel.
- **Other movable stacks hide once one is chosen**, so they are not mistaken for valid destinations. Keep it.
- **BoardGameGeek id:** 2346.

## Fixes

### Metadata and logic

- **A1 `hasScores: false`: applies.** `games/dvonn/src/definition/info.ts:8-19` has none. DVONN is won or lost; the stack totals only decide who. Example: gipf `7dd4828da`.
- **A2 Win/loss `finalScores`: applies.** `finalScores` reports the stack totals. Report winner 1 and loser 0, and 1 each for a draw; keep the totals on the cards and in the end panel. Examples: gipf `9824eb4b5`, zertz `b2a9b91fb` (draw).
- **A3 turn series: applies.** `initializer.ts:33-37` makes the turn manager without `seriesKeeps`. Nothing reads more than `currentTurn()`: `Header.svelte:8`, and the state handlers' `enter`. Set `turnManager.seriesKeeps = 'latest'` and add a playout check that the series stays short. Passes give one player consecutive turns (`movingStacks.ts:8-15`), so cover a game with a pass. Example: gipf `36405defd`.
- **A4 config normalised and validated: applies.** `config.ts:60-72` (`versionFromConfig`, `whitePlayerFromConfig`) read unknown values as the defaults through `??`. Reject them instead. Example: GP `4497039ac` (config.ts).
- **A5 per-choice descriptions: applies.** `config.ts:26-53`: Version has one combined description, and the White choices have none. Give Standard and Random placement each their own `description`, and keep the combined text on the option. Do the same for Random, Game creator and Opponent. Example: gipf `d0c84518d`.
- **A7 BoardGameGeek link: applies.** `info.ts` has no `bggId`. Add `bggId: 2346`. Example: zertz `e35ef711b`.
- **B1 State keeps only what play changes: applies.**
    - `model/board.ts:18-27,48-50` stores all 49 spaces with empty stacks. Store only the occupied stacks, e.g. `stacks: { coords, pieces }[]`, and take the spaces from `SPACES`.
    - In the logic, `spaceAt`, `vacantSpaces`, `isFull`, `moveStack` (drop the emptied entry) and `removeIsolated` change.
    - In the UI, the readers of `board.spaces` change: `animators/boardAnimator.svelte.ts:72-80`, `board/boardDiff.ts:24-28`, `board/tally.ts:7` (and `PlayerTray.svelte:47`), and `game.spec.ts`.
    - Regenerate the 10 scenarios (`scripts/build-scenarios.mjs`).
    - Also drop `version` from State (`gameState.ts:27,56`, `initializer.ts:53`): nothing reads it, because Random placement only shapes the start.
    - Keep `placedAt` (see Preserve).
    - Examples: gipf `f05f55d97`, matrx `c0b02ff0c`.
- **B3 shared helpers, asserts, no casts: applies.**
    - Use `assertExists` in place of `throw Error` after a lookup: `gameState.ts:65-79` (`opponentOf`, `whitePlayerId`) and `board.ts:61-68`.
    - Assert instead of silent fallbacks:
        - `placingPieces.ts:28-29` and `movingStacks.ts:41-42` (`playerId === undefined ? []`).
        - `history/historyEntries.ts:33,46-47,55` (`metadata?.` with `?? []` and `?? 0`): processed actions always carry metadata.
        - `GameEndPanel.svelte:14,26` (`{:else if winners[0]}`).
        - `Board.svelte:211` (`?? 'right'` after a `has` check), `Board.svelte:79,167` (`?.base ?? 0`).
    - Casts: `board/pieceShape.ts:316,360,371,423` use `as Rgb`. Use a typed `mapRgb` helper as zertz does.
    - Make `isSurrounded` (`board.ts:106`) private; only the board uses it.
    - Examples: zertz `ffc841dbb`, `0c7bc289d`, matrx `28c413199`.
- **B7 rules readings recorded and tested: applies.** `games/dvonn/docs/rules-interpretations.md` is missing; write it from Preserve. `game.spec.ts` already covers most readings, but these are missing:
    - White = Random without an assignment.
    - A creator who is not seated, falling back to random.
    - A Random placement start where White cannot move and is passed.
    - Near misses: a stack one short of a landing, and a stack on the edge that is not surrounded although every space beside it is full.

    Examples: gipf `45eaf4ced`, `bb8e1b48b`, matrx `19f475a13`.

- **B8 competition spec: applies.** There is no `competition.spec.ts` or `tests/playthrough.ts`. Cover both versions and all three White choices. Example: gipf `9824eb4b5` (competition spec part only, not its scoring change).
- **B2 one rule, one helper: check.** `boardDiff.ts:38-40` (`isHop`) restates rule E4 for the UI's move inference. It may become unneeded once D6 hands the animator the known move for every single-action step, but history jumps still infer. `PlayerTray.svelte:31` computes the pieces left in hand (`PIECES_PER_PLAYER - piecesOf`) in the UI. Decide whether either belongs in logic. Example: zertz `ffc841dbb`.
- **B4 unread metadata: check.** Every field is read, but `moved`, `landedOn` and `removed` (`actions/moveStack.ts:11-16`) store whole pieces where history reads only counts and "landed on a DVONN piece" (`historyEntries.ts:46-60`). PlacePiece's `piece` is read only to know whether it was a DVONN piece. Decide whether to keep these. Example: matrx `2fca25a7f`.
- **B5 unreachable branches: check.** Probe each of these with a throw under the playouts:
    - `boardDiff.ts:114-124` (`spacesBetween`'s `distance <= 10` and its final `return []`).
    - The animator's early returns when nodes are missing (`boardAnimator.svelte.ts:248,411,437,457,486`).
    - The `enter` fallbacks listed under B3.

    Example: matrx `19f475a13`.

### Session and staged selection

- **C1 register with `localSelections`: applies.**
    - `model/session.svelte.ts:117-127` overrides `undo()` and keeps `hasManualSelection()`. Register `undoableStagedSelection(DvonnStageOrder, …)` in a constructor and drop the override.
    - `Header.svelte:39` should read `session.hasLocalSelection`.
    - `hasManualDvonnSelection` and `popDvonnSelection` in `stagedSelection.ts` may then go unused.
    - Example: gipf `f527b9e17`.
- **C2 stacked stages: applies, spec only.** DVONN has a single replacing stage (`from`), so it needs no stacked stage. `stagedSelection.spec.ts` lacks the stage-order mismatch test (a stage outside the order throws). Example: gipf `c91b44ce8` (spec part).
- **C3 selection owner: applies.** The selection has no owner. After your own Undo in the harness's Non-active view, `beforeNewState` restages a stack the other viewer cannot see: `chosenFrom` is empty for them, but `hasManualSelection()` is true, so their first Undo press does nothing. Add `selectionOwner` and an `ownSelection` derived from it. Example: gipf `ec35a3152`.
- **C4 no choice taps while a committed move plays: applies.** State is published after the animation, so during your own hop the shown state still lists your movable stacks and their destinations as targets. `chooseSpace` (`session.svelte.ts:162-177`) and `letGo` (`149-152`) should do nothing while `updatingVisibleState` is set. Example: matrx `bb1ad8e0c`.
- **C6 restage only on your own Undo, by index: applies.** `beforeNewState` (`session.svelte.ts:142-146`) restages on any `undo` transition while `undoingMove` is set, and it keeps `undoingMove` across `undo` transitions. That is needed, because a hosted Undo presents twice. But a later Undo by the other player then restages your old move. Count `undoingMove` only while its `index` equals the incoming state's `actionCount` (read `incomingGameState`), and not when viewing as the non-active player. Copy `restagedPush` from gipf. Examples: gipf `601a844fe`, `b277355f5`.

### Animation

- **D3 guard `afterAnimations`: applies.** `boardAnimator.svelte.ts:195-203` sets `this.stacks = drawnStacks(to)` unconditionally. If a view switch shows another state during the run, this overwrites it. Guard it against a state shown since the run began. Example: gipf `e40541610`.
- **D4 the session can stop a move: applies.** There is no `moveInterrupter`. The hop's offset and the occluders' positions are taken from the layout at the start (`boardAnimator.svelte.ts:133-137,249-263`). So `toggleTurned`, `toggleGraphBoard`, `toggleCoordinates` (which changes the view on phones) and `toggleShrinkStacks` (which changes lifts) mid-move all send the flier the old way. On `view-switch`, `beforeNewState` should call `abandon()`, and each of those toggles should call `interrupt()`. Both should `progress(1)` on the context's timeline. The occluders update in an `onUpdate` (line 301) that a seek skips, so set them once after landing. Examples: gipf `79f0d563c`, `4d8e562cd`, zertz `bbb329009`.
- **D5 another player's Undo or a step back does not restage: applies**, the restage part only (see C6). DVONN draws no staged piece, so there is no lift-off to fold in. Example: gipf `e9389ffcf`.
- **D6 step back reads the undone move by index: applies.** `knownMove` (`boardAnimator.svelte.ts:207-212`) takes `session.historyMove` from `onHistoryAction`. On a step back, that names the action before the one undone. Exact matching then falls back to inference, so the effect is mostly hidden. Read the shown action whose `index` is the new `actionCount` instead, and do the same for `undo` instead of trusting `undoingMove`. Example: gipf `601a844fe`.
- **D7 actionless steps within 0.2 s: applies.**
    - An Undo of a move that cut stacks off runs `dropBack` (0.18 s) and then the hop (0.18 s), because the hop starts at `enter` (`boardAnimator.svelte.ts:175-178`). A history step forward runs the hop and then `cutOff` from `landed` (`180`, `413`). Each comes to 0.36 s.
    - The wait for the draw is unbounded: `(performance.now() - drawing) / 1000` (`168-173`). Cap it at 0.01 s.
    - Overlap the phases, then add `tests/undo-timing.spec.ts`.
    - Examples: matrx `4c9d54c1a`, `cd2ef6b20`, zertz `e60bc9cce`.
- **D9 `historyMove` only in History View: applies.** `knownMove` reads `historyMove` for any `history` transition, including leaving history. Drop `historyMove` once D6 reads by index, and assert the state an Undo presents. Example: matrx `53b1cfea4`.
- **D10 a piece coming in is drawn once: applies.** `PlayerTray.svelte:29-33` counts "left" from `session.gameState`, which stays the earlier state until the drop ends. A placed piece is therefore drawn dropping and is also still counted in hand. Set a `landingTrays` (counts left per player) as a step that places a piece starts. Example: gipf `c29b32285`.
- **D12 multi-move history jump: check.** For a jump over several actions, `boardDiff` finds no single hop, so stacks lift off and drop in. Because stacks merge, "one piece's path" rarely exists in DVONN. Decide whether a single stack moved twice should fly from start to end. Example: zertz `7f69bb931`.
- **D15 transitions in History View: check.** `History.svelte:38` puts `in:fade` on every entry. In History View, `session.actions` grows as you step, so entries fade in on each step. Decide whether that counts. Example: zertz `d3d5d3bda`.

### Specks and piece identity through history

- **E1–E6: n/a, checked.** Every seed is `coordsKey(piece.placedAt)` from the pieces being drawn:
    - `Board.svelte:190` reads `animator.stacks`, which during a step is `inBetween(from, to)`.
    - `Board.svelte:322` reads the flier's pieces, from `boardDiff` on the step's own states.
    - `land()` (`boardAnimator.svelte.ts:361-369`) reads `before` plus the moved pieces.
    - `PlayerTray.svelte:50` reads the published state. The hand's seeds there are `hand-<player>-<index>`.

    The animator reads nothing from `session.actions` or `incomingGameState`; `knownMove` takes only coordinates. The speck cache (`specks.ts:138-150`) is keyed by seed and is never built from an empty board.

- **E7 frame-by-frame spec: check.** This is optional because the seeds come from State. A short spec could check that a hopping stack keeps its specks from lift-off through landing, and through an Undo and a history step. Example: zertz `f0f7831c7`.

### Phone rendering (gate 16)

- **F1 SVG text: applies.** `Board.svelte:389-397` (`.coordinate-label`) uses `dominant-baseline: central` and `letter-spacing: 0.04em`. `HeightBadge.svelte:20` uses `dy="0.36em"`. Keep the badge's ×10-and-`scale(0.1)` trick, but give `dy` in user units. Example: gipf `a2aea2931`.
- **F2 no GSAP `matrix()`: applies.** Every tween in `boardAnimator.svelte.ts` sets `x`, `y` or `scale` on SVG `<g>` nodes, which GSAP writes as `matrix()`. The affected nodes are the flier's whole, body and shadow, each stack's body, shadow and badge, and the `scaledFromCentre` origins. Port `animators/svgPose.ts` and add `tests/motion.spec.ts`. Examples: gipf `09ee9f3ba`, `dbb96354f`, zertz `4f9df9475`.
- **F4 board-sized masks or filters: check.** There are no masks or filters, but the sand grain is a frame-sized `<image>` under `clip-path="url(#dvonn-sand-clip)"` (`Board.svelte:239-241,270-279`), and every piece clips its specks (`PieceDefs.svelte`). Measure repaint before changing anything. Example: matrx `af68c72f5`.
- **F6 measure with `tools/webkit-probe`: applies.** Record steady memory and repaint. The four merged titles came in at +53 to +82 MB and 32 ms.
- **F7 looks sized by the review's limit: applies.** `scripts/render-looks.mjs:53-54` uses `SCALE = 12`, so each look is 704×579 px. Use `2.5 * 2.5` (6.25 px per unit, for `maxFitScale={2.5}` in `GameTable.svelte`) and rerun the script. The sand (1.5 px per unit) is already below the limit. Examples: gipf `eb5fcf3b4`, zertz `2dd120bd7`.

### Tests, accessibility, docs

- **G1 Playwright smoke spec: applies.** There is no `tests/` folder, and `playwright.config.ts` still runs build and preview on port 4173. Copy gipf-ui's config (`pnpm run dev --port 5205`, a `baseURL`) and its `tests/table.spec.ts`. Example: gipf `231406f9d`.
- **G2 undo-timing and motion specs: applies** (see D7 and F2).
- **G3 fresh builds: applies.** Run the checks after `pnpm --filter @tabletop/dvonn-ui^... build`.
- **H1 tap-off on a presentation wrapper: applies.** `Board.svelte:224-236` puts `onclick` on the `<svg>` under a `svelte-ignore`. Wrap the svg in `<div class="tap-off" role="presentation">`. Example: zertz `a5afb8f2c`.
- **H2 visual contract: applies.** `docs/ui-interaction-visual-contract.md` needs these corrections:
    - §4 (line 33) says the selection is "Cleared in `beforeNewState` for every presented transition", but Undo of a move restages it.
    - §2 (line 15) names `board/sand.ts`, "grain drawn once on a canvas". The grain is now `scripts/render-sand.mjs` → `images/sand.webp`.
    - §9 still reads "initial DVONN UI".
    - Record each fix above in the same change as the fix. Example: gipf `0a583ac4c`.
- **H3 comments give reasons only: check.** Most comments give reasons. Sweep for comments that restate the code, especially in `boardAnimator.svelte.ts` and `Board.svelte`. Example: gipf `38496f671`.
- **H4 board geometry out of `Board.svelte`: applies.** Move these into `board/` modules: the graph lines and whiskers (`Board.svelte:33-55`), `markOn` (`162-169`), the badge spots and `badgeTop` (`70-100`), and the hit `target` outline (`128-134`). For example `boardLines.ts`, `marks.ts`, `badgeSpot.ts`.

Not in the catalogue:

- **Dead code: applies.** Nothing calls `resetAction()` (`session.svelte.ts:129-131`).

### Not applicable

- A6: `config.ts` imports only typebox and `@tabletop/common`, no geometry.
- A8: already `Alpha`.
- B6: there is no compatibility code (no "games from before" fields).
- B9: the rules offer no optional choices beyond the White draw, which is offered.
- C5: there are no out-of-turn actions; `activePlayerIds` is always the turn holder.
- C7: `session.spec.ts` and `stagedSelection.spec.ts` exist, and `vitest.config.ts` sets `root: projectRoot(…)` with the client runes environment.
- D1: `ANIMATED_KINDS` (`boardAnimator.svelte.ts:18-24`) already skips `initial`, `reconciliation`, `view-switch` and `edit`.
- D2: no Svelte transition sits on a GSAP-animated node. The only transitions are on text in Header and History.
- D8: no staged piece is drawn; a chosen stack only gets a ring, which fades with the marks. For the drop-back on Undo, see Preserve.
- D11: no placement is staged; your own placement already plays its drop as `own-action`.
- D13: there is no `$effect`. History captures its entries on click.
- D14: the animator's helpers are already private, apart from the attachments and `modelAt`, which Board uses.
- F3: shadows are already radial-gradient ellipses.
- F5: the sand and the looks are already pre-rendered WebP (`render-sand.mjs`, `render-looks.mjs`).

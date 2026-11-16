# TZAAR: review notes (temporary)

> Delete this file in the commit that finishes the readiness fixes. It guides the review and is not part of the title.

> "The author" below is the title's author, who opened this PR. Where a fix would change a choice marked as theirs, ask on the PR before changing it.

This branch has had only two readiness commits: the move to upstream's Rolldown/Vite 8/ESLint 10 tooling (`e4810cfd7`) and the visibility, randomness and WebP cover commit (`8f2b6f462`). The four GIPF project titles already on main (GIPF, MATRX GIPF, GIPF with Potentials, ZÈRTZ) needed the fixes below. The commits cited are on main and each shows a worked fix. The statuses come from reading this branch, not from running the review, so run `game-pr-readiness` as usual and treat these as leads. The harness runs on port 5206.

## Preserve

**Rule readings agreed with the author.** These also seed the missing `games/tzaar/docs/rules-interpretations.md`.

- Three versions. Random start is the default (rule C2). Fixed start uses the rulebook's position (H, diagram 4). In Tournament (I), White places first, then the players alternate one piece each until all 60 are on the board, and White then makes the single opening capture.
- Colour is chosen at creation, as in DVONN. Random is listed first and is the default, then Game creator, then Opponent. White moves first. In a local game the first seat counts as the creator. A creator who does not play leaves White to the draw (`initializer.ts` `chosenWhite`).
- A stack may never cover its owner's last top piece of a type, because that would leave them without a Tzaar, Tzarra or Tott. Such a stack is never offered (`gameState.ts` `coversLastOfKind`). The rules would allow it as a losing move, so B9 must not "restore" it.
- White's opening turn is a single capture in every version (rule D). The first move of any turn can never be a pass.
- If a first capture leaves no capture and no stack for the second move, the turn passes automatically (`noSecondMove`), and the history says so.
- A player who cannot capture loses when their turn begins. The action that caused it records this as `stuckPlayerId`, including the last Tournament placement.
- Taking the last top piece of a type wins at once, even on the first move. Buried pieces do not count (rule G).
- Coordinates follow the rulebook: columns A–I, and column E skips the centre, running E1–E4 below it and E5–E8 above.
- No draw is possible. After A2, the winner scores 1 and the loser 0.

**Looks the author chose.**

- Pieces are MATRX GIPF's discs with TZAAR's filleted sunken centre (about 0.37 R), a groove with sloped walls and a flat floor, and a raised ring. Markings are gold on white and silver on black: the Tzarra's centre, and the Tzaar's groove and centre. Disc thickness is 0.2826 R, with a 0.24 T gap between discs.
- Six pre-rendered WebP looks come from `scripts/render-looks.mjs` and the `/looks` route.
- Each piece carries its own spread specks (`board/specks.ts`), seeded by `piece.id` (`session.shapeOf`, `StackShape.svelte:51`). `Piece.id` must stay in State through any B1 or B4 change.
- A stack's count sits on a white badge with a black number at the near-right of the top piece, with digits set 10× and scaled down. Keep that trick when fixing F1.
- The table is rulebook sand (`#ddc15d`/`#cca848`/`#b88f38`), with a cream play area and panels.
- Labels never move. A tall stack covers a top label.

**Motion the author chose.**

- On a capture, the captured stack floats straight up and fades while the mover hops in an arc, then rebounds along the hop.
- Stacking onto your own stack bounces mostly up and down, like LYNGK.
- A placed piece drops with a small wobble, and undoing a placement lifts it off.
- A stack that goes past the limit lands and bounces at full height, then shrinks over 0.3 s (`shrink`/`modelAt`).
- Undo of a move hops the stack home and leaves it chosen. The next Undo lets go of it.

**Preferences and toggles.** These are overlay buttons with hover `hint`s, shown to a mouse only. A toggle that is on shows a cyan ring, not a fill.

- `90°` sets `rotatedBoard`. Its stack cap is 9, against 5 on the normal board.
- Far side sets `turned`.
- Stack limit sets `shrinkStacks`, which is **off by default**. Whole stacks get `WHOLE_HEADROOM` (4 pieces past the cap), and the frame grows over a tall stack or the flier's peak, eased over 0.3 s (`raiseFor`).
- `A1` sets `showCoordinates`.

**Choosing.**

- Tapping off the choices lets go of the chosen stack (`letGo`).
- The placing type (`chosenKind`) is a tool kept from one placement to the next. It is not a staged step: Undo, letGo and C1 must not register or clear it.

**Conflicts with catalogue fixes.**

- B9 must leave the no-self-cover reading alone.
- D7 vs. the chosen undo motion. An Undo of a capture brings the captured stack back down after the mover has left, and that runs past 0.2 s. Overlap and shorten it (start the drop earlier, make it shorter) until it fits; keep the drop (the author's decision).
- F7 makes the looks softer at full zoom. The author has accepted that trade in the other titles, so follow the rule.

## Author's decisions

- **Undo and actionless steps:** overlap and shorten the title's own motions until each step ends within 0.2 s (D7). Keep every motion; do not drop one or swap it for a fade.
- **Pieces an Undo or step back puts back:** keep the title's own return motion. gipf `c7d160278` fades such pieces in only because GIPF's taken rows had no motion and popped in; it is not a rule for titles that already move them back.
- **BoardGameGeek id:** 31999.

## Fixes

### Metadata and logic

- **A1 `hasScores: false`: applies.** Add it to `games/tzaar/src/definition/info.ts` (near line 17). Example: gipf `7dd4828da`.
- **A2 win/loss `finalScores`: applies.** `scoring.ts:6-13` reports `capturedBy` (the pieces taken) as each player's score. Score the winner 1 and the loser 0 from `winningPlayerIds`. TZAAR has no draws. After this, `HydratedTzaarGameState.capturedBy` (`gameState.ts:184`) has no reader and can go. Example: gipf `9824eb4b5`.
- **A3 turn series keeps the latest turn: applies.** TZAAR reads only `currentTurn()` (`turnFlow.ts` `activateCurrentPlayer`, `Header.svelte:8`). Set `turnManager.seriesKeeps = 'latest'` right after `HydratedTurnManager.generate` (`initializer.ts:35`), before the Tournament `startTurn` (line 61). Add a playout assertion that the series stays short in the random playouts (`game.spec.ts:436`). Examples: gipf `36405defd`, GP `4497039ac`.
- **A4 config validated: applies.** `versionFromConfig` and `whitePlayerFromConfig` (`config.ts:62-74`) quietly read unknown values as Random. Reject them with `assertExists`, and add `normalizeConfig` with `Value.Check` on `TzaarConfigurator` (line 57). There are no derived settings. Example: GP `4497039ac`.
- **A5 per-choice descriptions: applies (Version only).** The Version option (`config.ts:32`) runs all three descriptions together. Give each choice its own `description`, and keep the combined text on the option. White's choices need none (GP has none either). Example: gipf `d0c84518d`.
- **A7 BoardGameGeek link: applies.** Add `bggId: 31999` to `info.ts`. Example: zertz `e35ef711b`.
- **B1 State keeps only what play changes: applies.**
    - The board stores all 60 spaces, empty ones too (`board.ts:31-46` `Space`/`emptyBoard`). Store only occupied stacks with their coords, and take the spaces from `SPACES`. Keep `Piece.id`.
    - `TzaarGameState.version` (`gameState.ts:35`) is written at setup and never read. Drop it.
    - This touches `HydratedTzaarBoard`, the initializer, `boardDiff.ts` `stacks()` and the animator's `drawnStacks` (`boardAnimator.svelte.ts:73`), which read `board.spaces`, `scripts/build-scenarios.mjs`, and the 15 scenario JSON files (regenerate them).
    - Example: gipf `f05f55d97`.
- **B2 one rule, one helper: check.** Two places may hold the same rule twice:
    - When a capture ends the turn is decided in `capture.ts:66-77` and again from its flags in `capturing.ts:36`.
    - "Cannot capture" is checked in `stuckPlayerAfterTurnOf` and again in `startTurnOf` (`turnFlow.ts`). The handler reads the action's flags, so this may already count as one rule.

    Decide whether each needs a single helper. Example: zertz `ffc841dbb`.

- **B3 shared helpers, asserts, no casts: applies.**
    - `ringDistance` (`model/geometry.ts:19`) repeats `distanceAxial` from `@tabletop/common`.
    - The UI's string `coordsKey` (`tzaar-ui/src/lib/board/geometry.ts:23`, 19 uses, including the selection value and the animator keys) should become `coordinatesToNumber`, which the logic's `spaceKey` already wraps.
    - `throw Error` after `undefined` checks in `gameState.ts:82-96` and `board.ts:62` should become `assertExists`.
    - Casts `as Rgb` in `pieceShape.ts:337,367,411` should go, using a `mapRgb` helper like zertz.
    - Silent fallbacks to remove: `historyEntries.ts:51-100` reads `action.metadata?.…` with defaults (assert that processed actions carry metadata), and `GameEndPanel.svelte:17-22` returns `''` or defaults to "cannot capture" (assert the winner and an end reason).

    Examples: gipf `4296ad4c4`, matrx `2fca25a7f`, zertz `d3d5d3bda`.

- **B4 unread metadata: applies.**
    - `PlacePieceMetadata.piece` (`placePiece.ts:12,53`) is never read.
    - Capture `moved`/`captured` and Stack `moved`/`landedOn` (`capture.ts:13-14`, `stack.ts:12-13`) store whole piece arrays with ids, but history reads only the height and the top kind (`historyEntries.ts` `summary`). Store just those, or drop them if history can read them some other way.

    Example: matrx `2fca25a7f`.

- **B5 unreachable branches: applies.** TZAAR stacks move only over vacant spaces, so the animator always passes `over: between.map(() => 0)` (`boardAnimator.svelte.ts:264`). The over-stack clearance code in `hopPlan` therefore never runs (`hop.ts:56-100`: `clear`, `overTall`, `CLEARANCE`, the `groundStart`/`groundEnd` search, `tallest`). It was copied from a title whose hops cross stacks. Remove it and its `hop.spec.ts` cases, then probe the logic's `activateCurrentPlayer` `undefined` branch the same way. Example: matrx `19f475a13`.
- **B7 rule readings recorded and tested: applies.** There is no `games/tzaar/docs/rules-interpretations.md`; write it from Preserve above. These have no test yet:
    - a player stuck after the last Tournament placement (`PlacePiece` `stuckPlayerId`);
    - a capture that both removes a type and leaves the opponent unable to capture (elimination is recorded and wins);
    - Random White without an assignment.

    Examples: gipf `45eaf4ced`, `bb8e1b48b`.

- **B8 competition spec: applies.** None exists. Add `competition.spec.ts` and `tests/playthrough.ts` over Random, Fixed and Tournament and every choice of White. The playout helpers now live in `game.spec.ts`. Turn generation always shuffles before applying an assignment, so the "unchanged apart from who sits where" check should hold for the random start too. Examples: gipf `9824eb4b5`, matrx `4893fac3f`.

### Session and staged selection

- **C1 register with `localSelections`: applies.** `session.svelte.ts:152-158` overrides `undo()`, and `Header.svelte:39` reads `hasManualSelection()`. Register `selection` through `undoableStagedSelection(TzaarStageOrder, …)` in the constructor and read `hasLocalSelection`. Then drop `popTzaarSelection`/`hasManualTzaarSelection` if nothing else uses them. Leave `chosenKind` out of it. Example: gipf `f527b9e17`.
- **C3 selection belongs to its maker: applies.** There is no `selectionOwner`. After an Undo in the harness's Non-active view, the restaged stack shows to the other player and absorbs their Undo. Example: gipf `ec35a3152`.
- **C4 no taps while a move plays: applies.** `chooseSpace`, `letGo` and `pass` (`session.svelte.ts:188-217`) act on the shown state's choices while `updatingVisibleState` is true. A tap during the first capture's hop can send the second move early. Leave `chooseKind` (a panel tool) usable. Example: matrx `bb1ad8e0c`.
- **C6 restage on your own Undo only: applies.**
    - `beforeNewState` (`session.svelte.ts:173-177`) restages `undoingMove` on any `kind === 'undo'`, and `undoingMove` survives until a non-undo transition.
    - Restage only when `undoingMove.index === incoming.actionCount` and the viewer is not the non-active player (`restagedMove(to)`). Read `incomingGameState`.

    Examples: gipf `601a844fe`, `b277355f5`.

### Animation

- **D3 guard `afterAnimations`: applies.** `stacks` is a writable `$derived` over `session.gameState` (`boardAnimator.svelte.ts:86`). The `afterAnimations` at line 201 sets it to the run's `to` unconditionally, so after a view switch it overwrites the state already shown. Example: gipf `e40541610`.
- **D4 `moveInterrupter`: applies.** There is none. `toggleRotatedBoard`, `toggleTurned` and `toggleShrinkStacks` (`session.svelte.ts:55-72`) all change the layout the hop was planned in, so each should `interrupt()`. `beforeNewState` should `abandon()` on `view-switch`. Use `progress(1)` on the context's timeline. Examples: gipf `79f0d563c`, `4d8e562cd`.
- **D6 step back reads the undone move by index: applies.** `knownMove` (`boardAnimator.svelte.ts:215-220`) takes `session.historyMove`, set by `onHistoryAction`, for history steps back, and `undoingMove` for every undo. Use the action whose `index` is `to.actionCount` when `to.actionCount < from.actionCount`. `boardDiff` already ignores a known move that does not turn one board into the other, so a wrong one falls back to the guess. Example: gipf `601a844fe`.
- **D7 actionless steps within 0.2 s: applies.**
    - An Undo or step back over a capture runs the quick hop (0.18 s) and then `dropCaptured` from `duration * CAPTURED.returnAt` for `QUICK` (`boardAnimator.svelte.ts:51,54,186`), so it ends at about 0.27 s.
    - The motion is also delayed by the full draw time (line 179), which should be capped at 0.01 s.
    - The visual contract claims 0.18 s.
    - Add `tests/undo-timing.spec.ts`.
    - See Preserve for the chosen return drop.

    Examples: matrx `4c9d54c1a`, `cd2ef6b20`, zertz `e60bc9cce`.

- **D9 `historyMove` only in History View: applies.** `knownMove` reads it whenever `kind === 'history'`, and it is never cleared. Guard it with `isViewingHistory`. Example: matrx `53b1cfea4`.
- **D12 history jump over several moves of one stack: check.** A step over a whole turn (a capture and then a second move with the same stack) defeats `boardDiff`'s single-move search. The origin then lifts off, and the final stack changes in place without motion. See whether it should fly start to end. Example: zertz `7f69bb931`.
- **D14 animator helpers private: applies.** `drawnStacks` and `scaledFromCentre` are module functions (`boardAnimator.svelte.ts:73,512`). Examples: matrx `28c413199`, zertz `d3d5d3bda`.

### Specks and piece identity through history

Seeds come from `Piece.id` in State. During a step, the board draws `animator.stacks`, built from the step's `from`/`to` boards (`inBetween`, `land` uses `before`), and the flier comes from `from`. While a step plays, `session.gameState` is still the shown state. Nothing reads `session.actions` or the next state for a seed; `session.actions` is read only for history text (`History.svelte`, `ActionPanel.svelte`, `GameEndPanel.svelte`). The speck cache (`specks.ts`) is keyed by radius, tone, kind and seed, not by the board. That makes E1–E6 n/a.

- **E7 frame-by-frame specks spec: check.** `session.spec.ts:186` checks only that seed keys follow pieces across a move. Decide whether a unit check is enough: at each history step and in an exploration, every drawn piece's `seedKey` should equal the live board's piece of that id. If not, port zertz `f0f7831c7`.

### Phone rendering (gate 16)

- **F1 SVG text: applies.**
    - Coordinate labels use `dominant-baseline: central` and `letter-spacing: 0.04em` (`Board.svelte:264-272`).
    - The badge count uses `dy="0.36em"` (`StackShape.svelte:118`).
    - Use the alphabetic baseline, with `dy` of 0.35 × font size in user units (for the badge, inside its `scale(0.1)` group) and letter-spacing in px.

    Example: zertz `c28047def`.

- **F2 no GSAP `matrix()`: applies.** Every moving node is tweened with GSAP `x`/`y`/`scale`:
    - the flier's whole/body (`hop`, `bounce`, `rebound`);
    - captured stacks (`liftCaptured`/`dropCaptured`);
    - `drop`/`liftOff` body and shadow scale;
    - the reset at line 208.

    Port `animators/svgPose.ts`. `scaledFromCentre`'s `svgOrigin` then goes, since a pose scales about the stack's own origin. `occlude` reads `gsap.getProperty` (lines 306-307) in an `onUpdate`, so read the pose instead, and make sure a `seek()` that skips callbacks cannot leave an occluder showing. Add `tests/motion.spec.ts`. Examples: gipf `09ee9f3ba`, `dbb96354f`.

- **F6 measure with `tools/webkit-probe`: applies.** Board selector `svg.tzaar-board`. Measure on `midgame` and `tall-stack-on-e8`, including a capture and an over-limit stack with the Stack limit on. Record memory and repaint.
- **F7 looks sized by the limit: applies.** `scripts/render-looks.mjs:53-54` renders at `SCALE = 12`, but `GameTable.svelte` has `maxFitScale={2.5}`, so it should be `2.5 * 2.5`. Rerun the script to rewrite the six WebPs. Example: gipf `eb5fcf3b4`.

### Tests, accessibility, docs

- **G1 Playwright smoke spec: applies.** There is no `tests/` folder, and `playwright.config.ts` builds and previews on 4173. Switch it to the dev harness on port 5206, and add `tests/table.spec.ts`: choose a stack, Undo, capture, Undo. Example: gipf `231406f9d`.
- **G2 undo-timing and motion specs: applies.** See D7 and F2.
- **G3 fresh builds: applies (process).** Run checks after `pnpm --filter @tabletop/tzaar-ui^... build`.
- **H1 tap-off on a presentation wrapper: applies.** `Board.svelte:162-173` puts `onclick` on the `<svg role="group">` with a `svelte-ignore`. Move it to `<div class="tap-off" role="presentation">`. Keep `onBoardClick`'s `closest('[role="button"]')` test. Example: zertz `a5afb8f2c`.
- **H2 visual contract: applies.**
    - `docs/ui-interaction-visual-contract.md` §4 says undo and history finish "within 0.18 s", but an Undo of a capture runs to about 0.27 s.
    - It records no shared session/animator state. Record `undoingMove`/`historyMove`, the animator's `stacks`/`flier`/`landing`/`flightTop`, and later the interrupter.
    - Update it with each fix above.
    - Also, `src/scenarios/README.md:10` (Tall stacks) describes thinning as if the Stack limit were on by default. Say it needs the toggle on.

    Example: gipf `0a583ac4c`.

- **H3 comments give reasons only: applies.** About 360 comment lines across about 4,800 UI lines, with heavy narrative in `pieceShape.ts` (83) and the animator (54). For comparison, GIPF went from 232 of 3,402 to 74. Example: gipf `38496f671`.

### Not applicable

- A6: `config.ts` imports only typebox and `@tabletop/common`, so the site's entry chunk pulls in no geometry.
- A8: already `GameVisibility.Alpha`. Leave it.
- B6: no compatibility code; preferences are at version 1 with no migration.
- B9: every choice the rules allow is offered (capture, then capture, stack or pass). The one withheld move is the agreed no-self-cover reading.
- C2: one stage (`from`), and tapping another stack replaces it.
- C5: no out-of-turn actions; the turn holder is always the one active player.
- C7: `session.spec.ts` and `stagedSelection.spec.ts` exist, and `vitest.config.ts` sets `root: projectRoot(...)`.
- D1: `ANIMATED_KINDS` (`boardAnimator.svelte.ts:18`) already leaves out initial, reconciliation, view-switch and edit.
- D2: no Svelte transition on any node GSAP tweens.
- D5: no staged piece. Another player's Undo or a step back only hops the stack home; C6 covers the restage guard.
- D8: no staged piece is drawn; a chosen stack shows only a mark, which fades with the move.
- D10: trays show counts and one icon per type, not the pieces themselves.
- D11: no `StagedDrop`; your own placement is sent on tap and drops through the animator.
- D13: no `$effect` anywhere in the UI.
- D15: tray highlights have no CSS transition. History entries' `in:fade` matches the merged titles.
- E1–E6: seeds come from `Piece.id` in the state being drawn (see the Specks section).
- F3: shadows are radial-gradient ellipses already.
- F4: no masks or filters.
- F5: piece looks are pre-rendered WebP, with no live textures.
- H4: lines, outline, labels and centres already live in `board/geometry.ts` and `board/coordinates.ts`.

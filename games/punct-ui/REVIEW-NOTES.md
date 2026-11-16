# PÜNCT: review notes (temporary)

> Delete this file in the commit that finishes the readiness fixes. It guides the review and is not part of the title.

> "The author" below is the title's author, who opened this PR. Where a fix would change a choice marked as theirs, ask on the PR before changing it.

This branch has had only two readiness commits: the move onto upstream's Rolldown/Vite 8/ESLint 10 tooling, and the visibility, randomness and WebP cover commit. The four GIPF project titles already on main (GIPF, MATRX GIPF, GIPF with Potentials, ZÈRTZ) needed the fixes below. The commits cited are on main and each shows a worked fix. The statuses come from reading this branch, not from running the review, so run `game-pr-readiness` as usual and treat them as leads. The harness port is 5208.

## Preserve

**Rule readings agreed with the author.** Record these in the missing `games/punct/docs/rules-interpretations.md` (B7):

- The Standard version is the default and Basic is a game option. In Standard, no new piece enters the central hexagon, and placing the last piece decides the game on the central spaces each player controls (equal counts draw). In Basic, only White's first piece stays out of the centre, and the last piece placed without a connection draws ("undecided").
- A PÜNCT can be the unsupported middle of a bridge only if the top piece below it is the mover's (BoardSpace's reading; `board.ts` `levelFor`).
- Any completed connection ends the game at once. If only the opponent's connection is complete, the opponent wins. If the move completes both, the mover wins (BoardSpace; `turnFlow.ts` `outcomeAfter`).
- These readings were stated to the author, who did not object:
    - A piece is lifted before it moves, so it never rests on itself.
    - Turning a piece in place is a move. Putting it back unchanged is not, and the centre-PÜNCT straight piece turned half round counts as unchanged.
    - Any covered dot freezes a piece, including a dot under a bridge's middle.
    - Nothing may go into a space under a bridge, at any level.
    - A player with no legal action passes, and `passedPlayerId` is recorded on the move before. If neither player can act, the game is a draw (`NoMoves`).
- Who plays White is chosen at creation (Random, Game creator, Opponent).
- Shown names number each column up from 1 at its bottom space (`spaceLabel`: A1–A7, H1–H16). The logic keeps BoardSpace's `spaceName` for tests and scenarios.

**Looks the author chose.** Do not restyle any of these:

- The board is the HUCH edition: a plate with its edge showing, holes cut through to a pale base, thin lines from hole to hole (no hex outlines), a green centre and a green table.
- Pieces have upright sides with slight rounding and are 0.19 S thick. A 0.12 T seam with a dark crease shadow separates levels. Every top has a light edge, and the black top is #2c3034.
- Dots are flat-floored dishes 0.6 T deep, with the far wall in shade.
- Specks follow option F (2.5 per 100 u², size 1.3, a third grey). They are seeded by the piece's id.
- Pieces are pre-rendered WebP bodies, dishes, holes and icons. A piece is drawn live only while it turns, and the `moving` flag keeps the live body under the image until the image loads.
- Labels sit on the table in dark ink: the full name below each column, only the top number above it.
- Player cards show one row of six kinds with counts, then "N in centre" (Standard only).
- The reserve strip pieces are larger. On phones, the triangle and the right-hand angle piece go in a second row over the board's empty top corners.

**Motion the author chose** (`StagedMotion`, contract §2 "Hovering piece"):

- The staged piece hovers about 1.15 T above where it will rest.
- A new piece falls to its rest, bounces up past the hover and settles into it.
- A moved piece lifts off, then flies into the hover.
- A tap turns the piece about its PÜNCT with ease in and out: clockwise, the other way if that sweep is blocked, and lifting clear if both ways are blocked.
- Drop (or Place) brings the piece down with a small bounce. Undo raises a dropped piece back into its hover.
- While a piece hovers, the other destinations stay visible, dimmed to 65%. Once a piece is chosen, the other movable pieces' rings fade to 40%. The prompt reads "Tap the piece to [turn] it, then [Drop]".
- Pieces dropped by other players use DVONN's drop bounce. Moves glide clear of everything in their path.

**Preferences and toggles.** A1 coordinates (on by default), Levels badges (off), 90° rotated board (off) and Far side, a 180° turn (off). The 90° and Far side toggles combine. Do not add 60° steps.

**Behaviour a fix could easily flatten:**

- Pieces keep their true orientation 0–5 in state (`sameOrientation`/`samePlacementPeriod`), so specks never jump. Do not normalise rotation modulo the placement period in B1 or B2.
- Piece ids double as speck seeds. Any change to `nextPieceId` must keep each piece's id equal to its entry order.
- The chosen kind (`preferredKind`) and a new piece's last rotation (`preferredRotation`) carry from turn to turn and are not "let go".
- Tapping off the choices lets go (`session.letGo()`). Keep this when H1 moves the handler.
- Draw order is not worked out again every frame. `Board.svelte:100-105` keys it on `hover.piece`, `hover.cells` and `hover.aloft` and the flier's id, so any F2 rewrite must not make those change per frame. Shadows are cached, and only the pieces that moved are reset after an animation.

**Where a catalogue fix could conflict with an author choice:**

- D7 versus the drop bounce: an actionless step must end within 0.2 s, so it needs a quick drop. The full bounce stays for real moves.
- D8: PÜNCT has no lift-off when you let go, because the hover just vanishes. Adding one is new motion, so ask the author first.
- C2 per-tap Undo of turns: this changes how Undo feels after turning. Agree it with the author, and keep the turn animation, so Undo turns the piece back.
- A2 1/0 scores: the centre count stays on the cards and in the end panel.

## Fixes

### Metadata and logic

- **A1 `hasScores: false`: applies.** It is missing from `games/punct/src/definition/info.ts:8-20`. Example: gipf `7dd4828da`.
- **A2 Win/loss `finalScores`: applies.** `scoring.ts:7-12` returns each player's centre count for every ending, including connection wins and Basic games. Make it winner 1 and loser 0, with 1 each for a draw. Example: zertz `b2a9b91fb` (draw case).
- **A3 `seriesKeeps = 'latest'`: applies.** Nothing reads past `currentTurn()` (`Header.svelte:8`, `takingTurn.ts:36`). Set it in `initializer.ts` after `HydratedTurnManager.generate` (line 31), add the playout assertion, and rebuild the four scenario JSONs (`scripts/build-scenarios.mjs`), since they embed `turnManager`. Example: gipf `36405defd`.
- **A4 Config normalised and validated: applies.** `config.ts:56-65` (`variantFromConfig`, `whitePlayerFromConfig`) silently fall back to Standard and Random. Add `normalizeConfig` and `assertExists` as GP does. No derived settings need storing. Example: GP `4497039ac` (`normalizeGipfPotentialsConfig`).
- **A5 Per-choice descriptions: applies.** The Version option (`config.ts:22-35`) has only a combined description. Give Standard and Basic their own and keep the combined text. White's choices can stay as in matrx. Example: gipf `d0c84518d`.
- **A6 Config enum in an import-free module: applies.** `config.ts:8` imports `Variant` from `model/gameState.ts`, which pulls in the board, geometry, pieces and typebox compile. Move `Variant` into its own module, and maybe `EndReason`, which the UI imports. Example: matrx `2fca25a7f` (`model/boardShape.ts`).
- **A7 BGG link: applies.** Add `bggId` to `info.ts` metadata (look up PÜNCT's id). Example: zertz `e35ef711b`.
- **B1 State keeps only what play changes: applies.**
    - `nextPieceId` (`gameState.ts:40`, used at `:176-177`, the initializer and `session.svelte.ts:190`) always equals `board.pieces.length`, because pieces never leave the board. Derive it from there, which keeps every id and speck seed the same, and rebuild the scenarios.
    - Check whether to do the same for `PunctPlayerState.reserve` (`playerState.ts:8-22`). It equals `SET_COUNTS` minus that player's pieces on the board.

    Example: gipf `f05f55d97`.

- **B2 One rule, one helper: check.**
    - The rule's outcome is computed twice per action: `placePiece.ts:54` and `movePiece.ts:63` call `outcomeAfter` to get `passedPlayerId`, and `takingTurn.ts:45` calls it again.
    - `board.ts:196-213` `canMove` repeats `movesOf`'s filter (`:172-188`), probably for an early exit. Share a predicate.
    - `session.svelte.ts:307-315` (`turnStaged`) and `stagedMotion.svelte.ts:58` wrap rotations by hand next to `sameOrientation`.

    Example: zertz `ffc841dbb`.

- **B3 Shared helpers, asserts, no casts: applies.**
    - Use `sameCoordinates` in place of the hand-written q/r comparisons at `boardAnimator.svelte.ts:53-60, 286, 291` and `stagedMotion.svelte.ts:138-139`.
    - Silent fallbacks to replace with asserts:
        - `historyEntries.ts:41-45`: `metadata?.kind ?? PieceKind.Triangle`, `?? 0` and `entryOf` returning undefined.
        - `GameEndPanel.svelte:22, 29, 41`: `return ''`, which should assert a winner and an end reason.
        - `board.ts:278`: `if (current === undefined) break`.
    - Drop the pointless cast at `looks.ts:48` (`as number`). `gameState.ts:76-82` `opponentOf` throws where it should use `assertExists`.

    Examples: matrx `28c413199`, zertz `0c7bc289d`, matrx `2fca25a7f` (history and end panel asserts).

- **B4 Unread metadata dropped: applies.** `MovePieceMetadata.fromRotation` (`movePiece.ts:13, 67`) is read only by a spec fixture (`historyEntries.spec.ts:49`). `pieceId`, `kind`, `fromLevel`, `level` and `passedPlayerId` are read. Example: matrx `2fca25a7f`.
- **B5 Unreachable branches: check.** Probe these with a throw under the playouts:
    - `turnFlow.ts:35` (the `NoMoves` draw: can both players really be stuck?)
    - `turnFlow.ts:32-33` (the mover goes again)
    - `takingTurn.ts:37` (`playerId === undefined`)
    - `board.ts:278`

    Delete any that never fire, or keep them with a test. Example: matrx `19f475a13`.

- **B7 Every rule reading recorded and tested: applies.**
    - Write `games/punct/docs/rules-interpretations.md` from the Preserve list.
    - Tests exist for the bridge PÜNCT reading, both connection endings and passing (`game.spec.ts:359, 432, 440, 490`).
    - Missing tests:
        - the `NoMoves` draw
        - a moved piece refused under a bridge
        - the White option without an assignment (Creator, Opponent, Random). Copy matrx's `firstWith` in `games/matrx/src/definition/game.spec.ts`.

    Examples: gipf `45eaf4ced`, `bb8e1b48b`, GP `2d05bcb86`.

- **B8 Competition spec: applies.** There is no `competition.spec.ts` or `tests/playthrough.ts`. Cover both versions and every White choice. Examples: gipf `9824eb4b5`, matrx `4893fac3f`.

### Session and staged selection

- **C1 `localSelections`, no `undo()` override: applies.** `session.svelte.ts:225-231` overrides `undo()`, and `Header.svelte:39` reads `hasManualSelection()`. Register the selection in the constructor with `undoableStagedSelection` and read `hasLocalSelection`. Example: gipf `f527b9e17` (current shape: `games/gipf-ui/src/lib/model/session.svelte.ts` constructor).
- **C2 One Undo step per tap: applies, and it is a bug.** Turning sets one `rotation` stage (`session.svelte.ts:317`), so a single Undo resets every turn. For a new piece that Undo looks dead: `turnStaged` also sets `preferredRotation` (`:316`), and once the stage is popped `chosenOption` (`:172`) falls back to that same rotation. Decide with `docs/user-interactions.md` whether each turn is its own step (`pushStagedSelectionValue`), and either way make the Undo visibly change something. Add the stage-order mismatch spec. Example: gipf `c91b44ce8`.
- **C3 `selectionOwner`: applies.** The `staged` piece takes `playerId = this.myPlayer?.id` (`session.svelte.ts:182-190`). After an Undo in the harness's Non-active view, the next viewer gets the restaged choice in their own colour, and Undo pops it first. Examples: gipf `ec35a3152`, matrx `1f921c9b5`.
- **C4 No taps while a committed move plays: applies.** While the own-action step lands, the selection and marks are still live. `choosePiece`, `chooseSpace`, `chooseKind`, `turnStaged`, `letGo` and `confirm` all act, and `StagedMotion.follow` would start a new motion mid-landing. Return early on `updatingVisibleState`, and test it. Example: matrx `bb1ad8e0c`.
- **C6 Restage on your own Undo only: applies, and it is a bug.** `beforeNewState` (`session.svelte.ts:245-249`) restages whatever `undoingMove` holds on any `undo` transition, and never clears it on `undo`. A later Undo by the other player, or of an earlier move, restages a stale move. `boardAnimator.svelte.ts:151-153` then raises the wrong piece. Count the move only while `move.index === incoming.actionCount` and not `isViewingAsNonActivePlayer` (gipf's `restagedPush`), for both the restage and the animator. `restaged()` reads only the action, so nothing falls back to the shown state. Examples: gipf `b277355f5`, `601a844fe`.
- **C7 Session and staged-selection specs; vitest root: applies.** There is no `session.spec.ts` or `stagedSelection.spec.ts`, and `vitest.config.ts` lacks `root: projectRoot(import.meta.url)`. Example: matrx `1f921c9b5`.

### Animation

- **D3 Guard `afterAnimations`: applies.** `boardAnimator.svelte.ts:182-194` writes `this.pieces = to.board.pieces` unconditionally. `pieces` is a writable `$derived` of `session.gameState`, so a stale run would hold an old board until the next state. Example: gipf `e40541610`.
- **D4 `moveInterrupter`: applies.** Nothing can stop a move. The flier's start and end come from `session.view.plan` at glide start (`boardAnimator.svelte.ts:157-162, 242-243`) and are drawn without `view.orient`, so Far side or 90° mid-glide sends it the wrong way. Have `beforeNewState` abandon on `view-switch`, and have `toggleTurned` and `toggleRotatedBoard` (`session.svelte.ts:98-107`) interrupt, both with `progress(1)` on the context timeline. `StagedMotion` already works on the unturned plane and orients when drawn. Examples: gipf `79f0d563c`, `4d8e562cd`.
- **D5 Another player's Undo and step-backs: applies.** With no `undoingMove` (another player's Undo), the `undo` branch (`:148-153`) animates nothing, so an undone placement vanishes and an undone move snaps back. Slide back and lift off within one ≤ 0.2 s timeline. History step-backs already lift off or glide back quickly. Examples: gipf `e9389ffcf`, matrx `34825fadd`.
- **D7 Actionless steps within 0.2 s: applies.**
    - `drop()` (`:197-219`) ignores `quick`, so a state-only history step that adds a piece takes 0.26 + 0.14 s.
    - The timeline is offset by the uncapped draw time after `await tick()` (`:177`). Cap it at 0.01 s.
    - Add `tests/undo-timing.spec.ts`.

    Examples: matrx `4c9d54c1a`, (M) `cd2ef6b20`, zertz `e60bc9cce`.

- **D8 Lift-off only when the player lets go: check.** `StagedMotion.follow(undefined)` (`stagedMotion.svelte.ts:114-117`) drops the hover at once in every case: let-go, view switch, History, perspective change. So no lift-off can play at the wrong time, and none plays on a let-go either. Adding one is new motion, so ask the author. A moved piece's origin reappears at once on let-go. Examples: gipf `c7d160278`, zertz `5bbd25aed`.
- **D9 `historyMove` and the Undo's state: applies.** `historyMove` (`session.svelte.ts:77, 241-243`) is set and never read. Remove it. The animator's Undo (`boardAnimator.svelte.ts:151`) should assert that the move it raises is the one undone (see C6). Example: matrx `53b1cfea4`.
- **D10 A piece coming in is drawn once: applies.** During another player's, history or exploration placement, `session.gameState` is still the from-state. `PlayerTray.svelte:34` and `ReserveStrip.svelte:23` (through `session.inReserve`, `session.svelte.ts:206-215`) count the dropping piece in the reserve too, and `PlayerTray.svelte:17` shows the old centre count. Set the landing reserves at step start. `inReserve` already leaves out the staged piece. Examples: gipf `c29b32285`, GP `487466baf`.
- **D11 Drop mid-motion: check.** Own placements always come from the hover. `land()` starts from the hover's current `base`, so Drop pressed mid drop-in or mid-turn should continue from there. Confirm in the harness that pressing Drop mid-bounce does not snap. Examples: zertz `8f9341c11`, `57698b3e9`.
- **D12 History jump over several moves: applies.** `onGameStateChange` (`:154-174`) is an `else if` chain. It glides only `moved[0]`, ignores added pieces when anything moved, and snaps everything else at `afterAnimations`. Example: (M) zertz `7f69bb931`.
- **D13 `beforeNewState`, not `$effect`: check.** `Board.svelte:94-98` is the one `$effect`. It hands `session.staged` to `StagedMotion` and is documented in the contract. It mirrors the local selection and records nothing from the shown state, so D13's failure does not arise. It does re-run on every board change, though. Confirm the reviewer accepts it, or call `follow` from the session's selection setters. Example: zertz `29e601058`.

### Specks and piece identity through history

Specks are seeded by the stored `PlacedPiece.id`:

- Board pieces: `seed={piece.id}` at `Board.svelte:398`.
- The hover: `:345`.
- The flier: `:477`.
- `specks.ts:304-321`, keyed by kind, seed, angle and tilt.

The staged new piece takes the shown state's `nextPieceId` (`session.svelte.ts:190`). That is the id the placement gets, and an Undo restores it. Nothing reads `session.actions` or the next state for a seed. `ActionPanel` and `History` read `session.actions` for text only.

- **E7 Frame-by-frame spec: check.** Optional, since seeds come from state, but a cheap guard for B1's `nextPieceId` change. Example: zertz `f0f7831c7`.
- Not in the catalogue, check: a gliding or turning piece computes speck paths every frame at fractional angles (`speckPaths`), filling the 400-entry cache and clearing it. Measure this under F6.

### Phone rendering (gate 16)

- **F1 SVG text: applies.** `Board.svelte:547-549`: `.coordinate-label` uses `letter-spacing: 0.04em` and `dominant-baseline: central`. `Board.svelte:450`: the level badge uses `dy="0.36em"` under `scale(0.1)`. Use an alphabetic baseline with `dy = 0.35 × font size` in user units, and letter-spacing in px. Examples: zertz `c28047def`, GP `8d948c5d3`.
- **F2 No `matrix()` on moving SVG: applies.**
    - `drop()` and `liftOff()` tween GSAP `y` on piece `<g>` nodes (`boardAnimator.svelte.ts:202-209, 225-229`), and `afterAnimations` sets `y: 0` (`:190`). GSAP writes those as `matrix()`.
    - The flier (`:256-279`) and every `StagedMotion` tween move through `onUpdate`, which `seek()` skips.
    - Move them to `animators/svgPose.ts` setters and add `tests/motion.spec.ts`.
    - Keep the curves and the per-frame draw-order caching (see Preserve).

    Examples: zertz `4f9df9475`, `9b75bd255`, gipf `09ee9f3ba`.

- **F6 Measure with `tools/webkit-probe`: check.** The perf passes were judged on 4× Chromium. Record WebKit memory and repaint, especially for live turning and the glide.

### Tests, accessibility, docs

- **G1 Playwright smoke spec: applies.** `tests/` does not exist, and `playwright.config.ts` runs build+preview on 4173. Switch to `pnpm run dev --port 5208` with `baseURL` as gipf does, and add a table spec. Examples: gipf `231406f9d`, matrx `14e4246ea`.
- **G2 Undo-timing and motion specs: applies.** See D7 and F2.
- **G3 Fresh builds: applies.** Run checks after `pnpm --filter @tabletop/punct-ui^... build`.
- **H1 Tap-off wrapper: applies.** `Board.svelte:237-247` carries the `svelte-ignore` and `onclick` on the `<svg>`. Move them to `<div class="tap-off" role="presentation">`. Example: (M) zertz `a5afb8f2c`.
- **H2 Visual contract: applies.** Update `docs/ui-interaction-visual-contract.md` with each UI fix. §4 "Animation scope" (line 41) says Undo and history play in 0.18 s, which `drop()` does not do. §4 "Staged selection" (line 42) describes the overridden Undo. Example: gipf `0a583ac4c`.
- **H3 Comments give reasons only: check.** Many comments describe what the code does, or point to other titles (`ActionPanel.svelte:28`, "as Bus and Magna Grecia do"). Trim them to reasons under coding policy #38–41. Example: gipf `38496f671`.
- **H4 Board geometry out of `Board.svelte`: applies, partly.** Most is already in `board/`. Still in the component: `plateSideFill` (`:51-58`), `shadowPath` and its cache (`:216-228`), `relative` (`:230-234`), `hoverShadow` (`:191-193`) and the badge offsets (`:61-62`). Compare with `games/gipf-ui/src/lib/board/` (`boardLines.ts`, `marks.ts`).

### Not applicable

- A8: already `visibility: Alpha`. Leave it.
- B6: no compatibility code for older games.
- B9: the rulebook offers no optional choice the UI leaves out. Every legal rotation is offered.
- C5: no out-of-turn actions. On a pass the turn manager starts the mover's turn, so `Header.svelte:8` names the right player.
- D1: `ANIMATED_KINDS` (`boardAnimator.svelte.ts:22-28`) already excludes `initial`, `reconciliation`, `view-switch` and `edit`.
- D2: no Svelte transition shares a node with GSAP on the board.
- D6: step-backs diff the two boards by piece id and never use `onHistoryAction`.
- D14: animator helpers are already private. The public members are used by `Board.svelte`.
- D15: no highlight transitions on the board.
- E1–E6: seeds come from ids stored in state, never from `session.actions` or the next state (see the specks section).
- F3: shadows are path shapes, with no blur filters.
- F4: no board-sized masks or filters. Clip paths are piece-sized, in `DishLook` and `HoleLook`.
- F5: textures are pre-rendered WebP. Pieces are drawn live only while turning.
- F7: `render-looks.mjs:66` draws at 4 px per unit (icons 1.6), under the 2.5 × `maxFitScale` 2.5 = 6.25 limit.

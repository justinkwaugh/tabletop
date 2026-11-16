# LYNGK: review notes (temporary)

> Delete this file in the commit that finishes the readiness fixes. It guides the review and is not part of the title.

> "The author" below is the title's author, who opened this PR. Where a fix would change a choice marked as theirs, ask on the PR before changing it.

This branch has had only two readiness commits: the move to upstream's Rolldown, Vite 8 and ESLint 10 tooling, and "Ready LYNGK for review: visibility, randomness, WebP cover". The four GIPF project titles already on main (GIPF, MATRX GIPF, GIPF with Potentials, ZÈRTZ) needed the fixes below; each cited commit is on main and shows a worked fix to copy. The statuses come from reading this branch, not from running the review, so run `game-pr-readiness` as usual and treat these as leads. Harness and Playwright port: 5203.

## Preserve

**Rule readings** (seed `games/lyngk/docs/rules-interpretations.md` from these; the rules are LYNGK's published rulebook):

- Agreed with the author: Standard (default) and the Stack of 6 variant are offered. Claims count for passing: a player passes only if no move exists even after a claim still open to them, and the game ends when neither player can move that way. Tie-break stacks (4, 3, 2, 1; in Stack of 6, 5s on the board first) count for the player who claimed the top colour, and neutral tops count for no one. A neutral-topped 5-stack whose colour is later claimed stays on the board as an obstacle and never scores.
- Our own readings, not asked: jokers come down to "no two real pieces of one colour in a stack" (`hasRepeatedColor`). The point the stack leaves counts as empty during a LYNGK chain (`reachableFrom(..., vacated)`). LYNGK links must match the moving stack's top colour. A claim is offered only if it leaves the player a move (`claimableColors`), one claim per turn, before the move. Passing is automatic, with no Pass action (rule E12). A full tie is a draw. In Stack of 6, a stack of 6 wins only with a claimed colour on top.

**Looks**: the pieces are MATRX GIPF's disc in LYNGK colours: blue #2357ad, green #178c58, red #cc2e28, ivory #ece2c9, black. They are 0.2826 R thick, with a gap of 0.24 T and tilt 0.75. Each colour is a pre-rendered WebP, and each joker has its own near and far WebP with 640 flecks at size 0.6 baked in. Coloured pieces get 35 runtime specks at size 0.9 (black 32), spread by best-candidate sampling and clipped to the disc's outline; top specks shrink to keep off the lips. Pieces are numbered colour by colour with the jokers last (`FIRST_JOKER_ID` 40). The author said the shape is settled: do not suggest crisper or wider groove lips, and the colours are not open for discussion. The board has a taupe-cream table (#e2dccb→#cdc6b1), a white play area ending at the grid's edge, whiskers 0.25 of a step past each line, no node dots and no dark mode. Panels are dark brown (#3b3329), the cards and history are white (#fbf9f3), and the A1 toggle and claim pill are light. Marks are bright cyan two-tone rings, and landings are black-outlined dashes with a spot. LYNGK-points get a spot only. The SMIL lightning bolts show every LYNGK connection from the chosen stack (`lyngkConnections`), not only the ones a legal move uses; CSS opacity swaps blinked, which is why SMIL is used. Claim rings in the strip are tilted ellipses lying on the ground.

**Motion**: each hop arcs 24 units over 0.32 s (0.24 s per chained hop) and hovers 8 units over each LYNGK-point. The landing bounce is mostly vertical (2.5, then 0.8) with a small carry along the hop (1, −0.4). The occluder `<use>` copies hide a stack that lands behind a taller one; this fixed a bug the author reported. A scored stack waits for the bounce, swaps to one flier drawing and lifts 34 units as it fades, so it fades as one. Undo drops a scored stack back in and then hops it home. Undo and history play quickly and retrace the LYNGK route. The claim flight lifts, arcs, touches down short, skips and slides in, and plays in reverse on Undo. The second player's claims are mirrored so a new one lands outermost. A claim lands at once, with no mark fade before it.

**Interaction**: a move is one tap. Every reachable landing is marked, and the session commits the shortest route. Undoing a move picks its stack up again when it had more than one landing (`holdUndoneStack`, f8c15afcc), so another Undo lets it go; with a single landing nothing is held. Tapping off the choices lets go. A stack you cannot tap passes taps through to the stack behind (`pointer-events: none`), and marks sit in each stack's own wrapper, with the bolts on top. Other movable rings hide once a stack is chosen. This differs from the author's general "fade others to 40%" preference, but leave it unless the author asks.

**Preferences and phone**: the Far side toggle (`turned`, off by default) and the A1 toggle (`showCoordinates`, on by default) sit at the top right. Labels stay beyond their columns' ends, and the side tips' labels stay below when the board is turned. Preferences are at version 2, with a migration from version 1. LYNGK has no stack-height cap; do not add one (stack caps are off by default in every title). On phones the claim strip is one row, and the viewport tag (`maximum-scale=1, viewport-fit=cover`, `app.html:8`) and `touch-action: manipulation` (`GameTable.svelte:177`) are iOS workarounds. `CONTROLS_ROOM` keeps the bottom-left zoom bar clear of C1, and the board stays centred and is not shrunk.

**Where a fix meets an author choice:**

- D7 against the undo and history pace and the claim flight. Keep the retraced route, the drop-back of a scored stack and the reversed claim flight, but fit each Undo or actionless step into 0.2 s.
- F7 against the joker flecks. Halving the look scale softens flecks the author chose on full-size images. The author accepts slightly soft pieces at full zoom, so follow the rule and note the measured difference.
- B1 against the `scored` stacks. The cards draw each scored stack (an author choice) and `inferMove` reads them, so keep `scored` as stacks.
- B6 against `PieceIcon`. Icons and scored stacks have no ids, so `StackShape` keeps its optional `ids` and fallback seed for them; only the board's ids become required.

## Fixes

### Metadata and logic

- **A1 `hasScores: false`: applies.** `games/lyngk/src/definition/info.ts` has no `hasScores`. LYNGK is won or lost on a ranking (stacks of 5, then 4s, 3s, 2s, 1s), so add it with A2. Example: gipf `7dd4828da`.
- **A2 Win/loss `finalScores`: applies.** `scoring.ts:5-10` reports `scoreOf` (stacks scored, or 5-stacks on the board in Stack of 6). It ties when a tie-break decides the game, and the loser can have more when a stack of 6 wins. Report winner 1, loser 0, and 1 each in a draw. The cards and end panel read `rankingOf`, not `finalScores`, so nothing on screen changes. Example: gipf `9824eb4b5`, zertz `b2a9b91fb` (draw).
- **A3 Turn series keeps the latest turn: applies.** `initializer.ts:56`: set `turnManager.seriesKeeps = 'latest'` before `startTurn`. LYNGK reads only `currentTurn`, `endTurn` and `startNextTurn`. Add a playout assertion that the series stays short. Example: gipf `36405defd`.
- **A4 Config validated: applies.** `config.ts:50-55` `variantFromConfig` reads an unknown variant as Standard. Return Standard only when `variant` is undefined, assert otherwise, and add `normalizeConfig` with `Value.Check`. Example: GP `4497039ac` (`versionFromConfig`).
- **A5 Per-choice descriptions: applies.** `config.ts:33-40` has only the combined text. Give each of Standard and Stack of 6 its own `description` and keep the combined text on the option. Example: gipf `d0c84518d`.
- **A7 BoardGameGeek link: applies.** Add `bggId` to `info.ts` metadata after looking up LYNGK's BGG id. Example: zertz `e35ef711b`.
- **B1 State keeps only the pieces: applies.** `board.ts:16-19` and `emptyBoard` (`:30-32`) store all 43 points, empty ones included, and the initializer fills every point (`initializer.ts:58-63`). Store only the occupied points, say `stacks: { coords, stack, ids }[]`, and derive emptiness from absence. `pointAt`, `stackAt`, `occupied`, `lift` and `drop` change with it, and so do the spec helper `withStacks` (`game.spec.ts:~100`), `scripts/build-scenarios.mjs` and the five scenario files. Regenerating the scenarios rewrites the other files with new seeds, so restore any you did not mean to change. `claimedThisTurn` is real play state; keep it. Keep `scored` as stacks (see Preserve). Example: gipf `f05f55d97`, matrx `c0b02ff0c`.
- **B2 One rule, one helper: applies.** The LYNGK-link test (a stack of the mover's own claimed top colour) is written twice: in `board.ts:127-128` (`pathsFrom`'s `isLink`) and in the UI's `board/route.ts:46-72` (`lyngkConnections`). Move `lyngkConnections` or an `isLyngkLink` helper onto `HydratedLyngkBoard` and use it from both. In the session, the landings of one stack are computed in both `pathsFromChosen`/`landings` and `holdUndoneStack` (`session.svelte.ts:90-102, 167-172`); give them one private helper. Example: gipf `ada7f17c7`, zertz `ffc841dbb`.
- **B3 Shared helpers, asserts, no casts: applies.**
    - Casts: `as Rgb` at `board/pieceShape.ts:289, 300, 311, 320` (use a typed `mapRgb`, as zertz did) and `as MoveStack` at `board/route.spec.ts:59`.
    - Silent fallbacks to turn into asserts:
        - `historyEntries.ts:45, 56, 57`: `metadata?.… ?? …`, where a processed move always has metadata.
        - `board/coordinates.ts:54`: the notation falls back to `q,r`.
        - `route.ts:18-19, 40` and `session.svelte.ts:166`: early returns.
        - `boardAnimator.svelte.ts:295, 396`: return when nodes are missing.
        - `claimFlight.ts:96`: `?? 1`.
        - `GameEndPanel.svelte:20, 37-38`: reads `winners[0]` unchecked.
    - Shared helpers: `ringDistance` (`games/lyngk/src/model/geometry.ts:18-20`) is `distanceAxial` from the centre. Consider `coordinatesToNumber` in place of the string `coordsKey` (`board/geometry.ts:94`).
    - Examples: gipf `4296ad4c4`, zertz `ffc841dbb`, `0c7bc289d`, matrx `2fca25a7f` (notation and history asserts), `28c413199`.
- **B6 No compatibility code: applies.** `Point.ids` is optional "for boards set up without them" (`board.ts:11-13`). `drop` keeps ids only when both sides have them (`board.ts:70-79`), `idsAt` can return undefined (`:58-60`), and the animator copes with missing ids (`Flier.ids`, `boardAnimator.svelte.ts:61, 408`). Every scenario already has ids on every stack, so make ids required and the same length as the stack. Then drop the test "leaves them out where the stack landed on has none" (`game.spec.ts:191`), and give `withStacks` ids. After that `Flier.baseLevel` and the flier's `seedKey` matter only for the missing-ids seed. Remove them from the board path, and keep `StackShape`'s optional `ids` for `PieceIcon` (see Preserve). The comment at `board.ts:11-12` also calls an id "the index of the point it was dealt to", but pieces are now numbered colour by colour. The preference migration from version 1 (`preferences.ts:19-21`) is also for an undeployed title. Lean keep: it is tested, and the author's local harness stores version-2 preferences. Example: matrx `c0b02ff0c`.
- **B7 Rule readings recorded and tested: applies.** `games/lyngk/docs/` does not exist. Write `rules-interpretations.md` from Preserve and add the missing tests: the vacated origin counting as empty in a chain (no test found), a claim that would leave no move being refused, a neutral top counting for no one in the tie-break, and the endings. There is no first-player option. Example: gipf `45eaf4ced`, `bb8e1b48b`, matrx `19f475a13`.
- **B8 Competition spec: applies.** There is no `competition.spec.ts` or `tests/playthrough.ts`. Cover both variants with assigned starting positions (`supportsStartingPositions` is true), and move the playout helpers out of `game.spec.ts`. Example: gipf `9824eb4b5`, matrx `4893fac3f`.

### Session and staged selection

- **C1 `localSelections`, no `undo()` override: applies.** `session.svelte.ts:131-137` overrides `undo()`, and `Header.svelte:39` reads `hasManualSelection()`. Register `undoableStagedSelection(LyngkStageOrder, …)` in the constructor and read `hasLocalSelection`. Example: gipf `f527b9e17`, zertz `158cc765a`.
- **C3 The selection belongs to its owner: applies.** There is no `selectionOwner`. `holdUndoneStack` (`:163-176`) restages for whoever views. In the harness's Non-active view after an Undo, `chosenFrom` is empty (that viewer has no `movable`), but `hasManualSelection()` is true, so Undo shows and pops an invisible selection. Add `selectionOwner` and an `ownSelection` derived from it, as GIPF does. Example: gipf `ec35a3152`, matrx `1f921c9b5`.
- **C4 Taps ignored while a move plays: applies.** `choosePoint`, `letGo` and `claim` (`:179-210`) act during the move's animation. The shown state still offers the old choices, and choosing makes new marks appear at full opacity over the fading ones. Return early on `updatingVisibleState`. Example: matrx `bb1ad8e0c`.
- **C6 Restage on your own Undo only: applies (partly).** `holdUndoneStack` already reads `incomingGameState`. It does not check that `undoingMove` is the move undone (by `index === incoming.actionCount`) or that the view stays with that player. `undoingMove` is never cleared after the Undo. A hosted Undo presents twice (optimistic, then host) and re-holds, which resets any new choice made in between. Add a `restagedMove(incoming)` like GIPF's `restagedPush`. Example: gipf `b277355f5`, `601a844fe`.
- **C7 Session spec: applies.** Only `stagedSelection.spec.ts` exists; `vitest.config.ts` already sets `root`. Add `model/session.spec.ts` covering the hold after Undo with several landings, no hold with one, the Non-active view, and taps while moving. Example: matrx `1f921c9b5`.

### Animation

- **D3 Guard `afterAnimations`: applies.** `boardAnimator.svelte.ts:176-183` sets `this.stacks = to.board.occupied()` unconditionally. If a view switch publishes another state mid-move, the board is left showing the abandoned `to` until the next state. Record `shown = session.gameState` at the start and skip the overrides if it changed. Example: gipf `e40541610`.
- **D4 `moveInterrupter`: applies.** It is missing. `toggleTurned` (`session.svelte.ts:57-59`) changes the view while the flier's offsets and occluder depths were laid out in the old one. Add `interrupt()` and `abandon()`, both `progress(1)` on the step's timeline (its parent). Call `abandon()` from `beforeNewState` on `view-switch` and `interrupt()` from `toggleTurned`. Example: gipf `79f0d563c`, `601a844fe`, zertz `bbb329009`.
- **D6 A step back reads the undone move by index: applies.** For `kind === 'history'`, `fallback` (`:458-463`) uses `historyMove` from `onHistoryAction`, which names the action before the one undone. Take the move on screen whose `index === to.actionCount` for a step back; keep `historyMove` for a step forward. The effect is small today because the UI always commits the shortest route, so the fallback finds the same via. Moves sent by any other client could differ. Example: gipf `601a844fe` (`undonePush`).
- **D7 Actionless steps end within 0.2 s: applies.** In `QUICK` (`:52`), a chain undoes at 0.14 s per hop (0.28 s or more), and a scored Undo plays the 0.18 s drop-back before the 0.18 s hop (0.36 s). Undoing a claim, or stepping over one in history, plays the 0.62 s strip flight (`claimFlight.ts:8`; see X1). Fit each into 0.2 s: split 0.2 s across the hops, overlap the drop-back with the first hop, and use a short version of the claim flight. Add `tests/undo-timing.spec.ts`. Conflicts with author choices; see Preserve. Example: matrx `4c9d54c1a`, `4579aca43`, (M) `cd2ef6b20`, zertz `e60bc9cce`.
- **D9 History fields read only in History View: applies.** Leaving history is presented as `kind: 'history'`, so `fallback` can read a stale `historyMove`. Gate it on `session.isViewingHistory`, or clear it in `onHistoryExit`. `holdUndoneStack` should assert `incomingGameState` rather than return (`:166`). Example: matrx `53b1cfea4`, zertz `5bbd25aed`.
- **X1 Claim flight outside the animation context: applies (not catalogued).** `ColorStrip.svelte:38-40, 62-64` runs Svelte `in:receive`/`out:send`/`animate:flip` transitions whenever the published claims change. The presenter does not wait for them, `moveInterrupter` cannot stop them, and the undo-timing spec does not see them. They also play on `edit`, and on any reconciliation that changes claims. Either play the flight on the step's timeline (GSAP on HTML is fine) only for the animated kinds, or keep the Svelte transitions and make them instant for kinds other than `own-action` and `other-action`. Keep the motion the author chose for live claims.

### Specks and piece identity through history

- Every seed is read from state. The flier takes `before.board.idsAt(...)` from the step's own `from` or `to` state (`boardAnimator.svelte.ts:210, 248, 398-399`), board stacks take `point.ids` from the state drawn (`Board.svelte:176`), and nothing reads `session.actions` or the next state for a seed. The speck cache (`board/specks.ts:128-160`) is keyed by seed, colour, view and radius, not built from a board. E1–E6 are therefore n/a (listed below).
- **E7 Frame-by-frame speck spec: check.** It is not strictly needed for the reasons above. B1 and B6 rewrite how ids are stored and moved, though, so a spec checking that one stack's specks match before and after a move, its Undo, a history step each way and an exploration would guard that refactor. A scored Undo is worth a frame too: the flier swaps to `[...landedOn, ...moved]` ids mid-lift. Example: zertz `f0f7831c7`.

### Phone rendering (gate 16)

- **F1 SVG text: applies.** `Board.svelte:296-300`, the coordinate labels, use `letter-spacing: 0.04em` and `dominant-baseline: central`. Use the alphabetic baseline with `dy = 0.35 × 15`, and letter-spacing in px. Labels must not move (Preserve). Example: gipf `a2aea2931`, matrx `7fe6cad46`.
- **F2 No GSAP `matrix()` on moving SVG: applies.** Every animator tween sets `x`, `y` or `scale` on SVG `<g>` nodes (flier `whole`, `body` and `shadow`; stack `whole`, `body` and `shadow`). Port them to `animators/svgPose.ts` (copy GIPF's) and add `tests/motion.spec.ts`. `scaledFromCentre`'s `svgOrigin` (`:496-498`) exists only to stop GSAP measuring every stack, which froze opening a game on phones; pose scaling about each node's own origin makes it unnecessary. The occluders update from an `onUpdate` on a dummy tween (`:339-341`). Make sure `seek()` or `progress(1)` still leaves them right; they are dropped with the flier anyway. Example: gipf `09ee9f3ba`, `dbb96354f`, zertz `4f9df9475`, `9b75bd255`.
- **F3 Shadows as shapes: check.** The stack shadows are radial gradients already. The bolt glow uses `filter: blur(2px)` (`Board.svelte:376`) on SMIL-animated paths, which re-filters every shape step. If the probe shows it, replace it with a wider translucent stroke and keep the look. Example: gipf `948776b5f`.
- **F4 No table-sized masks or filters: check.** There are none on the board. `.lyngk-table` has `background-attachment: fixed` on a radial gradient (`GameTable.svelte:172`), which can cost full repaints. Measure it with the probe.
- **F6 Measure with `tools/webkit-probe`: applies.** Record steady memory and repaint against the merged titles' +53 to +82 MB and 32 ms.
- **F7 Looks sized by the limit: applies.** `scripts/render-looks.mjs:54` has `SCALE = 12` (616 px images). `maxFitScale` is 2.5 (`GameTable.svelte:105`), so set `SCALE = 2.5 * 2.5`, rerun the script and commit the new WebPs (`lookUrls.ts` is regenerated). See Preserve on the joker flecks. Example: gipf `eb5fcf3b4`, zertz `2dd120bd7`.

### Tests, accessibility, docs

- **G1 Playwright smoke spec: applies.** There is no `tests/`. `playwright.config.ts` builds and previews on port 4173, and `test` runs `test:integration` first, so it fails. Copy gipf's config with `pnpm run dev --port 5203` and add `tests/table.spec.ts`. Example: gipf `231406f9d`, matrx `14e4246ea`.
- **G2 Undo-timing and motion specs: applies.** See D7 and F2.
- **G3 Fresh builds: applies.** Run checks after `pnpm --filter @tabletop/lyngk-ui^... build`.
- **H1 Tap-off on a presentation wrapper: applies.** `Board.svelte:129-138` has the `svelte-ignore` and `onclick` on the `<svg>`. Wrap the svg in `<div class="tap-off" role="presentation" onclick={onBoardClick}>` with `display: contents`. Example: gipf `c29b32285`, zertz `a5afb8f2c`.
- **H2 Visual contract: applies.** `docs/ui-interaction-visual-contract.md` is stale:
    - It says "amber outline/ring" where the marks are cyan.
    - It says "Specks are seeded per point and level" and "a stack in flight is seeded for where it lands", but specks are now seeded per piece id.
    - It describes the bolts as three shapes at 0.4 s; there are six at 1/3.6 s.
    - It describes a two-row phone strip where the strip is now one row.
    - It leaves out the claim flight, the occluders, the scored lift and drop-back, and the tap-off and hold rules.
    - Its status line still reads "initial LYNGK UI".
      Update it alongside each fix. Example: gipf `0a583ac4c`.
- **H3 Comments give reasons: applies.** Examples: `ActionPanel.svelte:21` ("as Bus and Magna Grecia do"), the stale id comment at `board.ts:11-12`, and `StackShape.svelte:30-31` (the missing-ids fallback, which goes with B6). Example: gipf `38496f671`, matrx `bf58e9fab`.
- **H4 Board geometry out of `Board.svelte`: applies.** Move the lines and whiskers (`Board.svelte:21-49`) to `board/boardLines.ts`, and `roleOf`, `faceCenter` and the bolt shapes (`:61-91`) to `board/marks.ts`, with specs, as `games/gipf-ui/src/lib/board/` has them.

### Checks (cannot decide from reading)

- **B5 Unreachable branches: check.** Probe with a throw under the playouts: `stackAt` and `idsAt` for non-points (`board.ts:50-60`), `drop`'s id-dropping branch (dead after B6), `shortestRoute` with no current turn (`route.ts:18-19`), and the animator's fade-only branch when `inferMove` finds nothing (`boardAnimator.svelte.ts:443-455`). That last one is reachable on multi-action state-only jumps, so keep it. Example: matrx `19f475a13`.
- **D12 History jump over several moves: check.** `inferMove` needs exactly two changed points (`inferMove.ts:26`). A state-only jump over two or more moves fades only the stacks that leave, and arriving stacks pop in. If such jumps occur, at least fade the arrivals in. Flying one stack's several moves is possible only when one stack made them all. Example: zertz `7f69bb931`.
- **D15 Transitions in History View: check.** Board rings are not shown in History View. The claim strip's flights and flips do play on history steps (X1), and the History panel's entries fade in (`History.svelte:37`). Decide with X1.

### Not applicable

- A6: `config.ts` imports only typebox and `@tabletop/common`, with no geometry or runtime code.
- A8: already `GameVisibility.Alpha`; leave it.
- B4: every `MoveStackMetadata` field is read (`moved`, `landedOn` and `scored` by history and the animator; `completedSix` by `takingTurn.ts:50`).
- B9: claims are offered whenever allowed, and the route through LYNGK-points never changes a move's outcome (the one-tap shortest route was agreed).
- C2: one stage (`from`), tapped once.
- C5: no out-of-turn actions, so the turn holder is always the active player.
- D1: `ANIMATED_KINDS` already leaves out `initial`, `reconciliation`, `view-switch` and `edit` (for the strip, see X1).
- D2: no Svelte outro and GSAP tween share a board node; the strip uses Svelte only.
- D5: nothing is staged off the board. An undone stack flies home and stays; restaging is C3/C6.
- D8: no staged piece to lift off. A scored stack's drop-back on Undo is an author choice (see Preserve and D7).
- D10: no reserves feed the board. A claimed colour is drawn once, in the strip.
- D11: no placement drops.
- D13: no `$effect` in the UI. `History.svelte` snapshots entries on click.
- D14: animator helpers are already private; the public members are attachments.
- E1, E2, E4: seeds come from the step's states, never from `session.actions`.
- E3: not for seeds; the stale-history route read is D9.
- E5: the speck cache is not built from a board.
- E6: no `$effect`.
- F5: looks and joker flecks are pre-rendered WebPs, with no `feTurbulence`.

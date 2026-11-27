# The Game of Y UI interaction visual contract

## Visual intents

- **Place a stone.** On the viewer's turn every empty point (a cell on a hex board) is a hit target. A mouse or pen hovering one shows a faint stone of the viewer's colour there; a tap, a click, or Enter or Space on the focused target places. The prompt reads "Place a black/white stone on any empty point" ("cell" on a hex board drawn as hexagons). Nothing is dimmed and the stones already down are unaffected.
- **Swap or place.** On White's first turn with the swap rule on, the prompt reads "Place a stone or [Swap]". Swap is a button in the prompt; the board's targets stay live beside it. Swapping changes no stone: the players trade colours and the prompt passes to the new White.
- **A stone drops in.** A placement falls onto its point and rocks on its domed underside to rest, its shadow darkening under it. Undo lifts it off: it rises (in the flat view, swells) as it fades.
- **Last move.** The latest stone carries a ring in the other stone's colour until the game ends.
- **Winning chain.** When a Y completes, every stone of the winner's chain carries a cyan ring over a dark band; the rings light one after another along the chain from the winning stone. The end panel replaces the prompt.
- **Board views.** Toggles at the board's bottom right: coordinates (A1), flat or tilted (flat by default), loose stones (off by default), and, on a hex board only, hexagons or lines (hexagons by default). Each is a title preference. Loose stones sit up to 30 units off their points, seeded by stone id so every viewer sees the same board.
- **Coordinate guide.** On Kadon's board a ? button in the header opens a popover naming every point, each row traced in its own colour.
- **Replay a move.** A placement in the History panel is a button that replays that move on the board, highlighted while it plays. Swap and called-game entries are listed but cannot be replayed, since they change nothing on the board.
- **At rest.** Page loads, server syncs and view switches show the board as it is, without motion. A player whose system asks for reduced motion sees every state at rest.

## Coexistence and precedence

- **Winning chain over last move.** Once the game has a result, the winning chain's rings replace the last-move ring (`BoardAnimator.ringsOf`). The winning stone carries the chain's ring, not the last-move ring.
- **Place and Swap.** Both are offered on the swap turn and coexist: the board's targets and the Swap button are live together. Whichever is taken first closes the other.
- **Pointer stone and a move landing.** The pointer stone hides from the click that places until the visible state has finished updating (`updatingVisibleState`), so it never sits over the stone dropping in.
- **Board views and a move in flight.** Toggling coordinates, flat or tilted, or loose stones changes where stones lie, so it lands a playing move at once (`moveInterrupter.interrupt()`). Hexagons or lines moves nothing and leaves the move playing. A view switch lands the move and drops the rest of its replay (`abandon()`).
- **History View and placing.** While history is viewed nothing is placeable and no pointer stone shows. Rings follow the state shown.
- **Replay and the History panel.** While a replay plays, the panel keeps the entries it showed when the replay started and highlights the one replaying. A second replay is ignored until the first finishes.
- **Reduced motion and every motion intent.** Reduced motion wins: each state shows at rest, with no drop, rocking, lift or growing ring.
- **One stone id on two points.** A stone's id is its place in the order of play, so two lines of play (an exploration and the game, or an Undo and the move after it) can give one id to different points. The board keys stones by id and point (`board/stoneKey.ts`), so the stone that goes lifts off while the one that comes drops in. Neither copy jumps across the board.

## Shared visual state

- **Board stones** (`BoardAnimator.stones`).
    - _Meaning:_ the stones the board draws. During a step it holds both the `from` stones and the newly placed ones, so stones can drop in and lift off.
    - _Producer and consumers:_ produced by `BoardAnimator.present`, and read by `Board.svelte` for drawing and by `jitter.ts` for loose offsets.
    - _Lifetime and validity:_ reset to the `to` state when the move lands (`afterAnimations`), or on any error. A landing after a view switch leaves the board alone, because another state is already shown.
    - _History:_ history steps and replays animate like Undo or a move. A replay leaves each action's board until the visible state catches up.
- **Rings** (`BoardAnimator.rings`, keyed by `StoneKey`).
    - _Meaning:_ which stone carries the last-move ring or the winning chain's ring.
    - _Producer and consumers:_ derived from game state by `ringsOf`, which is the one place precedence is decided. During a step it holds both the old and new rings, so they can shrink and grow.
    - _Lifetime and validity:_ reset to the `to` rings as the move lands.
    - _History:_ follows the shown state in Live View and History View alike.
- **Hovered point** (`Board.svelte` `hovered`).
    - _Meaning:_ the point under a mouse or pen.
    - _Effect:_ drives only the pointer stone.
    - _Lifetime and validity:_ cleared on pointer leave and on place. A touch never sets it. Hidden while `updatingVisibleState` or when the point is not placeable.
- **Board view preferences** (`showCoordinates`, `flatBoard`, `looseStones`, `hexCells` on `YGameSession`).
    - _Lifetime and validity:_ per viewer, kept across games and sessions, and unaffected by history.
    - _Interruption:_ the three that move stones interrupt a playing move (see above).
- **Replaying entry** (`History.svelte` `replaying`).
    - _Meaning:_ the entry being replayed, plus the list frozen at its start.
    - _Lifetime and validity:_ cleared when `replayRange` settles or throws.
- **Action panel height** (`holdTallest.ts`).
    - _Meaning:_ the tallest height the panel has reached at its current width, so a wrapped line doesn't move the board when it shrinks back.
    - _Lifetime and validity:_ a new width or a remount starts it over.
- **Zoom limits** (`board/zoom.ts`).
    - _Meaning:_ how far the board may scale, to fit and by zooming, from the board's width and the screen's pixel ratio. The board is never drawn wider than 5,500 device pixels.
    - _Lifetime and validity:_ the same in either view, and changed only by the board shape or the pixel ratio.

## Render ownership

- **Stone motion.** Owned by `BoardAnimator`.
    - The drop takes 0.45 s (`DROP_TIME`): a 26-unit fall, then a 9° tip and three easing swings. The line the stone rocks about differs for each stone (golden angle by id) and turns 40° as it settles.
    - In the flat view, the stone starts at 1.2× size with its shadow 8 units off, instead of rising up the screen.
    - A step without an action finishes within 0.18 s, plus at most 0.01 s waiting for the board to draw.
    - The stone's tipped 3D shape is written as `translate()` plus an offset-free `matrix()` (`stoneShape.ts` `rockTransform`, `stonePose.ts`), because Firefox leaves a `matrix()` offset out of the board's CSS zoom.
- **Rings ride the stone.** A ring is drawn inside its stone's moving body group, so it rocks and lifts with the stone. The animator scales it about the ring's own middle. The rings are bands painted on the top dome, following its curve (`domeRing`).
- **Slow frames.** While a move drops a stone, GSAP's lag smoothing is (100, 33), so a phone's slow first frame shows the fall late rather than skipping it. The default (500, 33) comes back as the move lands, and steps without an action keep the default.
- **Stone images stay decoded.** `decodedStones.ts` decodes all four stone images when the board opens and holds them, so a new stone is never blank through its fall.
- **One board surface.**
    - The board is one SVG under `ScalingWrapper`'s `renderAtViewScale`.
    - These are pre-rendered WebP images by `scripts/render-looks.mjs` from the `/looks` page: the wood top and edge, the stones (lit pixel by pixel), and the board's shadow on the table (`boardShadow.ts`, 0.5 px per unit).
    - Stone shadows are radial gradients.
    - No filters or masks.
    - Measured on a 3x phone, the pre-rendered board shadow saved about 120 MB and 100 ms of repaint at full zoom, compared with the vector paths it replaced.
- **Hit targets.** `Board.svelte` draws the targets last, over every stone, so a tap reaches a point among stones on every side. A target is the stone's footprint ellipse.
- **Labels.**
    - Kadon's points use BoardSpace names. Each label stands on the rim, just clear of a stone on its point.
    - Hex labels stand on the line of cells they name, beyond the side, and 6 units clear of the cells when drawn as hexagons.
    - Hiding the labels doesn't change the board's frame.
    - Labels use the alphabetic baseline with a `dy` in user units.

## Verification scenarios

| Scenario                     | Start                               | Input                                    | Expected                                                                 | After                                                    | How                                                                 |
| ---------------------------- | ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------- |
| Place                        | Swap or place, Bob to move          | Tap F5                                   | Stone drops and rocks; last-move ring moves to F5; turn passes           | Undo lifts it within 0.2 s and the ring returns to E5    | `table.spec.ts` placing…, `undo-timing.spec.ts` your own Undo       |
| Tap among stones             | A crowded board                     | Tap a point's real centre                | Places there                                                             |                                                          | `table.spec.ts` a tap on a point's centre                           |
| Swap                         | Swap or place                       | Swap                                     | Stone stays black, colours trade, prompt passes                          | Undo offers Swap again                                   | `table.spec.ts` White may take…, `session.spec.ts` swap             |
| Swap closes                  | Swap or place                       | Place instead                            | Swap no longer offered                                                   |                                                          | `session.spec.ts` closes once White places                          |
| Winning chain over last move | One from a Y                        | Place C1                                 | Chain's rings light along it from C1; no last-move ring; end panel       | History back and forward restores the rings within 0.2 s | `table.spec.ts` completing a Y, `undo-timing.spec.ts` history steps |
| Another player's Undo        | After a placement                   | Undo arrives from elsewhere              | Stone lifts within 0.2 s                                                 |                                                          | `undo-timing.spec.ts` another player's Undo                         |
| One id, two points           | Swap or place, F5 placed            | Explore, Undo, place D4, end exploring   | D4's stone lifts off and F5's drops in, within 0.2 s                     |                                                          | `undo-timing.spec.ts` leaving an exploration                        |
| History View                 | Mid-game                            | Step back in history                     | No targets, no pointer stone                                             | Returning to live offers placing again                   | `session.spec.ts` offers nothing while history is viewed            |
| View toggles mid-game        | A move playing                      | Toggle flat, loose stones                | Move lands at once; stones lie per the view, never overlapping           |                                                          | `table.spec.ts` the board turns flat…, `jitter.spec.ts`             |
| No offset `matrix()`         | Each view                           | Place, Undo, history steps, a win        | Every moving SVG transform is `translate()` or an offset-free `matrix()` |                                                          | `motion.spec.ts`                                                    |
| Reduced motion               | Reduced motion on                   | Place                                    | Stone at rest at once                                                    |                                                          | `motion.spec.ts` with reduced motion                                |
| Hex board                    | New game, hex board                 | Place in a cell                          | Cells named as on a Hex board                                            | Lines toggle redraws without moving stones               | `table.spec.ts` a hex board…, `session.spec.ts` hex cells           |
| Replay                       | Swap or place, after a swap and F5  | Click F5's entry; look at the swap entry | The move replays, entry highlighted; the swap entry is not a button      | Highlight clears as the replay ends                      | `table.spec.ts` the History panel…                                  |
| Pointer stone                | Viewer's turn, mouse                | Hover a point, click                     | Faint stone shows, hides from the click until the move lands             |                                                          | Manual                                                              |
| Zoom on a phone              | A hex-19 board, 3x screen           | Zoom in fully                            | The board stops at about 1.6×, drawn at most 5,500 px wide               |                                                          | `zoom.spec.ts`; WebKit probe, manual                                |
| Panel height                 | A long player name wraps the prompt | The prompt shortens                      | The board does not move                                                  | A width change starts over                               | `holdTallest.spec.ts`                                               |

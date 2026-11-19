# UI Interaction Visual Contract

## 1. Visual Intents

| Intent    | Trigger                                 | What should be emphasized                                             | What should be dimmed | What must remain unaffected |
| --------- | --------------------------------------- | --------------------------------------------------------------------- | --------------------- | --------------------------- |
| place     | The viewer may place                    | Nothing: every empty cell can be filled; a pointer shows a faint fill | Nothing               | Filled cells                |
| swap      | The viewer is Blue on the swap turn     | The prompt's Swap button                                              | Nothing               | The board                   |
| last_move | Always, until the game ends             | A white hexagon outline inside the latest cell                        | Nothing               | Other cells                 |
| won       | The game has ended with a winning chain | Cyan dots over a dark band in every cell of the winning chain         | Nothing               | Other cells                 |

## 2. Visual Primitives

- **Board** (`Board.svelte`, `board/geometry.ts`): seen straight down, a rhombus of hexagons with a point at the top, 40 units between neighbouring centres, each row half a cell right of the one above (HexWiki's drawing). Empty cells pale (`--hex-cell`), outlined in dark lines drawn over the fills. Beyond the cells, each edge has a band in its player's colour reaching 0.18 of the spacing past the outermost corners, Red's top and bottom, Blue's left and right; at the obtuse corners the bands meet at the middle of the corner cell's shared side, at the acute corners at its corner.
- **Filled cell**: the whole hexagon in `--hex-red` or `--hex-blue`, flat, with no shading. Never carries interaction state.
- **Upright board** (`upright` title preference, off by default; the turning-arrow toggle beside A1): the whole board turned a quarter anticlockwise, so it stands taller than wide, as suits a phone; a player picks it once and sees the same board on every screen. Labels stay upright and re-clear their bands for the turned board. The player cards' small board icon turns with it.
- **Coordinate labels** (`board/geometry.ts`): HexWiki names in capitals, each standing on the line of cells it names, beyond the band: a letter on its column's slant past the top and bottom rows, a number on its row past the left and right edges, clear of the band by 0.14 of the spacing. The A1 toggle (`showCoordinates` title preference) hides them; the board's frame does not change.
- **Marks**: the latest move's white hexagon outline, its line 0.55 of the cell's corner radius out and 0.14 of it wide, growing from the cell's centre; the winning chain's cyan dot of radius 0.13 over a dark one of 0.19. Drawn above the lines, scaled about their middle by the animator.
- **Player cards** (`PlayerTray.svelte`): the player's colour band, and a small rhombus with their two edges drawn in their colour, turned as the board is.

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                        | Allowed Inputs                                  | Must Not Own                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------- |
| `HexGameSession`                                      | `placeable`, `canPlace`, `canSwap`; a tap commits a placement or the swap                                   | Game state, valid action types                  | Styling                     |
| `Board.svelte`                                        | Hit targets on every empty cell; the pointer's faint fill                                                   | Session lists, the animator's cells and marks   | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Cells filling and draining; which mark each cell carries, and marks growing, shrinking and fading with move | Transition kind, `from`/`to` states, the action | Interaction state, legality |
| `ActionPanel.svelte`                                  | One-line prompt on your turn ("Fill a cell or [Swap]" on the swap turn), the last move otherwise            | Session state, history entries                  | Board marks                 |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest.
- **Filling** (`board/geometry.ts` `growthOf`, `coverageOf`): a placed cell fills like a liquid in 0.3 s (`power1.out`), about as long as a GIPF-series drop or slide. From every cell of its colour beside it (the middle of the shared side) and every edge of its player it lies on (its outermost corner), a disc grows; the discs run together where they meet through a cell-sized goo filter (blur 3, alpha cut back to a hard edge) and are clipped to the tile. They grow only until together they cover the cell (plus 0.04), so every fill takes the whole time. A cell touching neither its colour nor its edges spreads from its centre as a soft hexagon (corners rounded over 0.35 of its radius), scaled up, crisp, without the goo. The sources are the cells there before the move.
- **Draining** (Undo, a step back): the discs shrink back into the cells and edge they came from, or the hexagon into its centre, in 0.18 s, the sources the cells still there after.
- **Marks**: a new mark grows from its middle as the fill finishes; the previous move's mark shrinks away as the next cell fills; the winning chain's marks grow one after another along the chain from the winning cell. A draining cell's mark fades over the first half of the drain.
- **Steps without an action** (Undo, state-only history, exploration): fills and drains and mark changes all within 0.18 s plus at most 0.01 s waiting for the board to draw.
- **Pointer fill**: shown only for a mouse or pen hovering an empty cell while the viewer may place, hidden from the moment of a click until the move lands.
- **Slow frames**: while a move fills a cell, a frame taking longer than 100 ms advances GSAP's clock by only 33 ms (`gsap.ticker.lagSmoothing`, put back to GSAP's 500 ms as the move lands), so a phone that stalls shows the fill late rather than skipping it. Steps without an action keep GSAP's default.
- **Interrupting**: a preference that changes layout (coordinates, upright board) lands a playing move at once; a view switch lands it and drops the rest of its replay.

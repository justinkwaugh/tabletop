# UI Interaction Visual Contract

## 1. Visual Intents

| Intent      | Trigger                              | What should be emphasized                                               | What should be dimmed | What must remain unaffected |
| ----------- | ------------------------------------ | ----------------------------------------------------------------------- | --------------------- | --------------------------- |
| place_stone | The viewer may place                 | Nothing: every empty point takes a stone; a pointer shows a faint stone | Nothing               | Stones on the board         |
| swap        | The viewer is White on the swap turn | The prompt's Swap button                                                | Nothing               | The board                   |
| last_move   | Always, until the game ends          | A ring on the latest stone, in the other stone's colour                 | Nothing               | Other stones                |
| won         | The game has ended with a Y          | Cyan rings over a dark band on every stone of the winning chain         | Nothing               | Other stones                |

## 2. Visual Primitives

- **Stone** (`Board.svelte`, sizes in `board/geometry.ts`, shape in `board/stoneShape.ts`): a go stone of Kuroki Goishiten's size 44 (thickness 1.15 of the radius), both faces domed alike, seen from the near side of the table at tilt 0.75. Each colour is one image, lit pixel by pixel (`board/stoneLight.ts`) and pre-rendered at 6.25 px per board unit by `scripts/render-looks.mjs` from the `/looks` page. Matte: a small tight highlight, warm light bounced up from the board onto the underside. Never carries interaction state.
- **Shadow**: a radial-gradient ellipse under each stone, offset down and right, inside the stone's drawing; no filters.
- **Board** (`Board.svelte`, `board/geometry.ts`, `board/woodTexture.ts`): a solid slab of kaya, its top a straight close grain and its near edge growth rings, both pre-rendered images; the outline is three arcs a margin outside the outer points, the corners rounded, the top corner and the sides reaching further than the bottom to hold the labels. The 93 points come from `scripts/layout-points.mjs` (`board/pointPlan.ts`), the sides bowing outward as on the Kadon board.
- **Rings** (`board/stoneShape.ts` `domeRing`): bands painted on the stone's top dome, 0.15 of the radius wide round a line 0.48 out, each edge a circle at its own height so they follow the dome. Drawn inside the stone's moving group, so they rock and lift with it, and scaled about their middle by the animator.
- **Coordinate labels** (`board/geometry.ts` `labelsFor`): BoardSpace names, on the rim, each square to its own side as shown on screen, just clear of a stone on its point and of most of its dome above; the distance changes at most 2 units from one label to the next along a side. The A1 toggle (`showCoordinates` title preference) hides them; the board's frame does not change.
- **Coordinate guide** (`CoordinateGuide.svelte`, opened from the ? button in `Header.svelte`): every point named, each row traced in its own colour, the pentads ringed. A copy is saved as `games/game-of-y/docs/coordinates.svg`.

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                     | Allowed Inputs                                  | Must Not Own                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------- |
| `YGameSession`                                        | `placeable`, `canPlace`, `canSwap`; a tap commits a placement or the swap                                                | Game state, valid action types                  | Styling                     |
| `Board.svelte`                                        | Hit targets on every empty point; the pointer's faint stone                                                              | Session lists, the animator's stones and rings  | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Stones dropping in and lifting off; which ring each stone carries, and rings growing, shrinking and fading with the move | Transition kind, `from`/`to` states, the action | Interaction state, legality |
| `ActionPanel.svelte`                                  | One-line prompt on your turn ("Place a stone or [Swap]" on the swap turn), the last move otherwise                       | Session state, history entries                  | Board marks                 |

## 4. Shared State Contracts

- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest.
- **Placing**: a placed stone falls 26 units in 0.16 s, then rocks on its underside about a line through its resting point, a quick first tip of 9° and three slower swings easing to rest, the line different for each stone (the golden angle by id) and turning 40° as it settles. The stone is written as a fitted affine of its tipped 3D shape (`board/stoneShape.ts` `rockTransform`, `animators/stonePose.ts`), as `translate()` and an offset-free `matrix()`, since Firefox leaves a `matrix()` offset out of the board's CSS zoom.
- **Rings**: a new ring grows from its middle as the stone settles; the previous move's ring shrinks into its middle as the next stone drops; the winning chain's rings grow one after another along the chain from the winning stone. Undo fades a lifted stone's ring over the first half of the lift.
- **Steps without an action** (Undo, state-only history, exploration): stones that appear drop in and stones that go lift off, rings change, all within 0.18 s plus at most 0.01 s waiting for the board to draw.
- **Pointer stone**: shown only for a mouse or pen hovering an empty point while the viewer may place, hidden from the moment of a click until the move lands.
- **Stone pictures** (`board/decodedStones.ts`): both stone images are decoded as the board opens and held, so a stone drawn for the first time is never blank through its fall.
- **Interrupting**: a preference that changes layout (coordinates) lands a playing move at once; a view switch lands it and drops the rest of its replay.

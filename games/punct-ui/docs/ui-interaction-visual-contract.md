# UI Interaction Visual Contract

## 1. Visual Intents

| Intent        | Trigger                                   | What should be emphasized                                                                                         | What should be dimmed                   | What must remain unaffected |
| ------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------- |
| choose_kind   | The viewer may place a piece              | Reserve strip under the action panel; the chosen kind ringed cyan                                                 | Kinds with none left                    | Board                       |
| choose_space  | A kind is chosen                          | Nothing: every empty space where it fits can be tapped, as in YINSH's ring placement, with no mark on each        | Nothing                                 | Pieces                      |
| choose_piece  | The viewer has pieces that can move       | A solid cyan ring on each such piece's top face                                                                   | Nothing                                 | Board                       |
| choose_target | A piece is chosen                         | Its ring thicker; dashed rings on the spaces its PÜNCT can go to, on the board or on the top dot of a piece there | Other movable pieces' rings (40%)       | Pieces                      |
| turn_staged   | A space is chosen for the PÜNCT           | The piece standing there as it would lie, ringed cyan; tapping it turns it; Place or Move in the action panel     | Other movable pieces' rings (40%)       | Pieces                      |

## 2. Visual Primitives

- **Choice marks** (`Board.svelte`, `.under` and `.over`): two-tone as in every title, a dark band (`.under`) under a cyan core (`.over`, `--punct-mark`); dashed ones have each dash outlined on its own. The active player's tray keeps orange (`--punct-target`).
- **Piece ring** (`.top-ring`, inside the piece's group after the piece, outside the node that moves it): the top face's outline inset a little; `role-movable` solid cyan, `role-chosen` and `role-staged` thicker; once something is chosen the other movable pieces' rings fade (`.faded`, 40%). Inputs `session.movablePieces`, `session.chosenPiece`, `session.staged`.
- **Target ring** (`.target-ring`): a dashed ring round a hole for an empty space (drawn on the board under the pieces), or round the top dot of the piece the PÜNCT would land on (inside that piece's group, so nearer pieces cover it). Spaces under the chosen piece itself get their ring and click area above everything. Inputs `session.destinations`.
- **Piece** (`PieceSlab.svelte`, geometry in `board/pieceShape.ts`, flecks in `board/specks.ts`): a slab on its level, its outline the dots joined by bars as wide as the piece and rounded at every outer corner; the strips of its side that face the viewer shaded by the light, far first; the speckled top with two dished minor dots and the PÜNCT's smooth insert. Flecks are seeded by the piece's id, laid out on the piece unturned and turned with it. A soft contact shadow of its outline lies at its base, on whatever is under it. Never carries interaction state.
- **PÜNCT marker** (`PunctMarker.svelte`): the rulebook's round PÜNCT-piece, standing where a moving piece's PÜNCT was while the move is staged.
- **Board theme** (`app.css`): the printed board's pale play area (`--punct-play`) of honeycomb cells (`--punct-grid`) round grey holes, the central hexagon's 19 cells tinted (`--punct-centre`), the pale area ending at the outer cells' edges, notched where the corners are missing; the green surround as the table (`--punct-table`); white panels.
- **Coordinate labels** (`.coordinate-label`, from `board/coordinates.ts`): columns A–Q, each numbered up from 1 at its bottom space (`spaceLabel`, A1–A7 … H1–H16 … Q1–Q7), as GIPF, ZÈRTZ and LYNGK; each column labelled with its bottom space's name below it (A1) and only its top space's number above it (7), on the table in dark ink. Every label of a row stands the same distance out along its column, as far as the inner columns' labels need to clear the cells by a small gap (`LABEL_PADDING`); A and Q take that same distance rather than their own. History, the banner and aria labels use the same names; the logic package keeps BoardSpace's (`spaceName`, A2–A8) for its tests and the scenario builder. They can be hidden with the A1 toggle (`showCoordinates`).
- **Winning chain** (`.win-spot`): at a game won by connection, a gold spot on each top dot of the chain.

## 3. Layer Responsibilities

| Layer                                                 | Owns                                                                                                                                         | Allowed Inputs                                   | Must Not Own                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------- |
| `PunctGameSession`                                    | `placeKinds`, `chosenKind`, `entryCells`, `movablePieces`, `chosenPiece`, `destinations`, `chosenAt`, `options`, `staged`, staged selection | Game state, valid action types, staged selection | Styling                     |
| `Board.svelte`                                        | Mark roles per piece and space; the draw order (`board/drawOrder.ts`)                                                                        | Session lists                                    | Deciding legality           |
| `BoardAnimator` (`animators/boardAnimator.svelte.ts`) | Motion for committed moves: a new piece dropping in, a moved piece gliding and turning, a piece taken back lifting off; marks fading         | Transition kind, `from`/`to` states              | Interaction state, legality |
| `ActionPanel.svelte`, `ReserveStrip.svelte`           | Prompts and the Place or Move button; the kind to place                                                                                      | Session state                                    | Board marks                 |

## 4. Shared State Contracts

- **Draw order**: pieces, the staged piece and the marker are drawn in one order: over a shared space the lower first; otherwise, of their nearest spaces in neighbouring columns, the farther first.
- **Animation scope**: the board animates only `own-action`, `other-action`, `undo`, `history` and `exploration` transitions; page loads, server syncs and view switches show the board at rest. Motion is read from the two boards by piece id: a new piece drops in, a moved one glides, a removed one lifts off. Your own move and an undone one already stand where they end (staged), so they do not move. Undo and history play in 0.18 s.
- **Staged selection**: `from` (a piece by its PÜNCT), `at` (the PÜNCT's space), `rotation` (each tap on the staged piece turns it to its next way of lying there, clockwise). Undo pops the highest manual stage; with none, it undoes the last action, which comes back staged as it was chosen (`beforeNewState` on `undo`). Tapping anything on the board that cannot be chosen lets go (`session.letGo()`); the chosen kind and the last rotation of a new piece stay.

## 5. Regression Checklist

- A new piece placed by you stands where it was staged and does not jump or blink as the state lands.
- Every piece shows its side and stands on its level; a piece on top is drawn after those under it.
- Target rings on top dots are covered by nearer pieces; those on empty spaces lie under every piece.
- Tapping off the choices lets go; the other movable pieces' rings fade once one is chosen.
- The board's position is the same on your turn, while waiting and in history.

# Promontory Point visibility

Promontory Point registers state and Action projection (`runtime.visibility.state` and `runtime.visibility.actions`). The contract follows `docs/hidden-information.md`. Rules are cited as `R-x.y` from `rules-digest.md`, house rulings as `R-x.y-Hn` and implementation rules as `R-X.n` from `rulings.md`.

Little is hidden: the order of the bag, and each player's hand of track pieces between turns. Money is public (R-1.3-H1), and so is everything else on the table (R-5).

## What is concealed

| Field                                                          | Hidden by  | Public state carries                                                                                                 |
| -------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| `bag.items`, the order and contents of the bag of track pieces | R-1.3, R-5 | `bag.remaining`, the count. The shared `DrawBag` schema protects `items` as host-only with an empty-array redaction. |

The bag's composition is not public in fact: it is the 24 pieces of each railroad less those on the board, scrapped, revealed this turn, kept (four-piece variant) and in hands, and the hands are concealed. The protected random cursor and the reproduction master seed are concealed as the platform defines.

## What each player knows

- **Hand** (R-1.3 step 6, R-5): `players[].hand` lists the railroad of each concealed piece, `Visibility.Policy.Owner`. The public `handCount` gives its size, so every seat shows the right number of backs. A player sees their own hand from the draw until the start of their turn.
- **Revealed pieces** (R-2.2 step 1): at the start of a player's turn the hand moves into the public `turn.pieces` and `hand` becomes empty, so `hand` only ever holds concealed pieces. The starting player's first pieces are dealt straight into `turn.pieces` at setup, since the game opens on that turn. A replacement drawn for a scrapped piece goes straight into `turn.pieces`, face up, since it is placed this turn (R-3.3-H1).
- **Kept piece** (four-piece variant, R-6.3): a piece left over at the end of a turn and kept stays public as `players[].keptPiece`, since the table saw it revealed.

Everything else is public (R-5, R-1.3-H1): the board, every town tile, every track piece placed, the scrapped counts, every share price, every player's shares (the share decks are derived from them), every player's money, the turn's pieces, trades used and placements made, and who owes what for a Repairs and whose decision it is.

## Action records

Draws are engine output. An Action that reads the bag resolves its result in `apply` from canonical state and writes it into state or `metadata`; the engine strips `metadata` from anything a client submits, and no submitted field is read as a draw.

| Action                                              | Actor-known (`Policy.Actor`)                         | Public                                                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EndTurn`                                           | `metadata.drawn`, the pieces drawn into the new hand | the number drawn; in the variant whether the leftover piece was kept or returned to the bag                                                               |
| `ScrapTrack`                                        | none                                                 | every field: the scrapped railroad and `metadata.replacement`, the piece drawn face up, or that the bag was empty                                         |
| `RevealHand` (System)                               | none                                                 | `metadata.pieces`, the hand turned face up                                                                                                                |
| `BuyShare`, `SellShare`, `PlaceTrack`, `PayRepairs` | none                                                 | every field, including the event a placement resolved, prices before and after, and each player's Dividend, Repairs bill, payment and any amount forgiven |

## Undo barriers

R-X.2: an action that draws from the bag, reshuffles it, or moves a piece into or out of concealment sets `revealsInfo`. The engine sets it from what `apply` resolved, never from input.

- Always a barrier: `RevealHand` (the hand turns face up) and `EndTurn` (the drawer sees the new hand; in the variant, returning the leftover piece also reshuffles the bag from the protected stream).
- A barrier by outcome: `ScrapTrack` when it draws a replacement. With the bag empty it draws nothing and is not a barrier.
- Not a barrier: `BuyShare`, `SellShare`, `PlaceTrack` and `PayRepairs`. Town tiles are face up from setup and every event is deterministic, so a turn's trades and placements are undoable, latest first, back to the turn's reveal or its latest replacement draw.

`EndTurn` and a drawing `ScrapTrack` read the bag, so they defer to the host. An `EndTurn` on an empty bag reads nothing hidden, but as a barrier its prediction is not shown until the host confirms it. Every other action reads only public state and runs optimistically. Action discovery needs only public state.

## Exploration

A player or a spectator explores from their own projection. `createFromProjectedState` keeps everything the projection names: the board, prices, shares, money, the turn's pieces, kept pieces, pending Repairs, and the explorer's own hand. It deals the rest afresh from the branch's randomness: the unseen pieces (per railroad, 24 less those on the board, scrapped, in `turn.pieces`, kept, and in the explorer's hand) are shuffled, each other player's hand takes `handCount` of them, and the bag takes the rest in that shuffled order, which must match `bag.remaining`. The result names no master seed and passes the canonical validator. Two sources that differ only in hidden values give the same branch.

Host View, hotseat and local branches start from canonical state through `createFromCanonicalState`, which reshuffles the bag within itself from the branch's new protected stream; hands stay as they are.

## Compatibility

No migrations: the Logic and UI Artifacts publish together, and a stored Game keeps the rules of the revision it was created under (R-X.3). Initialization sets `promontoryPointRevision`; revision 1 is the first release, so no Game predates it. New Games use `randomnessVersion: 1`: a private master seed, with the bag's shuffles from the protected stream; turn order and the town tiles' layout, public from the start, use the public stream. The visibility-capable backend and Site Frontend are prerequisites; this title adds no host bridge interface. Do not run a protected Game on a runtime without visibility registration.

## Verification

- Every registered action schema projected for its actor, another seat and a spectator, with `EndTurn`'s drawn pieces visible to the actor alone: `actionProjection.spec.ts`.
- Reproducible protected initialization from a master seed: `initializer.spec.ts`. The bag's items, the master seed and the protected cursor omitted from every player's and the spectator's projection, and `bag.remaining` kept: `visibility.spec.ts`.
- Each hand projected for its owner, another player and a spectator; `handCount` public; the hand moving into public `turn.pieces` at `RevealHand`; a kept piece public: `visibility.spec.ts`, `revealHand.spec.ts`, `endTurn.spec.ts`.
- `revealsInfo` set exactly on the barriers above, and Undo refused across them while a turn's trades and placements undo: `revealHand.spec.ts`, `endTurn.spec.ts`, `scrapTrack.spec.ts`, `buyShare.spec.ts`, `sellShare.spec.ts`, `placeTrack.spec.ts`, `payRepairs.spec.ts`.
- Guarded execution deferring every bag read to the host, and a projection offering the same actions as canonical state for its own player: `protectedPlay.spec.ts`.
- Piece conservation per railroad across bag, hands, kept pieces, turn pieces, board and scrapped, after every action of scripted games: `protectedPlay.spec.ts`.
- Exploration from each player's and a spectator's projection at states of scripted complete games (start of a turn, mid-placing, a pending Repairs, a variant kept piece, the last turn): sizes kept, the explorer's hand fixed, the result complete with no master seed, the same branch from sources differing only in hidden values, and the branch playing on to the end; from canonical state, the bag reshuffled and play continuing: `exploration.spec.ts`.
- Hydration round trip of canonical state and of every perspective's projection: `gameState.spec.ts`, `visibility.spec.ts`.
- Projected history replay with forward and undo patches, whole games at 2 to 4 players, for every seat and a spectator: `protectedPlay.spec.ts`.

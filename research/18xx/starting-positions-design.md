# Starting positions and reproducible seeds

Makes 18xx titles eligible for tournament setup: the shared initializer honors a
`StartingPositionAssignment` and the family runtime declares `randomnessVersion: 1` and
final-score `scoring`. See [tournament game capabilities](../../docs/tournament-game-capabilities.md)
for the engine contract.

## Evidence surveyed

The opening survey in [opening contract](opening-contract-design.md), and the
`allocation-method` and `actor-order` assignments in `data/title-traits.json`.

- **Player order** after setup is mostly relative to the last actor
  (`players-after-last-actor`, 89 assignments), but 30 assignments order players by most
  cash, 7 by least cash, 11 by pass order and 24 by special priority rules. Those rules
  reorder play later; they do not define the initial seating, so an assignment only fixes
  the order at Game Initialization.
- **First player** is title-owned: a draw (1889's waterfall, TOP's first auctioneer), an
  auction for initial positions (System18's `player-order-auction`), or the procedure
  surveyed in the opening contract (first auction result, richest player, draft order).
- **Seat-specific assets.** `starting-packets` (3 assignments, e.g. 1822PNW's Starting
  Packet) and 1889's Beginner Game `random-allocation` assign assets per player.
- **Randomness** also shapes the position (TOP's Mainline, Shortline and lot piles;
  1846's removals; 1822's bid boxes). An assignment fixes seating, not those draws.

## Shared behavior and title-owned choices

Shared: the assignment is the seat order (`turnManager.turnOrder`); the initializer
validates it, seats it and passes it to `createOpening` as `startingPositions`.
`drawFirstPlayer` is the shared "draw a first player" step: it always consumes the
ordinary draw, then returns position zero when an assignment is present. The waterfall
opening uses it.

Title-owned: what position zero means. TOP and 1889 draw their first actor, so position
zero takes that role. A title whose first player comes from seating, a first auction or
wealth ignores the draw helper and reads `startingPositions` in its own opening; one with
seat-specific assets hands them out by position.

Unchanged: player colors and the `players` array follow `game.players`; TOP still deals
lot piles by `players`. Pile contents are random, so which player receives which slice
carries no positional advantage.

## Support now and later

Now: seating plus the drawn first player for TOP and 1889. Prepared playground scenarios
reject an assignment, because their positions fix whose turn it is.

Later: seat-specific setup (starting packets) and first players chosen by other means read
the assignment in their own openings. A title that auctions initial positions (System18)
must decide whether an assignment replaces that auction or only seeds its order; that is a
tournament-policy question for the title, not a family default.

## Randomness

`randomnessVersion: 1` derives the public and protected PRNG seeds from a private master
seed for new Games only. 18xx uses only the public stream and has no hidden information,
so the state already carries its effective seed and the canonical `masterSeed` reveals
nothing new. The shared `GameState` schema already allows `masterSeed` and ChaCha20
cursors, so the runtime-contract snapshots are unchanged. The deployed TOP Game keeps its
numeric cursors and replays unchanged; every published TOP artifact postdates ChaCha20
support in Common, so rolling back to one still loads the new saves.

Seeded fixtures (`exampleGame`, the opening digests, 1889's title-state test) start
through `startFromPublicSeed`, which uses legacy initialization so a numeric seed keeps
pinning the same setup.

## Examples that verify the decision

- For every supported player count, one master seed reproduces the same Game; assigning
  the ordinary seating reproduces the ordinary Game exactly; every rotation and the
  reversed seating seat the table, start with position zero, and leave colors and the
  PRNG cursor unchanged (`libs/18xx/test/startingPositions.ts`, TOP 3–4, 1889 2–6).
- Invalid assignments and assignments to prepared scenarios are rejected.
- The opening digests, runtime-contract snapshots and deployed-game replay are unchanged.
- The ending example records a valid result whose top final scores are the winners.

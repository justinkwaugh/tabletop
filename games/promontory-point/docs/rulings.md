# Rulings

The code cites the rules as `R-<section>` of `rules-digest.md`. A citation ending in `-H1` or `-H2` names one of the house rulings below, made where the rules are silent or ambiguous. `R-X.<n>` names a rule of this implementation. A ruling marked _provisional_ awaits the publisher's answer; it stands until answered. Each ruling names the spec that covers it.

## House rulings

- **R-0-H1:** the theme's names: the $ tile is _Dividend_ (Pay day), the hammer tile is _Repairs_ (Illness), a travel marker is a _track_ piece, reputation is the _share price_, entertainer cards are _shares_, sponsoring and releasing are _buying_ and _selling_. Spec: `src/components/components.spec.ts`.
- **R-1.1-H1** _(provisional)_: the 48 town tiles are +1 ×5, +2 ×8, +3 ×6, −1 ×3, −2 ×6, −3 ×4, Dividend ×8, Repairs ×8, the only labelled split that sums to 48; to be checked against a physical copy. Spec: `src/components/components.spec.ts`.
- **R-1.1-H2:** the bank's money is unlimited; money is kept as a number, not coins. Spec: `src/model/gameState.spec.ts`.
- **R-1.1-H3:** the outlined, mostly sea-covered hex `space.-6.5` below the Southern Pacific home is an empty space, so the board has 123 spaces (48 village, 74 empty, Promontory) and every home touches four of them. Rejects leaving the Southern Pacific with three. Spec: `src/components/components.spec.ts`.
- **R-1.3-H1:** every player's money is public and shown on the 0–99 border track (wrapping past 99); the rulebook's permission to hide money is not taken. Spec: `src/model/gameState.spec.ts`.
- **R-2.1-H1:** the starting player is drawn from the game seed; play goes in seat order. Spec: `src/definition/initializer.spec.ts`.
- **R-2.2-H1:** buying and selling are open before the first placement and after the third, never between placements; after the third placement the player takes any actions left and then ends the turn explicitly, which draws the new hand. Rejects a review's reading that actions interleave with placements. Spec: to be named in the spec.
- **R-2.2-H2:** scrapping an unplaceable piece and drawing its replacement is part of placing: once a player scraps, even before the first placement, buying and selling stay closed until the placements end. Rejects keeping trading open until a piece is actually placed. Spec: to be named in the spec.
- **R-3.2-H1:** a share may be sold at price 0 for nothing; it uses one of the two actions. Spec: to be named in the spec.
- **R-3.3-H1:** the replacement drawn for an unplaceable track piece is placed this turn as one of the three; if the bag is empty, the player places fewer than three. Spec: `src/rules/placing.spec.ts` (when placing ends); the replacement draw: to be named in the spec.
- **R-4.3-H1:** the Repairs bill is fixed when the tile is reached (2 × the shares of that railroad held then); selling shares of that railroad to pay does not reduce it. Rejects the recount reading. Spec: `src/rules/repairs.spec.ts`; the Repairs town and `PayRepairs`: to be named in the spec.
- **R-4.3-H2:** a player who cannot pay chooses which shares to sell, of any railroad, one at a time, each for half its price rounded down, and stops as soon as they can pay. No forced order. Spec: `src/rules/repairs.spec.ts` (the sale list's legality); `PayRepairs`: to be named in the spec.
- **R-4.3-H3:** a player still short after selling every share pays all they have; the rest is forgiven and they stay in the game. Rejects elimination. Spec: `src/rules/repairs.spec.ts` (the sale list's legality and the forgiven amount); `PayRepairs`: to be named in the spec.
- **R-4.3-H4:** when several players are short at once, the placing player sells first, then the others in seat order from the placing player; the turn continues once all have paid. Spec: `src/rules/debtorOrder.spec.ts` (the order); the turn continuing: to be named in the spec.
- **R-6.1-H1:** the red-bordered tiles are the 16 red tiles (Dividend and Repairs). Spec: `src/components/components.spec.ts`.
- **R-6.1-H2:** if the bag empties during the end-of-turn draw, the player keeps what was drawn and the game ends after that turn; if it empties during a mid-turn replacement draw, the turn finishes and the game then ends. Spec: `src/rules/gameEnd.spec.ts` (the end test); the draws: to be named in the spec.
- **R-6.2-H1:** a tie for the most money shares the victory; there is no tie-break. Spec: `src/rules/finalTotals.spec.ts`.
- **R-6.3-H1:** the four-piece variant is a table option, off by default. Spec: `src/definition/info.spec.ts`, `src/definition/initializer.spec.ts`.
- **R-6.3-H2:** in the four-piece variant a kept fourth piece stays face up, and a player may keep a piece that has no open space instead of scrapping it; a piece is scrapped only when chosen as one of the three to place. Spec: `src/model/gameState.spec.ts` (the kept piece public); keeping a piece with no open space: to be named in the spec.

## Rules of the implementation

- **R-X.1:** every choice arrives as explicit input from the player it belongs to; the engine infers none.
- **R-X.2:** undo stops at an action that revealed information: one that advanced the random stream, moved a card into or out of concealment, or showed a player something they had not seen. Buying, selling and placing are undoable within a turn until a draw from the bag.
- **R-X.3:** a game keeps the rules of the revision it was created under (`promontoryPointRevision`, set at initialization). Revision 1 is the first release.
- **R-X.4:** track pieces are drawn in code in their railroad's colour; no art is supplied for them.

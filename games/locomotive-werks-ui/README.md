# Locomotive Werks UI

`@tabletop/locomotive-werks-ui` is the Game Client for [Locomotive Werks](../locomotive-werks/README.md).

The board follows the tabloid map: the Crystal Palace banner over one row per locomotive, with Existing Orders on the left and the Customer Base on the right, in ornamented boxes holding black Chessex-style dice; the Customer Base is a single box whose dice stack, with a count beside them. Each row shows its generation on a block of the kind's colour, its supply card count, its purchase, upgrade and income costs, its Initial Orders box and a plaque for each player's werk, each player keeping their own column down the board. The board fills the column's width and its rows scroll beneath the banner, which stays frozen with the column labels. The panels run in Player Order, and each player's panel is their Player Order card: their cash, a bar in each locomotive's colour with its generation, its units and any shipped this phase, and the tax their cash would pay now. A setting under the panels, saved per player, swaps the kind colours for a colour-blind-safe palette (Okabe–Ito) and adds a shape to each kind: a circle for Passenger, a triangle for Fast, a square for Freight and a diamond for Special.

Players act in the action panel, which lists each choice: the locomotives they can develop, with a Develop button to confirm the chosen one since a development cannot be undone; their werks, with a +1 button and an upgrade button per newer werk, which Done buying submits as one action; and the werks they can sell from, each with a toggle to hold the sale back. A checkbox in Production Capacity, and another in each selling turn, asks for the rest of that Production phase's selling to be taken automatically. The board mirrors the choice with gold rings, including one on the order die each sale fills or lowers, but takes no press. The action panel also shows the round's sequence of play with the current phase picked out and, when a round ends, lets each viewer step through its Production, Taxes and Market Demands without holding up the game. On the board, a sale flips a reduced order die to its new face or slides a filled one into the Customer Base. [The visual contract](docs/ui-interaction-visual-contract.md) records these interactions.

## Art

`src/lib/images` holds the banner engraving from the map, a paper tile, the catalogue cover and the two locomotive cards the cover shows. `scripts/prepare-art.sh` makes them from the source files, and `scripts/render-cover.mjs` renders the cover. The fonts are Playfair Display Black Italic, Abril Fatface and Libre Baskerville, each under the SIL Open Font License beside it.

## Development

`pnpm dev` serves the harness on port 5173; `pnpm test:integration` plays games through it with Playwright on port 5191.

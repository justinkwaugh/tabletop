# MarraCash implementation notes

Planning notes for implementing MarraCash (Stefan Dorra) as a new game. The source materials are in `my-materials/marracash/`, which git ignores. File contents may differ slightly between machines, but the key rules documents are the same.

## Sources

- **Revised rules:** the designer's post [MarraCash – neue Spielregel](https://dorra-spiele.de/marracash-neue-spielregel/) (German, published 2020-12-18, last updated 2024-03-07). This overrides the original rulebook wherever they conflict.
- **Original rulebook:** `Marracash.pdf` / `Marracash.doc`. Player aids: `Marracash-Aid-v1.pdf`, `MarraCash_-_Player_Aid.docx`. Antique cards: `MarracashCards.png`.
- **Board:**
  - `Original_Board.png` and `Original_board_2.jpg` show the original published board.
  - `Marracash_Tablero.jpg` is a third-party redraw. It gives the clearest reading of the board elements, so it is the reference for the map data.

## Status (2026-10-01)

- Phase 1, the rules review, is done.
- Phase 2, the implementation plan, is waiting on answers to the open questions below.
- No game code has been written yet.

## Decisions

- **Rules:** use the designer's revised rules (see Sources):
  - 64 visitors: 12 each of red, blue, green and purple, plus 16 yellow.
  - Sealed simultaneous bids.
  - Revised ending: finish the current round.
  - Secret antique hands: 5 cards per player, paying out the best 5/4/3/2 cards by finishing order.
- **Players:** 3–4, with 4 recommended. Ignore the 2-player rules.
- **Auction payment:** the designer's post doesn't cover payment, so the original rulebook's rules apply:
  - Only the winner pays, and pays the winning bid to the bank.
  - If someone other than the auctioneer wins, the bank pays the auctioneer a cut: 100 Dirham for a winning bid of 500 or less, 200 Dirham for a bid over 500.
  - If the auctioneer wins, they get no cut.
- **Bid ties:** the auctioneer counts as closest to themselves, so they win any tie they're part of. Other tied players are ranked by clockwise distance from the auctioneer.
- **Currency:** original Dirham only, not New Dirham.
- **Board:** build the map from `Marracash_Tablero.jpg`, the clearest redraw, and check it against the original board images. Every shop edge facing a walkway counts as a door, because the shops are open-air tents or stalls.
- **Artwork:** recreate it independently, using generic pawns for visitors and player-coloured discs for shop signs. Shop sign names don't matter. The user may ask the rights holders for permission to use the supplied images later, and will provide a cover image.
- **Tooling:** build with the turbo gen generators (`create-game`, `create-game-ui`, `add-action`, `add-state`). Use `games/fresh-fish` as the pattern reference, especially for hidden information.
- **Scope:** don't modify other games or shared libraries without explaining why first.

## Rulings from the BGG forums

| Topic | Ruling | Source |
|---|---|---|
| Filling entrances | Every empty entrance is refilled, each with 2–4 visitors from one end of the queue | Designer |
| Shop limit | 6 shops per player. A player with 6 shops can't win more auctions | Designer |
| Entering shops | All matching visitors in the moved group enter the first matching shop they pass | Forum consensus |
| Stopping next to a door | Counts as passing it, so the visitors enter | Forum and rulebook pictures |
| Movement | Start in any direction and continue to the next fountain that way, following corners in the road. The path can't cross another fountain. Moving into an entrance fountain is allowed | Forum |
| Customer payments | Paid one after another, so the 3rd and 4th customers pay 300 + 400. No customer limit, and the 5th and later pay 500 | Forum |
| Mover's cut | Worked out per shop and per move, from the sequential payments | Forum |
| Customers pulled in by an auction | No cut for anyone | Forum |
| Last visitor | A single visitor left in the queue is still placed | Forum |
| Under 100 Dirham | The player can't choose an auction option | Forum |

## Revised rules: key wording

From the designer's post, for checking the defaults below:

- **Bidding:** "bieten jetzt alle Spieler für einen Laden einmal verdeckt einen beliebigen Betrag". The auctioneer "muss nach wie vor, mindestens 100 Dirham bieten". The post doesn't say whether other players may pass.
- **Bid ties:** "erhält der Spieler den Zuschlag, der im Uhrzeigersinn dichter am Versteigerer sitzt".
- **Antiques:** "Sobald der erste Spieler 5 Kunden in den Farben seiner 5 Kärtchen in seine Läden gelockt hat, deckt er seine Kärtchen auf". The second player to reveal gets only their 4 most valuable cards, and so on.
- **Game end:** "Sobald die letzte Figur von der Mauer auf ein Eingangsfeld zur Altstadt gestellt wurde, endet das Spiel. Die aktuelle Runde wird jedoch noch zu Ende gespielt".

## Open questions and proposed defaults

Answering "use the defaults" accepts all of these.

1. **Visitor colours:** use 5 colours, including purple. The user's answers listed only red, green, blue and yellow.
2. **Route map:** write a map data file listing each fountain's exits, with the destination and the ordered shop edges passed for each one. Also produce an annotated Tablero image with the routes drawn on it, for the user to check.
3. **Cash visibility:** cash is hidden until the end, using the same mechanism as Fresh Fish's hidden bids.
4. **Sealed bids:**
   - Non-auctioneers may bid 0, which counts as passing.
   - A player with 6 shops is entered as 0 automatically.
   - Bids are revealed after the auction resolves.
5. **New visitors on an entrance:** they don't enter an adjacent shop of their colour until they're moved, or until that shop is auctioned.
6. **Antique cards:**
   - Customers count from the start of the game.
   - Two cards of one colour need two customers of that colour.
   - A completed set is detected, revealed and paid automatically.
   - Undealt cards stay hidden.
   - Antique money isn't part of the mover's-cut profit.
   - If one move completes two sets, they're ranked by the order the final customers entered.
7. **Revised ending:** play continues until the player to the right of the start player has had their turn. Entrances that are still empty stay empty.
8. **Winner tie-break:** tied players share the win.
9. **Queue setup:** generate the queue randomly from the game seed, following the setup rules (entrance trios are all different colours, and no more than 3 of one colour in a row). The whole order is public.
10. **Round 1:** starting with a random start player, each player auctions exactly one shop.

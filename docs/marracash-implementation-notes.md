# MarraCash implementation notes

Planning notes for implementing MarraCash (Stefan Dorra) as a new game. The source materials are in `my-materials/marracash/`, which git ignores. File contents may differ slightly between machines, but the key rules documents are the same.

## Sources

- **Revised rules:** the designer's post [MarraCash – neue Spielregel](https://dorra-spiele.de/marracash-neue-spielregel/) (German, published 2020-12-18, last updated 2024-03-07). This overrides the original rulebook wherever they conflict.
- **Original rulebook:** `Marracash.pdf` / `Marracash.doc`. Player aids: `Marracash-Aid-v1.pdf`, `MarraCash_-_Player_Aid.docx`. Antique cards: `MarracashCards.png`.
- **Cover image:** `CoverImage.png`, supplied by the user for the game thumbnail. It's an 886×900 WebP file despite the `.png` extension, so convert it or rename it when it's copied into the UI package.
- **Board:**
  - `Original_Board.png` and `Original_board_2.jpg` show the original published board.
  - `Marracash_Tablero.jpg` is a third-party redraw. It gives the clearest reading of the board elements, so it is the reference for the map data.

## Status (2026-10-01)

- Steps 1–8 of the implementation plan are done and pushed. Step 9 (Game Catalogue) and step 10 (readiness check) remain.
- **In progress when work paused:** the step 8d review. New Playwright tests in `games/marracash-ui/tests/` time out in the `createGame` helper on a `locator.fill`, so all 5 fail. The cause isn't known yet. Next: run `pnpm exec playwright test -g Concealed` in `games/marracash-ui` and read which locator it waits for. The Playwright config now uses the dev server on port 5185, like Estates.

## Decisions

- **Rules:** use the designer's revised rules (see Sources):
  - 64 visitors: 12 each of red, blue, green and purple, plus 16 yellow.
  - Sealed simultaneous bids.
  - Revised ending: finish the current round.
  - Secret antique hands: 5 cards per player, paying out the best 5/4/3/2 cards by finishing order. This is an optional variant (see Antique cards).
- **Players:** 3–4, with 4 recommended. Ignore the 2-player rules.
- **Auction payment:** the designer's post doesn't cover payment, so the original rulebook's rules apply:
  - Only the winner pays, and pays the winning bid to the bank.
  - If someone other than the auctioneer wins, the bank pays the auctioneer a cut: 100 Dirham for a winning bid of 500 or less, 200 Dirham for a bid over 500.
  - If the auctioneer wins, they get no cut.
- **Bid ties:** the auctioneer counts as closest to themselves, so they win any tie they're part of. Other tied players are ranked by clockwise distance from the auctioneer.
- **Route map:** the board as a grid, with each fountain's exits, destinations and the ordered shops passed, is in `docs/marracash-board-map.md`. The annotated image for checking it is `my-materials/marracash/Marracash_Tablero_routes.jpg`.
- **Cash visibility:** a game creation option, like Fresh Fish's `BooleanConfigOption`s in `games/fresh-fish/src/definition/gameConfig.ts`:
  - **Concealed Cash**, off by default. Cash is public unless the creator turns the option on. The default may be switched later.
  - When it's on, each player's cash is hidden from opponents until the game ends, using Fresh Fish's hidden-information mechanism.
  - Every money movement stays public: winning bids, auctioneer cuts, customer payments, mover's cuts and antique payouts. So, as at a real table, a player who tracks the history can work out everyone's cash. Concealed Cash hides the running totals, not the payments. Estates' Hidden Money works the same way.
- **Auction eligibility:**
  - A player who owns 6 shops can't start an auction.
  - A player needs at least 100 Dirham at the moment they start an auction.
  - The only limit on a turn's two actions is that an auction can't be followed by a move.
  - A move pays everyone as soon as it's confirmed, so profits from a first move count toward a second-action auction.
- **Sealed bids:**
  - Non-auctioneers may bid 0, which counts as passing. The auctioneer must bid at least 100.
  - A player with 6 shops is entered as 0 automatically and isn't asked to bid.
  - All bids are revealed after the auction resolves, even with Concealed Cash on.
- **Auction pull-in** (a special callout in the rulebook): when a shop is auctioned, every visitor of the shop's colour in any group next to its doors goes straight in as a customer.
  - The new owner gets those customers' payments straight away.
  - Nobody gets a mover's cut for them, because nobody moved them. The auctioneer still gets the usual cut of the winning bid.
- **New visitors:** they come from either end of the queue outside the wall and are placed on one of the three entrance fountains. No entrance fountain is next to a shop, so new visitors never enter a shop when they're placed. The route map data should confirm this.
- **Antique cards:**
  - An optional variant, chosen when the game is created with the **Antique Cards** option. It's on by default for now; the default may change based on player feedback. With it off, no cards are dealt and sets are never checked. The original rulebook calls it the Souvenir Variant and the player aid the Antiques Variant.
  - Each player is dealt 5 cards at the start, visible to them and hidden from everyone else.
  - Every customer in a player's shops counts toward their set, from the start of the game.
  - Two cards of one colour need two customers of that colour.
  - A completed set is detected, revealed and paid automatically.
  - Every player is told in the game when someone completes their set, so players who check in now and then don't miss it. This is an in-game event they see when they next load the game, not a notification sent outside BoardTogether.
  - Undealt cards stay hidden all game.
  - Hands that were never completed stay hidden after the game ends. Revisit if player feedback asks for them to be shown.
  - Antique payouts don't count toward the mover's-cut profit. The player aid and the original souvenir variant counted card money, but that was for face-up cards sold one customer at a time. A completed set pays out all at once.
  - If one move completes two sets, they're ranked by the order the final customers entered.
- **Game end:** the game ends once the last visitor in the queue has been placed on an entrance. The current round is then played out, until the player to the right of the start player has had their turn. Entrances that are emptied after the queue runs out stay empty.
- **Winner:** the player with the most cash wins. Shops don't count toward the cash total. The rulebook gives no tie-break, so tied players share the win.
- **Queue setup:** the queue is generated at random from the game seed, following the setup rules: entrance trios are all different colours, and there are never more than 3 of one colour in a row. The whole order is public.
- **Round 1:** the start player is chosen at random. In round 1, each player in clockwise order auctions exactly one shop. Normal turns start in round 2.
- **Currency:** original Dirham only, not New Dirham. Every amount is a multiple of 25 Dirham, the smallest note in the original game, so bids are entered in steps of 25.
- **Board:** build the map from `Marracash_Tablero.jpg`, the clearest redraw, and check it against the original board images. Every shop edge facing a walkway counts as a door, because the shops are open-air tents or stalls.
- **Player colours:** every site colour except the five visitor colours: orange, pink, brown, gray, black and white. A viewer's preferred site colours apply automatically, choosing from this list. Owner markers need a contrasting outline, since orange sits near the yellow and red stalls and pink near purple and red.
- **Colour-blind support:** each visitor and shop colour also has a shape, drawn on pawns and shop tiles: red triangle, blue circle, green square, purple diamond, yellow star. Colour never carries the meaning alone.
- **Harness cast:** the user allowed the dev harness page's `UiDefinition as unknown as GameUiDefinition<…>` cast, which every game UI uses and has no cast-free alternative.
- **Artwork:** recreate it independently, using generic pawns for visitors and player-coloured discs for shop signs. Shop sign names don't matter. The user may ask the rights holders for permission to use the supplied images later. The user has provided the cover image (see Sources).
- **Tooling:** build with the turbo gen generators (`create-game`, `create-game-ui`, `add-action`, `add-state`). Use `games/estates` as the main pattern reference (concealed cash with sealed bids) and `games/fresh-fish` for protected randomness; see the implementation plan.
- **Maturity:** MarraCash is pre-alpha until Justin first pulls it into the upstream project. The platform has no pre-alpha level, so the title uses the most restrictive one, `GameVisibility.Alpha` (admins and alpha testers only), the same as The Old Prince. Change it when the game moves to alpha or beta.
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
| Last visitor | A single visitor left in the queue is still placed | Forum |
| Under 100 Dirham | The player can't start an auction | Forum |

## Revised rules: key wording

From the designer's post, for checking the decisions above:

- **Bidding:** "bieten jetzt alle Spieler für einen Laden einmal verdeckt einen beliebigen Betrag". The auctioneer "muss nach wie vor, mindestens 100 Dirham bieten". The post doesn't say whether other players may pass.
- **Bid ties:** "erhält der Spieler den Zuschlag, der im Uhrzeigersinn dichter am Versteigerer sitzt".
- **Antiques:** "Sobald der erste Spieler 5 Kunden in den Farben seiner 5 Kärtchen in seine Läden gelockt hat, deckt er seine Kärtchen auf". The second player to reveal gets only their 4 most valuable cards, and so on.
- **Game end:** "Sobald die letzte Figur von der Mauer auf ein Eingangsfeld zur Altstadt gestellt wurde, endet das Spiel. Die aktuelle Runde wird jedoch noch zu Ende gespielt".

## Open questions

None. All the planning questions are answered.

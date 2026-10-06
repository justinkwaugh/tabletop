# Rulings

How this implementation reads the rules of MarraCash (Stefan Dorra, 1996), and the rulings it makes where the rules are silent. Tests in `src/` cover each ruling. The board as data is in [the board map](board-map.md).

## Sources

- **Revised rules:** the designer's post [MarraCash – neue Spielregel](https://dorra-spiele.de/marracash-neue-spielregel/) (German, published 2020-12-18, updated 2024-03-07). It overrides the original rulebook wherever they conflict.
- **Original rulebook**, its player aids and the antique cards.
- **BoardGameGeek forum rulings**, listed below.

The source files aren't in the repository.

## Revised rules adopted

- **Visitors:** 64, which is 12 each of red, blue, green and purple, plus 16 yellow.
- **Bidding:** sealed and simultaneous.
- **Game end:** the current round is finished after the queue runs out.
- **Antique cards:** secret hands of 5, paying out the best 5, 4, 3 and then 2 cards by the order players complete them.
- **Players:** 3 or 4, with 4 the default. The 2-player rules aren't implemented.

## Rulings

### Auctions

- **Payment:** the revised rules don't cover it, so the original rulebook applies. Only the winner pays, and pays the winning bid to the bank. If someone other than the auctioneer wins, the bank pays the auctioneer a cut: 100 Dirham for a winning bid of 500 or less, 200 for a bid over 500. An auctioneer who wins gets no cut.
- **Ties:** the auctioneer counts as closest to themselves, so they win any tie they're in. Other tied players are ranked by clockwise distance from the auctioneer.
- **Starting an auction:** a player needs at least 100 Dirham and fewer than 6 shops.
- **Turn order of actions:** a turn has two actions, and the only limit is that an auction can't be followed by a move. A move pays everyone as soon as it's made, so its profits count toward a second-action auction.
- **Undo:** an action can be undone unless undoing it would hide information that has already been revealed. The only barriers are an auction resolving (every bid is shown), an antique set being revealed, and the end of a game with Concealed Cash (every player's cash is shown). Moves, entrance placements, starting an auction and sealed bids can all be undone, including after the turn has passed on, until another player acts on top of them. A sealed bid can be undone even after other players have bid, because their bids are kept; the auctioneer can undo starting the auction once no one else has a bid in, so they ask the other bidders to undo first. There is no confirmation step: a turn ends by itself once its actions are used up and no emptied entrance needs refilling.
- **When a move completes an antique set:** the set stays secret, hidden even from players' own views of the game, until the turn ends, then it's revealed and paid. Starting an auction commits the moves before it, so their sets are paid before anyone bids and still count toward the bids, as the turn-order rule requires.
- **Sealed bids:** non-auctioneers may bid 0, which counts as passing. The auctioneer must bid at least 100. A player with 6 shops is entered as 0 automatically and isn't asked. All bids are revealed when the auction resolves, even with Concealed Cash on.
- **Pull-in:** when a shop is auctioned, every visitor of its colour at a fountain next to its doors goes straight in as a customer. The new owner is paid for them at once. Nobody gets a mover's cut for them, because nobody moved them; the auctioneer still gets the usual cut.

### Movement and visitors

- **New visitors** come from either end of the queue and are placed on an empty entrance fountain. No entrance is next to a shop, so placing visitors never sends them into a shop.
- **Doors:** every shop edge facing a walkway is a door, because the shops are open-air stalls.

### Antique cards

The **Antique Cards** game option, on by default. The original rulebook calls it the Souvenir Variant and the player aid the Antiques Variant. With it off, no cards are dealt and sets are never checked.

- Each player is dealt 5 cards, visible only to them.
- **Dealing:** a rule from the designer, Stefan Dorra, given directly to this project and not in either rulebook. Each colour's cards are shuffled as a separate pile. Each player takes 2 cards from one random pile and 1 card from each of three other random piles, so every hand starts with a 2/1/1/1/0 colour split. Which colours are doubled and missing is random, limited only by there being 5 cards of each colour.
- Every customer in a player's shops counts toward their set, from the start of the game. Two cards of one colour need two customers of that colour.
- A completed set is detected, revealed and paid automatically, and every player sees it in the game history.
- Undealt cards stay hidden all game. Hands that were never completed stay hidden after the game ends.
- Antique payouts don't count toward the mover's-cut profit. The original variant counted card money, but it sold face-up cards one customer at a time; a completed set pays out all at once.
- If one move completes two sets, they're ranked by the order their final customers entered, and sets completed by a turn's two moves rank in the order they were completed, even though all of them are revealed only when the turn commits.

### Cash

The **Concealed Cash** game option, off by default. When it's on, each player's cash is hidden from opponents until the game ends. Every money movement stays public: winning bids, auctioneer cuts, customer payments, mover's cuts and antique payouts. As at a real table, a player who follows the history can work out everyone's cash; the option hides the running totals, not the payments.

### Setup, end and scoring

- **Queue:** generated from the game seed following the setup rules. Entrance trios are all different colours, and no colour appears more than 3 times in a row. The whole order is public.
- **Round 1:** the start player is chosen at random. Each player in clockwise order auctions exactly one shop. Normal turns start in round 2.
- **Game end:** the game ends once the last visitor in the queue is placed on an entrance, after the current round is played out, up to the player to the right of the start player. Entrances emptied after the queue runs out stay empty.
- **Winner:** the player with the most cash. Shops don't count. The rules give no tie-break, so tied players share the win.
- **Currency:** original Dirham only, not New Dirham. Every amount is a multiple of 25 Dirham, the smallest note in the original game, so bids go up in steps of 25.

### Presentation

- **Player colours:** every site colour except the five visitor colours: orange, pink, brown, gray, black and white. Owner markers get a contrasting outline, because orange sits near the yellow and red stalls and pink near purple and red.
- **Colour-blind support:** with the site's colour-blind palette preference on, the five market colours switch to the Okabe–Ito vermilion, blue, bluish green, reddish purple and yellow, and player colours use that palette's remaining entries. Colour alone tells markets and players apart, so pawns, shops and cards carry no shape symbols.
- **Artwork:** drawn independently, with generic pawns for visitors, striped cloth awnings on corner poles for shops, cobbled sandstone ground with no grid, seeded irregular palms, and flat cardboard shop signs in the owner's colour, each seat's sign cut with its own top shape.

## Forum rulings

| Topic                   | Ruling                                                                                                                                                                               | Source                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Filling entrances       | Every empty entrance is refilled, each with 2–4 visitors from one end of the queue                                                                                                   | Designer                    |
| Shop limit              | 6 shops per player. A player with 6 shops can't win more auctions                                                                                                                    | Designer                    |
| Entering shops          | All matching visitors in the moved group enter the first matching shop they pass                                                                                                     | Forum consensus             |
| Stopping next to a door | Counts as passing it, so the visitors enter                                                                                                                                          | Forum and rulebook pictures |
| Movement                | Start in any direction and continue to the next fountain that way, following corners in the road. The path can't cross another fountain. Moving into an entrance fountain is allowed | Forum                       |
| Customer payments       | Paid one after another, so the 3rd and 4th customers pay 300 + 400. No customer limit, and the 5th and later pay 500                                                                 | Forum                       |
| Mover's cut             | Worked out per shop and per move, from the sequential payments                                                                                                                       | Forum                       |
| Last visitor            | A single visitor left in the queue is still placed                                                                                                                                   | Forum                       |
| Under 100 Dirham        | The player can't start an auction                                                                                                                                                    | Forum                       |

## Revised rules: key wording

From the designer's post, for checking the rulings above:

- **Bidding:** "bieten jetzt alle Spieler für einen Laden einmal verdeckt einen beliebigen Betrag". The auctioneer "muss nach wie vor, mindestens 100 Dirham bieten". The post doesn't say whether other players may pass.
- **Bid ties:** "erhält der Spieler den Zuschlag, der im Uhrzeigersinn dichter am Versteigerer sitzt".
- **Antiques:** "Sobald der erste Spieler 5 Kunden in den Farben seiner 5 Kärtchen in seine Läden gelockt hat, deckt er seine Kärtchen auf". The second player to reveal gets only their 4 most valuable cards, and so on.
- **Game end:** "Sobald die letzte Figur von der Mauer auf ein Eingangsfeld zur Altstadt gestellt wurde, endet das Spiel. Die aktuelle Runde wird jedoch noch zu Ende gespielt".

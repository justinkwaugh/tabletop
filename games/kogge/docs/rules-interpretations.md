# Kogge rule interpretations

The implementation follows the MoD Games English rulebook (2005, translated by Duismann and Heli). Where it is silent or mistranslated, the German original "Regelversion 1.1, November 2003" and the designer's BGG answers (account `Mod-Games`, Andreas Steding) decide. Each ruling below is covered by `src/model/bids.spec.ts`, `src/definition/rules.spec.ts` or `src/definition/visibility.spec.ts`.

## Board and components

- **Cities.** 0 Tönsberg, 1 Stockholm, 2 Åbo (ore); 3 Reval, 4 Riga (fur); 5 Danzig, 6 Stralsund (amber); 7 Lübeck, 8 Kopenhagen (salt). A route marker has the colour of the city it names. The guild master walks 0 → 1 → … → 8 → 0.
- **Counts.** Route markers 0–8: 14, 13, 12, 11, 10, 9, 8, 7, 6. Goods: 25 ore, 18 fur, 13 amber, 10 salt. Two copies of each of the four bonus chits.

## Setup

- **Routes.** One marker of each number goes to a city other than its own, then each city draws a second marker that matches neither its number nor its first marker. Another drawn marker places the guild master and the Spiel Ende marker, then returns to the reserve.
- **Start cities.** Everyone picks secretly. When a city would hold more than two offices, every player who chose it picks again and may not repeat any earlier choice. The marker naming the start city goes back to the reserve.
- **First turn order.** The lowest start city plays first; players sharing a city are ordered at random. Round 1 opens with a normal auction in that order.

## Auction

- **Bidding is compulsory** (German rules): a player passes only with no markers, or when every combination they hold repeats an earlier bid. Passing players go last, keeping their previous relative order.
- **Comparing bids** reproduces the designer's examples (BGG thread 658791). A bid holding two or more identical markers is a group bid; a larger group beats a smaller one, then the higher group value, then the remaining markers compared the same way (4+4 > 3+3+6 > 3+3 > 8). Bids of distinct markers compare their sums, then their markers from the highest down; a longer list wins a tie, so 5+0 > 5 > 4+1 > 0.
- **Supplies.** Every marker bid sends two goods to the city it names, highest city first when goods run short. Each office in that city takes one first, but only if there are enough for every office.
- **Market.** The previous round's unsold markers return before eight new ones are drawn; only complete pairs are offered and the market is not refilled during a round.

## Guild master

- The first player moves him one or two cities, skipping raided cities, and he places two goods on (never in an office of) the city where he stops.
- **Game end.** Progress counts every city passed, raided ones included. On reaching 18 (two rounds of the board) the game ends at once and that round's player phase is not played.

## Movement

- The first move is free and each further move costs one good or one route marker; "2 Felder gehen" makes the second free too. The secret passage leads to the guild master's city at normal cost plus one, and is unavailable when already there.
- **Office goods** are loaded automatically whenever the cog starts its turn in, or sails into, a city with the player's office. Leaving them in the office is never offered; it matters only for which goods a cog raid can reach.
- **Hidden markers.** Sailing a face-down route turns it face up and is binding. When it leads into the player's own raided city the movement ends where the cog stands and the fee is lost (German v1.1; the English text's "use a different route" is a mistranslation). A revealed marker always stays face up.
- A face-up route into the player's own raided city is not offered.

## Actions

- Each action at most once per turn, in any order; the first action ends movement.
- **Office.** One each of the three goods the city does not produce, and one marker of the city's number (two if an office already stands there). A player may own both offices in a city. A fifth office is allowed only because it wins.
- **City trade.** Only after sailing and ending in a city other than the starting one. The kinds given and taken are disjoint, and a player receives between one and two (three with the bonus) goods per good given. Given goods stay in the city.
- **Route change.** One face-up marker is swapped for one of the player's markers, laid face down; it may not name the city itself, may repeat the other route, and may even repeat the replaced number.
- **Guild master.** One deal per turn, no move needed (designer, thread 66464): three identical markers for the second raid marker (once per game); six identical goods for any remaining bonus chit, duplicates allowed (designer, relayed); one good for a chosen marker of its colour from the reserve (designer, thread 345412); one marker for a good of its colour.
- **Raids.** A cog raid takes half the victim's cargo: the victim makes two piles at most one good apart and the robber picks one. A city raid takes every good in the city and its offices. The robber's turn ends, their raid marker stays on the city, and their cog is moved one route on for free, face-down routes included (designer, thread 87074). The next player in turn order chooses the route, standing in for "the other players". If every face-up route leads to another city the robber raided and none is hidden, the cog stays.

## Scoring

- Five development points (offices plus bonus chits) during a player's turn win at once.
- Otherwise: office 10, bonus chit 20, unused raid marker held 10, and goods on the cog or in offices worth salt 7, amber 5, fur 3, ore 1. Tied leaders share the victory.

## Hidden information

The German rules let players keep markers secret, and the digital game does: route-marker hands are visible only to their owner (counts are public), cargo is public, and a face-down route is known only to the player who laid it. The reserve's contents stay hidden so its composition cannot reveal those values. Hands and face-down routes are revealed when the game ends.

## Not implemented

Free trading and binding promises between players, and the advanced rules (taxes, trading with offices, conflicts, memory).

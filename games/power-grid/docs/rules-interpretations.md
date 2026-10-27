# Power Grid rules interpretations

The game follows **Power Grid Recharged** (Rio Grande Games / 2F-Spiele, 2018 rules, PDF updated 2020) on the **Recharged Germany** board. Page references are to that rulebook. The research notes, both rulebooks and the FAQs are in `/workspace/artassets/power-grid/rules/`.

## Board data

- **R1. Germany map.** Cities, regions and connection costs are the consensus of eight independent transcriptions of the original board (every edge agreed by at least seven). Recharged renames Torgelow to **Stralsund** and Wiesbaden to **Mainz**, and reprices **Essen–Dortmund to 5** (confirmed by the rulebook's building example) and **Mannheim–Saarbrücken to 16** (from boardgamers.space's Recharged map only). Check these four against a Recharged board photo when one is available.
- **R2. Plants.** All 42 plants are taken from the card scans. Plug backs are 03–15 and socket backs 16–50 (p. 3).
- **R3. Resource refill.** Only the 5-player refill card is printed in the rulebook; it matches the original edition, so the original table is used for every player count. The Recharged cards show values per map, which may differ for 2, 3, 4 and 6 players, so each map carries its own refill table (`MapRules.resupply`); Germany uses the original one.

## Setup

- **R4. Play area.** The rules have players choose a contiguous group of regions. The game picks one at random: a random region, then random neighbouring regions until the player count's number is reached (p. 2).
- **R5. Seats.** Players sit in a random order, which is also the first round's player order. Bidding goes clockwise around the table, so it follows this seat order rather than the player order (p. 4; BGG FAQ).
- **R6. Hidden plants.** Plants removed at setup are never revealed, as most groups play (BGG FAQ). The stack is hidden; its size and the back (plug or socket) of its top card are public, as at the table.
- **R7. Money is public.** Neither rulebook makes money secret.

## Auction

- **R8. Players who cannot raise drop out automatically.** When a bid leaves another bidder unable to pay one more, that bidder is passed for them and the history says so.
- **R9. The last chooser.** A player who chooses a plant with nobody left to bid against buys it at its minimum bid (p. 5) and cannot open higher.
- **R10. Scrapping.** Resources are pooled per player and checked against what the plants can hold, which is equivalent to moving tokens between plants at any time (p. 5). A scrapped plant's tokens stay where the remaining plants can hold them; only the overflow goes back to the supply. The player chooses only the coal/oil split when hybrids make it a choice. The FAQ's option to throw away tokens that could be kept is not offered.
- **R11. Replacement draws.** A replacement is drawn as soon as a plant is sold, before any scrapping.

## Building

- **R12. First house.** A player's first house goes in an empty city (p. 5: "any empty city (not already chosen by another player)"), also in Steps 2 and 3. When several cities are built that turn, one of them must be empty and the network starts there.
- **R13. Several cities at once.** A turn's cities are built in the cheapest legal order: each new city connects to the network or to a city added before it (p. 5). That total is a minimum spanning tree over the cities, with the existing network as one node, so it is computed with Prim's algorithm and does not depend on the order the player clicked.
- **R14. Play area only.** Connections leave and enter only play-area cities; paths never pass through cities outside it (p. 6).

## Steps

- **R15. Step 3 card drawn as Step 2 begins.** If the card comes up as the replacement for the lowest plant removed when Step 2 begins, it stays in the market through Phase 5 and replaces that round's market update: at the end of Phase 5 the card and the lowest plant leave, nothing is drawn, and Step 3 begins (pp. 7–8). Doing the normal update as well would leave five plants.
- **R16. Step 3 before Step 2.** If the Step 3 card is drawn while still in Step 1, in Phase 2 or in the Phase 5 market update, the Step 2 market change (remove the lowest plant and draw a replacement) happens first, then the Step 3 change (p. 7: "first perform all changes for Step 2").

## End of game

- **R17. Final Bureaucracy.** Nobody chooses plants in the final Phase 5: each player is credited with the most cities they could power with their plants and fuel, and nobody is paid (p. 8). Ties go to the most money; a tie on money as well is a shared win.

## Two players: against the Trust

Two-player games always play "Against the Trust" (pp. 9–10).

- **R18. When the Trust takes a plant.** The rule reads "After one of the two players has bought a power plant, or after the first player opted out, the Trust takes the biggest (fourth) power plant in the current market". This is read as **once a round**, at the first purchase or opt-out of the phase, not after every purchase. No ruling was found; revisit if one turns up.
- **R19. Which plant.** "Biggest" is the highest plant players could bid on: the fourth of the current market, or the sixth in Step 3. A replacement is drawn as after a sale. The Trust taking plant 39 on Germany does not start the nuclear phase-out: p. 6 starts it "after a player buys" the plant, and the Trust is not a player and does not buy. A plant the Trust scraps leaves the game.
- **R20. Hybrid fuel.** The Trust's coal–oil alternation runs across all its hybrid plants, starting with coal (p. 9: "it alternately takes 1 coal and 1 oil… (it always starts with coal)"), not afresh on each plant.
- **R21. Setup.** The six starting houses are placed starting player first, in the pattern 1–2–2–1, each next to (directly connected to) a Trust city already placed; the first may go anywhere in the play area.
- **R22. Blocking.** A Trust house goes on the 15 space of every empty city a player connects, while the Trust has houses left. The Trust's resources go back to the supply at the end of each round, before the resupply.

## Not offered

- **R23. Default Starting Cities** (an option for experienced players, p. 3).

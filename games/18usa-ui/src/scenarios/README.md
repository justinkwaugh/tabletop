# 18USA harness scenarios

Written by `scripts/scenarios.build.spec.ts` (`SCENARIOS=all pnpm exec vitest run --config
scripts/scenarios.config.ts` in this package, or `SCENARIOS` naming the ones to write). These come
from seeded four-player games of the logic package's test bot, each keeping the actions that led
to it:

- **Private auction**: the opening auction with a private nominated and bid on. Raise the bid or
  pass; the board shows the starting map, market, loan strip and depot.
- **Company auction**: the first stock round, a company auctioned in a city still offering a
  subsidy. The panel names the subsidy under the home; the city shows its orange subsidy token.
- **Laying track**: a company lays track in phase 3. Choose a hex, rotate and confirm a tile.
- **Merger round**: a 2-share company's president may convert it or pass.
- **Acquisition round**: a company's president decides on a sale or offer.
- **Pullman run**: phase 5, a company with a Pullman runs. The run panel attaches the Pullman to a
  train (+$20 a stop); the Pullman entry scraps it for $50, and Train powers gives Double Heading
  to a train when the company holds P30.

Arranged in code from a seeded game, with no actions behind them (the privates' positions in
`scripts/privateScenarios.ts`):

- **Station limit**: B&O, holding P8 Express Freight with its marker in Mexico and eight stations
  counting the marker, has merged and is over the limit. Remove a station and the marker stays;
  choose the Mexico card and the marker leaves the map and P8 closes.
- **Merger pullman**: a merger round whose deciding company owns a Pullman. Scrap Pullman sells it
  for $50 beside Convert and Pass.
- **Phase 8 run**: the board and fleet of a recorded phase-8 run
  (`scripts/fixtures/phase-8-fleet.json`) laid over the Pullman run's game: Illinois Central runs
  two 8-trains, trains rusted by phase 8 are gone, and the board's companies start at $100. The
  run step's 5 s search does not prove this fleet's best run, so the panel offers the best found
  ($1,010; the players ran $950) and lets the director draw: tap a train, then stops on the map. A
  run earning less than the best found is refused; one earning as much or more may run. The
  Pullman run, proved at once, offers no drawing.
- **Privates resources**: Norfolk and Western (NW) at its first lay in phase 5 holds
  Lehigh Coal (P1), Reece Oil and Gas (P3), Hendrickson Iron (P4), Fox Bridge Works (P2), Keystone
  Bridge (P21), Nobel’s Blasting Powder (P5) and the Resource subsidy.
    - Lehigh Coal lays at B12, D8 or D10 and puts its coal token on the tile. Its "coal and oil"
      choice at B12 lays both tokens, the oil from Reece Oil.
    - Reece Oil lays at B12 or J14 with its oil token; Hendrickson Iron at D16 with its ore token.
      Each closes with its last token.
    - Keystone Bridge chooses coal or ore as it lays, and stays open for its bridge.
    - Fox Bridge Works and Keystone Bridge put a bridge on Portland, Omaha, Kansas City, St. Louis or
      Memphis.
    - The Resource subsidy lays any of the three kinds, as a free extra yellow lay.
    - With Nobel’s, a lay on the mountains of B6 or C7 costs no $15.
- **Privates track**: the same lay, NW holding Track Engineers (P7), Boomtown (P9), Pettibone &
  Mulliken (P11) and Great Northern (P17).
    - Track Engineers: lay three tiles, the second for $20 and the third free; no fourth is offered.
    - Pettibone & Mulliken: with the $20 second lay, make two upgrades, at most one of them a city.
    - Boomtown upgrades a yellow city (Denver, Memphis, Fargo or St. Louis) to green, besides the
      normal lay, and closes.
    - Great Northern lays a free yellow tile at B12 or B18, and the normal lay still follows.
- **Privates tiles**: the same lay, NW holding Regional Headquarters (P16), Rural Junction
  (P26) and Company Town (P27).
    - Regional Headquarters puts the gray RHQ tile on Sacramento, Salt Lake City, Omaha or Kansas
      City, and closes.
    - Rural Junction lays a junction at Boise, and stays open for its other two.
    - Company Town lays its tile on an empty hex (F12, B12, B18, D16, J14, D8, D10 or Boise) with a
      bonus NW station on it, and closes.
- **Privates stations**: New York Central at its first lay in phase 4 holds Import / Export Hub
  (P6), Express Freight Service (P8), Suem & Wynn (P20) and the Free Station subsidy.
    - Import / Export Hub marks Port of New Orleans or Florida: the area's value token becomes the
      30/40/50/80 token, and P6 closes.
    - Express Freight marks Port of New Orleans or Florida with NYC’s extra station.
    - Suem & Wynn puts a station in full Dallas-Fort Worth, filling its next slot to open.
    - The Free Station subsidy places a station from the supply in any city NYC reaches.
- **Privates run**: the Pullman run, Southern Railway holding Union Switch & Signal (P19) and
  Double Heading (P30). Train powers gives Union Switch to the 3+-train, which may then pass one
  city as plain track, and Double Heading one more city.
- **Privates trains**: Union Pacific buys trains in phase 3 owning a 2-train, the next
  train a 4, holding American Locomotive (P25), Pennsy Boneyard (P13) and Western Land Grant
  (P15), with $600.
    - The 4-train costs $360, 10% off its $400.
    - Buying it rusts the 2-trains; Pennsy Boneyard asks whether to keep UP’s until its next run.
    - Western Land Grant lets UP take one loan more than its limit.
- **Privates company start**: a phase-2 stock turn whose player holds Carnegie Steel (P10) and
  Bankrupt Railroad (P29), with $400. Carnegie holds Atlanta, Chicago and Los Angeles.
    - Auction a company in one of those cities and contribute Carnegie Steel: the city becomes a
      metropolis.
    - Auction a company in a "No subsidy" city (Fargo, Boise, Omaha, Sacramento, Santa Fe, San
      Antonio or Jacksonville) for $120 or more and contribute Bankrupt Railroad, worth $120: the
      company receives a free 2-train.
- **Privates boomtown subsidy**: ATSF’s first operating round, at empty Phoenix, with the Boomtown
  subsidy. The subsidy offers nothing until ATSF lays its yellow home tile; then it upgrades Phoenix
  to green for free.
- **President sale**: no 60% president limit; Player 1 holds all five ATSF shares. On Player 2's
  turn, the ATSF cell in Player 1's row buys a share for $55, 10% above the $50 price.

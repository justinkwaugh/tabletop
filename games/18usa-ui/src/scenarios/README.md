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

Arranged in code from a seeded game, with no actions behind them:

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
- **President sale**: no 60% president limit; Player 1 holds all five ATSF shares. On Player 2's
  turn, the ATSF cell in Player 1's row buys a share for $55, 10% above the $50 price.

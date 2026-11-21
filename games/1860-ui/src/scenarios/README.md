# 1860 harness scenarios

Written by `games/1860/test/scenarios.build.spec.ts` from seeded games of the logic package's test
bot (`SCENARIOS=all pnpm exec vitest run --config test/scenarios.config.ts` in `games/1860`, or
`SCENARIOS` naming the ones to write), all for four players, each keeping the actions that led to
it.

- **Initial auction**: the third of the six auctions, with a bid made and a player passed.
- **First stock round**: the six certificates taken; the C&N and IOW are started.
- **Home tile**: a company has floated on a bare home hex; its director lays the home tile.
- **Halts**: a company's run with several halts laid on the map.
- **Insolvent lease**: an insolvent company runs the bank's smallest train, leased.
- **Bankrupt refloat**: a stock round after a company went bankrupt; its bases lie face down and
  its director's share waits in the IPO to start it again.
- **Private sale**: a stock turn from the second stock round on, the player holding a private
  the bank will buy for its face value less £30 (the Privates panel beside Buy and Sell).
- **Fishbourne ferry**: a stock turn from phase 6, the Fishbourne Ferry for sale; buying it
  closes the other privates.
- **Nationalisation**: British Rail has formed and closed companies; the rounds go on.

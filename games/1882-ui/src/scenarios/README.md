# 1882 harness scenarios

Written by `games/1882/src/scenarios.build.spec.ts` (run with `SCENARIOS=1`) from seeded bot
games, each with the actions that led to it.

- **Private auction**: the opening. Pass with every player and the cheapest unsold private falls
  by $5 (§9).
- **Saskatchewan Central exchange**: a stock turn of the SC's owner. Choose Exchange SC, a par,
  then the SCR's home on the map (§7.1.2).
- **Neutral station**: a company's station step with its neutral station to place, beside its own
  (§11.4).
- **Rebellion station move**: the company owning the North-West Rebellion Company in its turn;
  choose North-West Rebellion, a station, then a rebellion city (§7.1.3).
- **Rebellion extra lay**: the extra lay or upgrade in the hex the station moved to (§7.1.3).
- **Rebellion train**: a company about to buy the train whose purchase brings the rebellion (§8).
- **Canadian National track**: the CN laying track from its neutral stations (§10.4).
- **Fishing exit funding**: the Canadian Northern's train step, its only route from a Spiritwood
  station to the fishing exit and $50 in its treasury. It may finish without a train, or its
  president may fund a 2-train as a company that must (§11.5, §11.8). Arranged in code, so it has
  no history.
- **Finished game**: a whole game, for history and the final scores.

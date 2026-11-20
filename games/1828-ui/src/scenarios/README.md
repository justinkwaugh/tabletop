# 1828 harness scenarios

Written by `games/1828/src/scenarios.build.spec.ts` (run with `SCENARIOS=1`) from seeded bot
games, each with the actions that led to it.

- **Private auction**: the opening. Rows of one price; a $250 private holds one bid (§6).
- **First stock round**: the auction played out, the $250 privates' companies parred.
- **Merger**: a stock turn on which the player may merge two companies into a system (§7.5).
- **Merger single share**: a merger waiting for a player to trade up or sell their single share.
- **System shells**: a system at the start of its train step, able to move trains between its
  shells (§8.3.5.1).
- **Cobourg lay**: the C&P's owner laying its tile (§13.2.2.5).
- **Cobourg run**: the C&P's owner choosing between two runs through its tile, $60 or $50.
- **Mohawk on turn**: the M&H's owner directing the company in its track step, able to exchange
  it from the operating steps (§13.2.2.6).
- **Mohawk off turn**: the same exchange on another player's turn; use the harness's Non-active
  view when its seat is the owner's.
- **Coal marker for sale**: a director whose track reaches the Virginia Coalfields, able to buy a
  coal marker for $120 (§16).
- **Coal tunnel**: a company able to build the Virginia Coalfields Tunnel with tile #4 and take the
  coal marker on it (§14.3.1.2).
- **Coal run**: a company with a coal marker and trains, its track reaching the Coalfields (§15.2).
- **Finished game**: a whole game, for history and the final scores.

# 18RoyalGorge harness scenarios

Written by `games/18royalgorge/src/scenarios.build.spec.ts` (run with `SCENARIOS=1`) from seeded
bot games. All are four-player games but the two bridge lease ones. The first ten keep the actions that led
to them. The private scenarios below them hand a private to the owner that uses it at the moment
it acts, so their history starts afresh.

- **Private auction**: the opening selection auction, no action taken yet. The first player
  opens the first drawn card at its face value or passes. A sold card goes to the winner, who
  opens the next; if every player passes without bidding, only that card is removed and the next
  card is offered (AU-1 to AU-5). William Palmer (Y4) is one of the cards: its winner also takes
  a Rio Grande and a CF&I share, Rio Grande receiving nothing for its share (Y4).
- **Metal shares stock round**: the first stock round, Rio Grande and South Park started, the
  active player holding the Metals Investor (G5). Buy Metal Shares offers CF&I and VGC a space
  below their $45 price, at $40; buying one CF&I share is the turn's purchase, and that player may
  still buy only a VGC share with the card this round (G5, SR-13).
- **Steel choice**: Rio Grande's track step in the green phase after a yellow lay, its yellow
  steel fixed to column A. The steel market shows the yellow and green columns; choosing green
  column F makes the next green tile take F's $20 cube, and the yellow column cannot be changed
  this turn (ST-2, ST-3).
- **Gold shipping**: South Park's earnings after a run through B6, which holds two gold cubes.
  Ship Gold takes one cube off B6 and adds $50 to the revenue: paying out then pays $130, $13 a
  share, from an $80 run. Only one shipment is allowed a turn (GO-2, GO-3). Player 1 holds the Local
  Jeweler (Y6): the shipment puts $5 on its card (Y6).
- **Treaty debts**: Rio Grande buying trains after the Treaty of Boston, owing four debts with
  Santa Fe owing two, the debt marker at $60. Pay Debt takes $60 from Rio Grande's treasury into
  Santa Fe's and leaves Rio Grande three debts; a second payment is not offered in the same
  operating round (DB-3, DB-5).
- **Bridge lease choice**: a three-player game in the Green phase. South Park holds the Hanging
  Bridge Lease (G3) and is about to run its 4+. Its best run without the lease earns $170. Use the
  lease, before running, and Rio Grande's gorge stations no longer block it: the 4+ then runs from
  Leadville through the gorge to F12 for $240, and after its payout South Park owes Rio Grande
  $24, 10% of that train (G3, RG-2, RG-3).
- **Bridge lease**: a three-player game in the Brown phase. South Park chose the Hanging Bridge
  Lease (G3) before running, and has just run a 4+ for $330 through the gorge. Pay out or
  withhold; then, before anything else, Pay Bridge Lease sends Rio Grande $33, 10% of that
  train's run, from South Park's treasury or its president's cash, either way whichever the run
  went to (G3, RG-3).
- **Brown gorge**: Rio Grande's track step in the Brown phase, the green gorge still on the board.
  Hovering any of the gorge's three hexes outlines the whole gorge. Choosing one shows the brown
  gorge as one piece across all three, its values 40, 60 and 80, at one lay and one brown steel;
  accepting lays all three (RG-1).
- **Train extension**: Rio Grande's run with the Track Engineer (B5). Extend Train lengthens one
  of its two 2+ trains by a stop for this run; the Track Engineer then has no choice left for the
  other train (B5).
- **Finished game**: a whole game, ended by the first 6x2 train, for history and the final
  scores.

## Privates

- **St. Cloud hotel**: Rio Grande's run in the Silver phase, owning the St. Cloud Hotel (Y1). The
  hotel's marker stands on Cañon City (H12), where it moved in the Brown phase. Running its best
  route, which stops at Cañon City, earns $250: $20 of it is the hotel's (Y1).
- **Ghost town**: South Park's earnings after a run through Buena Vista (B6), which holds its last
  gold cube; South Park owns the Ghost Town Tour Co. (Y2). Ship Gold from B6, and Place Ghost Town
  is offered there: the ghost town goes on B6, and the card shows one fewer left (Y2).
- **Ghost town run**: South Park's run with a ghost town on Buena Vista (B6) and the Ghost Town
  Tour Co. (Y2). Its best route, Leadville to Buena Vista, earns $90: $50 and $30 for the stops and
  $10 for the ghost town (Y2).
- **Coal creek**: Rio Grande's run in the Brown phase, owning Coal Creek Mines (Y3) with two coal
  cubes. Extend Train offers one or two cubes; spending one lengthens a train by a stop and leaves
  one. The run passes Coal Creek (H14), so the card gains a cube back from the supply: two on the
  card, nine left of the twelve (Y3).
- **Coal depot**: Rio Grande's run, owning the Coal Depot (G6) with four cubes. Extend Train offers
  one or two cubes for one train; spending two leaves two, and the other train may not use the
  depot this turn (G6).
- **Prison labor**: South Park's track step, owning the Colorado State Prison Labor Force (Y5).
  Laying its home city at Buena Vista (B6), whose river costs $20, costs $10: the terrain is
  halved, and the yellow steel is the free cube (Y5).
- **Steel depot**: Santa Fe's track step in the Green phase, owning the Steel Depot (B3) with five
  steel. Choosing the Steel Depot for yellow on CF&I's market makes the next yellow tile's steel
  free from the card. Two yellow tiles take depot steel, leaving three; the third takes a column's
  steel (B3).
- **Sulphur springs**: Pueblo & Arkansas Valley's track step in the Brown phase, owning Sulphur
  Springs (B2), with a green town tile on Sulphur Springs (E3). The private's lay turns it into the
  green R city, free and outside the six lays, and the private closes. The R city later upgrades to
  the brown R city like any city (B2, TR-8).
- **Gold nugget**: Rio Grande's earnings in the Brown phase after a run past B10's gold, owning the
  13lb Gold Nugget (G2). Ship Gold with the Nugget adds $130 to the revenue instead of $50, and the
  Nugget closes (G2).
- **Doc holliday**: Santa Fe buying trains after the Treaty of Boston, owing two debts, with
  Player 1 holding Doc Holliday (G1). Pay Debt takes the debt marker's $80 from Santa Fe, and
  Player 1 receives it rather than the bank (G1, DB-3).
- **Mint worker**: Player 1's stock turn in the Green phase, holding the U.S. Mint Worker (B6), VGC
  at $50. Buy Metal Shares with the Mint Worker buys one or two VGC shares at half price: two cost
  $50, and the card closes (B6).
- **Private income**: Santa Fe's train buying, last in the first operating round of a Brown set.
  Player 1 holds Florence Oil Fields (G4), Player 2 Silver Mines (B1) and Player 3 Sulphur Springs
  (B2), with a tile on Sulphur Springs (E3). Finishing the turn starts the next operating round,
  which pays Player 1 $25, Player 2 $25 and Player 3 $50, besides the other privates' incomes
  (G4, B1, B2, PV-1).
- **Set end**: Rio Grande's train buying, the last turn of a Green set. Player 1 holds the Local
  Jeweler (Y6) with $15 on it, and Player 2 the Gold Miner (B4) with no VGC shares. Finishing the
  turn ends the set: VGC pays $140, $14 a share, and Player 2 receives $28 for the Gold Miner's two
  shares. As the stock round begins Player 1 takes the jeweler's $15 (B4, Y6, EG-1).

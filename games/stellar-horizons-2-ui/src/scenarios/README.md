# Stellar Horizons II scenarios

The dev harness lists these under **Scenarios**. Each opens as a hotseat game at a prepared position, in one player's phase or at a decision one player makes; loading one again starts it over. _Three factions at one anomaly_ is a game of _These are the Voyages_; the others are campaigns with the Starfarers, the Givers, the Praetorians and (with four players) the True Path, prepared at the end of 2100 so that 2110 draws a chosen economic tile. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/stellar-horizons-2`.

In the harness's hotseat game the phases' branches are played one at a time, so a later faction sees what the earlier ones committed; in a hosted game commitments show only once everyone has finished exploring.

## Three factions at one anomaly

Three players in the exploration phase of the first decade. The Stellar Chart, a science anomaly, lies at Vega, where it needs 7 exploration: its printed 4 plus one per player. Each faction has two ships there, strong enough together: the Starfarers' Orion (+6, a research ship) and Kepler (+3), the Givers' Darwin (+5) and Mendel (+2), the Praetorians' Odyssey (+6) and Audax (+3). Vega keeps its exploration marker, so every ship could explore it instead. Initiative order is Starfarers, Givers, Praetorians, and the phase opens with the Starfarers. The position is prepared: in play an anomaly is found at the end of a decade and first resolved in the next.

- **Choosing ships.** On the Starfarers' card, Orion alone shows 6 / 7 in orange and Commit ships stays disabled; adding Kepler shows 9 / 7 in green and enables it. Commit ships records the attempt: the card names Orion and Kepler as committed, both leave the list of ships that can explore, and history shows the attempt.
- **Rivals.** Done exploring hands the phase to the Givers, whose card says the Starfarers have committed ships here and resolve before them; Darwin and Mendel make exactly 7 / 7, so both are needed. The Praetorians, last in initiative, see both rivals resolving before them.
- **Resolution.** When the Praetorians finish exploring, the attempts resolve in initiative order before the surveys: the Starfarers take the Stellar Chart, so their console shows the tile and the standings read 1/4; the Givers' and Praetorians' attempts fail, their ships' actions spent for nothing; the anomaly leaves Vega; and history records one Resolve anomaly step per attempt.
- **Passing.** A faction that explores Vega with its ships, or ends the phase without committing, leaves the anomaly to the next faction in initiative order that committed enough; if nobody commits, the Stellar Chart stays at Vega for the next decade.

## Campaign initiative

2110 draws _Roll initiative_. Player 1 (the Starfarers) has 3 IP, Player 2 (the Givers) 1 and Player 3 (the Praetorians) none.

- **Declaring.** Player 1 is offered No IP and 1 to 3 IP, each +20%. Choosing one ends their declaration and spends the IP at once (the console shows it). Player 2 is offered No IP and 1 IP. Player 3 has nothing to declare and is skipped.
- **Rolling.** After the last declaration the rolls follow: history lists the new order with each total, and IP declared shows as roll + IP. The standings reorder from the highest total, ties keeping the earlier order. Then the build phase opens.

## Campaign base production

2110 draws _Base production_. The Starfarers have bases at Alpha Centauri (12 settlements, an M world and a D world) and Luhman 16 (4, a J world); the Givers one at Alpha Centauri (6).

- **Choosing.** Each base offers cash and every tech type its worlds produce, with the yield: the best world value plus the settlement bonus (Alpha Centauri for the Starfarers: $6B, 3 biology markers, …; Luhman 16 has no bonus below 5 settlements). Types the system cannot produce are not offered. Choosing for one base leaves the other; choosing for the last ends the Player's choices.
- **Producing.** Once every base has chosen, history lists what each produced; the cash and the markers appear in the consoles.

## Campaign conversion

Four players. 2110 draws _Settlement growth_; the True Path (Player 4) and the Givers both have bases at Alpha Centauri. Growth has happened, and the True Path is offered the conversion.

- **Converting.** The card names Alpha Centauri and the Givers' base. Choosing it rolls a die: history shows the roll, and on 4 or less one Givers settlement becomes the True Path's. Don't convert skips it. Either way the build phase follows.

## Campaign terraforming

2110 draws _Terraforming_. The Givers own _Terraforming_ and have a base at Alpha Centauri with an M world on side I and another on side II.

- **Twice.** The hint says the Givers may terraform 2 worlds. Flipping the side I world earns 1 IP and leaves only the other world for the second turn: the same world is never offered twice. Drawing for the side II world offers a replacement; taking it earns 2 IP.
- **Refill.** When terraforming is over, one world of each set-aside class (M, O, L, H) joins the pool.

## Campaign paying with IP

The development phase of 2100. Every Player has 4 IP and $2B.

- **Paying.** Choosing _Interstellar Settlement_ (10 points) suggests the biology 2 marker, 3 IP and $2B. The − and + beside the IP move points between IP and cash, never past what is needed. Developing it spends them; being the first to develop it earns 1 IP back.
- **Turning IP into cash.** The console's 1 IP → $1B button does so at any point in the Player's own phase.

## Campaign pact

The exploration phase of 2100. Terran DNA, a science anomaly, lies at Alpha Centauri: 8 plus one per player is 11, and 10 for the Starfarers, whose ships count one less difficulty. The Starfarers' Orion (+6) and the Givers' Darwin (+5) are there, neither enough alone. Its reward is 2 IP and 2 biology markers. The phase opens with the Starfarers.

- **Proposing.** Terran DNA's card offers Propose a pact. The editor lists Player 2 as a partner, Orion as the Starfarers' ship and, once Player 2 is chosen, Darwin as theirs; the reward splits 1 IP and 1 marker each, with − and + to change it. The total reads 11 / 10 in green once both ships are pledged, and Propose pact stays disabled, with the reason beside it ("Choose at least one partner"), while the terms fall short or the split does not add up. Undo, or Propose a pact again, closes the editor without proposing. Proposing lists the pact at the top of the phase: Player 1 has accepted, waiting for the other partners, with Counter and Withdraw. Zoomed into Alpha Centauri, the system panel shows the pact to everyone, as offered.
- **Accepting from the waiting seat.** With Options → Non-active view, view as Player 2: their waiting panel lists the pact as proposed to them, with Accept, Counter and Decline. Accepting marks it agreed: "Agreed. It resolves once everyone has finished exploring." Orion and Darwin can no longer explore.
- **Resolving.** Turn Non-active view off and finish exploring for all three Players: the pact resolves after the phase, Player 1 and Player 2 have 1 IP each and the Starfarers a biology marker, and Terran DNA turns over at Alpha Centauri, where its back adds a biology marker to bases producing biology.
- **Lapsing.** A partner who finishes exploring before accepting lets the offer lapse; it leaves the list.

## Campaign mining

The exploration phase of 2100. Alpha Centauri shows an M world and a D world and holds no base. The Starfarers' Orion (a research ship) and Pytheas (a mining ship) are there, and the Starfarers own Atmosphere Processing.

- **Offering.** Mine, research or terraform lists Orion with Research M and Research D, each with its chance and what it earns, and Pytheas with Mine M, Mine D, Terraform M and Terraform D.
- **Mining.** Mine M rolls a die: on its cash value or less $2B, otherwise $1B. The panel reports the roll and the cash ("Pytheas mined Alpha Centauri: rolled 2, needing 4 or less, so $2B"), and Orion's research leaves the list: a Player mines or researches each system once a turn.
- **Terraforming.** Terraform D instead reports that Pytheas terraforms D once everyone has finished exploring, and Orion can still research. When the phase ends the D world is turned to its other side and the Starfarers earn 1 IP.

## Campaign event

2110 draws an event: the pool holds only Incoming Comet (combat 6, 5 IP). The Starfarers have a base at Alpha Centauri; the Givers, last of the two in initiative, have bases at Alpha Centauri and Luhman 16. The Praetorians have none.

- **Placing.** The Givers place the event. Its tile and text say why ("you have the worst initiative among the factions with a base"), and the map highlights their two systems. Clicking Luhman 16 places it there, beside the anomaly position on the map, and the decade goes on to building.

## Campaign anomaly backs

Base production in 2110. Mineral Veins was resolved at Alpha Centauri and lies turned over, giving its bases +$3B cash production. Pirate Raids, an unresolved event, sits beside it. The Starfarers have a base of 8 settlements there.

- **Production.** The base offers $8B (its $5B plus Mineral Veins' 3) and 3 biology markers, and its row names the cause: "Mineral Veins: +$3B when producing cash".
- **The system.** Zoom into Alpha Centauri: the turned-over tile shows "Bases: +$3B Cash production", and the Pirate Raids tile sits left of it. The system panel lists Mineral Veins as turned over and Pirate Raids as unresolved, needing 6 combat for 3 IP.

## Campaign reward settlements

The end of 2100's exploration. The Starfarers have committed to Splinter Colony at Alpha Centauri (an M world, no base) and resolve it; they have a base of 4 at Barnard's Star and room for a second base.

- **Placing.** Splinter Colony gives 2 settlements. The map highlights Barnard's Star and Alpha Centauri; each click adds one settlement there, listed in the panel, and Undo takes the last one back. The button counts down the settlements left to place and enables Place settlements at none. One each makes Barnard's Star 5 and founds a base of 1 at Alpha Centauri. The new base draws Alpha Centauri's demand marker: the Starfarers keep one of the two drawn. The development phase follows.

## Campaign trade goods

2110 draws the trade goods tile. The Starfarers drew Food, Ore and Fine Art; they have bases at Alpha Centauri (6 settlements, an M and a D world) and Luhman 16 (3 settlements, a J world), each taking 1 good this turn. The Givers and Praetorians drew goods of their own.

- **Assigning on the map.** The panel lists the three goods with Food first. The map highlights Alpha Centauri ("Food here") and Sol ("Food to Earth"). Clicking Alpha Centauri sends Food there; the room line shows Alpha Centauri takes 0 more.
- **Nowhere to go.** Ore (A, D or K) now has no highlighted system: Alpha Centauri has taken its good for the turn, Luhman 16 has no such world and Ore cannot go to Earth. The panel says so; Discard Ore for $1B sets it aside.
- **Finishing.** Fine Art goes to Luhman 16. The button reads "Assign goods, $1B for the rest"; Undo takes back one choice at a time. Assigning ends the Starfarers' Branch, the tracker marks them done, and the next Player assigns theirs.

## Campaign trading

The cargo and trade phase of 2110, played on the Main Line in initiative order; the Starfarers go first. They have Medicine and Food at their base at Alpha Centauri (an M and a K world), where Medicine is in demand; Fauna aboard Andromeda at Barnard's Star, where the Givers have a base and Fauna is in demand; Ore on Earth; and Polaris, empty, at Alpha Centauri.

- **Selling.** "Sell goods where there is demand" offers Ore at Sol ($4B), Medicine at Alpha Centauri ($5B, +1 IP) and Fauna at Barnard's Star ($6B, +1 IP). Choosing Fauna shows "Pays Player 2 $1B": the Starfarers have no base there.
- **Demand.** Selling Fauna returns Barnard's Star's marker and the Starfarers keep one of two new ones; the cargo step comes back with what is left to sell.
- **Loading.** Choosing Polaris shows Earth-less partners: the base, with a row for Medicine and one for Food, each moving one good per arrow beside the settlement row.
- **The map and the system panel.** Alpha Centauri's demand marker shows in its upper left; zooming in lists "Demand: Medicine sells for $5B each, and 1 IP" and the base's goods beside its settlements. Sol shows its own marker for Ore, Rare Materials and Fine Art.
- **Goods in the console.** The faction console lists Goods 4 of 12 by place, Earth, Alpha Centauri and Andromeda, each with a 1 → $1B button to destroy one.
- **Turn order.** Once the Starfarers have nothing more to load, unload or sell, their turn ends by itself and the next Player's begins.

## Campaign demand

The trading position after the Starfarers sold Medicine at Alpha Centauri: they choose the system's new demand marker.

- **Keeping one.** The panel shows the two markers drawn; keeping one puts it on Alpha Centauri and returns the other to the pool, and the Starfarers' trading turn goes on.

## Campaign reward goods

The end of 2100's exploration. The Starfarers resolve Megafauna at Alpha Centauri, which gives 2 IP and 2 Fauna. They have a base of 6 there and Andromeda, carrying a settlement with room for one more.

- **Placing.** The panel offers "Your base at Alpha Centauri" and Andromeda. Each click places one Fauna; Undo takes one back. The base takes only one good this turn, and Andromeda one.
- **The rest.** "Place 1, destroy 1 for $1B" places what was chosen and destroys the rest for $1B each.

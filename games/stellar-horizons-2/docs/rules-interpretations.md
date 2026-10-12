# Stellar Horizons II rule interpretations

The implementation follows the Compass Games rulebook (December 2023 print) for scenario 2.1, _Footfall among the Stars_, and the competitive mode of scenario 2.3, _These are the Voyages_, together with the designer's and publisher's answers on BoardGameGeek. This file records where the component data came from and the rulings the rulebook leaves open. Rulings are covered by `src/model/rules.spec.ts`, `src/definition/flow.spec.ts` and `src/definition/playthrough.spec.ts`; those for These are the Voyages by `src/definition/voyages.spec.ts`, `src/model/anomalies.spec.ts` and `src/definition/anomalyRace.spec.ts`.

Everything from Turn structure to Bases, ships and settlements applies to both scenarios unless it names Footfall. The section on These are the Voyages lists what differs there.

## Component data

- **Map.** `src/components/systemCatalog.ts` lists all 36 system tiles with their printed habitability, exploration type and bonus, world slots and earthlike restriction. The map is an odd-q grid of flat-topped hexes; the hex distance from Sol computed from the coordinates matches the ring printed on every tile. Sector membership comes from the Vassal module's sector covers. Footfall uses the Sol and Alpha Centauri sectors (nine systems).
- **Ships.** `src/components/shipCatalog.ts` holds the 118 faction counters with their printed exploration, cargo, combat, build cost, fast, mining and research markings. Where the Vassal module's traits disagree with the printed counter, the printed value is used (Viper's combat; Empress, Surveyor, Tempest, Stargazer, Scavenger and Firebrand's costs). Eternal Flame and Revenant show the fast engine plume and are treated as fast.
- **Worlds.** `src/components/worldCatalog.ts` holds the 160 world tiles (149 worlds and 11 No World tiles) with both faces as printed.
- **Anomalies.** `src/components/anomalyCatalog.ts` holds the 34 anomaly tiles (19 science, 15 combat) with their printed difficulty and their no-exploration and no-bases icons. Their rewards and reverse sides are not recorded, because the only scenario that uses anomalies so far ignores them.
- **Techs.** `src/components/techs.ts` transcribes the 44-tech chart: costs, prerequisite arrows (all are required) and effects. A scenario's tech level _n_ means every tech in columns 1 to _n_.

## Rulings

### Turn structure

- **Simultaneous decades.** Within a decade every player works through their own steps in rulebook order: build and repair, cargo, movement, exploration, develop techs. Players act at the same time. In Footfall nothing one player does in a decade changes another player's options in that decade. The two exceptions are handled explicitly: surveys are resolved in initiative order after everyone has finished, and tech discounts and prerequisites count only ownership from before the decade.
- **Idle steps end by themselves.** A player's cargo step ends as soon as none of their ships can load, unload or exchange a settlement, and their movement step ends as soon as none of their ships can move, whether after their last action in the step or on reaching it with nothing to do. While anything is still possible, the player ends the step themselves. The exploration step is skipped the same way when none of the player's ships can explore, but exploring never ends it: after their last exploration the player still ends the step themselves, having seen the results.
- **Initiative.** Initiative is drawn once as the turn order (or taken from tournament seats) and does not change, as the scenario rules say.
- **Factions.** Players choose factions in initiative order. Faction abilities and faction-sheet values are ignored, as all scenarios require, so a faction only supplies its ship roster and colour. The Consortium is offered with the rulebook's balance warning.
- **End of a decade.** Surveys resolve, then in even decades terraforming happens, then victory is checked. Income is paid at the start of each even decade.

### Victory

- **Goal.** A player wins with 10 or more settlements at a base in a system whose printed world populations total at least 25. "Max (printed) population" is read as the system's population limit from rule 4.6, the sum of its worlds' printed maximum populations on their current sides.
- **Timing and ties.** The goal is checked at the end of every decade, so players who reach it in the same decade share the win.
- **No winner.** If nobody reaches the goal by the end of 2300, the game ends with `GameResult.Loss` and no winners. This also covers a solo player who misses the deadline.

### Setup

- Each player starts with $30B and one random tech marker of each type, as rulebook page 9 says. The separate scenario summary omits the markers; the BGG question about this is unanswered.

### Rounding

The rulebook's examples round halves up. The game applies that everywhere a fraction appears: the crippling threshold (half a CV's size), loss compensation (a quarter of its size in engineering markers), scrap refunds and full remote repairs (half the build cost).

### Movement

- **Travel time.** Travel time is the hex distance multiplied by the movement modifier, rounded up, and at least one turn. Fast CVs use the next modifier on the chart unless they carry settlements.
- **Range.** A destination must be within range of Sol or of one of the player's own bases whose settlements are at least the ship's cost.
- **Transit.** A ship in transit cannot load, unload, explore or be repaired. It can be scrapped. Tech improvements bought during transit do not shorten the trip.

### Exploration and surveys

- **Exploration value.** It uses the system's exploration marker as it stood at the start of the decade, because surveys only resolve once everyone has explored.
- **Malfunctions.** Every exploration rolls for malfunction. A ship destroyed by a malfunction still keeps the markers it earned. Only markers from the exploration itself count towards a survey, not loss compensation.
- **Crippled ships.** A crippled CV cannot explore but can still move and carry cargo.
- **Resolving surveys.** Surveys resolve in initiative order. Each lowers the exploration marker by one while it is above zero; a survey that finds the marker already at zero does nothing. A system at zero is fully surveyed and cannot be explored.
- **New worlds.** A completed survey fills the first empty world slot. In an earthlike-restricted system, an M or O world is drawn again; this is implemented as a draw from the legal tiles, which has the same odds.
- **Full systems.** In a full system, a draw happens only if some world has a maximum population below 12. A drawn world of population 12 or less may replace any world with a smaller population. A replaced No World tile leaves the game; every other replaced or unused world returns to the pool (designer ruling).

### Terraforming

- **Who and when.** At the end of even decades, each player with _Terraforming_ and a base may terraform one world in a system where they have a base, in initiative order.
- **Flipping.** A side I world flips to side II.
- **Drawing a replacement.** A side II world (never J, D or E) draws one tile, or two with _Advanced Terraforming_. A drawn world may replace it if its class can be terraformed, its population is higher, and it is no more than 10 higher. The replaced world returns to the pool.
- **Unused draws.** Unused draws with a smaller population than the original world (including No World) may be removed from the game; the rest return to the pool. The rulebook leaves the old tile's destination and the two-draw case open.
- **Pool refill.** The campaign's set-aside worlds and its pool refill do not apply to Footfall.

### Techs

- **Payment.** Techs are paid with markers of the tech's type plus $1B per point. There is no change, and cash may only cover a shortfall left by the chosen markers.
- **Limits and cost.** A player develops at most one tech per type per turn. Prerequisites must have been owned before the decade. The cost drops by 3 for each other player who owned the tech before the decade, to a minimum of 5. Spent markers return to their pool (publisher ruling).
- **Empty pools.** A marker that cannot be drawn because its pool is empty is paid as $1B instead (Player Guide 1.9). Cash paid this way does not count towards a survey, which needs tech value.

### Bases, ships and settlements

- **Settling.** Settlements are bought at Sol for $5B (less with _Terran Exodus_) into the cargo of a ship at Sol. They can be unloaded only in a system with a revealed world and enough habitability for the player's settlement tech. Sol has no bases. A player has at most one base per system. A ship may load at most one settlement from a base each turn; settlements may move between a player's ships in the same system at any point in that player's turn. Destroying one's own settlements is not offered; it has no use in Footfall beyond freeing cargo space.
- **Building.** Ships can be built at Sol without limit, or at the player's own base when the base has at least as many settlements as the ship costs. Spending on builds and repairs at a base each turn is capped by its settlements. Each named counter can be in play once; destroyed counters can be rebuilt. The campaign's fleet limits do not apply.
- **Repairs.** Repairs cost $1B per point at Sol or at a base. Once per turn a CV anywhere can be repaired remotely: $3B for one point, or half its cost for all damage.
- **Scrapping.** A ship can be scrapped at any time during the player's turn, refunding half its cost if it is undamaged and at Sol.
- **Cloning.** _Cloning_ lets a player buy one settlement at each base for $5B during the build step.

### These are the Voyages

The scenario is chosen when the game is created. Only its competitive mode is implemented, for two to four players.

- **Setup.** The map is every sector except Tau Ceti and Epsilon Eridani. The four systems in play next to Sol (Barnard's Star, Luhman 16, Alpha Centauri and WISE 0855-0714) start with no exploration marker and their world slots filled from the pool; WISE 0855-0714 cannot start with an M or O world. Lalande 21185 and Wolf 359 are also next to Sol but belong to the sectors left out.
- **Starting bases.** After factions are chosen, each player places a base of 25 settlements at Barnard's Star, Luhman 16 or Alpha Centauri, in reverse initiative order. Several players may choose the same system, and the base does not need a revealed world there. The rulebook says a player "may" place one; declining is not offered.
- **Money and ships.** Players start with $25B and one random tech marker of each type, draw $5B at the start of each even decade, and build their first ships in the first decade's build step.
- **Terraforming.** There is none, although every player owns _Terraforming_ at tech level 3: only the first two scenarios allow it.
- **Finding anomalies.** Each completed survey rolls percentiles, and on 20 or less a random anomaly from the pool is placed in the system, unless it already holds one or the pool is empty. A survey that finds the exploration marker already at zero is not completed and does not roll. An anomaly found in a decade can first be resolved in the next one.
- **A second anomaly.** Rule 1.16 allows one anomaly per system, "resolved or unresolved". Here the resolver keeps the tile, so once it is gone the system can receive a new one.
- **Restrictions.** A "no exploration" anomaly stops exploration actions in its system; since anomalies only arrive at the end of a decade, this starts in the decade after it is found. A "no bases" anomaly stops settlements being unloaded or cloned there. Ships can still be built at a base in such a system.
- **Resolving.** During the exploration step a player commits ships at an anomaly, each using its action for the decade. A ship's strength is its printed exploration value (science) or combat value (combat) less its damage, to a minimum of 1, plus 1 for a research ship on a science anomaly. Tech, system and exploration-marker bonuses do not count. Crippled crew vehicles, ships in transit and, for combat, ships with no combat value cannot take part. The committed ships' total must reach the printed difficulty plus the number of players; faction modifiers are ignored. There is no die roll and no malfunction roll.
- **Contested anomalies.** Commitments are recorded when made and resolve after everyone has finished the decade, in initiative order and before the surveys. The first player in initiative order to have committed enough takes the tile; anyone after them has spent those ships' actions for nothing. Commitments are visible to the other players as soon as they are made. BoardGameGeek has no ruling on two players resolving the same anomaly in one decade; rule 1.0 says to use initiative order whenever order matters.
- **No joint resolution.** Rule 1.16 lets several players pool ships if they agree how to split the reward. With rewards ignored and one tile to keep, this is not offered in the competitive mode.
- **Rewards.** Anomaly rewards and the effects on the tiles' reverse sides are ignored, as the scenario says.
- **Victory.** A player wins by holding four resolved anomalies, at least one science and one combat. This is checked at the end of every decade, so players who reach it in the same decade share the win.
- **No deadline.** The rulebook gives the competitive mode none. The game ends with `GameResult.Loss` and no winners once no new anomaly can be found (no system has an exploration marker left, or the pool is empty) and no player could reach the goal with the anomalies they hold plus those still unresolved on the map.

### Not used in these scenarios

Combat, escalation and influence, events, trade goods and demand, the economic phase, cards, directives, titles, mining and research, and terraforming with mining ships are all campaign rules (blue boxes). Anomalies are used only in These are the Voyages. The techs that unlock unused rules can still be developed but do nothing here.

## Deployment

`GameResult.Loss` is new in `@tabletop/common`. The backend and Site Frontend must be deployed with it before Stellar Horizons II is published, because the backend validates stored results against the enum.

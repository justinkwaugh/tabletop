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

- **Phases as parallel spans.** A decade is five phases, each a Parallel Span of its own: build and repair, cargo, movement, exploration, develop techs. Every player plays each phase in a private branch of their own, and the branches are merged in the order rule 1.0 gives the phase: build and movement in reverse initiative order and cargo in initiative order, as Ordered Merges, so a player may wait to see what those ahead of them did; exploration and tech development are simultaneous, so they merge as a Barrier, with nobody seeing another player's play until everyone has finished. Nothing a player does in a phase may depend on another player's play in the same phase; a branch reads the table as it stood when the phase began. In Footfall nothing one player does in a phase changes another player's options in it. Tech discounts and prerequisites count only ownership from before the decade.
- **Phases end by themselves.** A phase ends once the player can do nothing more in it, whether on reaching it or after their last action: nothing to build, repair or clone; no settlement to buy, load, unload or pass between ships; no ship to move; no tech they can afford. Exploring never ends the exploration phase, so the player reads the results before ending it themselves; a player who can neither explore nor send ships at an anomaly skips it. Scrapping a ship and moving settlements between a player's own ships are allowed in every phase and never hold one open.
- **Initiative.** Initiative is drawn once as the turn order (or taken from tournament seats) and does not change, as the scenario rules say.
- **Factions.** Players choose factions in initiative order. Faction abilities and faction-sheet values are ignored, as all scenarios require, so a faction only supplies its ship roster and colour. The Consortium is offered with the rulebook's balance warning.
- **After exploring.** Once everyone has finished exploring, the markers earned are drawn, anomaly attempts resolve, surveys resolve, and only then are techs developed, as rule 1.0 orders the phases. In even decades terraforming follows the last phase, then victory is checked. Income is paid at the start of each even decade.

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
- **Drawing the markers.** An exploration settles how many markers it earns; the markers themselves are drawn from the pool once every player has finished exploring, in initiative order, as rule 1.12 has it: every exploration resolves at once, then the markers are placed. The dice are rolled when the ship explores, from a random stream of the player's own, so the roll never depends on what another player did in the phase. Whether a survey is completed is decided when the markers are drawn.
- **Malfunctions.** Every exploration rolls for malfunction. A ship destroyed by a malfunction still earns the markers of its exploration, and its compensation is drawn with them. Only markers from the exploration itself count towards a survey, not loss compensation.
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
- **Limits and cost.** A player develops at most one tech per type per turn. Prerequisites must have been owned before the decade. The cost drops by 3 for each other player who owned the tech before the decade, to a minimum of 5. Spent markers return to their pool (publisher ruling) at the end of the decade, since a player's branch may only change what is theirs.
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
- **Contested anomalies.** Commitments are recorded when made and resolve once everyone has finished exploring, in initiative order and before the surveys. The first player in initiative order to have committed enough takes the tile; anyone after them has spent those ships' actions for nothing. A commitment becomes visible to the other players once everyone has finished exploring, since exploration is simultaneous. BoardGameGeek has no ruling on two players resolving the same anomaly in one decade; rule 1.0 says to use initiative order whenever order matters.
- **Joint resolution.** Rule 1.16 lets several players pool ships if they agree how to split the reward. With rewards ignored, a pact here names the partner who keeps the tile instead of a split; otherwise it works as in the campaign (slice 2 below).
- **Rewards.** Anomaly rewards and the effects on the tiles' reverse sides are ignored, as the scenario says.
- **Victory.** A player wins by holding four resolved anomalies, at least one science and one combat. This is checked at the end of every decade, so players who reach it in the same decade share the win.
- **No deadline.** The rulebook gives the competitive mode none. The game ends with `GameResult.Loss` and no winners once no new anomaly can be found (no system has an exploration marker left, or the pool is empty) and no player could reach the goal with the anomalies they hold plus those still unresolved on the map.

### The campaign (slice 1)

The campaign (rule 3.0 and the blue boxes) is being built in slices; `docs/campaign-plan.md` lists them. Slice 1 is the frame and the economy. Its rulings are covered by `src/definition/campaign.spec.ts`.

- **Component data.** `src/components/factionSheets.ts` transcribes each faction's settlement cost, century table (cash, tech markers, maximum ships and bases, trade goods), the shared Base Production table and the initial ships from rulebook page 14. Faction abilities are recorded there as data.
- **Setup.** Initiative is the drawn turn order, which is the same as rolling percentiles and rerolling ties. Each faction's initial ships are placed when it is chosen, with their transfer markers, together with Earth production for 2100. Every system starts with a '5' exploration marker; 8 M, 6 O, 6 L and 6 H worlds are set aside at random. The game starts in the exploration phase of 2100, and that turn has only exploration and development (forum ruling). Ships with a '1' marker arrive at the start of 2110.
- **The economic phase.** Each turn from 2110 draws one of the seven tiles, without replacement and never the tile of the turn before; once all seven are drawn they are reshuffled. It follows the start of the turn, where transfer markers drop: slice 5 moves it ahead of them, since only blockades care.
- **Initiative.** Each Player declares 0 to 3 IP at the same time, in a Barrier span, and the IP is spent on declaring (agreed 2026-10-18). Everyone then rolls percentiles, adding 20% per IP. The new order runs from the highest total; ties keep the order before the roll. A Player with no IP is skipped. Escalation markers arrive with slice 5.
- **Earth production** pays each faction its century's cash and draws its tech markers, a marker the pool cannot supply being paid as $1B.
- **Base production.** Each base chooses at the same time, in a Barrier span, between cash and the tech types its system's worlds produce. It produces the highest value those worlds show for its choice, plus the settlement bonus. Tech is read as that many tech markers of the type, since rule 4.4 speaks of "cash or tech markers produced" (agreed with the user, 2026-10-18). Markers are drawn on the Main Line in initiative order once every base has chosen. A base in a system with a "no bases" anomaly produces and grows nothing.
- **Growth and migration.** A base of 10 or fewer settlements grows by one; a larger one by one per full 10, plus one if a die rolls at or under the remainder. Migration adds one on a percentile roll at or under the habitability (the True Path's +20%, at most 100%), raised 10% for each full 10 settlements the owner trails the leader by, counted before growth. Neither takes a base past the system's limit for its owner: the worlds' maximum populations, less 10 for each other Player with a base there. Bases over the limit keep their settlements.
- **Conversion.** After growth the True Path may choose one base of another Player in a system where both have bases, and roll a die: on 4 or less one settlement changes sides. A base's last settlement cannot be converted, and none can in a system with a "no bases" anomaly, where bases gain no settlements by any means (1.16).
- **Terraforming.** On its tile, every Player with the tech, and the Givers with or without it, terraform in initiative order, one action per turn of the queue: the Givers get one more than their tech allows, never the same world twice in the phase. A base in a "no bases" system cannot terraform. Flipping a world earns 1 IP, a replacement 2. Afterwards one world of each set-aside class joins the pool. The rule for an empty pool (each Player adds back a removed world) is not built yet.
- **IP.** Earned for being first to a tech (every Player who develops a tech nobody owned at the start of the turn), terraforming, completing the last survey of a system (who also keeps the marker), and finding an anomaly (even where the system already has one or the pool is empty). Spent on initiative, as 2 tech points each of the tech's own type when paying for a tech (never more than needed, cash covering only what is left), and as $1B wherever the Player plays their phase or takes a turn: their own Branch of a phase, the initiative declaration, base production, the conversion and terraforming. Choosing a surveyed or terraformed world costs nothing, so it is not offered there.
- **Faction sheets.** Settlements cost the faction's price. Ships and bases are capped by century: no ship can be built at the cap, and no new base founded. The Starfarers' bases count double for range and they find anomalies on 30%; the Syndicate's combat anomaly difficulty is 2 lower. The Starfarers' sheet takes 1 off "anomalies and events", but rule 1.16 takes it off science challenges only; the rulebook is followed (agreed 2026-10-18), as one BoardGameGeek session report also plays it.
- **Anomalies** resolve as in These are the Voyages, with the rewards and reverse sides of slice 2.
- **The end.** From the end of 2500 a percentile roll ends the campaign at or under 1%, rising 1% a turn, plus 1% for each tech type each Player has completed (up to 3% per Player). The highest score wins, ties sharing the win. Scores count the categories that exist so far: −5 per tech not developed, settlements at bases at half their distance from Sol, +1 per full 5 settlements at each base, +10 for the largest base (every Player tied for it; the rulebook does not say, agreed 2026-10-18), kept exploration markers, 1 per 2 IP, 1 per full 10 tech points, 1 per full $10B and the player-count bonus. The total is rounded once, halves up. A score of exactly 300 is read as Emperor.
- **Not built yet.** Cargo stays an Ordered span until slice 3 plays the cargo and trade phase on the Main Line. Destroying one's own base for points, and offering IP when cash runs short outside development, come later.

### The campaign (slice 2)

Slice 2 brings anomalies in full, events, mining and research, terraforming with mining ships, the Syndicate's take and joint pacts. Its rulings are covered by `src/model/campaignAnomalies.spec.ts`, `src/model/operations.spec.ts`, `src/model/events.spec.ts` and `src/definition/pacts.spec.ts`.

- **Component data.** `src/components/anomalyCatalog.ts` transcribes all 34 anomalies' fronts and backs and `src/components/events.ts` the 20 event tiles, from the Vassal module.
- **Anomaly rewards** (1.16) go to whoever resolves the anomaly: IP, cash, tech markers and settlements. Trade goods (slice 3) and level I cards (slice 4) give nothing until their slices (agreed 2026-10-18). Settlements go to any of the Player's bases, or found a base in the anomaly's system if that keeps within the base limit, habitability ignored; the Player places them after the attempts resolve.
- **Reverse sides.** A resolved tile turns over. A back that affects bases stays in the system and changes their production, growth, migration, ship costs or population limit; the others leave the game, Stellar Chart first drawing a world for its system and each adjacent one with an empty slot, as if surveyed. A turned-over tile no longer counts as the system's anomaly.
- **Faction difficulty.** The Starfarers' science difficulty is 1 lower and the Syndicate's combat difficulty 2 lower, for events as for anomalies, as slice 1 has it.
- **Events** (4.2). The economic tile draws one at random. One without a challenge acts at once: Breakthrough halves the printed cost (rounded up) of one tech of its type this turn, for the Players with the lowest printed tech total of that type; Colonial Rush adds a settlement to every base of the Players with the fewest settlements, and Homesteaders gives those Players two settlements for a base of their choice, both counting only Players with a base. One with a challenge is placed by the Player with the worst initiative among those with a base, at one of their bases, beside the anomaly position. Anyone may then resolve it in the exploration phase as they would an anomaly, for its IP. While unresolved it acts at the end of each turn (Pirate Raids, Contagion, …), throughout (Unrest, First Contact, Smugglers), or when the next event is drawn (Incoming Comet, Supervolcano, …), after which it returns to the pool. It also leaves when every base in its system is gone.
- **"The players in the system"** on event tiles means the Players with a base there.
- **Halving.** An event that halves bases rounds half up: a base of 5 keeps 3.
- **Mining and research** (1.17) are exploration actions of mining and research ships, in a system with a revealed world and none of the Player's bases. They roll no malfunction (designer ruling) and a "no exploration" anomaly stops them, as it stops any exploration action. Mining earns $1B, or $2B on a die at or under the world's cash value. Research earns a marker of the world's type on a die at or under its research value plus half the ship's exploration value, rounded up; the marker is drawn once everyone has explored.
- **Once per turn.** "A system may be mined or researched only once per turn" is read as once per Player: one mining or research action per system per Player per turn. Players explore unseen by each other, so a shared limit would let one Player's private play block another's. Proposed; still to be confirmed by the user.
- **The Syndicate's take.** $1B from each Player mining or researching in a system where the Syndicate's ships have more combat value than that Player's, settled once everyone has explored, in initiative order.
- **Terraforming with mining ships** (1.18). With Atmosphere Processing a mining ship may use its exploration action to terraform a world in its system, any number per system. No base is needed. A "no exploration" anomaly stops it, as an exploration action, and a "no bases" anomaly does, as it stops all terraforming. The draws settle once everyone has explored, in initiative order, like surveys, and earn IP as terraforming does.
- **Pacts** (1.16 joint resolution, agreed with `docs/parallel-spans.md`, Common Actions). During the exploration phase a Player may propose a pact on an anomaly or event to the other Players with ships there: its partners, the ships each pledges, and how the reward is split item by item (or, in These are the Voyages, who keeps the tile). The proposer guarantees only their own ships: these must be free to use. The pledged ships must reach the difficulty as everyone can see them, and the split must add up. Each partner accepts, counters with new terms, or declines. Once every partner has accepted the pact binds: the pledged ships can do nothing else, and the pact resolves once everyone has finished exploring, at its earliest partner in initiative order. An offer still open when a partner finishes exploring lapses. The acceptance that completes a pact reveals it, so no Player can undo past it.
- **Not built yet.** Trade-good and card rewards, and the backs that use trade goods, wait for slices 3 and 4.

### Not used in these scenarios

Combat, escalation and influence, events, trade goods and demand, the economic phase, cards, directives, titles, mining and research, and terraforming with mining ships are all campaign rules (blue boxes). Anomalies are used only in These are the Voyages. The techs that unlock unused rules can still be developed but do nothing here.

## Deployment

`GameResult.Loss` is new in `@tabletop/common`. The backend and Site Frontend must be deployed with it before Stellar Horizons II is published, because the backend validates stored results against the enum.

The decade's phases are Parallel Spans (`docs/parallel-spans.md`), so the backend and Site Frontend that carry them must be deployed before the UI Artifact is published.

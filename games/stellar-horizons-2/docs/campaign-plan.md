# Stellar Horizons II campaign: plan

Status: proposed 2026-10-17. Slices 1 and 2 built and reviewed 2026-10-18, their rulings agreed; slice 3 built 2026-10-18; slice 4 built and reviewed 2026-10-24; slice 5 proposed 2026-10-24. Decisions 1 and 3 agreed 2026-10-17; decision 2 agreed 2026-10-18, with Common Actions in the engine. The campaign is rule 3.0 and every blue box of the Compass Games rulebook (December 2023 print). Sources are in `/workspace/artassets/stellar-horizons-2` (outside git): `notes/rulebook-p01-10.md`, `notes/rulebook-p11-19.md`, `notes/player-guide-pp3-5-7-8.md`, `notes/forum-rulings.md`, and the component transcriptions in `notes/vassal-inventory.md` (appendices A to C) and `notes/vassal-charts.md`.

## What the campaign adds

Footfall and These are the Voyages already play the core turn: build and repair, cargo, movement, exploration with surveys and world draws, tech development, and terraforming. The campaign adds:

- **Setup and length.** 1 to 7 players, 2100 to an end roll from 2500, about 41 decades. It starts in the exploration phase of 2100 with each faction's initial ships, some still in transit. No starting techs.
- **Factions.** Each faction sheet gives settlement cost, Earth production by century, maximum ships and bases by century, trade goods to draw, and abilities. Abilities apply only in the campaign.
- **Influence (IP).** Earned for being first to a tech, terraforming, selling goods off Earth, the last survey of a system, finding an anomaly, resolving anomalies and events, being attacked and fulfilling a directive. Spent on initiative, tech points (2 each), $1B each at any time, directive redraws and titles.
- **Economic phase.** One of seven tiles each turn, drawn without replacement: roll initiative and discard escalation, draw event, Earth production, base production, draw trade goods, settlement growth and migration, terraforming and adding worlds.
- **Anomalies in full.** Rewards on the front; the back stays in the system as a permanent effect on bases there, or leaves the game. Found on 20% (30% for the Starfarers), with 1 IP.
- **Events.** 20 tiles: some act at once, others are science or combat challenges placed at a base of the player with the worst initiative and resolved like anomalies.
- **Mining and research.** Mining and research ships' exploration actions, once per system per turn.
- **Trade goods and demand.** Goods drawn and assigned to bases or Earth, carried in cargo, sold where a demand marker matches, with prices by world type and distance and payments to other players' bases.
- **Cards.** Fleet improvements (28 kinds, 35 cards) and genetic manipulations (35) in three levels, one hand per type, bought with tech points in the development phase. Their effects reach almost every rule.
- **Combat.** A truce rolled away from 2110, then fleet combat, planetary assault, ground combat, raids and attacks on REs, in initiative order. Escalation markers for the attacker, IP for the defender, blockades in base production and growth.
- **Scoring.** Victory points at the end, a galactic rank, and competitive, cooperative and solo modes.
- **Optional rules.** Directives, titles, smaller maps, the advanced start in 2250, a later end, and a demilitarised Earth.

## The turn

Rule 1.0 says play within a phase is simultaneous and initiative decides order where it matters. Each phase keeps its Parallel Span where Players act independently, and plays on the Main Line in turn where they contend for something shared or act on each other. This follows `docs/parallel-spans.md`: combat and selling to a shared market stay in ordinary ordered Machine States.

| Step                           | Rulebook order                                                             | How it is played                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Economic: roll initiative      | IP declared, then everyone rolls; then discard half the escalation markers | Barrier span for the IP declaration and the discard choice; the rolls follow on the Main Line                                     |
| Economic: draw event           | the worst initiative with a base places a challenge                        | Main Line, that Player                                                                                                            |
| Economic: Earth production     | automatic                                                                  | System Actions                                                                                                                    |
| Economic: base production      | blockades in reverse initiative, then each base picks cash or a tech type  | blockades on the Main Line in reverse initiative; the choices in a Barrier span                                                   |
| Economic: draw trade goods     | draw, then assign                                                          | goods dealt on the Main Line, assigned in a Barrier span                                                                          |
| Economic: growth and migration | blockades, rolls, then conversions                                         | blockades and conversion choices on the Main Line in initiative order; rolls are System Actions                                   |
| Economic: terraforming         | each Player with the tech                                                  | Main Line in initiative order, as now, since draws come from the shared world pool                                                |
| Reduce transfer markers        | automatic                                                                  | System Action                                                                                                                     |
| Build and repair               | reverse initiative                                                         | Ordered span, as now                                                                                                              |
| Combat                         | initiative order                                                           | Main Line: the attacker declares, the defender answers, hits are assigned alternately                                             |
| Cargo transfer and trade       | initiative order                                                           | Main Line in turn (agreed)                                                                                                        |
| Movement                       | reverse initiative                                                         | Ordered span, as now                                                                                                              |
| Exploration                    | simultaneous; surveys in initiative order                                  | Barrier span, as now; markers, mining payments, anomaly and event attempts, surveys and finds settle after it in initiative order |
| Develop techs and buy cards    | simultaneous                                                               | Barrier span, as now; replacement cards are drawn after it in initiative order                                                    |
| Shuffle discarded cards        | automatic                                                                  | System Action                                                                                                                     |

The first turn has only exploration and development (forum ruling).

### What crosses between Players

A Branch may change only what its Player owns. Every campaign rule that touches another Player or a shared pool uses one of the three patterns in `docs/parallel-spans.md`:

- **Queued for the end of the span:** anomaly and event attempts, joint attempts, surveys, the Syndicate's $1B from a miner, a title bought mid-phase, the IP a defender gets.
- **Dealt before the span:** trade goods to assign, replacement cards.
- **Played on the Main Line:** combat, blockades, conversions, trading, event placement, terraforming.

### Actions "at any time"

Spending IP for $1B or for tech points, discarding goods for $1B and destroying one's own ships, settlements or bases are offered wherever the Player is acting: in their own Branch or their turn. A Player who is waiting has no use for them until they act. Payments offer the conversion when cash runs short.

A title can be bought at any time, but titles are a shared pool and two Players may qualify at once. A purchase made inside a span is queued with its IP held, and settled after the span in initiative order, as the rulebook's priority rule says.

## Joint resolution of anomalies and events (decision 2)

Rule 1.16 lets ships of several Players resolve an anomaly together if they agree how to split the reward. The rulebook counts a joint resolution for each partner's anomaly directives and for the Guardian and Mastermind titles.

Played with **Common Actions** (`docs/parallel-spans.md`, which has the full example, settled 2026-10-18). During the exploration span, partners negotiate a pact on the Main Line, Löwenherz-style: an anomaly, the partners, the ships each pledges and the split. Each Player guarantees only their own side: proposing or accepting is valid only if their own pledged ships are free in their Branch, and it holds those ships. A proposal's pledged ships must reach the difficulty at the values everyone can see. The acceptance that completes a pact can't be undone or withdrawn; it is marked as revealing information, as Löwenherz marks an accepted deal. A Player closing their Branch makes any pending proposal naming them lapse. An agreed pact needs nothing more in a Branch: after the span it resolves in initiative order at its earliest partner, using its pledged ships, and the UI says from the agreement on that it resolves when everyone has finished exploring.

- **The campaign:** the front reward (IP, cash, markers, goods, settlements, a card) is divided item by item. The tile itself is not kept by anyone: its back stays in the system or leaves the game.
- **These are the Voyages:** rewards are ignored and the resolved tile is kept, so a pact names the one partner who keeps it.

## Hidden information

Card hands, unfulfilled directives and the order of every pool and deck are hidden. Each Player's drawn tech markers are hidden in the Vassal module (masked); the physical rules do not say. The current game shows them. Proposal: keep them visible, as now, unless you want them hidden (slice 4, Q14).

## Component data

Every component is transcribed and checked against the module's images. Each becomes a catalog in `src/components`, recorded in `docs/rules-interpretations.md` with its source, as the existing catalogs are:

- anomaly rewards and backs (34)
- events (20)
- trade goods (92 chits of 10 kinds)
- demand markers (47, and Sol's)
- escalation markers (39)
- fleet improvements (28 kinds, 35 cards in three decks)
- genetic manipulations (35, in three decks)
- directives (42)
- titles (14)
- economic phase tiles (7)
- faction sheets by century (7)
- initial ships (34)
- the combat table and the raid table

## Slices

Each slice is playable end to end in the harness, has harness scenarios for its rules, records its rulings, and passes the logic, UI and browser suites. You review each slice before the next starts.

1. **The campaign frame.** The Campaign scenario with its options (Players, mode), setup in the exploration phase of 2100 with initial ships, faction sheets, IP and its conversions, the economic phase tile cycle with initiative, Earth production, base production, settlement growth and migration and the campaign's terraforming. The last survey's marker and IP, first-to-develop IP, an empty tech pool giving $1B. The end roll and scoring for what exists. The faction abilities that need nothing later: Starfarers' range and anomaly chance, Givers' terraforming, True Path's habitability and conversion, the Consortium's demand draw waits for slice 3. Until their slices land, the event and trade goods tiles do nothing and say so.
2. **Anomalies, events, mining and research.** Rewards and backs, events and their challenges, joint pacts, mining and research, terraforming with mining ships, the Syndicate's take from miners. Joint pacts also come to These are the Voyages here.
3. **Trade goods and demand.** The trade goods tile, storage, demand markers on bases and full surveys, selling with prices and payments, goods from anomalies and the Consortium's abilities.
4. **Cards.** Hands, draws, buying in the development phase, discards and reshuffles, and every card effect on rules that exist by then. Combat cards wait for slice 5.
5. **Combat and escalation.** The truce, the four combat types and REs, the combat and raid tables, hit assignment, damage, escalation and IP, escalation markers and their effects, blockades, faction combat abilities and the combat cards.
6. **Directives and titles.**
7. **Campaign options.** The advanced start in 2250, smaller maps, the later end, a demilitarised Earth, cooperative scoring and solo play.

Length matters online. A decade has up to seven waits: the economic step, build, combat, cargo and trade, movement, exploration and development. About 41 decades is close to 300 waits. The advanced start in 2250 cuts that by about a third. Slice 7 could make it the default for hosted games.

## Slice 1 in detail

Started 2026-10-18. What slice 1 builds, and how:

- **The Campaign scenario.** A third scenario choice, 1 to 7 players, every sector. Competitive only; the cooperative and solo modes are slice 7.
- **Setup.** Factions are chosen in initiative order as now; initiative is the drawn turn order (equivalent to rolling percentiles and rerolling ties). Each faction's initial ships are placed with their transfer markers, and each player takes Earth production for 2100. No techs. Every system gets a '5' exploration marker; 8 M, 6 O, 6 L and 6 H worlds are set aside. The game starts in the exploration phase of 2100, and that turn has only exploration and development.
- **Faction sheets.** Settlement cost, Earth production, maximum ships and bases by century, abilities: the Starfarers' doubled bases for range, 30% anomaly chance and −1 anomaly difficulty; the Syndicate's −2 for combat anomalies; the Givers' extra terraform; the True Path's +20% habitability and conversion.
- **IP.** Earned for the first to develop a tech, terraforming (1 or 2), the last survey of a system (which also keeps the marker) and finding an anomaly. Spent on initiative, as 2 tech points of the tech's type when paying for a tech, and as $1B whenever the Player is acting.
- **The economic phase** at the start of every turn from 2110, after the transfer markers drop (slice 5 moves it ahead of them, for blockades). One tile is drawn, without replacement and never the same twice running:
    - _Roll initiative:_ a Barrier span in which each Player declares 0 to 3 IP, then everyone rolls on the Main Line. Ties go to the earlier initiative.
    - _Earth production:_ System Action.
    - _Base production:_ a Barrier span in which each base chooses cash or a tech type; production follows on the Main Line, markers drawn in initiative order.
    - _Settlement growth and migration:_ System Action rolls, then the True Path's conversion on the Main Line.
    - _Terraforming:_ the existing ordered terraforming with the campaign's IP, the Givers' extra action and the pool refill.
    - _Draw event_ and _draw trade goods_ say they arrive in slices 2 and 3 and do nothing.
- **Anomalies** are found at the campaign's chance with 1 IP, and resolved alone as in These are the Voyages, without rewards until slice 2.
- **The end.** From the end of 2500, a roll at 1% rising 1% a turn, plus 1% per complete tech type per Player. Scoring counts techs, settlements by distance, large bases, the largest base, kept exploration markers, IP, tech points, cash and the player-count bonus. The galactic rank is shown.
- **Not yet:** cargo stays an Ordered span until slice 3 turns it into the Main Line phase of decision 1; destroying one's own base for points; the terraforming rule for an empty world pool.

## Slice 2 in detail

Started 2026-10-18. What slice 2 builds, and how:

- **Anomalies in full.** Each of the 34 tiles' front rewards (IP, cash, tech markers, settlements, goods, cards) and reverse side, transcribed as data. A resolved tile is turned over: its back stays in the system, giving bases there its permanent effect, or leaves the game; a system keeps one anomaly, resolved or not (1.16). The backs that slice 2 can apply:
    - production bonuses at unblockaded bases producing the matching product;
    - Dissidents' +30% migration habitability and Stunning Vistas' +1 settlement in migration;
    - Natural Stimulants' doubled settlements for the production bonus;
    - Symbiotic Spores' +1 settlement after production, even above the limit;
    - Hostile Xenomorphs' −1 settlement in production;
    - Nanobot Swarm's ships $1B cheaper there;
    - Tunnel Complex's +5 population limit;
    - Stellar Chart's world draws.

    Goods on the backs wait for slice 3 and Tunnel Complex's combat modifier for slice 5.

- **Settlement rewards** (Splinter Colony, Dissidents): added to any of the Player's bases, or founding a base in the system within the base limit, habitability ignored. This is a choice on the Main Line.
- **Events.** The 20 printed tiles: the module's deck less its Stellar Chart event, which the printed game lacks, and with Unrest (its art is in the module, not its deck), drawn on their economic tile. Those without a challenge act at once: the three Breakthroughs (half the cost of one tech for the Players with the fewest of that type), Colonial Rush and Homesteaders. A challenge is placed by the Player with the worst initiative who has a base, at one of their bases (a Main Line choice); with no bases anywhere it is ignored. Events are resolved like anomalies, by anyone, for their IP; they leave when resolved or when the system loses its last base. Their effects apply every turn or when the next event is drawn while they are unresolved:
    - IP or cash lost;
    - settlements destroyed on a die roll;
    - bases halved;
    - a world replaced with class K or A;
    - Earth production +1 marker of each type;
    - no base production or growth;
    - REs within range malfunctioning.

    Smugglers waits for trade goods.

- **Joint resolution: the pact.** As agreed in `docs/parallel-spans.md` (Common Actions, example), for anomalies and events: propose, counter, accept, withdraw on the Main Line during the exploration span; pledged ships held; the agreement binds and resolves after the span in initiative order at its earliest partner, the reward split item by item as agreed. In These are the Voyages the pact names the partner who keeps the tile instead.
- **Rewards not built yet** (agreed 2026-10-18): trade goods (slice 3) and level I cards (slice 4) on anomaly fronts give nothing until their slices, and history says so.
- **The pact's interface** (agreed 2026-10-18): in the exploration step, beside each anomaly or event the Player's ships can reach; proposals naming the Player at the top of that step with Accept, Counter and Decline; pacts shown to everyone in the system panel and history.
- **Mining and research** (1.17): exploration actions for mining or research ships in a system with a revealed world and none of the Player's bases; no malfunction roll (designer ruling). "A system may be mined or researched only once per turn" is read as once per Player, since Players explore unseen by each other (agreed 2026-10-18). Mining earns $1B, or $2B on a die at or under the world's cash value; research earns a marker of the world's type on a die at or under its research value plus half the ship's exploration value, rounded up.
- **The Syndicate's take**: $1B from a Player mining or researching where the Syndicate has more ship combat value, settled after the span.
- **Terraforming with mining ships** (1.18): with Atmosphere Processing, as an exploration action, any number per system; the draws settle after the span in initiative order, like surveys.
- **Starfarers and Syndicate** anomaly and event difficulty, as slice 1 has it (science −1, combat −2).

## Slice 3 in detail

Built 2026-10-18, its open questions answered by the user the same day. What slice 3 builds, and how:

- **Components.** The 92 goods of 10 kinds, each with its producing world types, base price and the world types that add or take $1B, and the 47 demand markers and Sol's (`notes/vassal-inventory.md` 3.4 and 3.5, `notes/vassal-charts.md` Chart Trade Goods). Earth counts as M-class for trade.
- **Where goods are.** On a base, on Earth or in a ship's cargo, each good taking 1 cargo point beside settlements. A base stores twice its assignment limit (the Faction Sheet's base production row for its settlements), Earth 10 goods per faction. A ship lost loses its goods.
- **The trade goods tile** (4.5). Each Player's goods for the century are drawn on the Main Line, in initiative order, as a System Action; if the pool runs short, the later Players get what is left. Each Player then assigns their own in a Barrier span: to a base with one of the good's world types, within the base's assignment limit for the turn and its storage, or to Earth if the good lists M. A Player may hold 12 goods in all after assigning; the rest, and any good not assigned, earn $1B each.
- **Goods from base production.** An anomaly back that produces a good adds one from the pool to each unblockaded producing base there, after the production choices, in initiative order; with the pool empty, or no room in the base's storage, it pays $1B instead. These count against storage only (agreed).
- **Goods from anomaly fronts** (1.16). Placed after the attempts resolve, like reward settlements: into the cargo of the Player's ships in the system, onto their base there (despite its world types, counting against its assignment limit, forum ruling), or destroyed for $1B. A pact splits them item by item, as it does the other rewards.
- **Demand markers.** A system gets one when it is fully surveyed or gets its first base: the Player who completed the survey or founded the base draws 2 and keeps 1, the Consortium 3. It goes back to the pool when the system's last base is lost, unless the system is fully surveyed. Sol's never leaves. One marker per system.
- **The cargo and trade phase** on the Main Line in initiative order in the campaign (decision 1); Footfall and These are the Voyages keep their Ordered span. In their turn a Player loads and unloads settlements and goods, buys settlements and sells, in any order, then ends their turn.
- **Selling** (1.9). In a system whose demand marker matches and with no "no bases" anomaly, a Player sells any number of that good from their ships and bases there, or from Earth at Sol. Each earns its base price, +$1B or −$1B for each listed world type in the system, and off Earth the system's distance from Sol and 1 IP. Selling where another Player has a base and the seller has none pays $1B a good to one of them, the seller's choice; the Consortium pays nothing. The seller then draws the replacement marker (Sol's stays), and may sell again if it matches.
- **Destroying goods** for $1B is offered wherever the Player is acting, as the other conversions are; loading, unloading and moving goods stay in the cargo and trade phase (agreed).
- **Visibility.** Goods are visible to everyone (agreed).
- **Smugglers** stops a system's bases being assigned drawn goods and producing goods (agreed).
- **The interface.** Goods on bases, ships and Earth; demand markers on the map; the assignment step; the selling and loading controls in the cargo step; the demand-marker choice; the anomaly-goods placement.

## Slice 4 in detail

Proposed 2026-10-24. Every question was answered by the user the same day: Q3 as a choice at each draw, the rest as proposed. What slice 4 builds, and how:

- **Components.** `src/components/cards.ts` transcribes the 63 kinds from the module's card fronts (`notes/vassal-inventory.md` 3.14 and appendix B): 28 fleet improvements in 35 cards and 35 genetic manipulations, each with its printed name, level, copies, points, cost, the tech type that pays for it and its text, plus its effects as data. The lower-left star is victory points and the lower-right circle the cost, its colour giving the type: grey engineering, blue physics, green biology (the module's `VPVal` matches the star on all 63 fronts, and the forum's "Stabilized Wormholes costs 50 Physics" matches its blue 50). **Q1:** a fleet card costs the type its circle shows, not the buyer's choice of engineering or physics.
- **Decks.** Six: fleet and genetic, levels I to III. A deck and its discards are host-only, with their counts public, as `DrawBag` keeps them. Draws are random from the deck on the protected stream, so there is no order to hide.
- **Hands.** One card of each type, two genetic for the Transhumanists and two fleet for the Praetorians, one more of each with Creative. A hand card's back is public: everyone sees its type and level, as at a table; only its owner sees which card it is (`Policy.Owner` on each card's identity). Owned cards are public, with the year each was bought.
- **Setup** (step 13). Once every faction is chosen, a System Action deals each Player their level I hand in initiative order.
- **Buying** in the development Branch, from the Player's own hand, so it stays in the Branch. Payment works as for techs: markers of the card's type, IP at 2 points, cash for the rest. The cost is the printed cost, +5 for each card of the same type and level the Player owns (+3 for Transhumanist genetic and Praetorian fleet cards), less the card discounts (Military Academy, Science Academy, Neural Interface, Hive Mind), never below 5. A card counts as that type's purchase for the turn, so a Player buys at most one tech or card of each tech type. The first-to-develop IP is for techs only (forum). Increased and Reduced Body Size exclude each other. The tech and card purchase share one cost and payment seam instead of a second copy of the tech code.
- **Same turn (Q2).** Proposal: cost discounts from a card bought this turn wait for the next turn, on techs and on cards, as tech prerequisites count only what was owned before the turn. A card earned from an anomaly or a pact came before the purchases, so it discounts at once. Every other effect starts at once. The +5 counts cards bought earlier in the same turn, which only matters to a Player holding two cards of one type; either order costs the same in total.
- **Drawing after the span.** Replacements touch the shared decks, so they are dealt on the Main Line when the development span completes:
    1. Each Player who bought no tech and no card discards their whole hand.
    2. In initiative order, each Player draws up to their hand size of each type, so when cards run short the later Players miss out. A card the Player owns or holds is discarded and drawn again. Each draw is its own Action when its level is chosen (Q3), so others see that a redraw happened, as they would at a table, but not which card was discarded.
    3. The end of the turn shuffles the discards back into their decks (turn step 9).
- **Which level (Q3, agreed).** A Player chooses the level of every card they draw, from those their techs allow (the user, 2026-10-24: a standing preference is not enough). The draws touch the shared decks, so the choice is made on the Main Line after the development span: in initiative order, each Player with cards to draw chooses a level for one card, sees it, and chooses for the next, including a redraw of a copy they own or hold. Only levels whose deck has cards are offered, and the choice is skipped when one level is left, so nobody waits until a Player has a level II tech. Choosing in the development Branch instead was turned down: it is chosen before the Player sees what they draw or what earlier Players took.
- **Anomaly rewards.** Alien Derelict (fleet) and Alien Remains (genetic) earn a level I card of their type when they resolve on the Main Line (1.16). One the Player owns is discarded; one in their hand is earned from it and they draw a replacement, otherwise they earn the drawn card. It is not a purchase. An empty deck gives nothing and history says so. **Q4 (agreed):** the rulebook does not say when the replacement is drawn; it is drawn at once, its level chosen as in Q3, since the resolution is already on the Main Line. Creative's "immediately draw up to your new hand size" waits for the deal after the span, since it is bought in the development Branch, which cannot touch the decks. **Q5 (agreed):** the pact's terms name the one partner who earns the card, the proposer to begin with; today the first partner in the pact's list gets it.
- **Effects** feed one lookup instead of scattered card checks. Each card carries its effects as data, as techs do, and `capabilitiesOf(state, playerId)` folds techs, faction abilities and owned cards into one `Capabilities`; rules read only that. Tech chains keep their best value, while card bonuses add to the tech's and to each other (rulebook 1.12: a card bonus stacks with a tech bonus; **Q6**: cards with cards too, so Robo Miners, Deep Core Mining and the Conglomerate give $5B more, and Radiation and Zero-G Tolerance +15). The faction abilities that cards also give move into the same lookup: habitability, anomaly difficulty and chance, demand draws, conversion and extra terraforming. What each card does:
    - _Costs:_ CV and RE costs (Crew Focus, Robotic Focus, Engine Upgrades' fast ships), which also set the base size a build and range need (designer ruling) but not repairs or scrap refunds; settlement prices (Pioneers' first each turn, Spacefaring Populace); cloning (Cyborg Species, **Q7**: the chart's Cloning buys settlements at $5B, so the card makes them $3B, and it does nothing without the tech; the forum's puzzle comes from a reply that misread Cloning); tech costs (Skilled Biologists, Engineers and Physicists, Enhanced Intellect, Neural Interface, Hive Mind).
    - _Ships:_ malfunction rates, exploration bonuses (Science Academy's for CVs and REs), cargo (Freight Haulers), damage capacity (Reinforced Hulls, with the crippling threshold on the new capacity, designer ruling), ship caps (Fleet Logistics, Robotic Swarms' extra RE), all ships fast (Engine Upgrades), Self Repair's free point at the start of each build Branch.
    - _Exploration:_ the two-dice cards (Explorer's Guild, Quantum Sensors, Interstellar Mining Conglomerate) keep the lower die, which is always the better one here, and history shows both; +5% to find anomalies on a survey completed by a CV or RE; Planetary Surveys draws two worlds for the Player's survey and they choose; mining's extra $1B; research ships' full exploration value, and +2 at science anomalies and events in place of the usual +1 (**Q8**); anomaly and event difficulty (Cunning, Enhanced Intellect, Science Academy); Hypersonic Missiles' +1 combat value for armed CVs at combat anomalies and events, as the card says it applies there.
    - _Economy:_ cash production (Robo Miners, Deep Core Mining, the Conglomerate); extra goods in the trade goods draw (Trader's Guild, Culinary Geniuses, Gifted Artists, Skilled Entertainers and Naturalists, Skilled Artisans); assigning their good to any base, Earth too except Gifted Artists', and selling it for $1B more; Trader's Guild's extra demand marker to choose from; Starports (**Q9**: proposal, a system where the card's owner has a base may hold two demand markers; when its owner draws for such a system they keep two of those drawn, the Consortium two of three as the designer ruled, and when one of the two is sold through, the seller draws as usual for the one place left); +1 IP at the start of each turn (Increased Body Size); +20% initiative (Cunning).
    - _Settlements:_ population limits by world class, by star (Infrared Vision, which needs each tile's printed star type added to `systemCatalog.ts`) or everywhere (the body sizes, Subterranean), for their owner only; habitability +20% for settling and migration (Environmental Tolerance); growth bonuses applied after growth and migration (Prolific Breeders at a base of the Player's choice, Infrared Vision, Aquatic and Desert Species, Flying, Natural Immortality), which stop at the population limit like any growth (**Q10**: Prolific Breeders too, as Scoutdad reads the rulebook's "unless stated otherwise"); Eager Migrants' 2 settlements; Transcend Biology's growth past the limit and no migration; Cultural Dominance's conversion on a 3 or less, a roll of its own beside the True Path's.
    - _Terraforming:_ Planetary Engineering's extra action and its extra draw from a side II world, mining ships' terraforms included (**Q11**: the extra action needs the Terraforming tech, since the card does not say otherwise and the Givers' sheet has to say "no tech required").
    - _Movement:_ Stabilized Wormholes (**Q12**: the printed card says "for movement purposes", the errata "all purposes, excluding Sol"; proposal, for the owner's ships any two systems where they have bases are one hex apart, which shortens travel and extends range from a base, and nothing else measures distance between bases today; agreed 2026-10-24 with one such hop per trip).
    - _The turn:_ Hive Mind's owner chooses the economic tile from those left in the cycle, never the one drawn the turn before; Transcend Biology's ±3% on the end roll, announced before it.
- **Choices on the Main Line.** Hive Mind's tile choice when the tile is drawn; Prolific Breeders' base, then Cultural Dominance's conversion, after growth with the True Path's, in initiative order, on the map; Planetary Surveys in the existing survey choice; Planetary Engineering in the existing terraform choice. Transcend Biology's modifier is a standing choice set in the development step and shown to everyone, so the end roll needs no wait.
- **Waiting for combat** (slice 5): Minefields and Enhanced Strength do nothing yet; the combat parts of Hypersonic Missiles, the body sizes, Subterranean and Military Academy (combat rolls and escalation markers) neither. The card text in the interface marks each part that is not built. Removing the five combat cards in the cooperative and solo modes is slice 7's. The Geneticist title's extra card is slice 6's.
- **Scoring** adds the points on owned cards, as a category of the score breakdown.
- **Visibility** (**Q13** for the public hand backs and hidden discards). This is the game's first hidden information:
    - Hands are owner-only, decks and discards host-only, counts and hand backs public. Discards stay hidden: discarding a duplicate of a held card would otherwise show the card held.
    - The deal and the anomaly draw record each Player's cards in metadata that only that Player sees; everyone else sees the deck, as history's "drew a level II fleet improvement". History text comes from that data only.
    - A purchase is private in the Branch and public from the merge, when the card is face up anyway.
    - The deal is information-revealing, so no Undo passes it. Undo inside the development Branch takes a purchase back as now.
    - Exploration from a Player's view needs the population hook to fill other hands, decks and discards from the cards that Player has not seen, keeping each hand's backs and the no-copies rule. Today it copies the projection, which would now be missing those fields.
    - Drawn tech markers stay visible to everyone, as now, although the Vassal module masks them (**Q14**).
    - Checked in the harness's Protected mode from each Player's view, and in the specs by projecting the state and every new Action.
- **Prices** (**Q15**). Settlement and ship discounts can stack below anything printed: the True Path's $3B settlement less Terran Exodus, Spacefaring Populace and Pioneers is $0. Proposal: no price below $1B.
- **The interface** (**Q16**).
    - The development step's action panel shows the Player's hand under their point totals, each card with its cost now. Choosing one gives the tech payment panel, with `Buy with …`; the tech chart stays in the main area.
    - The draw level for each type, with the deck counts, and Transcend's modifier sit under the hand.
    - The faction console shows the Player's owned cards for everyone, with points and text on tap, the backs of their hand for others, and the cards themselves on the viewer's own console at any time.
    - Choices on the map: the Prolific Breeders base and the Cultural Dominance conversion. Hive Mind's tile choice goes in the action panel.
    - The pact editor gains the card's recipient.
    - Harness scenarios: buying (a hand, markers and IP), the deal (a redraw, a duplicate, a short deck), the anomaly card (alone and in a pact), growth with Prolific Breeders, Hive Mind's tile, Planetary Surveys and a protected-view check.
- **No migration.** Stellar Horizons II is unreleased, so the new state fields need none; the harness scenarios are regenerated.

## Slice 5 in detail

Proposed 2026-10-24. Sources: rulebook 1.3 to 1.7, 3.0 (the truce), 4.1, 4.4 and 4.6, the combat and raid tables (`notes/vassal-charts.md` 6.0 and 6.1), the Player Guide's combat example (3.3) and escalation markers (2.5), and the 39 escalation counters (`notes/vassal-inventory.md` 3.10 and appendix A.4). Questions are numbered **Q1** to **Q10**; each has a proposal. The user answered every question on 2026-10-24: Q6 against the proposal, the rest as proposed. What slice 5 builds, and how:

- **Two halves (Q1).** Proposal: build and review it in two halves, each playable and committed on its own. **5a:** the truce, escalation markers and their effects, the discard at initiative, blockades, and the economic phase moved ahead of the transfer drop. **5b:** the combat phase, with its four types and REs, the tables, hits and damage, escalation from combat, and every faction, card and anomaly modifier. 5a draws escalation through blockades, so both halves are exercised as they land.
- **Components.**
    - `src/components/escalation.ts`: the 39 markers. 14 are victory points (two 1s, four 2s, four 3s, three 4s and one 5; the 5's file is named `Escalation 6.png`). 22 are penalties, printed in red. 3 are bonuses, printed in purple. Each marker's effect is data.
    - `src/components/combatTables.ts`: the combat table (20 rows of combat value by the modified die, from 3 or less to 12+) and the raid table.
- **The truce** (3.0). The campaign starts under it. From the end of 2110, a System Action at the end of each turn rolls percentiles: the truce ends on 1% in 2110, rising 1% a turn. While it holds there is no combat phase and nobody can attack. The turn header shows it with the next chance, and history records each roll. The advanced start's 2250 at 10% is slice 7's.
- **Escalation markers.**
    - **The pool.** The 39 drawn at random on the protected stream. Its contents are public, as the event and goods pools are, since every marker drawn is public too. **Q2 (agreed):** drawn markers are public, face up in front of their owner, as owned cards are. The rulebook doesn't say. The Admiral title (slice 6) compares how many each Player holds.
    - **Effects.** All are cumulative and fold into `capabilitiesOf`:
        - Earth production −$2B cash, never below $0, or +1 engineering or physics marker;
        - initiative roll −20%, −30% or −40%;
        - settlements cost +$1B or +$2B on Earth;
        - −$1B or −$2B for each good sold, with the existing $0 floor;
        - migration chance −20% or −30%;
        - You Can't Attack.
    - **Scoring.** A new category of the breakdown: the printed points, −1 for each red marker. The two purple bonus markers score nothing.
    - **Drawing.** The pool may run dry. The drawer then loses 1 IP for each marker they could not draw, ignoring Military Academy's extra one. If they lack the IP, they lose all they have and cannot attack until after the next initiative roll. The other side still gains the full IP.
    - **Military Academy** draws one marker more each time and discards one of those drawn: a choice on the Main Line, made at once.
- **The discard at initiative** (4.1). After the rolls each Player discards half their markers, rounded up (with 1 marker they discard it), keeping the ones they choose. Discards go back to the pool. **Q3:** proposal, choose what to keep in the initiative Branch, beside the IP declaration, and apply it after the rolls. The rolls still use the markers held before the discard, and nothing a roll shows changes which markers are worth keeping. This saves a second wait on every initiative tile. A Player with markers but no IP now has a Branch too. The choice is skipped when every marker goes, or when all the markers have the same effect.
- **Order of the turn.** In the campaign the economic phase moves ahead of the transfer drop, as rule 1.0 orders it. Ships arriving this turn are not yet in their system for a blockade. A new System Action drops the markers after the economic phase, and the arrivals move from `StartTurn`'s metadata into it. Footfall and These are the Voyages keep their order. The combat phase goes between build and cargo in the campaign's phase list.
- **Blockades** (4.4, 4.6). Before base production, and before growth and migration, each Player who can blockade gets a turn on the Main Line, in reverse initiative order. Players who can't are skipped.
    - **The condition.** In their turn a Player blockades any number of systems. In each they name one or more other Players' bases. Their arrived ships' total combat value there must exceed the named Players' ships' combat value plus those Players' settlements there, all together.
    - **Escalation.** The blockader draws 1 escalation marker per base and each blockaded Player gains 1 IP. The decline exception is for combat only. After the review (the user, 2026-10-24): a base already blockaded in the step can't be blockaded again, nor a base where the step does nothing (a "no bases" anomaly or a halting event), and the cards' cash production is halved with the rest.
    - **Effect.** A blockaded base produces half, the whole production (world value, settlement bonus and cards) halved and rounded 0.5 up (Player Guide 1.1). It gets no anomaly production bonus and no anomaly goods. On the growth tile it neither grows nor migrates, and gets no extra growth from cards or anomalies. The True Path's conversion is not growth, so it is unaffected. A blockade lasts for its step.
    - **Combat value (Q4).** Combat value is what a ship's combat value means everywhere: printed, less damage, at least 1 if armed, plus Hypersonic Missiles' +1 for armed CVs. Proposal: Minefields' +3 counts for the blockaded Player, who is defending a system where they have a base. One function serves combat, blockades and the Syndicate's take, so Hypersonic Missiles now counts in the take too.
    - **Q5: blockades and attacks.** The truce forbids attacks; whether it forbids blockades is disputed on BoardGameGeek. The same reading decides whether You Can't Attack, the empty-pool ban, Admiral (slice 6) and Demilitarised Earth (slice 7) stop blockades. Proposal: a blockade counts as an attack for all of these. It draws escalation and gives its victim IP as an attack does, and the truce is there to keep the opening peaceful. The other reading, Ardrosis's: a blockade is not one of the four combat types, so it is allowed throughout.
- **The combat phase** (1.3). On the Main Line in initiative order. Each Player with a legal attack gets a turn; the rest are skipped, and so is the whole phase during the truce. In their turn a Player starts at most one combat in each system where they have arrived ships or a base, in any order, then ends their turn. They can't attack while holding You Can't Attack or while banned by an empty pool.
    - **Q6: REs (agreed).** Destroying an RE is part of the combat rules, and rule 1.5 calls it a combat ("any combat except raids and attacks on REs"), so it uses the system's one combat for the phase (the user, 2026-10-24; BoardGameGeek has no discussion of it). The proposal, a separate allowance, was turned down.
    - **Fleet combat.** The attacker chooses one or more armed, uncrippled CVs and one other Player. All of that Player's arrived CVs defend, unarmed and crippled ones too. The defender may add their base there.
    - **Planetary assault.** The attacker's armed, uncrippled CVs against a base. The defender may add any of their CVs there, armed or not.
    - **Ground combat.** The attacker's base against another base in the system. The attacker can't add CVs; the defender may.
    - **Raid.** One armed, undamaged CV against a base whose owner has no armed arrived CV in the system. Praetorian bases can't be raided.
    - **RE attack** (1.4). An armed, uncrippled CV destroys one RE of the attacker's choice, except at Sol or where the RE's owner has a base or an arrived CV. The owner draws 1 engineering marker, as loss compensation already does.
    - **The defender's answer.** When the defender has something to choose (the base in a fleet combat, CVs in an assault or ground combat) they answer on the Main Line before the dice. Otherwise the dice follow the declaration at once.
- **Resolving** (1.5).
    - **Combat value.** Each side totals its combat value: CVs as above, and a base's settlements up to 30. Minefields adds +3 to its owner's side when they defend in a system where they have a base, whether or not the base is in the combat.
    - **The die.** Each side rolls a die and adds a tenth of the enemy CVs' sizes, fast ones one size smaller (Engine Upgrades makes every ship fast). It adds a tenth of the enemy settlements in the combat, up to 30. Then the modifiers:
        - Praetorians +1;
        - Military Academy +1;
        - Enhanced Strength and Increased Body Size +1 in assault and ground combat, attacking or defending;
        - Reduced Body Size −1 in the same;
        - Subterranean −2 to the opponent's assault and ground rolls when its owner defends;
        - Hypersonic Missiles −1 to the opponent's assault and raid rolls when its owner defends;
        - Tunnel Complex −1 to the opponent's assault, ground and raid rolls of a Player with a base there (**Q7**: proposal, attacking or defending; in a ground combat there both sides take it).

        The total is rounded once, 0.5 up, as in the Player Guide's example (7.5 is 8), and read against the side's combat value on the table. The roll and every modifier go to history.

    - **Q8: Praetorians with Military Academy.** The raid text says "+1 for Praetorians or Military Academy". Proposal: they add, +2, since each says "+1 to combat rolls" and card bonuses stack with each other (slice 4, Q6).
    - **Hits** (**Q9**). Hits on the attacker are assigned first, the attacker, defender and attacker taking turns one hit at a time; then hits on the defender, starting with the defender. A hit is 1 damage to a CV in the combat or 1 settlement off a base in it. A CV whose damage reaches its capacity is destroyed, with its cargo and the usual compensation. A base that loses its last settlement is gone, as today. Hits left over once every unit is gone are lost. Proposal: one Action per hit, as the rule alternates them. A hit is placed for the Player when only one unit can take it, when the choices are alike (settlements of one base, or undamaged ships of one kind), and all at once when the hits are enough to destroy every unit. The faster alternative is a house rule: each Player assigns all the hits on their own units.
- **Raids** (6.1). The raider rolls a die (Praetorians and Military Academy +1; Hypersonic Missiles and Tunnel Complex −1) and percentiles.
    - **The Syndicate** may then lower its die to any smaller result, even one that cannot apply (the table's note).
    - **Results:**
        - 1–2 steal $1B;
        - 3–4 steal $2B, or $1B from a Player with only $1B;
        - 5–6 steal a random marker of a type the raider chooses among those the victim holds;
        - 7–8 take a good of the raider's choice from the base, into the raider's cargo if there is room, or destroy it for $1B;
        - 9 or more destroy a settlement, never the base's last.

        A result that can't apply has no effect.

    - **Damage.** Then the raider takes 1 damage at 25% or less (20% if fast), or 2 at 10% or less, and may be destroyed, losing what it stole into cargo.
- **Escalation and IP** (1.7). After each combat the attacker draws 1 marker, +1 for each defending CV destroyed, +0.5 for each defending settlement destroyed (at the base or in a destroyed CV's cargo), +2 for eliminating the base and +2 at Sol, rounded once, 0.5 up. Only the defender's losses count, as in the Player Guide's example. A raid with no effect draws nothing. An RE attack draws 1. The defender gains IP equal to what the attacker should have drawn.
    - **The decline exception.** Each ship records the Players it attacked this turn and last turn. When the defender's side included a ship that attacked the attacker, the attacker chooses whether to draw. Declining gives the defender no IP. The choice is offered only then, since markers can be worth points (and Warlord, slice 6, wants six).
    - Combat challenges at anomalies and events stay out of all this (designer ruling), as now.
- **Interface.**
    - **The combat step.** Systems where the Player can attack get map targets. Choosing one opens the action panel with the combat types and targets possible there, then the CVs to send, shown with their combat value and size. The defender's answer goes in their panel.
    - **Q10: the combat panel.** Proposal: a panel in the main area beside the map while a combat resolves, rather than in the zoomed system view. It shows both sides' units with damage, the two rolls with each modifier, the table lookup and the hits left to assign. The Player assigning a hit taps a unit in it.
    - **Raids.** The raid result shows both dice, then the Syndicate's lower-result choice, the marker type and the good, all in the panel.
    - **Escalation.** The decline choice and Military Academy's discard go in the action panel. Escalation markers sit on each faction console, face up. The initiative step gains the keep-which choice.
    - **Blockades.** Map targets for systems where the Player can blockade, then a list of the bases there with the combined value to beat.
    - **The truce** in the turn header.
    - Combat history entries read like the Player Guide's example, for example "Praetorians attack the Consortium base at Luhman 16 with Odyssey and Gladiator; Sapphire defends". They give each roll in full: the die, the modifiers, the total and the hits.
- **Harness scenarios.** For 5a: the truce roll, the discard at initiative, a blockade at production and at growth, a multi-Player blockade, and an empty escalation pool. For 5b: one of each combat type, an RE attack, a raid of each result with the Syndicate's choice, hit assignment with a crippled and a destroyed ship, a base eliminated, the decline exception, Military Academy's discard, and each card modifier.
- **Card text.** The `waits` notes come off Minefields, Enhanced Strength, Hypersonic Missiles, the body sizes, Subterranean, Military Academy and Tunnel Complex's back as each part lands.
- **Later slices.** The Admiral and Warlord titles and combat directives are slice 6's. Demilitarised Earth, the advanced start's truce and removing combat in cooperative and solo play are slice 7's.
- **Online length.** After the truce the combat phase is one more wait each turn for every Player with a legal attack, and a combat adds the defender's answer and the hit assignment. Blockades add a wait on two of the seven tiles, for Players who can blockade.
- **No migration**, as before: the game is unreleased, and the harness scenarios are regenerated.

## Rulings to make

The rulebook leaves these open. Each is decided in its slice, recorded in `docs/rules-interpretations.md` with the reasoning, and raised with you:

- Base production of tech: read as that many tech markers of the chosen type (the highest research value of that type in the system, plus the tech bonus), as rule 4.4 says "cash or tech markers produced". Agreed 2026-10-18.
- The largest base bonus when Players tie: each tied Player gets it. Agreed 2026-10-18.

- The truce: whether blockades are allowed during it (disputed on BoardGameGeek): slice 5, Q5.
- "No exploration" anomalies also block mining and research. Agreed 2026-10-18.
- Rounding follows the Player Guide (1.1): halve or double before adding or subtracting, and round only the final value, 0.5 up. This settles escalation discards, fractional combat modifiers and half escalation markers. Agreed 2026-10-18.
- Terraforming tile disposal with two draws.
- Prolific Breeders past the population limit and Cyborg Species against the Cloning tech: slice 4, Q10 and Q7. Mastermind's difficulty with or without the Player count.
- Player-to-player deals: cash, goods and IP transfers. Proposal: none beyond joint pacts and the rulebook's payments.
- Whether a card bought this turn discounts techs bought this turn: slice 4, Q2. Proposal: no, since purchases are simultaneous.
- Several surveys reaching one system in a decade: whether the later ones still draw worlds and roll for anomalies (the community says yes).

## Decisions

1. **Cargo transfer and trade in the campaign.** Agreed 2026-10-17: the whole phase on the Main Line in initiative order, because selling takes the shared demand marker and the rulebook lets a Player sell and then buy settlements in either order. The alternative keeps cargo as an Ordered span and adds a trade step on the Main Line after it, which is faster online but stops a Player selling first and spending the money on settlements in the same phase.
2. **Joint resolution** as the pacts above, for the campaign and for These are the Voyages. Agreed 2026-10-18, with every Common Actions decision in `docs/parallel-spans.md`.
3. **The slice order** above. Agreed 2026-10-17.

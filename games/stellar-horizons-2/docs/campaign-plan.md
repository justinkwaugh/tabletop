# Stellar Horizons II campaign: plan

Status: proposed 2026-10-17. Slice 1 built and reviewed 2026-10-18; slice 2 started 2026-10-18. Decisions 1 and 3 agreed 2026-10-17; decision 2 agreed 2026-10-18, with Common Actions in the engine. The campaign is rule 3.0 and every blue box of the Compass Games rulebook (December 2023 print). Sources are in `/workspace/artassets/stellar-horizons-2` (outside git): `notes/rulebook-p01-10.md`, `notes/rulebook-p11-19.md`, `notes/player-guide-pp3-5-7-8.md`, `notes/forum-rulings.md`, and the component transcriptions in `notes/vassal-inventory.md` (appendices A to C) and `notes/vassal-charts.md`.

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

Card hands, unfulfilled directives and the order of every pool and deck are hidden. Each Player's drawn tech markers are hidden in the Vassal module (masked); the physical rules do not say. The current game shows them. Proposal: keep them visible, as now, unless you want them hidden.

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
- **Mining and research** (1.17): exploration actions for mining or research ships in a system with a revealed world and none of the Player's bases; no malfunction roll (designer ruling). "A system may be mined or researched only once per turn" is read as once per Player, since Players explore unseen by each other (proposed; raised with the user). Mining earns $1B, or $2B on a die at or under the world's cash value; research earns a marker of the world's type on a die at or under its research value plus half the ship's exploration value, rounded up.
- **The Syndicate's take**: $1B from a Player mining or researching where the Syndicate has more ship combat value, settled after the span.
- **Terraforming with mining ships** (1.18): with Atmosphere Processing, as an exploration action, any number per system; the draws settle after the span in initiative order, like surveys.
- **Starfarers and Syndicate** anomaly and event difficulty, as slice 1 has it (science −1, combat −2).

## Rulings to make

The rulebook leaves these open. Each is decided in its slice, recorded in `docs/rules-interpretations.md` with the reasoning, and raised with you:

- Base production of tech: read as that many tech markers of the chosen type (the highest research value of that type in the system, plus the tech bonus), as rule 4.4 says "cash or tech markers produced". Agreed 2026-10-18.
- The largest base bonus when Players tie: each tied Player gets it. Agreed 2026-10-18.

- The truce: whether blockades are allowed during it (disputed on BoardGameGeek).
- "No exploration" anomalies: whether they also block mining and research.
- Escalation discard rounding (the community rounds half up, as the Player Guide's rounding rule does).
- Fractional combat modifiers and half escalation markers: the Player Guide's rounding, applied once to the final value.
- Terraforming tile disposal with two draws.
- Prolific Breeders past the population limit; Cyborg Species against the Cloning tech; Mastermind's difficulty with or without the Player count.
- Player-to-player deals: cash, goods and IP transfers. Proposal: none beyond joint pacts and the rulebook's payments.
- Whether a card bought this turn discounts techs bought this turn. Proposal: no, since purchases are simultaneous.
- Several surveys reaching one system in a decade: whether the later ones still draw worlds and roll for anomalies (the community says yes).

## Decisions

1. **Cargo transfer and trade in the campaign.** Agreed 2026-10-17: the whole phase on the Main Line in initiative order, because selling takes the shared demand marker and the rulebook lets a Player sell and then buy settlements in either order. The alternative keeps cargo as an Ordered span and adds a trade step on the Main Line after it, which is faster online but stops a Player selling first and spending the money on settlements in the same phase.
2. **Joint resolution** as the pacts above, for the campaign and for These are the Voyages. Agreed 2026-10-18, with every Common Actions decision in `docs/parallel-spans.md`.
3. **The slice order** above. Agreed 2026-10-17.

# Ride the Rails rulings

The code cites the rules as `R-<section>` of `rules-digest.md`. A citation ending in `-H1` or `-H2` names one of the house rulings below, made where the rules are silent or ambiguous. `R-X.<n>` names a rule of this implementation. A ruling marked _provisional_ awaits the publisher's answer; it stands until answered. Each ruling names the spec that covers it.

Rules version: the 2020 rulebook (USA map). Each ruling names the question in `open-questions.md` it settles, where its readings and sources are given in full.

## House rulings

### Components and setup (R-1)

- **R-1.1-H1** (Q6), _provisional_: the 27 locomotives of each colour are a hard limit on shares and track together. Once every locomotive of a colour is on player boards and the map, no more shares of that railroad can be taken and no more of its track built; phase 1's "must take" means one of an available railroad that still has locomotives in the supply. Rejected: an unlimited supply. Spec: `supply.spec.ts` (the count), `takeShare.spec.ts` (a share from an empty supply), `placement.spec.ts` (track from an empty supply), `completeGame.spec.ts` (supplies emptied in whole games, and a building turn that opens with nothing legal).
- **R-1.2-H1** (Q2): the game takes 3 to 5 players, as printed. Rejected: an unofficial 2- or 6-player mode, for which the rules give no placement limits. Spec: `initializer.spec.ts`, `competition.spec.ts`.
- **R-1.3-H1** (Q3): setup places one passenger on every city. The USA map has 51 cities and the box 52 passengers, so the supply never runs short. Spec: `initializer.spec.ts`.

### Turn structure (R-2)

- **R-2.5-H1** (Q4): when players tie on money at the end of a round, the tied players reverse their relative order from the round just played ("swap player positions"); with three or more tied, their previous order is reversed. Rejected: tied players keep their relative order. Spec: `endOfRound.spec.ts`.

### Actions (R-3)

- **R-3.1-H1** (Q7): there is no cap on the shares of one railroad a player may hold. Rejected: the player board's row length as a cap. Spec: `takeShare.spec.ts`.
- **R-3.3.1-H1** (Q5): a player with no passenger they can carry on a legal journey passes phase 3 and earns nothing. The pass is offered only when no legal journey exists. Rejected: treating the case as impossible. Spec: `routes.spec.ts` (whether a journey exists), `rideTheRails.spec.ts` (the pass), `handlers.spec.ts` and `round.spec.ts` (the pass offered only then).
- **R-3.3.2-H1** (Q22): a link runs between two cities with no city between them, so a railroad's track through a city is two links, every city passed through is visited and counted, and a route changes railroad only in a city. This keeps "links + 1 = cities visited" true. Rejected: one railroad's run from start to end as one link however many cities it passes. Spec: `routes.spec.ts` (links and changes of railroad), `rideTheRails.spec.ts` (dividends and fare).

### Starting a railroad (R-4.2)

- **R-4.2.3-H1** (Q14): Yellow makes one start, in Chicago or in one of the three westernmost occupied cities ("and/or" read as a choice of where, not a second start). Its first locomotive goes there, and every later one must be adjacent to a Yellow locomotive (R-4.1.2), as for every railroad. Rejected: two starts, one in each. Spec: `startRailroad.spec.ts`, `placeLocomotive.spec.ts` (a second start refused in the same building turn and a later one, both ways round, and only hexes next to Yellow's track lit after its start).
- **R-4.2.3-H2** (Q15): the three westernmost occupied cities are the cities holding at least one locomotive whose hexes lie furthest west by horizontal position (the lowest `dcol`, `components.md`), with every city tied with the third included. A city among them that cannot take Yellow (it holds two locomotives, or is a one-locomotive city already filled) still counts among the three. Rejected: breaking ties by another order, such as north first. Spec: `startRailroad.spec.ts`.
- **R-4.2.5-H1** (Q16): Black may start in any city with room for it under the city's capacity, or in Chicago. On the USA map every city is drawn black or shows Black among its colours, so the question of cities that show no Black does not arise; an East Coast start still counts toward Black's two East Coast cities. Spec: `startRailroad.spec.ts`, `placement.spec.ts` (an East Coast start counted).

### Building bonuses (R-4.3)

- **R-4.3.2-H1** (Q8): a $5 city's bonus goes with the first locomotive placed in the city. A railroad that starts there uses the bonus up without earning it, and no railroad that later builds in earns it ("No bonus is given … if a Railroad starts in the city"). Rejected: a start not counting as "building into" the city, so that the first railroad to build in from a neighbouring hex still earns $5. Spec: `bonuses.spec.ts`, `bonusPlaythrough.spec.ts` (a Black start in a real game).
- **R-4.3.3-H1** (Q19): the Transcontinental needs a line of at least two different railroads; two railroads connect where both have a locomotive in the same hex, and locomotives of different railroads in adjacent hexes do not connect. A line is a walk over connected track and may pass a hex more than once, so a railroad may carry it out and back. Rejected: one railroad alone crossing coast to coast. Spec: `transcontinental.spec.ts` (the line search, a hex passed twice), `bonuses.spec.ts` (the placement that pays).
- **R-4.3.3-H2** (Q20): the Transcontinental pays $12 if some line it completes changes railroad only in city hexes, and $8 otherwise. It goes, once, to the player whose placement first completes any qualifying line. Rejected: pricing by the junction the completing placement made. Spec: `transcontinental.spec.ts` (a line's price), `bonuses.spec.ts` (the placement that pays, once), `bonusPlaythrough.spec.ts` (both prices and the claim, in real games).

### Information and undo (R-5)

- **R-5-H1** (Q24): a player may take back any of their own actions until the next player acts: each placement, with any bonus it paid; a share; a journey. Nothing is hidden or random after setup, so no action reveals information. Rejected: no undo. Spec: `takeShare.spec.ts` (a share), `placeLocomotive.spec.ts` (a placement with its bonuses, and one that ended the building turn), `endBuilding.spec.ts`, `undo.spec.ts` (each kind of action, and the cascades undone with their cause), `walk.spec.ts` and `completeGame.spec.ts` (whole games undone action by action), and in the UI `session.spec.ts` (Undo closes an open railroad popup before it takes back a placement).

### Game end (R-6)

- **R-6.2-H1** (Q25): players tied for the most money share the win. Rejected: a tie-break by turn order or shares held. Spec: `scoring.spec.ts`, `competition.spec.ts`; the history line naming every winner, `describeAction.spec.ts`.

### Maps (R-8)

- **R-8-H1** (Q1): this release plays the USA map only, so there is no map option at game creation. The game state keeps a map id, so the expansion maps can add the option later. Spec: `initializer.spec.ts`.

## Rules of the implementation

- **R-X.1:** every choice arrives as explicit input from the player it belongs to; the engine infers none.
- **R-X.2:** undo stops at an action that revealed information: one that advanced the random stream, moved a card into or out of concealment, or showed a player something they had not seen.
- **R-X.3:** a game keeps the rules of the revision it was created under (`rideTheRailsRevision`, set at initialization). Revision 1 is the first release. A state from a revision this code does not know is refused at hydration, and the provisional rulings are pinned as revision 1 plays them, so changing one needs a new revision. Spec: `gameState.spec.ts` (the unknown revision), `revision.spec.ts` (R-1.1-H1 and R-4.2.3-H1 under revision 1).

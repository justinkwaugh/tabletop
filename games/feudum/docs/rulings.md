# Feudum rulings

The code cites the rules as `R-<section>` of `rules-digest.md`. A citation ending in `-H1` or `-H2` names one of the house rulings below, made where the rules are silent or ambiguous. `R-X.<n>` names a rule of this implementation. A ruling marked _provisional_ awaits the publisher's answer; it stands until answered. Each ruling names the spec that covers it.

Rules version: the December 2018 English rulebook with the designer's later answers. Each ruling names the question it settled; its readings and sources were set out in `open-questions.md` when it was asked. Specs are named as planned and are written with the code.

## House rulings

### Components and setup (R-1)

- **R-1.1-H1** (Q3): shillings are limited to the 78 in the box (50 coins), like every other component; a payment from the supply when it runs short pays what remains. Rejected: unlimited money. Spec: `supply.spec.ts`.
- **R-1.2-H1** (Q25), _provisional_: the roads and the ship, submersible and flying-machine routes are those of the community map aid, until a clear picture of the board confirms or corrects them. The three ferry routes are read from the board. Spec: `boardMap.spec.ts`.
- **R-1.4-H1** (Q2): 2 to 5 players; with 2 or 3 players, dummy Knight rows are added in unused colours until there are exactly 4 rows. Rejected: a dummy row for every unused colour. Spec: `initializer.spec.ts`.

### Actions (R-3)

- **R-3.1-H1** (Q4): all players choose their hands at the same time, but finalise ("Long live the king") in turn order: a player cannot finalise until every earlier player has, and each player's pouch good becomes public when they finalise. Rejected: fully simultaneous selection with pouch goods revealed together. Spec: `selectHand.spec.ts`.
- **R-3.2-H1** (Q5): a player who has played all chosen cards is skipped until everyone has. Spec: `turnOrder.spec.ts`.
- **R-3.4-H1** (Q1): every game uses the advanced rules; there is no basic-game option. Rejected: a basic-game table option. Spec: `actions.spec.ts`.
- **R-3.10-H1** (Q8): Explore draws 2 Royal Writs plus 1 per outpost or feudum ruled beyond the first outpost. Rejected: 1 plus outposts ruled. Spec: `explore.spec.ts`.
- **R-3.11-H1** (Q9): favours are drawn at random from the haversack; only Inspect the Harvest lets a player choose them, holding a bead or not. Spec: `harvest.spec.ts`.
- **R-3.13-H1** (Q11): Conquer may not be a player's last card played in the round; a card that player plays later in the round, including the second card of a sequential turn, makes it not last. A Conquer left as a player's only card is played with its action forfeited. The hand picker warns when a hand puts Conquer at risk of being last. Spec: `conquer.spec.ts`.
- **R-3.14-H1** (Q12): whenever a player holding an unplayed Defend has a piece attacked, or a subject or serf starved, the game asks them whether to flip it, whatever the odds. Rejected: asking only when it could change the result. Spec: `defend.spec.ts`.

### Mechanisms (R-4)

- **R-4.3-H1** (Q20): when an improvement's tile is prohibited, the improving player chooses which stack to take an earlier-epoch tile from, among those that have one on top. Spec: `regionTiles.spec.ts`.
- **R-4.4-H1** (Q13): Royal Writ mandates and wild region tiles may be used on the player's own turns, during hand selection and nourishing, and (weapons) during the player's own attack; a wild tile is also offered whenever a payment would otherwise fall short. Rejected: out of turn at any moment. Spec: `royalWrits.spec.ts`, `regionTiles.spec.ts`.
- **R-4.5-H1** (Q18): after anything changes status stars, each guild's ranks are recomputed from the new totals; a current holder keeps a space against a tie. Rejected: applying bumps player by player. Spec: `guildStatus.spec.ts`.
- **R-4.6-H1** (Q14), _provisional_: the Noble trade sells king's seals from the guild's scrolls; with no seal there, there is nothing to buy. Rejected: from the general supply. Spec: `guildTrade.spec.ts`.
- **R-4.6-H2** (Q15): the hidden-bead draw (Monk trade, Farmer pull, Monk push) picks one of the highest- and lowest-valued beads at random; no opponent arranges them. Listed in `known-deviations.md`. Spec: `beads.spec.ts`.
- **R-4.6-H3** (Q16), _provisional_: the apprentice's share from the Farmer, Merchant and Alchemist guilds goes to the church coffer; from the Knight, Noble and Monk guilds, to the farmer's purse. Spec: `guildTrade.spec.ts`.
- **R-4.6-H4** (Q17): the krud barrel prices (1st, 2nd, 3rd) count barrels within one action, so a Knight pull's barrel always costs the first price. Rejected: counting barrels across the game. Spec: `alchemist.spec.ts`.
- **R-4.6-H5** (Q19): a push or pull moves as many of the stated items as fit, at least one, and scores the level it reaches. Rejected: unavailable unless all fit. Spec: `guildFunctions.spec.ts`.
- **R-4.7-H1** (Q24): reeves score only when the push or pull reaches a threshold. Spec: `reeves.spec.ts`.
- **R-4.8-H1** (Q10): every piece the attacker and the defender have on the space joins the combat. Rejected: the attacker choosing which of theirs join. Spec: `combat.spec.ts`.
- **R-4.9-H1** (Q21): after each successful Conquer or Starve the People the player is asked whether to place a military service disc. Spec: `militaryService.spec.ts`.
- **R-4.11-H1** (Q6): the epoch marker, and with it which region tiles are legal, changes only at step 4 of the round, even when an improvement met the condition earlier. Rejected: changing the moment the condition is met. Spec: `epochs.spec.ts`.

### Information (R-5)

- **R-5-H1** (Q22): king's seals red side up keep their bead values hidden from everyone, their holder included, until flipped; the supply of seals is a hidden shuffled pile, and a seal returning to it goes in red side up and the pile is reshuffled. Spec: `visibility.spec.ts`.

### Game end (R-6)

- **R-6.1-H1** (Q7): when epoch V is triggered, the round's remaining cards are played, pawns are nourished, the die is not rolled, epoch V's dawn is scored, then final scoring. Spec: `gameEnd.spec.ts`.

## Rules of the implementation

- **R-X.1:** every choice arrives as explicit input from the player it belongs to; the engine infers none.
- **R-X.2** (Q23): undo stops at an action that revealed information: any haversack draw, any Royal Writ draw, the progress die, a seal flipped to a bead, the hidden-bead draw, a finalised hand, and any action that passes a decision to another player (an attack that may be defended, a starve that may be resisted).
- **R-X.3:** a game keeps the rules of the revision it was created under (`feudumRevision`, set at initialization). Revision 1 is the first release.

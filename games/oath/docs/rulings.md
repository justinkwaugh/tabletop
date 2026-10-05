# Rulings

The code cites the Law of Oath as `R-<section>`. A citation ending in `-H1` or `-H2` names one of the
house rulings below, where the Law is silent or ambiguous. `R-X` names a rule of this implementation.
A ruling marked *provisional* is a question put to the publisher's community; it stands until answered.

- **R-2.11-H1:** the Oathkeeper title is re-evaluated after every action, so it can change hands mid-Campaign. Each change is recorded as its own System Action (`TransferOathkeeper`) in games created at the turn-flow revision or later.
- **R-3.3-H1:** the end die is the Chancellor's roll. In games created at the turn-flow revision or later, a round that ends in rounds five to seven with the Chancellor or a Citizen holding the title waits in `EndOfRound` on the Chancellor's `RollEndDie`; until it is rolled, the last seat's turn can be undone.
- **R-3.2-H1:** a tie is not a win: a Vision's "the most" means strictly more than every other player.
- **R-4.1.1-H1:** the People's Favor never drops below one favor during the Wake.
- **R-4.1.4-H1:** an Opportunity site offers only what its own card prints.
- **R-4.3-H1:** in games created at the turn-flow revision or later, the Rest Phase waits on its player only while they hold a Rest power they can use (one with a choice the engine accepts, a bank power needing a bank with favor); otherwise the Rest resolves as a System Action after End the Act Phase.
- **R-4.3.4-H1:** a Supply gain stops at the track's last space; the excess is lost.
- **R-5.5.3-H1:** defending bandits use the cost-free battle plans at every site they rule, not only at the targeted ones.
- **R-5.5.5-H1:** the attacker chooses which of their own warbands die, from their board or a site in their force: the skulls' kills in an order declared with the Campaign, the sacrifice and the defeated half picked after the roll.
- **R-5.5.6-H1:** in games created at the turn-flow revision or later, a defeated defending side is asked to choose its losses only when the choice can change the outcome: the force mixes owners, or part of it stands on a board. Otherwise the engine kills the default and the Campaign moves on, since every survivor goes to its board (R-5.5.6).
- **R-6.4-H1:** the Grand Scepter's holder knows every Reliquary relic, since they may peek at will: from setup, and at once when the Scepter changes hands; a former holder keeps what they saw.
- **R-7.1.1-H1:** a relic in a player's bank is in reach the way an adviser is; a relic is held, never ruled.
- **R-7.1.2.a-H1:** a card's occupancy bar is checked once, before the cost is paid.
- **R-7.1.4-H1:** an always-on power without the persistent braid is continuous and binds only its holder: faceup advisers and held relics.
- **R-7.1.4-H2:** a persistent power's "you may" is a trigger: its holder is asked, and the interrupted turn waits.
- **R-7.2.2-H1** *(provisional)*: Pilgrimage leaves a locked denizen at the site, and it does not count toward the number drawn.
- **R-7.5.4-H1:** a battle plan's ± is by side, adding for the attacker and subtracting for the defender.
- **R-7.6.3-H1:** a card's binding exchange enforces what changes hands at once, not promises of later actions, and has no manual override.
- **R-7.6.3-H2:** at The Gathering, proposals come after the pawns have moved, one per present player in turn order.
- **R-9.4-H1:** a player may let another peek at any time, except while the game waits on that player's own decision.
- **R-10.2-H1** *(provisional)*: simultaneous triggers resolve clockwise from the acting player.
- **R-10.5-H1** *(provisional)*: favor and secrets on the denizens Pilgrimage moves return as on a discard, favor to the matching bank and secrets to the acting player.
- **R-10.11-H1:** a banner given, by Citizenship terms or Ancient Pact, changes hands and nothing else happens: R-2.5.3's penalty is for a banner taken, per the banners' Q&A.
- **R-10.28-H1:** in a battle plan, "you" covers the user's side: an Imperial user counts what any Imperial player holds, and Code of Honor bars the rest of the side.
- **R-11.2-H1:** a relic taken through a Homeland site is taken as a Recover takes it, so "after a player takes relics" powers fire.
- **R-X.1:** every choice arrives as explicit input from the player it belongs to: another player's permission, a Citizen's joining a defence and a defeated defending side's losses are each that player's own answer to a request; the engine never infers one.
- **R-X.3:** undo stops at an action that revealed information: (a) it advanced the random stream, (b) it moved a card into or out of the vault, or (c) it showed a player a card they had not seen (a faceup play or flip, a Dream Thief swap, a facedown adviser exchanged).
- **R-X.4:** a game keeps the rules of the revision it was created under (`oathRevision`, set at initialization). A state without one was created before the first revision and keeps that flow to its end, so its stored actions replay unchanged. Revision 1 is the turn flow. Revision 2 counts the secret a Trade for favor places in the total of what the Trade costs (R-7.1.2), so a Trade the player cannot pay in full is refused; before it, a Master of Disguise Trade for favor with one secret was accepted and left the player at minus one. Revision 2 also applies Search modifiers to a facedown adviser's play (R-6.1: "Restrictions and modifiers apply"): the holder's mandatory ones that act on the play (Book of Records on a site play) and any declared with it that act on the play itself; one that changes a Search's draw, cost or pile is refused, since this play draws nothing, and Welcoming Party is refused by its own text. Before it, such a play took no modifier. Revision 3 charges Forced Labor's toll on a facedown adviser's play or discard, as its Q&A rules (R-6.1 is "as if you searched"): the favor is listed with the play, totalled with its modifiers and the Conspiracy's secret, and without a favor to give the play is refused. Revision 3 also gives Land Warden's second card the Search's carried modifiers, so Book of Records gains a secret, not favor, for each card played to a site. Revision 3 also totals a side's battle-plan costs (R-7.1.2): the plans are paid in the order declared from one holding, each printed cost and then any cost an enemy's card adds (Gleaming Armor, Insect Swarm), after the secret The Hidden Place flips, and a declaration that holding cannot pay is refused. A favor burned while its payer holds Vow of Renewal comes straight back to them and pays the next plan (its FAQ makes a burn free for its holder). Before it, a facedown play paid no toll, the second card took no modifier and each battle plan was checked alone.

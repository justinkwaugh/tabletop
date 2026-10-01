# Sequenced Out-of-Turn Actions are ordered and undone like other User Actions

Some rules let a Player act outside their turn in ways later Actions depend on, such as exchanging a private for a share during another Player's turn. A Game Title declares such an Action type with the schema literals `outOfTurn: true` and `sequenced: true`: the Game Runtime accepts it from any seated Player as it does any Out-of-Turn Action ([ADR 0007](0007-out-of-turn-actions.md)), but places it in the Action history and undoes it like any other User Action, so it blocks another Player's Undo and is not re-applied after a suffix reversal. An Action carrying `sequenced` whose type does not declare both literals is rejected, and a sequenced type cannot be supersedable ([ADR 0008](0008-supersedable-actions.md)), because supersession requires the replaced Action to have had no dependents.

A Player acting outside their turn can race another Player from the same Game State. When a Sequenced Out-of-Turn Action is involved on either side, the host records the later arrival after the Actions it raced if a Commutation Proof succeeds, and otherwise rejects it as stale; a Sequenced Out-of-Turn Action is never accepted from a stale index without that proof. Races arise only when separate clients submit to a host, so a Local Game needs no proof.

## Considered Options

- **Adding the eligible Player to the Active Players.** Shikoku 1889's exchange first worked this way. Ordering and Undo are correct, but the site reads Active Players as the Players a Game is waiting on, so the eligible Player receives turn notifications and appears on turn.
- **A plain Out-of-Turn Action.** A stale index and re-application after Undo are sound only for declarations without dependents; an entangled Action could apply to a state its Player never saw, or change meaning when re-applied.
- **Always rejecting a stale race.** Simpler, but it discards a Player's decision whenever an unrelated Action lands first. Equal final Game States alone would not justify reordering; the proof also requires each Action's own consequences to be unchanged, so every Player receives the outcome they saw when they acted.

## Consequences

The host's reply tells a Game Client when its Action was recorded after Actions it raced by returning those Actions as missing Actions, which a Game Session already places before its own. The reconciled Action is adopted without an error, and the Game UI Host Bridge Contract ([ADR 0004](0004-game-ui-host-bridge-contract.md)) is unchanged. The Game Runtime that enforces these rules runs in the host as well as in each UI Artifact, so the host must be deployed first; a Game Title adopting a sequenced type then republishes its Logic and UI Artifacts together.

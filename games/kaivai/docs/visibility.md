# Kaivai protected visibility

New Games register state and complete Action projection and use `randomnessVersion: 1`.
Normal `bids`, resources, board positions, setup, and realized fishing outcomes stay public.
The shared projector conceals the master seed and replaces the protected PRNG with its neutral
representation. Both editions use version-aware protected randomness for randomized fishing,
including Less Luck variants. Luckless fishing consumes no randomness.

## Final island bidding

New states use `scoringBids`, an array of submitted `{ playerId, amount }` records. The record
and player identity are public; `Policy.Owner` conceals each amount from other Players and
spectators. `bidders` and `activePlayerIds` track outstanding submissions. Legal discovery and
submission checks use these public identities, never another Player's amount.

`PlaceScoringBid.amount` is permanently actor-private in delivered history. A last submission
transitions to FinalScoring before the queued `ScoreIsland` executes; its bids remain concealed
at that intermediate boundary. `ScoreIsland` is the information-reveal barrier and publishes
all amounts as `metadata.playerMajorities[].influence`, together with huts, boats, winners,
and awards. The handler then clears the pending records. Results and history render this
public snapshot rather than recovering amounts from old submission records.

Canonical validation requires an amount on every submitted record. The derived projected
schema permits its omission, and hydration preserves that omission. Ordinary bids and
nonfinal owner submissions can execute locally; resolving a round with unknown bids and
randomized fishing require authoritative execution and permitted replay patches.

## Exploration

Population receives only the selected projection and fresh sampling randomness. It preserves
known bid amounts and samples each omitted submitted amount from zero through that Player's
public influence. It does not invent submissions. The shared Exploration preparation removes
the source master seed and supplies fresh public and protected entropy before either projected
or Host View population. Earlier source positions are not constrained by later scoring reveals.

## Compatibility and publication

`scoringBids` is optional solely for existing saves. Its absence retains the legacy scoring
`bids` map and its historical Action/Undo shape. New initialization always creates the array;
ordinary round bids continue using the original map. No latest-state migration is needed.
Unmarked Games, including legacy v1/v2 and interim v3 Games, retain canonical delivery.
Version-aware fishing preserves the historical public random stream for v1/v2.

Adoption requires matching new Kaivai Logic and UI Artifacts. A Logic major bump and the UI
major reload mechanism are required at publication so already-loaded clients cannot continue
with the old bid storage and fishing implementation. No host bridge or Site Frontend contract
changes are needed. Package versions are not bumped here, and no artifacts are published.

Conformance tests cover state/Action privacy, the last-submission boundary, both editions'
public reveal, permitted history replay and reversal, canonical rejection of omitted amounts,
legacy map continuation, Exploration constraints, dice protection, and projected legal discovery.
Chromium harness tests exercise ordinary and scoring bidding across Player, spectator, and
Host views. Hosted transport authorization and mixed published artifacts remain release checks.

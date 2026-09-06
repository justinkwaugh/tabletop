# Lowenherz: private inspection and Exploration

Implemented 2026-09-06. Lowenherz 2.0.0 uses face-based politics cards, explicit state/action projection, protected initialization, and constrained hypothetical Exploration. Fresh Fish and Sol provide the shared-platform precedents.

## Design

Record what was actually revealed in permitted Action History. Give the current inspector an owner-visible inspection snapshot for selecting a card. When starting Exploration, assign the thirteen politics cards to hypothetical acquisition events and remaining pile positions, constrained by those observations.

This needs no general belief-state subsystem and no policy that remembers previous requests. The title owns the card constraints; the shared platform continues to own authenticated projection, guarded execution, History, and Exploration persistence.

## What the existing rules allow

The [politics deck](../games/lowenherz/src/definition/politicsCards.ts) has thirteen cards. Each starts in one of two piles, is acquired once, and can later be discarded. Current rules have no politics-card transfers between players, returns to piles, or pile reshuffles during play. The [initial deal](../games/lowenherz/src/util/politicsCardAssembly.ts) produces piles of six and seven cards.

An inspector sees an entire pile and chooses a card; order within that pile is irrelevant. [Taking the card](../games/lowenherz/src/actions/takePoliticsCard.ts) clears the active inspection. That clearance must not erase the recorded observation or pretend the player has forgotten it.

Cards leave hands through [alliance play](../games/lowenherz/src/actions/playAllianceCard.ts), [renegade play](../games/lowenherz/src/actions/playRenegadeCard.ts), a winning [duel bid](../games/lowenherz/src/stateHandlers/dueling.ts), or [treasure payment for a wooded knight placement](../games/lowenherz/src/actions/placeKnight.ts). Losing and tied duel bidders retain their treasure cards, even though the completed round reveals them. Parchments remain in hand until final scoring.

These one-way movements make a small assignment model possible. Revisit that model if rules later add trading, card returns, or reshuffling.

## Three distinct representations

| Representation | Contents and purpose |
| --- | --- |
| Canonical state | Actual piles, hands, bids, and deck; authoritative rules execution |
| Current player projection | Public counts/results, that player's hand and bid, and any active inspection snapshot |
| Permitted history | Public events plus that player's private inspection and acquisition records, through the selected source position |

Do not project the actual current pile to someone merely because they inspected it earlier. A later opponent's hidden removal would then reveal which card disappeared. Keep the old observation immutable; it is a fact about the time of inspection, not a live view of the pile.

Likewise, do not copy an opponent's current canonical hand into an inferred-hand field. Deduction comes from permitted observations, not a fresh query of hidden state.

## State and Action contracts

### Active inspection

Keep `politicsCardPileA` and `politicsCardPileB` Host-only. Add public pile counts for chooser availability and display. Add an owner-protected `players[].politicsInspection` containing `{ pile, cards }` while a player is choosing.

`LookAtPoliticsPile` validates against public turn/commitment/count information. Authoritative execution reads the actual pile, writes the owner's inspection snapshot, and records the same snapshot in `metadata.cards`, protected by `Policy.Actor`. The existing `revealsInfo` barrier remains.

`TakePoliticsCard` keeps `playerId` and `pile` public, but protects `card` with `Policy.Actor`. Its legality can use the acting player's known inspection. Execution removes the actual canonical card, updates the owner's hand and public counts, and clears the active inspection snapshot. Because the canonical pile is hidden, local execution may fall back to the host; that does not prevent legal discovery or rendering the known choices.

Keep `TakePoliticsCard` undoable within the existing rules. Its permitted Undo patch restores the same inspected pile snapshot. Undo must still stop at the preceding inspection, so choosing a different card cannot become a way to inspect the other pile.

The intentional snapshot duplication serves two different lifetimes: current state supports rules/UI without walking history; Action metadata retains the historical observation after the current interaction ends. Use the same capture operation for both values.

### Hands and public results

Protect `players[].politicsCards` with `Policy.Owner` and expose a separate public count. Hydrate through `LowenherzProjectedState`; missing hands remain missing. Rule/UI code must not interpret an omitted hand as an empty one or iterate every opponent's hand to decide which Actions are available.

Keep public plays and payments public, including `PlaceKnight.treasureValue` and `metadata.paidWithTreasureCard`. The payment reveals and discards the card; it is not a sealed submission. Final scoring should publish explicit hand/score/wealth results for the end panel, rather than relying on a generic endgame exemption to owner visibility.

Politics cards are values: `{ type, value? }`. The three alliance copies and three renegade copies are interchangeable. `PlayAllianceCard` and `PlayRenegadeCard` select the card type through the Action type and consume exactly one copy; no copy selector needs protection. `TakePoliticsCard.card` selects a face, and treasure payments/bids select printed values. Treasure values are unique in the physical deck. UI occurrence keys are local to a rendered hand or inspected pile and are never sent in Actions or saved as card identity.

### Sealed duel rounds

Keep each submitted entry's `playerId` public; protect its amount and treasure values with owner entitlement. Protect matching `SubmitDuelBid` inputs and the submitter's `metadata.treasureCardsUsed` with actor entitlement. The public list of submitting players supplies availability; no access to their amounts is needed to determine who still owes a bid.

Before the final submission clears or replaces the round, capture a public `metadata.roundResult` with the slot and every participant's ducat amount and treasure values. Effective totals are derived from those values; the adjacent `duelResult`, `winnerId`, and `reduelPlayerIds` describe the outcome. The last submission can carry public result metadata alongside private submission fields. Earlier submission Actions stay private; their visibility does not depend on the current phase.

The result must distinguish spent winning treasure from retained losing/tied treasure. Both are information for Exploration. Retried rounds need their own result snapshots; an outcome saying only who won or tied is insufficient.

Update the status/history UI to read completed bid summaries from these public results. Individual sealed submissions remain unavailable to other players even after the round resolves.

### Future action deck

Protect remaining action-card faces/order while publishing the counts and backs needed by the deck UI and draw legality. Add the full revealed card to `DrawActionCard.metadata` and mark the draw as information-revealing. Existing `cardType` and `back` alone do not distinguish the remaining standard cards.

Exploration builds the configured initial deck, subtracts exactly the revealed cards in the source prefix, and shuffles within each remaining letter group. Preserve the A/B/C/D/E order and the special ending card's group. Branching before a later reveal must not use that later card to constrain the sample.

New initialization needs protected entropy for both action-deck assembly and politics-pile allocation. Public board/color/order randomness retains its current role. The separate discussion of stronger PRNGs and seed derivation remains deferred.

## Politics-card assignment

The external seam should be the existing `createFromProjectedState` hook. Put the title-specific analysis and assignment in a focused module under Lowenherz's logic package. Its inputs are the permitted state/history and supplied sampling randomness; it must have no canonical loader, host context, hidden seed, or hidden source-state argument.

### Slots

Build thirteen slots from public information:

- One slot for each historical `TakePoliticsCard`: its source pile, Action position, and receiving player. A known `card` fixes that slot's face.
- One slot for each card still in pile A or B, using the public remaining counts.

A card assigned to an acquisition slot belongs to its recipient unless a subsequent public event spent it. Hand size therefore follows from public acquisitions and discards. Confirm those derived sizes against the source's public hand counts.

All thirteen cards occupy exactly one slot each. A slot represents a card's initial-pile/acquisition trajectory, not merely its final location; that distinction is what preserves temporal knowledge.

### Constraints

Treat each observation as a multiset of faces, preserving duplicate counts. Assign faces to acquisition and remaining-pile slots subject to these constraints:

1. **Deck conservation:** the thirteen slots collectively contain the printed deck's exact face multiplicities.
2. **Inspection at position t:** remaining slots from that pile plus acquisitions after t contain exactly the observed multiset. Absence and duplicate counts both matter.
3. **Known acquisition:** fix that event's face.
4. **Revealed ownership and public discard:** process events in order. A player must hold the revealed face at that time. Discard removes one copy; a retained losing/tied treasure remains available for subsequent reveals or payment.
5. **Known current hand:** the derived unspent multiset must match the owner's complete known hand.
6. **Current inspection:** match its exact pile multiset, even if supplied separately from history.

A title-local constrained search over the thirteen slots can choose faces while tracking remaining multiplicities and observation capacities. Reject a branch as soon as any observation cannot be satisfied; validate the resulting ownership/discard timeline before returning it. Randomize the candidate order with the supplied Exploration randomness. This promises a feasible hypothetical world, not uniform sampling or a model of opponents' preferences.

Identical copies have no distinct identity in the input or output. A solver may use temporary internal labels, but they must not become observations, persisted card IDs, or public acquisition-to-play links. The earlier proposal to enumerate 36 exact-copy assignments is superseded by this value model. The implemented search prunes forced faces, checks observation capacities at every branch, and memoizes failed equivalent constraint states. The title has thirteen slots; this is not a general-purpose constraint engine.

Do not sample each zone independently: plausible individual choices can jointly exceed the available quantity of a face or contradict an earlier inspection. Do not repeatedly reshuffle until observations happen to fit.

### Example

You inspect A and see `{a, b, c}`. Another player later takes one unknown card from A.

At that source position, any of `{a,b}`, `{a,c}`, or `{b,c}` may be the remaining pile; the opponent's acquisition must receive the complementary card. An unrelated card cannot enter A.

If you subsequently inspect A and see `{a,c}`, the earlier hidden acquisition is now known to have been `b`. An Exploration after that second inspection must respect the deduction. An Exploration before it must not use it.

If instead a completed duel reveals that the opponent bid `b` and lost, the sampled hand must retain `b`. If the opponent won and spent it, the sampled world must put it among the spent cards. Revealing a card and discarding it are separate facts.

### Pending bids

Populate hands first, incorporating any known pending treasure values from the explorer's own bid. Then sample only other players' already-submitted bids within their hypothetical hands and available money. Preserve who has submitted, the explorer's actual known bid, and any completed round results. Never invent a submission for an outstanding bidder.

### Failure and persistence

Missing required observations, unknown card definitions, contradictory evidence, or no complete assignment should produce a specific unsupported/inconsistent Exploration error. Never substitute the real hidden piles or relax constraints to obtain a sample.

Once populated, use the shared hypothetical checkpoint and saved Exploration machinery. Save/load and Undo should retain that sampled world, not solve the assignment again. Source History continues to display the original permitted observations. Host/Admin Exploration retains an authorized complete-state path and must remain available independently of ordinary population support.

## Existing games and money

Add public counts and other continuation facts at canonical normalization/initialization and update them with the owning rule operations. Never manufacture them from redacted arrays in hydrated constructors. Added historical metadata must remain optional for old Action hydration; new executions always write it. Legacy v1/v2 games retain complete-state Exploration. Older v3 games without the new observation records may not support ordinary historical Exploration; forward play and Host/Admin Exploration remain available.

Preserve existing v1/v2 deterministic behavior and do not upgrade their privacy. Games initialized by older public-randomness logic cannot gain retroactive secrecy merely by hiding their current fields, even if their system version is already 3. Limit new privacy guarantees to correctly initialized games; do not reconstruct historical private observations from today's canonical piles.

`publicMoney` currently governs presentation, with public starting balances and transactions. Keep the decision about enforcing this option in network delivery separate from the card-knowledge model. If delivery concealment is adopted, the title can reconstruct permissible hypothetical balances from complete public financial records; it must account for treasure payments rather than treating every expense as cash. A custom phase/config policy is not automatically trusted for local execution. Define how rules access owner money and publicly permitted balances before changing its schema.

## Investigation evidence and implementation slices

The mutation sweep found only pile-to-hand acquisitions and the four discard paths listed above. The current UI/history consumers and state-handler reads were inspected to identify required public counts, owner snapshots, and round results.

The earlier in-memory matching experiment tested a model with distinct cards. It does not validate the revised multiset solver. Conformance tests cover repeated inspections, duplicate deck multiplicities, retained losing treasure, pending bids, missing observations, contradictions, and source-prefix enforcement.

The face-based representation is implemented first: action payloads select faces/values, rule operations consume one copy, and hydration removes legacy card IDs while resolving pending legacy duel references against the owner's saved hand. An unresolved or conflicting legacy commitment fails explicitly. Current-state forward play is covered; old Action replay and historical patches are not guaranteed across this schema change. Existing game system versions and privacy status are unchanged. The Logic and UI packages are both version 2.0.0 for the new Action payloads; publish them together so the major-version compatibility check reloads older clients. The shared host bridge is unchanged.

Implemented together:

- Public deck backs and hand/pile counts; owner inspection snapshots; immutable actor-private inspection/choice history; complete public draw and duel-round results; public final hands.
- Host-only remaining piles/deck, owner hands and pending bids, actor-private submissions, projected hydrated types, and projected UI rendering with unknown card backs.
- Thirteen-slot constrained politics population, action-deck reconstruction by back group, legal hypothetical pending bids, with source selection after recorded resolution cascades. Host/Admin retains complete-state Exploration.
- Current-save normalization before projection, legacy deterministic initialization, and focused projection, history, rule, migration, and Exploration tests.

The local manifest selects matching 2.0.0 Logic/UI artifacts. Production publication remains a separate action. The shared host bridge contract is unchanged. A shared execution-guard correction permits absent public optional unions while still denying protected optional fields; UI artifacts need republishing to adopt that correction. Lowenherz's new artifact includes it.

Public plays disclose the visible card face; identical-copy IDs no longer exist in the new state model. Whether the money option should control delivery remains a separate product decision. Neither needs a general persistent belief model. The core recommendation is immutable observation history plus title-owned constrained population.

## Validation

The Lowenherz suite passes 326 tests; the shared visibility/canonical-boundary suite passes 96. Logic and UI builds pass, and the UI check reports zero errors with six existing warnings. Separate hosted accounts verified owner/opponent/spectator state, durable private inspection history, refresh, taking, Undo restoration, ordinary hypothetical Exploration, and admin Host View Exploration. Browser interaction checks also cover duplicate-card spotlighting, disabled pending choices, history, resizing, inspection reload, and duplicate treasure selection.

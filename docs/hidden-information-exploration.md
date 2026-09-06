# Hidden-information Exploration

This document records the implemented Exploration decisions from the Game Session refactor discussion. The implementation now provides projected-state population, persisted source/hypothetical checkpoints, inherited Undo barriers, and Fresh Fish continuation. Validation and compatibility results are recorded below. Hosted Fork is a separate [canonical-copy operation](hidden-information-forks.md); its policy is settled.

## Agreed behavior

- Ordinary Exploration starts from the selected projected Game State and fills unknown information with hypothetical values consistent with the Game rules and the explorer's knowledge at that position. Later source-Game revelations do not constrain an earlier branch.
- The title supplies the state-population logic. Shared visibility annotations do not imply a generic state generator. Titles can support projected Exploration without every title being required to implement it.
- Debug/Admin Exploration from an authorized Host View remains available through the existing canonical-state initializer, even when the title has no projected-state population method. The retained authorized Host Game Context supplies that path. Ordinary Exploration must never silently fall back to it.
- Fresh exploration randomness prevents either path from predicting the source Game's random future. The source protected PRNG is never reused as the hypothetical branch's random future.
- Recorded source History remains navigable backward and forward up to the source position within its supported schema range. It displays the source representation, independently of the populated hypothetical state.
- Undo changes the playable hypothetical state. When undoing inherited Actions, stop before the first Action with a forward patch or requiring non-optimistic execution. Check the entire User/System cascade; do not skip an unsafe System Action. Existing protected/sentinel Actions also cannot be executed as complete Actions.
- Exploration-generated Actions have their own execution records and normal local Undo behavior. Undo/redo within a branch must preserve its sampled hidden values and randomness.

## Completed implementation slices

E1–E4 below record the implementation requirements now delivered. E5 combines repository conformance checks with release checks; the latter remain on the [completion list](hidden-information-compatibility.md#remaining-development-slices).

### E1: explicit initialization paths

`populateExplorationState` adds an optional title-owned projected population capability alongside the existing `initializeExplorationState` hook. Its inputs are a copy of the projected state, permitted source history through the chosen position, relevant Game configuration, source Perspective, and fresh exploration randomness. Its output is complete hypothetical state checked by the canonical validator before play or persistence. The implemented `ExplorationPopulation<T>` signature reuses the existing Game, Perspective, Action, and randomness types.

The framework owns source selection, cloning, branch identity, fresh public/protected PRNG initialization, and branch persistence. The title owns population of missing game information and validation of game-specific constraints. Keep the new capability additive so older UI/Logic implementations and full-information initialization remain usable. Preserve historical system versions; existing v2 Games do not receive a privacy upgrade.

### E2: Fresh Fish population

Reuse the existing tile-population and board-setup rules to recover the starting bag composition. Subtract revealed `DrawTile` outcomes from the permitted history prefix. This accounts for the current chosen tile and tiles that were discarded, placed into the void, or later removed from the board. Do not infer the remaining bag solely from current board occupancy, and do not subtract final-stall supply as though it came from the bag. Validate the reconstructed total against `tileBag.remaining`, then shuffle using exploration randomness.

Populate submitted auction bids whose amounts are absent with hypothetical legal amounts, preserving visible bid amounts, submission status, participant eligibility, public funds, and any outcome already established at the branch point. Do not invent submissions for participants who have not bid. Prefer a straightforward valid sampling policy; this feature does not promise a statistical model of opponents' decisions.

For Host View, retain the existing full-state initializer and reshuffling behavior. There is no need to replace already authorized canonical bid values with guesses. Give subsequent execution fresh branch randomness.

### E3: source History and hypothetical execution

Retain the original permitted source state/history for recorded History navigation. Keep the populated branch state as a separate checkpoint, with its own subsequent Action history. Moving the History cursor across the source position selects the appropriate recorded or hypothetical context; it must not apply source patches to sampled hidden state.

Implement inherited Undo eligibility using the agreed forward-patch/non-optimistic cascade barrier. Safely reversible source Actions may be undone; unsafe Actions remain available for recorded History navigation. Preserve hypothetical state and randomness when reversing the safe suffix. Verify actual reconstruction rather than assuming that absence of a forward patch makes every inherited undo patch compatible with changed branch data.

Projected initialization avoids the legacy undo/reapply-last-Action step. Positions within a User/System cascade preserve recorded source outcomes and complete only the hypothetical continuation after the selected point. The legacy full-state path retains its last-Action continuation behavior.

Persist the selected source position, source representation needed for recorded History, populated checkpoint, and branch Action history so saving/loading does not sample a different world. Reuse existing storage structure where it can represent these distinctions; preserve loading of existing saved Explorations.

### E4: Game Session integration and compatibility

Expose ordinary projected Exploration only when the title can populate its source state. Keep authorized Host View Exploration available in Debug/Admin regardless of that capability. Preserve existing Local/Hotseat and legacy full-information Exploration behavior. An Acting Player projection must not accidentally acquire the retained Host Context through the ordinary population path.

Exercise privilege switching, entering Exploration from History, returning to Live, switching saved Explorations, and save/load. Preserve the immediate publication rules for representation changes. Review the Game UI Host Bridge Contract before adding any UI-facing availability value; do not require an atomic Site Frontend/UI Artifact rollout.

### E5: conformance and release checks

- Same permitted state/history and exploration seed produce the same hypothetical state despite differing undisclosed source values.
- Reconstructed Fresh Fish bags have correct composition/count at setup, after draws, during an auction, after tile removal, and at bag exhaustion/final-stall play.
- Known bids stay unchanged; hidden submitted bids are valid; unfinished bidding and completed auctions continue correctly.
- Source History round-trips across an unsafe Action while playable Undo stops at its cascade barrier. Safe inherited Actions and newly simulated Actions remain undoable without resampling.
- Partial-cascade branch positions preserve revealed facts and do not replay unknown canonical outcomes.
- Saving/loading preserves the hypothetical checkpoint, random streams, history, and Undo eligibility.
- Debug/Admin Host View can explore a title without the new population hook. Ordinary clients cannot obtain that path through projection failure or missing capability.
- Existing v2 Games, full-information titles, and saved Explorations remain usable.

Use the existing runtime and GameSession seams for focused tests, with Chromium coverage for History/Undo and context switching. Shared-client changes require each title's UI Artifact to be republished to adopt them. Runtime interface or title initializer changes need their matching Logic/UI publication assessment. No deployment is part of writing this plan.

## Implemented interface and storage

`GameInitializer.populateExplorationState` is optional. It receives `ExplorationPopulation<T>` containing the copied state, permitted Action prefix, Game configuration, Perspective, and sampling randomness. `getExplorationActions` optionally prepares the automatic Actions needed after the selected position, advancing the supplied state's public PRNG when reserving their identities; Fresh Fish uses it to continue a revealed draw or pending auction without replaying the revealing Action. Its automatic bidding, auction-resolution, and forced-placement helpers are shared with ordinary rules execution. Legacy full-state initializers keep their last-Action continuation path.

The framework independently initializes the branch's public and version-3 protected PRNGs and gives population fresh sampling randomness. The optional `explorationState.checkpoint` stores two directional difference patches: `source` converts the hypothetical boundary state back to the permitted source, and `hypothetical` converts that source into the sampled state. Both exclude recursive Exploration metadata. Unchanged state is not copied into the checkpoint. Existing Action storage retains the source prefix plus simulated suffix; there is no source-world reconstruction from the protected seed.

History at the boundary displays the recorded source. Entering History directly at that position, or stepping back from the simulated suffix to it, applies the `source` patch once. Stepping farther backward uses original History directly. Forward navigation applies `hypothetical` once when leaving the boundary for the simulated suffix. Original patches can replace whole objects containing sampled fields, and population patches can insert array entries, so neither retaining the sample through original History nor blindly reapplying population is safe.

Older checkpoints containing root replacement snapshots remain readable with the same patch mechanism. New checkpoints, including those rebuilt after safe inherited Undo, use differences. Saved branches keep their existing sampled values and random streams; loading does not repopulate them.

`ExplorationHistory` owns checkpoint transitions and inherited Undo verification. In addition to explicit forward-patch/reveal/non-optimistic barriers, it probes complete safe cascades against the sampled state, checking resulting state and Action identities. Undo is conservative if that reconstruction fails. Undo into the verified source suffix first reconstructs the old hypothetical boundary, reverses population there, and rewinds the removed source Actions. It then rebuilds the directional patches at the earlier position while retaining the sampled world. Older saved Explorations without checkpoints continue through the previous replay behavior.

`GameSession.canExplore` and the bundled History control expose availability without a new host bridge member. Switching saved Explorations updates History's source, and refreshing the primary representation during Exploration leaves the branch's History intact. A new branch opened from History uses that selected position even when saved branches exist.

## Publication

### Sol adoption follow-up

Sol reconstructs thirteen cards per publicly selected suit and subtracts only `DrawCards.metadata.drawnCards` from the permitted source prefix. `squeezedCards` repeats previously revealed cards and is not subtracted again. Population checks the remaining count, preserves all visible player cards, assigns hypothetical remaining identities without reusing revealed ones, and shuffles with fresh exploration randomness. Missing draw results or inconsistent counts fail explicitly. No canonical deck or protected seed is consulted.

Its continuation hook resumes pending solar flares, automatic no-choice passes, and Motivate activations without replaying the source draw or duplicating a flare already awaiting player activations. Authorized Host View keeps the complete-state reshuffle path. The title's conformance suite covers projection and History patch round trips, public legal discovery and optimistic card choice, population independence and exhaustion, partial-cascade continuation, and legacy initialization/forward play. The Sol logic suite passes 30 tests; its build passes, and its UI type check reports zero errors with 40 warnings in unchanged UI files.

Publishing this adoption requires matching Sol Logic/UI artifacts. Use a Logic major bump to reject incompatible old Action submissions and the UI major reload mechanism for clients predating protected delivery. No host bridge members or Site Frontend transport shapes changed. Package versions have not been bumped, and actual mixed published-artifact verification remains a release check; nothing was deployed.

### Shared-client publication

This change adds optional runtime initializer capabilities and serialized checkpoint metadata, and changes shared Game Client behavior. Fresh Fish needs matching Logic/UI artifacts for its initializer changes; each other title needs a new UI artifact to adopt the shared client, with a compatible embedded runtime. The Site Frontend bridge and transport result shapes are unchanged. No publication or old/new deployed-artifact test has been performed.

## Validation at the Exploration slice

The affected suites pass: 119 Common tests, 28 Fresh Fish logic tests, 19 shared Game Client tests, 45 Fresh Fish client tests, and ten Chromium scenarios. The seven new client cases cover population independence, bag composition and exhaustion, known/unknown bids, version-1/version-2 continuation with a legacy initializer, loading old saved Explorations, and Host View without a population hook. Five new browser scenarios cover source History and save/load, branching earlier while a saved branch exists, safe inherited and simulated Undo, partial-cascade continuation, privilege transitions, and a simulated auction's History/Undo round trip.

Both client type checks report zero errors with the existing seven/one warnings. Common, Fresh Fish, and shared-client builds pass. These are repository-level tests; mixed deployed artifacts, long-history performance, and population hooks for other hidden-information titles remain future work. Hosted Fork is implemented separately; see [canonical Forks](hidden-information-forks.md).

The later [shared hydration integration](projected-hydration-prototype.md#integration-follow-up) adds private-hand population, play, and saved-sample reload coverage. The Fresh Fish browser fixture now supplies a runtime for the canonical save validation introduced in `9f128dd6`. The current [completion list](hidden-information-compatibility.md#remaining-development-slices) separates repository implementation from outstanding publication checks.

## Boundary delta follow-up

The checkpoint field shape and Game UI Host Bridge Contract are unchanged. New UI code reads both the previous root snapshots and new directional deltas. Old UI implementations assume idempotent snapshot restoration and should not be used to browse new delta-based saved branches. Each title needs a republished UI Artifact to adopt this shared client behavior; the Site Frontend alone cannot update it. In particular, Fresh Fish, Sol, and Lowenherz need new UI Artifacts for their projected Exploration paths. No title rules or initializer interfaces change, and no Logic Artifact publication is required for this client behavior change. No artifacts were published as part of this change.

Validation: all 152 Common tests pass, including eight boundary tests for repeated source/future navigation, whole-object replacement, serialized reload, legacy snapshots, legacy metadata without checkpoints, and safe inherited Undo with and without a simulated suffix. Six shared-client and eight Fresh Fish browser scenarios pass. The private-hand browser scenario now verifies repeated History round trips before and after loading the saved Exploration. Common and shared-client builds pass; the shared-client check reports zero errors and seven existing warnings.

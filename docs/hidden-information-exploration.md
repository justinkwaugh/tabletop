# Hidden-information Exploration

This document records the implemented Exploration decisions from the Game Session refactor discussion. The implementation now provides projected-state population, persisted source/hypothetical checkpoints, inherited Undo barriers, cascade-boundary source selection, and exact return-position restoration. Validation and compatibility results are recorded below. Hosted Fork is a separate [canonical-copy operation](hidden-information-forks.md); its policy is settled.

## Agreed behavior

- Ordinary Exploration starts from a copy of the selected projected Game State advanced through the rest of its recorded cascade. It fills unknown information consistently with the Game rules and permitted knowledge at that completed position. Later source-Game revelations beyond that position do not constrain the branch.
- The title supplies the state-population logic. Shared visibility annotations do not imply a generic state generator. Titles can support projected Exploration without every title being required to implement it.
- Debug/Admin Exploration from an authorized Host View remains available through canonical-state preparation, even when the title has no projected-state population method. The retained authorized Host Game Context supplies that path. Ordinary Exploration must never silently fall back to it.
- Fresh exploration randomness prevents either path from predicting the source Game's random future. The source protected PRNG is never reused as the hypothetical branch's random future.
- Recorded source History remains navigable backward and forward up to the source position within its supported schema range. It displays the source representation, independently of the populated hypothetical state.
- Undo changes the playable hypothetical state. When undoing inherited Actions, stop before the first Action with a forward patch or requiring non-optimistic execution. Check the entire User/System cascade; do not skip an unsafe System Action. Existing protected/sentinel Actions also cannot be executed as complete Actions.
- Exploration-generated Actions have their own execution records and normal local Undo behavior. Undo/redo within a branch must preserve its sampled hidden values and randomness.

## Completed implementation slices

E1–E4 below record the implementation requirements now delivered. E5 combines repository conformance checks with release checks; the latter remain on the [completion list](hidden-information-compatibility.md#remaining-development-slices).

### E1: explicit initialization paths

`createFromProjectedState` adds an optional title-owned projected population capability alongside `createFromCanonicalState` on `runtime.exploration`. Its inputs are a copy of the projected state, permitted source history through the chosen position, relevant Game configuration, source Perspective, and fresh exploration randomness. Its output is complete hypothetical state checked by the canonical validator before play or persistence. The implemented `ExplorationPopulation<T>` signature reuses the existing Game, Perspective, Action, and randomness types.

The framework owns source selection, cloning, branch identity, fresh public/protected PRNG initialization, and branch persistence. The title owns population of missing game information and validation of game-specific constraints. UI Artifacts bundle matching Game Runtime and Game Client implementations; old bundles retain their existing interface, and rebuilt bundles use the extracted interface. Preserve historical system versions; existing v2 Games do not receive a privacy upgrade.

### E2: Fresh Fish population

Reuse the existing tile-population and board-setup rules to recover the starting bag composition. Subtract revealed `DrawTile` outcomes from the permitted history prefix. This accounts for the current chosen tile and tiles that were discarded, placed into the void, or later removed from the board. Do not infer the remaining bag solely from current board occupancy, and do not subtract final-stall supply as though it came from the bag. Validate the reconstructed total against `tileBag.remaining`, then shuffle using exploration randomness.

Populate submitted auction bids whose amounts are absent with hypothetical legal amounts, preserving visible bid amounts, submission status, participant eligibility, public funds, and any outcome already established at the branch point. Do not invent submissions for participants who have not bid. Prefer a straightforward valid sampling policy; this feature does not promise a statistical model of opponents' decisions.

For Host View, retain full-state preparation and reshuffling behavior. There is no need to replace already authorized canonical bid values with guesses. Give subsequent execution fresh branch randomness.

### E3: source History and hypothetical execution

Retain the original permitted source state/history for recorded History navigation. Keep the populated branch state as a separate checkpoint, with its own subsequent Action history. Moving the History cursor across the source position selects the appropriate recorded or hypothetical context; it must not apply source patches to sampled hidden state.

Implement inherited Undo eligibility using the agreed forward-patch/non-optimistic cascade barrier. Safely reversible source Actions may be undone; unsafe Actions remain available for recorded History navigation. Preserve hypothetical state and randomness when reversing the safe suffix. Verify actual reconstruction rather than assuming that absence of a forward patch makes every inherited undo patch compatible with changed branch data.

Both projected and canonical preparation start after the selected cascade completes. Its recorded System Actions are inherited before sampling, without replaying the preceding User Action or generating replacement consequences. The original display position remains separate and is restored when Exploration closes.

Persist the selected source position, source representation needed for recorded History, populated checkpoint, and branch Action history so saving/loading does not sample a different world. Reuse existing storage structure where it can represent these distinctions; preserve loading of existing saved Explorations.

### E4: Game Session integration and compatibility

Expose ordinary projected Exploration only when the title can populate its source state. Keep authorized Host View Exploration available in Debug/Admin regardless of that capability. Preserve existing Local/Hotseat and legacy full-information Exploration behavior. An Acting Player projection must not accidentally acquire the retained Host Context through the ordinary population path.

Exercise privilege switching, entering Exploration from History, returning to Live, switching saved Explorations, and save/load. Preserve the immediate publication rules for representation changes. Review the Game UI Host Bridge Contract before adding any UI-facing availability value; do not require an atomic Site Frontend/UI Artifact rollout.

### E5: conformance and release checks

- Same permitted state/history and exploration seed produce the same hypothetical state despite differing undisclosed source values.
- Reconstructed Fresh Fish bags have correct composition/count at setup, after draws, during an auction, after tile removal, and at bag exhaustion/final-stall play.
- Known bids stay unchanged; hidden submitted bids are valid; unfinished bidding and completed auctions continue correctly.
- Source History round-trips across an unsafe Action while playable Undo stops at its cascade barrier. Safe inherited Actions and newly simulated Actions remain undoable without resampling.
- Selections inside a cascade advance privately to its end, preserving recorded consequences and stopping before the next User Action. Closing restores the exact selected display position.
- Saving/loading preserves the hypothetical checkpoint, random streams, history, and Undo eligibility.
- Debug/Admin Host View can explore a title without the new population hook. Ordinary clients cannot obtain that path through projection failure or missing capability.
- Existing v2 Games, full-information titles, and saved Explorations remain usable.

Use the existing runtime and GameSession seams for focused tests, with Chromium coverage for History/Undo and context switching. Shared-client changes require each title's UI Artifact to be republished to adopt them. Runtime interface or title initializer changes need their matching Logic/UI publication assessment. No deployment is part of writing this plan.

## Implemented interface and storage

`runtime.exploration` is optional: titles without state-specific Exploration preparation use the copied canonical state directly. When supplied, `GameExploration` requires `createFromCanonicalState`; `createFromProjectedState` is optional. It receives `ExplorationPopulation<T>` containing the copied state, permitted Action prefix, Game configuration, Perspective, and sampling randomness. Exploration starts at a completed cascade. The shared client advances a copied source context through the remaining recorded System Actions, stopping before the next User Action, using permitted History replay/patches. Population receives that completed position and its Action prefix. It neither reconstructs a pending queue nor undoes and re-executes the preceding Action.

The framework independently initializes the branch's public and version-3 protected PRNGs and gives population fresh sampling randomness. The optional `explorationState.checkpoint` stores two directional difference patches: `source` converts the hypothetical boundary state back to the permitted source, and `hypothetical` converts that source into the sampled state. Both exclude recursive Exploration metadata. Unchanged state is not copied into the checkpoint. Existing Action storage retains the source prefix plus simulated suffix; there is no source-world reconstruction from the protected seed.

History at the boundary displays the recorded source. Entering History directly at that position, or stepping back from the simulated suffix to it, applies the `source` patch once. Stepping farther backward uses original History directly. Forward navigation applies `hypothetical` once when leaving the boundary for the simulated suffix. Original patches can replace whole objects containing sampled fields, and population patches can insert array entries, so neither retaining the sample through original History nor blindly reapplying population is safe.

Older checkpoints containing root replacement snapshots remain readable with the same patch mechanism. New checkpoints, including those rebuilt after safe inherited Undo, use differences. Saved branches keep their existing sampled values and random streams; loading does not repopulate them.

`ExplorationHistory` owns checkpoint transitions and inherited Undo verification. In addition to explicit forward-patch/reveal/non-optimistic barriers, it probes complete safe cascades against the sampled state, checking resulting state and Action identities. Undo is conservative if that reconstruction fails. Undo into the verified source suffix first reconstructs the old hypothetical boundary, reverses population there, and rewinds the removed source Actions. It then rebuilds the directional patches at the earlier position while retaining the sampled world. Older saved Explorations without checkpoints continue through the previous replay behavior.

`GameSession.canExplore` and the bundled History control expose availability without a new host bridge member. Switching saved Explorations updates History's source, and refreshing the primary representation during Exploration leaves the branch's History intact. A new branch opened from History uses the end of the selected cascade even when saved branches exist, while retaining the original display position for return.

## Publication

### Sol adoption follow-up

Sol reconstructs thirteen cards per publicly selected suit and subtracts only `DrawCards.metadata.drawnCards` from the permitted source prefix. `squeezedCards` repeats previously revealed cards and is not subtracted again. Population checks the remaining count, preserves all visible player cards, assigns hypothetical remaining identities without reusing revealed ones, and shuffles with fresh exploration randomness. Missing draw results or inconsistent counts fail explicitly. No canonical deck or protected seed is consulted.

Sol's source includes the complete recorded cascade before population, including automatic flares, no-choice passes, or Motivate activations. No title-specific continuation hook is required. Authorized Host View keeps the complete-state reshuffle path. Conformance covers projection and History patches, public legal discovery, optimistic card choice, population independence/exhaustion, completed-cascade consequences, and legacy forward play.

Publishing this adoption requires matching Sol Logic/UI artifacts. Use a Logic major bump to reject incompatible old Action submissions and the UI major reload mechanism for clients predating protected delivery. No host bridge members or Site Frontend transport shapes changed. Package versions have not been bumped, and actual mixed published-artifact verification remains a release check; nothing was deployed.

### Shared-client publication

This project adds optional runtime exploration capabilities and serialized checkpoint metadata, and changes shared Game Client behavior. Fresh Fish needs matching Logic/UI artifacts for its runtime changes; each other title needs a new UI artifact to adopt the shared client, with a compatible embedded runtime. The Site Frontend bridge and transport result shapes are unchanged. No publication or old/new deployed-artifact test has been performed.

## Validation at the original Exploration slice

The affected suites pass: 119 Common tests, 28 Fresh Fish logic tests, 19 shared Game Client tests, 45 Fresh Fish client tests, and ten Chromium scenarios. The seven new client cases cover population independence, bag composition and exhaustion, known/unknown bids, version-1/version-2 continuation with a legacy initializer, loading old saved Explorations, and Host View without a population hook. Five new browser scenarios cover source History and save/load, branching earlier while a saved branch exists, safe inherited and simulated Undo, partial-cascade continuation, privilege transitions, and a simulated auction's History/Undo round trip.

Both client type checks report zero errors with the existing seven/one warnings. Common, Fresh Fish, and shared-client builds pass. These are repository-level tests; mixed deployed artifacts, long-history performance, and population hooks for other hidden-information titles remain future work. Hosted Fork is implemented separately; see [canonical Forks](hidden-information-forks.md).

The later [shared hydration integration](projected-hydration-prototype.md#integration-follow-up) adds private-hand population, play, and saved-sample reload coverage. The Fresh Fish browser fixture now supplies a runtime for the canonical save validation introduced in `9f128dd6`. The current [completion list](hidden-information-compatibility.md#remaining-development-slices) separates repository implementation from outstanding publication checks.

## Boundary delta follow-up

The checkpoint field shape and Game UI Host Bridge Contract are unchanged. New UI code reads both the previous root snapshots and new directional deltas. Old UI implementations assume idempotent snapshot restoration and should not be used to browse new delta-based saved branches. Each title needs a republished UI Artifact to adopt this shared client behavior; the Site Frontend alone cannot update it. In particular, Fresh Fish, Sol, and Lowenherz need new UI Artifacts for their projected Exploration paths. No title rules or initializer interfaces change, and no Logic Artifact publication is required for this client behavior change. No artifacts were published as part of this change.

Validation: all 152 Common tests pass, including eight boundary tests for repeated source/future navigation, whole-object replacement, serialized reload, legacy snapshots, legacy metadata without checkpoints, and safe inherited Undo with and without a simulated suffix. Six shared-client and eight Fresh Fish browser scenarios pass. The private-hand browser scenario now verifies repeated History round trips before and after loading the saved Exploration. Common and shared-client builds pass; the shared-client check reports zero errors and seven existing warnings.

### Exploration interface extraction

State creation now lives in `GameExploration`, registered as `runtime.exploration`, with `createFromCanonicalState` and optional `createFromProjectedState`. Fresh Fish, Sol, Lowenherz, Estates, and Santiago supply this module; other titles need no state preparation hook. The former automatic-action continuation hooks and legacy last-Action replay have been removed; source preparation now includes the recorded cascade before population.

This is an internal runtime interface change. A UI Artifact bundles its Game Runtime and shared Game Client together, so existing artifacts retain the old matching pair and rebuilt artifacts use the new pair. The Site Frontend host bridge, saved Game State, and saved Exploration formats are unchanged. Every title's UI Artifact must be republished to adopt the updated shared client; the five titles with custom preparation must include their extracted exploration modules. No artifacts have been published by this change.

Validation for the extraction: all 12 Game Logic packages and the shared Game Client build; 152 Common tests, 386 title tests, 9 Fresh Fish exploration unit tests, and 22 browser tests pass. Shared-client and Fresh Fish UI checks report zero errors with their existing warnings.

### Cascade source and return position

The selected display position and the Exploration source are separate. `GameHistory.createExplorationSource` advances a copy to the completed cascade, using the same `getActionCascadeEndIndex` calculation as canonical Forks. It does not navigate or animate the displayed History, and it does not use title-specific History grouping. A position before the first Action remains before the first Action.

Starting Exploration captures the original History snapshot and exact index. Closing restores that snapshot with `silent-swap`, even when the source was mid-cascade or the primary Game has advanced or recovered. Creating or switching branches retains the original return position. Starting from Live instead returns to the latest primary Game. The return snapshot is session-local and is not stored with saved Explorations. If the primary viewing Perspective changes while exploring, closing returns to its current representation rather than restoring information from the previous Perspective.

Failed source replay or population leaves the displayed History in place. Existing saved Explorations continue to load their sampled state and checkpoint without regenerating automatic Actions. New branches inherit the entire source cascade, including its recorded identities and revealed consequences, before receiving fresh hypothetical state.

Validation of cascade-boundary creation and return restoration: 553 Common/title/canonical-Fork tests, nine Fresh Fish exploration unit tests, and 24 Chromium tests pass. Browser coverage includes a mid-cascade selection followed by another User Action, recorded System Action identities, title grouping independence, repeated branch creation/switching, unchanged History after failed population, Live and History return during primary recovery, and invalidating a Host View snapshot after a Perspective change. Common, Fresh Fish, Sol, Lowenherz, and shared-client builds pass. Shared-client and Fresh Fish UI checks report zero errors with their existing seven/one warnings. No artifacts were published.

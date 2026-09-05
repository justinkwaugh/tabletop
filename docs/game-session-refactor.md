# Game Session development slices

This work follows the hidden-information review and the decision to refactor the reconciliation responsibilities before adding more hidden-information behavior.

## Constraints

- Preserve GameSession's public interface, subclass hooks, presentation lifecycle, and injected host contract.
- Keep canonical and projected delivery behavior, historical execution versions, optimistic fallback, and Undo semantics covered by the existing tests.
- Existing v2 games have no privacy-upgrade requirement. They must remain playable under newer code.
- Extract ownership and algorithms together. New modules receive their dependencies explicitly and do not reach into private GameSession state.
- Slices 1–3 make no fork/exploration policy, ETag, publication, or unrelated presentation changes. Slice 4 records the exploration decisions before further implementation.

## Slices

1. **Accepted-history reconciliation.** Extract application of accepted Actions, complete replay suffix replacement, checksum verification, and reconstruction from a legacy Undo manifest. Verify public module outcomes against canonical host fixtures and preserve the existing GameSession integration tests.
2. **Queued delivery and recovery.** Move pending-update ordering, busy deferral, recovery after failures, incremental synchronization, and full reload into the reconciliation module. Keep perspective/representation selection in GameSession; a stale response must not overwrite a newer representation.
3. **Submission and Undo integration.** Route direct authoritative responses and optimistic acceptance through the same reconciliation algorithms. Remove duplicate history mutation and trace-comparison paths from GameSession. Preserve local/hotseat execution and subclass entry points.
4. **Fork/exploration design discussion.** Settle source randomness, unknown information, retained knowledge, and the relationships among primary, exploration, and displayed contexts. This slice requires product/design input before implementation.
5. **Representation management.** With the Exploration knowledge rule settled, extract context loading, perspective selection, privileged inspection, request generations, and stale-response handling behind an interface that fits the agreed context model.
6. **Compatibility and completion review.** Exercise notification ordering, in-flight submissions, Undo, History, privilege transitions, older stored games, and mixed artifact contracts. Update the hidden-information review and resume its remaining functional work.

## Verification seams

The existing GameSession interface remains the integration seam, including real browser presentation and history tests. The extracted GameReconciliation interface is the focused seam for history transformation, accepted-response handling, and recovery using the real GameContext/GameEngine and an in-memory host transport. Tests observe resulting state/history and public transport behavior, not private methods or queue internals.

## Publication

This refactor changes the shared Game Client bundled in each UI Artifact. A Game Title needs a UI-only publication to adopt it if its embedded runtime is otherwise unchanged. No Site Frontend dependency or payload shape changes. Earlier hidden-information runtime changes still have their separate matching Logic/UI publication requirements.

## Progress

- [x] Slice 1: accepted-history reconciliation
- [x] Slice 2: queued delivery and recovery
- [x] Slice 3: submission and Undo integration
- [ ] Slice 4: fork/exploration decisions — Exploration implemented; Hosted Fork remains open
- [x] Slice 5: representation management
- [x] Slice 6: compatibility and completion review — repository audit complete; publication/History decisions remain open

## Completed in slices 1–3

`GameReconciliation` owns pending delivery and recovery state, accepted Action application, complete suffix replacement, legacy Undo manifest reconstruction, incremental synchronization, and optimistic acceptance. The module receives transport and presentation/representation callbacks explicitly; it has no GameSession reference. GameSession retains user Action initiation, local/hotseat execution, perspective selection, typed context loading, notifications at the host seam, and the existing presentation hooks.

Replacement history is constructed and checksum-validated before it is published. Both incremental and full-reload responses check whether the requested representation is still current. The existing GameContext loader's transport-to-runtime type assumption remains in GameSession for the later representation/hydration work; this extraction does not introduce a new state schema or migrate stored games.

The GameSession constructor and bridge contract remain unchanged. GameContext and GameReconciliation have additive package exports for composition and direct conformance tests. No Game Runtime behavior or host payload changed, and no publication was performed.

Validation: 19 shared Frontend Components tests, 36 Fresh Fish client tests, and five Chromium scenarios pass. Both affected client type checks report zero errors; their existing Svelte warnings remain. The Frontend Components build passes. Tests cover projected and legacy Undo, reordered optimistic submission, rollback on invalid replacement, full-reload cancellation, busy delivery, discontinuity recovery, privileged view transitions, and projected History. Cross-publication deployment and the broader compatibility audit were outstanding at this slice; the slice-6 completion record below describes subsequent validation.

The Exploration knowledge rule is settled. Representation extraction can proceed independently of Hosted Fork policy and hypothetical-history implementation.

## Slice 4: hypothetical exploration

The user established the following requirement on 2026-09-05: anything newly revealed by ordinary projected Exploration must be simulated or hypothetical, and the hypothetical state must respect what had been revealed at the selected branch point. When branching from History, later real-game knowledge does not constrain the sample. Exploration must not reveal undisclosed source information by running hypothetical Actions against the real hidden state.

For a deck where five identified Cards have been drawn and have not returned, those Cards remain excluded from the remaining deck. The remaining order is sampled independently. Other facts constrain the sample too: deck composition and duplicate counts, known hands and discards, revealed positions, and rules that return or shuffle Cards. A Card that was merely inspected and remains in the deck is constrained by that knowledge, rather than automatically removed. Independently sampled order can coincide with the real order by chance; excluding that possibility must not require reading the real hidden order.

### Consequences for the design

- The projected exploration initializer operates on the source Perspective's permitted state and retained knowledge at the selected branch point, with fresh exploration randomness. It does not receive unknown canonical values or the source protected PRNG.
- Authorized Debug/Admin Host View Exploration retains its full-state initializer and remains available without a projected-state population hook.
- Sampling unknown state is Game Title-specific. Generic field redaction cannot reconstruct a legal deck, another Player's hand, or dependencies among hidden zones. Reusable card/bag samplers may implement common constraints behind that game-specific interface.
- Once sampled, the hypothetical state and its randomness belong to the Exploration. Undo and continuation operate on that branch; they must not consult the real hidden state or silently resample an already chosen hypothetical world.
- The representation model distinguishes the permitted source Game Context, the hypothetical Exploration Game Context, and the Displayed Game State. Sharing a rules engine does not make the hypothetical context a canonical source context.
- A useful conformance invariant is: two source games with the same permitted knowledge, supplied the same exploration seed, produce the same hypothetical initial state even if their undisclosed canonical states differ. Repeated exploration must not become a way to probe real secrets.

### Implementation follow-up

The existing flow already branches from the selected visible Game Context, including a History position. `GameExplorations.createExploration` invokes `initializeExplorationState` on its clone and changes the public PRNG cursor; the engine restores that cursor when replay reaches the branch point. Fresh Fish and Sol shuffle their remaining bag/deck; Lowenherz also redistributes unknown politics Cards while preserving pile sizes. These hooks already aim to prevent Exploration from predicting the real hidden future. The new work must preserve that behavior with projected inputs and independent version-3 protected randomness.

The [Exploration implementation](hidden-information-exploration.md) now adds a projected-state population hook. Fresh Fish reconstructs its remaining bag and supplies hypothetical hidden submitted bids. Persisted source/hypothetical checkpoints separate recorded History from playable execution, and inherited Undo checks complete cascades. The canonical initializer remains available for authorized Host View.

### Decisions still open in slice 4

- Whether a Hosted Fork has the same hypothetical-information contract as Exploration; they are distinct lifecycle operations in the current model.
  The user settled recorded History versus playable Undo: source History stays navigable in both directions; inherited Undo stops at the first forward-patched or non-optimistically executable Action cascade. Debug/Admin Host View Exploration must remain available without a projected-state generator. The [Exploration implementation plan](hidden-information-exploration.md) records these requirements and Fresh Fish population slices.

The Exploration privacy and historical-knowledge rules are settled. Slice 5 manages primary representations and privileged inspection without changing Exploration construction or deciding Hosted Fork policy. The subsequent Exploration work implements checkpointed History and inherited Undo barriers. Existing v2 games still have no retroactive privacy-upgrade requirement.

## Completed in slice 5

`GameRepresentations` owns retained Host Game Contexts, ordinary and Acting Player projections, schema-checked representation loading, requested inspection mode, and asynchronous request validity. It receives transport, user/Acting Player selection, loading status, and context publication explicitly. It has no GameSession reference. Request generations stay private; submission, Undo, and reconciliation capture a validity function before awaiting a response.

GameSession retains Action initiation and presentation coordination. Its existing context replacement still clears superseded deliveries, resets History, and immediately publishes the safe state when privileged inspection ends, including when the ordinary reload subsequently fails. Exploration continues to own a separate context and its existing initialization behavior. The pre-existing legacy recovery loader remains a Session adapter with its transport-to-runtime type assumption; the extraction does not impose a visibility schema on older runtimes.

The GameSession public interface, bridge members, injected host dependencies, and transport payloads are unchanged. The new module is internal to the bundled Game Client. Each title needs a UI-only publication to adopt this refactor, with the earlier hidden-information runtime work retaining its separate Logic/UI requirements. No artifact was published.

Validation: 19 shared Frontend Components tests, 38 Fresh Fish client tests, and five Chromium scenarios pass. New integration cases prove that exiting inspection or disposing the Session prevents a pending canonical load from publishing. Existing cases cover in-flight Action responses, rejected privileged Actions, Acting Player changes, canonical refresh after Actions/Undo, projected History, and queued recovery. Both client type checks have zero errors (seven and one existing warnings), and the Frontend Components build passes.

At completion of slice 5, the broader migration audit was outstanding. Slice 6 below records the subsequent audit; actual mixed-publication deployment, older stored-game coverage across publication, and historical-schema policy remain release work. The subsequent [Exploration implementation](hidden-information-exploration.md) now supplies Fresh Fish population, fresh branch randomness, checkpointed History, and inherited Undo barriers. Hosted Fork policy and the broader publication/migration audit remain separate.

## Completed in slice 6

The [compatibility audit](hidden-information-compatibility.md) records the Standards and Spec findings, supported combinations, validation, and release prerequisites. The fixes queue legacy Undo, recover the primary Game during Exploration, preserve recovery when notifications arrive during representation loads, and require explicit host API support before treating a requested Host View as canonical. New browser regressions and stored v1/v2 auction cases cover these boundaries.

The next release-critical slice is publication and History compatibility: settle old loaded-client delivery (P3) and historical-schema loading (C3), then exercise the chosen policy with actual old/new artifacts. Projected hydration/Action discovery and Hosted Fork policy remain separate decisions. No publication was performed.

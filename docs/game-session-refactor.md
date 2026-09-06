# Game Session development slices

This is the completed development-slice record for the hidden-information GameSession refactor. Reconciliation, representation management, and notification handling now have distinct owners. The [current completion list](hidden-information-compatibility.md#remaining-development-slices) tracks operational and release work; no additional broad GameSession refactor is required by this project.

## Constraints

- Preserve GameSession's public interface, subclass hooks, presentation lifecycle, and injected host contract.
- Keep canonical and projected delivery behavior, historical execution versions, optimistic fallback, and Undo semantics covered by the existing tests.
- Existing v2 games have no privacy-upgrade requirement. They must remain playable under newer code.
- Extract ownership and algorithms together. New modules receive their dependencies explicitly and do not reach into private GameSession state.
- Slices 1–3 make no fork/exploration policy, ETag, publication, or unrelated presentation changes. Slice 4 records the exploration decisions before further implementation.

## Original slices (completed)

1. **Accepted-history reconciliation.** Extract application of accepted Actions, complete replay suffix replacement, checksum verification, and reconstruction from a legacy Undo manifest. Verify public module outcomes against canonical host fixtures and preserve the existing GameSession integration tests.
2. **Queued delivery and recovery.** Move pending-update ordering, busy deferral, recovery after failures, incremental synchronization, and full reload into the reconciliation module. Keep perspective/representation selection in GameSession; a stale response must not overwrite a newer representation.
3. **Submission and Undo integration.** Route direct authoritative responses and optimistic acceptance through the same reconciliation algorithms. Remove duplicate history mutation and trace-comparison paths from GameSession. Preserve local/hotseat execution and subclass entry points.
4. **Fork/exploration design discussion.** Settle source randomness, unknown information, retained knowledge, and the relationships among primary, exploration, and displayed contexts. The final decisions and implementation are recorded below.
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
- [x] Slice 4: Fork/Exploration decisions and implementations — hypothetical Exploration; real canonical Forks
- [x] Slice 5: representation management
- [x] Slice 6: repository compatibility audit, forward-play policy, and major-version reload
- [x] Follow-up: notification ownership extraction
- [x] Follow-up: canonical validation and shared projected hydration

## Completed in slices 1–3

`GameReconciliation` owns pending delivery and recovery state, accepted Action application, complete suffix replacement, legacy Undo manifest reconstruction, incremental synchronization, and optimistic acceptance. The module receives transport and presentation/representation callbacks explicitly; it has no GameSession reference. GameSession retains user Action initiation, local/hotseat execution, perspective selection, typed context loading, notifications at the host seam, and the existing presentation hooks.

Replacement history is constructed and checksum-validated before it is published. Both incremental and full-reload responses check whether the requested representation is still current. The existing GameContext loader's transport-to-runtime type assumption remains in GameSession for the later representation/hydration work; this extraction does not introduce a new state schema or migrate stored games.

The GameSession constructor and bridge contract remain unchanged. GameContext and GameReconciliation have additive package exports for composition and direct conformance tests. No Game Runtime behavior or host payload changed, and no publication was performed.

Validation: 19 shared Frontend Components tests, 36 Fresh Fish client tests, and five Chromium scenarios pass. Both affected client type checks report zero errors; their existing Svelte warnings remain. The Frontend Components build passes. Tests cover projected and legacy Undo, reordered optimistic submission, rollback on invalid replacement, full-reload cancellation, busy delivery, discontinuity recovery, privileged view transitions, and projected History. Cross-publication deployment and the broader compatibility audit were outstanding at this slice; the slice-6 completion record below describes subsequent validation.

The later representation, Exploration, and Fork sections record the completed follow-ups.

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

The existing flow already branches from the selected visible Game Context, including a History position. `GameExplorations.createExploration` invokes `initializeExplorationState` on its clone and changes the public PRNG cursor; the engine restores that cursor when replay reaches the branch point. Fresh Fish and Sol shuffle their remaining bag/deck; Lowenherz also redistributes unknown politics Cards while preserving pile sizes. These hooks already aim to prevent Exploration from predicting the real hidden future. The implemented projected population path preserves that behavior with independent version-3 protected randomness.

The [Exploration implementation](hidden-information-exploration.md) now adds a projected-state population hook. Fresh Fish reconstructs its remaining bag and supplies hypothetical hidden submitted bids. Persisted source/hypothetical checkpoints separate recorded History from playable execution, and inherited Undo checks complete cascades. The canonical initializer remains available for authorized Host View.

### Settled Fork and Exploration decisions

[Canonical Forks](hidden-information-forks.md) preserve the real position, including hidden information and random cursors. The host always supplies canonical source state; Hotseat and the harness already possess it. Historical points remain eligible independently of projected History and Undo barriers, but unsupported reconstruction can fail explicitly.

Exploration uses hypothetical unknowns. Source History stays navigable within the supported schema range; inherited Undo stops at a forward-patched or non-optimistically executable cascade. Debug/Admin Host View Exploration remains available without projected population. Existing v2 games have no retroactive privacy-upgrade requirement.

## Completed in slice 5

`GameRepresentations` owns retained Host Game Contexts, ordinary and Acting Player projections, schema-checked representation loading, requested inspection mode, and asynchronous request validity. It receives transport, user/Acting Player selection, loading status, and context publication explicitly. It has no GameSession reference. Request generations stay private; submission, Undo, and reconciliation capture a validity function before awaiting a response.

GameSession retains Action initiation and presentation coordination. Context replacement resets History and immediately publishes safe state when privileged inspection ends, including when the ordinary reload subsequently fails. Slice 6 subsequently preserves a recovery request for updates arriving after a load snapshot while invalidating superseded payloads. Exploration continues to own a separate context and its existing initialization behavior. The pre-existing legacy recovery loader remains a Session adapter with its transport-to-runtime type assumption; the extraction does not impose a visibility schema on older runtimes.

The GameSession public interface, bridge members, injected host dependencies, and transport payloads are unchanged. The new module is internal to the bundled Game Client. Each title needs a UI-only publication to adopt this refactor, with the earlier hidden-information runtime work retaining its separate Logic/UI requirements. No artifact was published.

Validation: 19 shared Frontend Components tests, 38 Fresh Fish client tests, and five Chromium scenarios pass. New integration cases prove that exiting inspection or disposing the Session prevents a pending canonical load from publishing. Existing cases cover in-flight Action responses, rejected privileged Actions, Acting Player changes, canonical refresh after Actions/Undo, projected History, and queued recovery. Both client type checks have zero errors (seven and one existing warnings), and the Frontend Components build passes.

At completion of slice 5, the broader migration audit was outstanding. Slice 6 and the forward-play follow-up below record its implementation and agreed historical-schema policy. Actual mixed-publication deployment remains release work. The [Exploration implementation](hidden-information-exploration.md) supplies Fresh Fish population, fresh branch randomness, checkpointed History, and inherited Undo barriers.

## Completed in slice 6

The [compatibility audit](hidden-information-compatibility.md) records the Standards and Spec findings, supported combinations, validation, and release prerequisites. The fixes queue legacy Undo, recover the primary Game during Exploration, preserve recovery when notifications arrive during representation loads, and require explicit host API support before treating a requested Host View as canonical. New browser regressions and stored v1/v2 auction cases cover these boundaries.

## Completed: forward-play compatibility and major reload

Current projected loading no longer requires every historical schema to remain compatible. Historical projection retains compatible recent cascades and replaces the unavailable prefix with public Action envelopes without patches. History and Undo stop at that position; existing reconciliation can reload the current state when a replacement cannot be replayed. The backend validates the Undo range before writing state. Existing v1/v2 forward-play and randomness behavior remains covered.

The Site Frontend continues to use its existing major-version reload. Version-change precedence and the Logic-major error callback are fixed; a patch notice cannot cancel a required reload. The [compatibility record](hidden-information-compatibility.md) describes validation, deployment requirements, and the limits of response-driven detection.

## Completed: notification handling

`GameNotifications` owns subscriptions, payload validation, Perspective filtering, routing accepted deliveries into reconciliation, discontinuity recovery requests, and listener cleanup. It receives explicit callbacks for context/representation operations and holds no GameSession reference. GameSession retains public Action initiation and presentation coordination. This is an internal bundled-client extraction, with no new host bridge capability or payload shape.

## Completed: canonical validation and projected authoring

`9f128dd6` adds complete-state validation at canonical operations. `808537fe` integrates shared hydration and locally decidable owner visibility, with a permanent private-hand flow across Common, backend representations, and actual browser GameSession behavior. See the [authoring contract](DESIGN.md#schemas-and-hydration) and [integration validation](projected-hydration-prototype.md#integration-follow-up).

The completed slices have not published artifacts. Performance, diagnostics, and mixed-publication verification remain on the [completion list](hidden-information-compatibility.md#remaining-development-slices).

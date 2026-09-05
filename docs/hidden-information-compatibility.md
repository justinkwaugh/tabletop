# Hidden-information compatibility and completion review

Reviewed 2026-09-05 against `3fd8c5e5...4740bfef`, followed by the slice-6 fixes in the working tree. This completes the repository compatibility audit; it does not establish release readiness. The [wider review](hidden-information-review.md) retains the unresolved authoring and publication requirements. Hosted Fork policy remains separate from the completed hypothetical Exploration implementation.

## Standards

The independent standards review found one new violation of [ADR 0004](adr/0004-game-ui-host-bridge-contract.md): a newer Game UI assumed an older injected host API understood `getGame(id, { hostView: true })`. The older implementation ignores the extra argument. Against the current backend it returns an ordinary projection, which the new UI labelled Host View and used for full-state Exploration.

The fix adds optional `TabletopApi.supportsHostView`. A Game Session checks for explicit support before requesting a canonical representation. An older Site Frontend can continue ordinary play; attempting Host View asks the user to reload the site. The current API also rejects a perspective-bearing response to a Host View request. The capability is optional for old host implementations, and existing method signatures and result shapes remain compatible. It is capability discovery, not authorization: the backend still authorizes Host View.

No additional actionable smell-baseline findings were identified. Reconciliation, representation selection, and hypothetical History now have distinct owners; this slice keeps those boundaries rather than moving their algorithms back into GameSession.

## Spec

Three additional delivery defects were reproduced and fixed:

1. **Legacy Undo while busy.** The old notification handler returned during processing or presentation, discarding an accepted Undo. It now queues the compact replay manifest with surrounding deliveries. Manifest resolution happens when the queue drains, after preceding Actions have arrived. The existing replacement algorithm validates the complete suffix before publishing it.
2. **Recovery during Exploration.** `checkSync` returned early in Exploration even though notifications continued to update the primary context. A discontinuity or failed delivery could therefore be consumed without recovery. Synchronization now targets the primary context while the branch remains displayed. The sample and its History source stay unchanged; leaving Exploration exposes the recovered primary state.
3. **Notifications arriving during representation loads.** A full response contains the server snapshot taken before some subsequently received notifications. Publishing it previously cleared those queued updates unconditionally. Representation replacement now invalidates their representation-specific payloads while retaining a synchronization request. Recovery runs after the load settles, using the selected ordinary or Host representation. It never applies a Player patch to canonical Host state.

These fixes implement the existing slice-6 requirement to exercise notification ordering, in-flight work, History, and privilege transitions. They add no new Exploration or Hosted Fork policy.

## Compatibility matrix

| Combination or transition | Evidence and behavior | Remaining limit |
| --- | --- | --- |
| Current Game Client with current transport | Projected replay, legacy replay, authoritative submission, optimistic acceptance, Undo, and recovery suites pass | These conformance fixtures are not historical deployed artifacts |
| New Game UI with older injected Site Frontend API | Missing Host View capability is tested; ordinary loading retains the original interface | Reload the Site Frontend before using Host View |
| Older Game UI with newer Site Frontend | Added capability is optional and ignored by older code; existing result fields remain available | A UI predating projection cannot interpret new projected delivery; P3 below remains open |
| New API with an older canonical backend response | Host View accepts the existing canonical response without a Perspective field; Undo derives replay from legacy fields | Does not promise new runtime compatibility with arbitrary older title logic |
| Host request receiving a Player/spectator projection | API rejects it before publishing a Host Context | Older APIs must first adopt the capability |
| Host/ordinary reload with a notification arriving after its snapshot | Both browser cases recover the latest primary state with the correct bag visibility | Concurrent publication of incompatible rules still needs the P3/C3 strategy |
| Busy legacy and projected Undo | Browser cases cover processing and pending presentation, with surrounding deliveries | Legacy manifests still require referenced Action records or recovery |
| Exploration with primary discontinuity | Browser case preserves the sample and returns to current projected play | Hosted Fork is a separate operation |
| Stored v1/v2 state | Existing seeded initialization tests plus new auctions without `submitted` or `protectedPrng` cover projection, last bid, resolution, and canonical/projected Undo | No retroactive privacy guarantee; not a blanket promise for arbitrary historical schemas |
| New title with no visibility declaration | Existing engine tests create systemVersion 3 independently of visibility | Protected randomness alone does not make canonical delivery private |
| Older saved Exploration without a checkpoint | Existing legacy loading/continuation tests remain passing | Reading new checkpointed branches with older clients is not established |
| Current saved Exploration | History, save/load, partial-cascade continuation, inherited Undo barriers, and simulated Undo remain covered | Per-title population is still required for ordinary projected Exploration |

## Publication and rollback

The new optional Host View capability belongs to the host-injected API contract. Publish the Site Frontend to make it available, and republish each affected title's UI Artifact to adopt the client recovery fixes and capability check. Old loaded Site Frontends remain safe and ordinary play remains available; they require a reload to use Host View in the new UI.

This slice changes shared Game Client behavior and tests, not game rules or stored canonical schema. A title can adopt this slice with a UI-only publication whose embedded runtime matches its selected Logic Artifact. The accumulated hidden-information project has separate runtime changes: Fresh Fish still requires matching Logic/UI artifacts when adopting those changes. The currently checked-in versions are not a release plan, and this audit does not bump or publish them.

The project must resolve these release prerequisites:

- **P3: old loaded UIs and delivery changes.** A pre-projection client cannot process the new notifications or projected Actions. The title-specific HTTP major-version gate does not cover ordinary load/sync or idle realtime delivery. Choose and enforce a rollout boundary that makes those clients reload before projected delivery reaches them. Merely changing the title major version does not cover idle clients.
- **C3: historical schema compatibility.** Initial projected loading reconstructs every past state with the current schema. A supported latest state can fail to load when an earlier state predates a newly required field. Choose historical schema/projector support, migration of reconstructed states, or an explicit History boundary. Latest-state operational compatibility must remain sufficient to continue a surviving Game.
- **Rollback.** Once a newer runtime has written canonical state, old logic needs explicit reverse compatibility; otherwise use a forward fix. Existing v2 instances keep their original execution version and do not require privacy conversion. New checkpointed local Explorations also need an explicit old-reader boundary if UI rollback is to be supported.

The low-risk projection ETag issue C2 remains deliberately deferred. Host View capability discovery does not resolve P3, C3, or cache migration.

## Validation

The slice adds tests for missing host capability and projected Host responses, five Chromium scenarios for busy legacy Undo, Exploration discontinuity, and in-flight representation loads, and two legacy auction cases. See the final validation record below for suite totals and hosted checks.

## Remaining development slices

1. **Publication and History compatibility design:** settle P3 and C3, then implement and test the selected boundaries with actual old/new artifacts and a stored v2 Game. This is the next release-critical slice.
2. **Projected authoring contract:** settle required-field hydration and legal-Action discovery for owner-known private hands; validate with one realistic private-hand flow. Fresh Fish's canonical-hydratable projection does not settle the general contract.
3. **Hosted Fork decision:** choose whether it preserves canonical history/randomness or samples a hypothetical world, then fix C1 source selection with service-level coverage. Ordinary Exploration is already hypothetical.
4. **Completion work:** measure long-history projection/checkpoint cost, provide useful fallback diagnostics, and condense the authoring documentation. C2 remains deferred unless release testing elevates its risk.

## Final validation record

261 automated tests pass: 119 Common, 30 Fresh Fish logic, 31 backend representation/notification/fork, 20 shared Game Client, 46 Fresh Fish client, and 15 Chromium scenarios. Both client type checks report zero errors, with the existing seven shared-client and one Fresh Fish UI warnings. Common/Fresh Fish/shared-client builds and `git diff --check` pass.

The repository runner built and staged Fresh Fish Logic `3.0.0` and UI `5.0.1` and started the actual Site Frontend/backend against local Firestore and Redis. Three separate browser contexts/accounts loaded a started v3 Game. A disk placement reached all three clients through hosted notifications with equal checksums and empty projected bags; hosted Undo returned all three to the prior position. Admin Host View exposed the canonical bag, and exiting restored its projection. Ordinary Exploration populated the hypothetical bag; reloading the client restored projected hosted play. The runner and its application processes were stopped after verification.

This hosted smoke uses the current locally staged artifacts and a test Game created during this audit. It is not a cross-publication deployment test, an upgrade of a persisted historical artifact, a long-history benchmark, or a complete sealed-auction hosted playthrough. A separate public-lobby setup attempt did not preserve all joined slots; that observation was not isolated to the changed code and is not counted as a confirmed hidden-information defect. The successful playthrough used the already-started test Game.

The review found one new Standards violation and three new Spec defects; all four have fixes and regression coverage. Existing P3/C3 release prerequisites and the other explicitly deferred decisions remain open. No artifact was published and no version was bumped.

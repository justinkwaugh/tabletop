# Hidden-information compatibility and completion review

Reviewed 2026-09-05 against `3fd8c5e5...4740bfef`, followed by the slice-6 fixes in `a0586281`, forward-play compatibility, canonical Forks, and shared hydration through `808537fe`. The original audit and its validation are retained below; the [remaining-work section](#remaining-development-slices) is the current completion list. The repository implementation does not establish publication readiness. The [current contract](hidden-information.md) records explicit visibility setup and completed authoring decisions.

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
| Older Game UI with newer Site Frontend | Added capability is optional and ignored by older code; existing result fields remain available | A UI predating projection needs a major-version reload and a compatible current Publication |
| New API with an older canonical backend response | Host View accepts the existing canonical response without a Perspective field; Undo derives replay from legacy fields | Does not promise new runtime compatibility with arbitrary older title logic |
| Host request receiving a Player/spectator projection | API rejects it before publishing a Host Context | Older APIs must first adopt the capability |
| Host/ordinary reload with a notification arriving after its snapshot | Both browser cases recover the latest primary state with the correct bag visibility | Actual old/new artifact publication remains an operational release check |
| Busy legacy and projected Undo | Browser cases cover processing and pending presentation, with surrounding deliveries | Legacy manifests still require referenced Action records or recovery |
| Exploration with primary discontinuity | Browser case preserves the sample and returns to current projected play | Hosted Fork is a separate operation |
| Stored v1/v2 state | Existing seeded initialization tests plus new auctions without `submitted` or `protectedPrng` cover projection, last bid, resolution, and canonical/projected Undo | No retroactive privacy guarantee; not a blanket promise for arbitrary historical schemas |
| New title with no visibility declaration | Existing engine tests create systemVersion 3 independently of visibility | Protected randomness alone does not make canonical delivery private |
| Older saved Exploration without a checkpoint | Existing legacy loading and forward-play tests remain passing | Reading new checkpointed branches with older clients is not established |
| Current saved Exploration | History, save/load, cascade-boundary creation and exact History return, inherited Undo barriers, and simulated Undo remain covered | Per-title population is still required for ordinary projected Exploration |

## Publication and rollback

The new optional Host View capability belongs to the host-injected API contract. Publish the Site Frontend to make it available, and republish each affected title's UI Artifact to adopt the client recovery fixes and capability check. Old loaded Site Frontends remain safe and ordinary play remains available; they require a reload to use Host View in the new UI.

The follow-up also changes backend History projection and Undo validation, and the Site Frontend's version-change handling. Deploy the backend, publish the Site Frontend, and republish each affected UI Artifact to adopt those changes. Game rules and stored canonical schema are unchanged. A title can adopt this slice with a UI-only publication whose embedded runtime matches its selected Logic Artifact. The accumulated hidden-information project has separate runtime changes: Fresh Fish still requires matching Logic/UI artifacts when adopting those changes. The currently checked-in versions are not a release plan, and this audit does not bump or publish them.

The user clarified the next slice on 2026-09-05: use the existing frontend major-version reload mechanism, and require forward play from the latest stored state without requiring historical compatibility. These are implementation and rollout checks, not open choices about the compatibility guarantee.

- **P3: major-version reload implemented and tested.** Reuse `X-Tabletop-Version` and the title UI version header with the existing five-second Site Frontend reload. Required major/rollback notices now survive later minor/patch notices, including both headers on one response. The Logic-major rejection handler retains its API instance and records the reload notice. No new compatibility protocol was added. Publish compatible artifacts before announcing the breaking major version. An idle client detects the change on its next HTTP response; the existing delay still permits in-flight response handling and is not an immediate execution barrier. The title Logic-major gate rejects incompatible Action requests. A real old/new artifact rollout remains a release check.
- **C3: forward play independent of History fixed.** Current state projection remains mandatory and fails explicitly for an unsupported current state. Historical cascades are reconstructed from newest to oldest. The first incompatible cascade and all earlier Actions retain only the existing redacted public envelope, without payloads or forward/undo patches; compatible recent cascades remain available. IDs, indexes, Action count, and checksum continuity survive. Count/index corruption in the supplied history still fails explicitly. Initial loading, sync, and missing-Action response assembly share this behavior. History navigation and client Undo stop at the missing-patch position; the backend rejects Undo across unavailable projected History before writing state. Incremental replay that cannot cross that position uses existing current-state reload recovery. Title-owned migration/hydration of the latest stored state is still required; migration of every historical state is not.
- **Rollback.** Once a newer runtime has written canonical state, old logic needs explicit reverse compatibility; otherwise use a forward fix. Existing v2 instances keep their original execution version and do not require privacy conversion. New checkpointed local Explorations also need an explicit old-reader boundary if UI rollback is to be supported.

The low-risk projection ETag issue C2 remains deliberately deferred. This slice does not change cache migration or the low-risk C2 decision.

## Validation

The slice adds tests for missing host capability and projected Host responses, five Chromium scenarios for busy legacy Undo, Exploration discontinuity, and in-flight representation loads, and two legacy auction cases. See the final validation record below for suite totals and hosted checks.

## Remaining development slices

The projected authoring slice is integrated: canonical schemas remain strict; shared hydrated types and validators derive from the visibility schema; `Policy.Owner` supports owner-known private hands. Permanent Common, backend, and Chromium GameSession fixtures cover the private-hand flow, including legal discovery, optimistic play, protected-read fallback, delivery, and Exploration. See the [integration record](projected-hydration-prototype.md#integration-follow-up) and [authoring contract](DESIGN.md#schemas-and-hydration).

Explicit visibility setup is settled: a title relying on secret randomness or hidden information registers its state and Action projectors. Common-field projection is not automatic, and a no-hidden-information title needs no visibility registration. The documentation consolidation is complete: [the current contract](hidden-information.md), [scenario reference](hidden-information-scenarios.md), and historical slice records have distinct purposes. The planned GameSession extractions are complete.

1. **Performance measurement:** benchmark long-history materialization, larger states/cascades, multiple Player Perspectives, and Exploration checkpoint size. Establish useful latency/memory targets before adding projection caches or equivalent-Perspective grouping.
2. **Fallback diagnostics:** distinguish expected protected reads from unexpected execution exceptions, Action-trace differences, and projected-state/replay mismatches. The proposed surfaces are opt-in debug output in the browser console/local harness for client attempts and structured backend logs for host classification. Include Action identity/type, a reason, and the first affected transition/path where safe; do not send canonical values or host exception details to ordinary clients. Expected fallback should not generate routine player warnings. A dedicated diagnostics panel is not currently planned. This diagnostic work is not yet implemented.
3. **Publication and rollback verification:** rehearse an already-open older client, the current client, existing v2 forward play, a new title without visibility, projection-rule changes, and unsupported historical schemas using actual old/new artifacts. Deploy the backend and Site Frontend and publish affected UI Artifacts; Fresh Fish requires matching Logic/UI artifacts for its accumulated runtime changes. Verify the old-reader boundary for saved Exploration and reverse-state compatibility before allowing rollback after newer writes. Publish compatible artifacts before announcing a breaking major version. The private-hand conformance fixture is not a deployed title.

C2 projection ETags remain deliberately deferred as low risk unless release evidence changes that assessment. Additional titles need their own declarations, knowledge rules, and projected Exploration population as they adopt hidden information. General custom-policy execution, arbitrary replacement adapters, a universal knowledge model, and tighter transport authorization are outside the completed contract, not prerequisites silently added to these slices.

## Validation at the compatibility slice

275 automated tests pass: 123 Common, 30 Fresh Fish logic, 32 backend representation/notification/fork, 28 shared Game Client, 46 Fresh Fish client, and 16 Chromium scenarios. New cases cover incompatible historical states and Actions, malformed/missing patches, current-state rejection, preserved checksums and confidentiality, continued browser play/History/Undo, and version-change precedence. Both client type checks report zero errors, with the existing seven shared-client and one Fresh Fish UI warnings. Common/Fresh Fish/shared-client builds and `git diff --check` pass.

The repository runner built and staged Fresh Fish Logic `3.0.0` and UI `5.0.1` and started the actual Site Frontend/backend against local Firestore and Redis. Three separate browser contexts/accounts loaded a started v3 Game. A disk placement reached all three clients through hosted notifications with equal checksums and empty projected bags; hosted Undo returned all three to the prior position. Admin Host View exposed the canonical bag, and exiting restored its projection. Ordinary Exploration populated the hypothetical bag; reloading the client restored projected hosted play. The runner and its application processes were stopped after verification.

This hosted smoke uses the current locally staged artifacts and a test Game created during this audit. It is not a cross-publication deployment test, an upgrade of a persisted historical artifact, a long-history benchmark, or a complete sealed-auction hosted playthrough. A separate public-lobby setup attempt did not preserve all joined slots; that observation was not isolated to the changed code and is not counted as a confirmed hidden-information defect. The successful playthrough used the already-started test Game.

The forward-play follow-up used the same runner and three separate accounts against persisted Actions. A test-only old Undo patch was changed to reconstruct a state without the required board. All accounts still loaded the current projection; the backend rejected a direct Admin Undo across that record before persistence. A new hosted Action, its notifications, Undo, and another Action produced matching checksums on all three clients without exposing their bags. The test patch was restored afterward. Injecting only a `17.0.0` response header into the actual `16.1.3` Site Frontend triggered its existing reload after 5.026 seconds. This verifies the real UI response path, not publication of an actual older/newer artifact pair. The runner was stopped after testing.

The review found one new Standards violation and three new Spec defects; all four have fixes and regression coverage. C3 is fixed and the P3 mechanism is implemented and tested; actual cross-publication rollout remains release work alongside the explicitly deferred decisions. No artifact was published and no version was bumped.

## Protected dev harness compatibility

The optional `hostPerspective` Game Session constructor option lets the dev harness supply a Player/Spectator projection backed by a local authoritative API. Local storage and hotseat metadata remain unchanged. Omitted options retain existing hosted and ordinary hotseat behavior; Site Frontend does not need to send the new option or implement a new API capability.

The dev harness loads matching source-tree UI code. A UI-only Publication is needed for each Game Title that should adopt the updated shared Game Client; existing UI Artifacts continue using their bundled implementation. No Logic Artifact change, stored-state migration, or coordinated Site Frontend publication is required for this harness feature.

## Reproducible randomness adoption (2026-09-06)

Fresh Fish Logic 4 / UI 6, Sol Logic 6 / UI 7, and Löwenherz Logic 3 / UI 3 adopt `randomnessVersion: 1`. Publish each matching Logic/UI pair with the updated backend and Site Frontend. Their Logic major gate and UI major notices require old loaded clients to reload. Other titles need no publication for this slice and keep legacy initialization; republishing their UI is necessary only to adopt the shared client improvements.

`GameService.createGame(game, options?)` and `TabletopApi.createGame(game, options?)` add an optional argument. Older callers continue to work. The optional `supportsReproductionSeed` capability lets the new creation form reject supplied reproduction seeds when injected into an older host, instead of silently dropping them. The backend requires Admin authorization for supplied master seeds and rejects them for runtimes lacking the new initialization capability. No private seed enters public Game metadata or notifications.

Old v1/v2 and existing numeric v3 saves keep their stored generators and remain playable with the updated runtimes. A lobby created before adoption has no private seed document; starting it generates a fresh master seed and persists its derived public seed. It has no gameplay state to migrate. Forks bypass initialization and preserve their saved cursors. Older Logic Artifacts cannot read new ChaCha20 saves, so rollback after new games start requires a forward-compatible fix, not selecting an old artifact.

The crypto dependencies require Node 20.19 or newer; the production Node 22 image satisfies that floor. Deployment and mixed-publication rollout verification remain release work.

## Backend-only deployment and older runtime interfaces (2026-09-06)

A backend-only deployment keeps the manifest-selected Logic/UI and Site Frontend artifacts unchanged. Production loads the selected Logic bundle from static storage; it does not substitute the game source packages built in this checkout. Runtimes without visibility registration retain canonical delivery and legacy notifications, and runtimes without `randomnessVersion: 1` retain numeric PRNG initialization. Repository game version bumps do not select new publications by themselves.

The compatibility audit reproduced a blocker at the Common engine / loaded runtime boundary: older hydrated states provide `getPrng()`, while the updated `MachineContext` called `getPublicPrng()` when generating System Action IDs. System Action generation now constructs its PRNG from the stable persisted public `prng` cursor directly. This preserves IDs and invocation counts without requiring either accessor on an older runtime. It does not restore the removed game-authoring alias or change v1 causal IDs.

Permanent regression tests remove the newer accessors from a runtime's hydrated state and verify v1/v2/v3 cascade execution, flattened replay, Undo, and redo. All 206 Common and backend representation/notification tests pass. A separate compatibility probe rebuilt unmodified Common and Fresh Fish source from commit `3fd8c5e5` in a temporary checkout. The current backend engine using that old Fresh Fish runtime and the old client engine produced identical state, IDs, checksums, and cursors through nine Actions including automatic auction cascades, Undo, and redo. The probe covers both an existing v2 Game and a new Game initialized by the current engine using the old runtime.

This validates the identified runtime-interface boundary and legacy transport contracts. It is not an end-to-end rehearsal against the currently published production artifacts. Backend-only rollout leaves the publication manifest unchanged; adopting the new privacy/seeding runtimes remains a separate matching Logic/UI publication.

## Protection is fixed at Game Initialization

The staged rollout is backend, Site Frontend, then matching title Logic/UI artifacts. `Game.protectedInformation` is set only when Game Initialization uses a visibility-aware runtime. Existing unmarked v1/v2 Games and v3 Games started during the interim old-artifact stage retain canonical delivery, notifications, synchronization, Undo, and canonical Exploration. Waiting lobbies started after the title publication adopt protection. Forks preserve the source marker, including when a hosted Fork later starts. Ordinary updates cannot change it.

A shared visibility resolver requires the persisted marker and the registered projector. A protected Game whose selected runtime lacks its projector is rejected even for Host View, rather than falling back to ordinary public delivery. This is independent of randomness versioning and does not reseed existing state. The marker is additive to the host bridge's existing Game metadata. Publish the backend and Site Frontend first; each privacy-adopting title then requires matching Logic/UI artifacts with this change. Older unprotected artifacts need no republication.

Protected development Games created before this marker must be explicitly marked from known provenance or recreated. There is no automatic migration based on system version or PRNG presence.

Validation covers initialization, forbidden metadata updates, unmarked v1/v2/v3 delivery, ETags, synchronization, Undo, legacy notifications, missing-projector rejection, canonical Exploration under the newer client, and inherited Fork protection. The shared-client and Fresh Fish browser suites pass all 30 scenarios, including legacy Undo notifications with a visibility-aware runtime.

A local hosted migration rehearsal used Fresh Fish Logic 4 / UI 6 and three separate accounts. Two persisted Games were initialized using unmodified archived Fresh Fish source from `3fd8c5e5`: one with its original Common engine (v2), and one with the current Common engine (interim v3). Both remained unmarked and fully canonical after loading the new publication. An unmarked, prepared waiting lobby started through the current backend and persisted protection. All three cases passed loading, play, notifications, Undo, refresh, Exploration, canonical admin access, and historical Fork creation/loading with the correct inherited protection. Protected Host View entry and exit preserved concealment. The runner was stopped and the temporary manifest changes restored.

The rehearsal again encountered the previously observed public-lobby join problem: the next joining account overwrote the preceding joined slot, leaving the Game waiting for players. The successful initialization case therefore used a prepared lobby; complete join-to-start and hosted Fork restart were not established by this run. The notification transport also reported connection-closed errors while navigating between Games; the asserted state/checksum and delivery checks passed. This is a migration rehearsal with archived runtime-generated saves and current hosted artifacts, not a full rollout of historical Site Frontend artifacts or a production deployment.

## Lobby membership follow-up

The lobby defect was isolated to two existing backend behaviors. Joins and declines built a replacement player list before the Firestore transaction; a newer membership list read during validation or a transaction retry could therefore be overwritten. Redis write-lock acquisition also swallowed WATCH conflicts and proceeded with the database write without invalidating cached metadata. A hosted fork reproduced this second failure directly: Firestore contained three joined players and `waitingToStart`, while Redis retained a reserved player and `waitingForPlayers`.

Membership changes now select and modify players from the transaction's current document. Notifications use the committed slot, and user game-list invalidation includes both previous and new members. Redis write-lock acquisition retries WATCH conflicts and refuses the datastore write if acquisition remains unsuccessful. Overlapping writers retain one shared lock prefix.

Verification: 83 backend-service tests passed, including new stale-read, concurrent public/private join, decline, final-slot, notification, cache invalidation, and lock-conflict regressions. The real Firestore/Redis concurrent-join reproduction preserved all players. A three-account hosted Fresh Fish run completed public lobby creation, joins, start and play, followed by fork creation, joins, start and independent play; all three fork clients received projected state and the source state remained unchanged. This closes the join-to-start and hosted Fork restart gaps above. The runner was stopped and the temporary manifest restored. These fixes change no API or artifact contract and require only the backend deployment; they do not reconstruct player associations already overwritten by the old code.

The subsequent [cache/store coherence audit](./cache-coherence-audit.md) found broader protocol and dependency failures that the lobby regressions did not cover. The [correctness work](./cache-coherence-correctness-plan.md) repairs the existing cache protocol, transaction dependencies, Game data snapshots and manifest refreshes. Key-format changes and further deployment/recovery verification are deferred by user decision; the documented operating assumptions remain applicable.


## Config-based visibility policies

Visibility projectors now accept an optional third context argument containing persisted public Game configuration. Cascade/history/result helpers accept an optional `game`, with existing `replay.game` callers retained. Old string policies and old projector implementations remain compatible without using the new argument. Config-dependent projectors fail closed when called without config context; no default silently authorizes an older caller.

Deploy the backend before publishing matching Estates Logic and UI artifacts that use conditional policies. The UI Artifact bundles the updated Common execution guard and shared Game Client; Estates must be republished to adopt these changes. A separate Site Frontend deployment is required only if the earlier visibility-support changes are not already deployed. Other title artifacts need no republication unless they adopt config conditions. No host bridge message or persisted Game shape changes: `Game.config` already crosses that boundary. No package versions are adjusted here; deployment assigns them.

Estates uses one canonical schema and a directly derived projected schema. The optional state `hiddenMoney` flag is retained for legacy auction behavior, not policy evaluation. Unmarked v2 and numeric v3 Games still use canonical delivery and preserve forward-play behavior, checksums, and random cursors. Existing protected-data rollback constraints continue to apply. Tests cover config-aware projection and guarding, load/sync/results/Undo without a replay runtime, per-audience notifications, historical final disclosure, and saved v2 continuation. Browser checks use the local development harness, not a hosted rollout rehearsal.

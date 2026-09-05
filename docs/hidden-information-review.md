# Hidden-information implementation review

Reviewed 2026-09-04 from `3fd8c5e5` (immediately before the implementation commits) through `0d32b361` and the current uncommitted worktree. The specification is `hidden-information.md` plus the user's handoff and subsequent corrections. The unrelated Dockerfile edit is excluded.

The [slice-6 compatibility audit](hidden-information-compatibility.md) extends this review through `4740bfef` and the subsequent recovery/capability fixes. It records current validation and the next release-critical work.

The core direction is promising: canonical execution, schema-based projections, independent projected patches, and whole-cascade replay classification fit the scenarios exercised so far. This is not ready for general deployment. The reproduced recovery and execution-guard defects S1, S2, P1, and P2 are now fixed. Hosted Fork policy, publication compatibility, and the remaining design boundaries below still need attention. The user deferred C1 for discussion with exploration and classified C2 as low risk.

## Change made before this review

`GameEngine.generateUninitializedState` now creates version-3 states with both PRNGs regardless of visibility registration. Existing state versions still select historical execution behavior. The user clarified on 2026-09-05 that existing v2 Game Instances are not expected to become private under the v3 runtime. Their migration requirement is continued play with historical behavior; retroactive privacy conversion is outside scope. Old independently published artifacts remain unchanged until they adopt the new engine. Tests exercise creation with and without visibility and retain the version-1/version-2 execution characterizations.

The randomness guidance now distinguishes predictable entropy from publicly revealed outcomes. Ordinary gameplay dice generally need the protected stream. A game author still needs to mark an outcome-revealing Action `revealsInfo`; consuming protected randomness alone does not imply a reveal, because a hidden shuffle may reveal nothing to any Player.

## Standards and developer experience

These findings separate reproduced behavior from design judgments. No additional material hard coding-policy violation was identified beyond the behavioral and architectural issues below.

### S1 — Numeric Record keys bypass the execution guard (P2, fixed)

The guard previously parsed numeric strings as array indexes before checking Record schemas. A protected numeric key could return `undefined` or bypass mutation checks.

Record handling now precedes array-index parsing. [projectedExecutionGuard.spec.ts](/workspace/libs/common/src/game/visibility/projectedExecutionGuard.spec.ts) covers numeric and named keys through reads, writes, membership, deletion, definition, and property descriptors. It also checks nested protected fields under numeric keys.

### S2 — Collection omission can silently change rule answers (P2, fixed)

A protected-item array `[1, 2]` previously projected to `[]`, and guarded `.length` or `.every(...)` could interpret that incomplete view as a complete collection.

The guard now rejects access to an Array or Record when its member schema can omit entries for the current Perspective. This is a conservative schema check: even an empty projection cannot prove canonical emptiness. Union branches and reference definitions participate in the check. Object enumeration also rejects potentially omitted additional properties.

Public collection membership remains usable when only nested fields are protected, when an Actor policy proves every member visible, or when whole-member replacement retains membership. Individual protected values remain guarded. Custom policies that cannot prove membership locally still require authoritative execution; the broader Action-discovery limitation S3 remains open.

The public-projector tests cover empty and nonempty arrays, shifted union indexes, Record enumeration, reference schemas, custom policies, and preservation of safe public operations. The A9 availability scenario now reports the collection path where execution stops.

### S3 — Custom-policy visibility does not yet support ordinary Action discovery (DX limitation)

[valueProjector.ts:555](/workspace/libs/common/src/game/visibility/valueProjector.ts:555) deliberately rejects custom policies during guarded execution, even when the projected value is actually visible to its owner. [gameSession.svelte.ts:409](/workspace/libs/frontend-components/src/lib/model/gameSession.svelte.ts:409) converts unavailable-value errors into an empty list of valid Actions.

This is conservative, but it makes a natural Hearts/Go Fish/Rummy implementation difficult: an availability rule inspecting the current Player's own hand can advertise no Actions. Automatic authoritative submission fallback does not help when the UI cannot discover an Action to submit. The built-in actor policy expects a root `playerId`; it is not a generic nested Player-state ownership policy.

Provide locally provable owner/team/knowledge policies, a permitted-view availability interface, or authoritative availability. The choice is still open; do not resolve it by trusting arbitrary custom policy code against incomplete state.

### S4 — Projection types and client hydration have an unfinished boundary (design judgment)

`GameRuntime.visibility?: GameVisibility<T>` in [gameDefinition.ts:29](/workspace/libs/common/src/game/definition/gameDefinition.ts:29) does not carry the concrete projected shape into the Game Session. The session still uses the canonical hydrator, whose `Hydratable` constructor validates the canonical schema.

Fresh Fish's neutral PRNG, empty bag, and optional bid fields fit that schema. Other supported-looking declarations do not: omitting a required secret scalar can produce a valid projection that the canonical hydrator rejects before patch application. The schema-level API is more flexible than the integrated client contract.

Either document and validate a restricted, canonical-hydratable projected shape for this phase, or introduce an explicit projected hydration/rendering boundary. A second rules implementation is not required. TypeBox composition metadata and static inference should have conformance coverage around whichever boundary is selected.

### S5 — Game Session responsibilities are growing together (complexity judgment)

Follow-up on 2026-09-05: the first three [Game Session refactor slices](game-session-refactor.md) extract accepted-history reconciliation, queued delivery/recovery, and submission/Undo response handling into `GameReconciliation`. Slice 5 now extracts retained host contexts, projections, representation loading, and request cancellation into `GameRepresentations`. GameSession retains Action initiation, mode selection, and presentation publication. The original concern below motivated those extractions; Fresh Fish hypothetical Exploration is now implemented through an optional population hook, with checkpointed History and conservative inherited Undo. Broader publication compatibility validation remains outstanding.

The privileged representation lifecycle introduced request generations, asynchronous loading, perspective switching, and authoritative reconciliation alongside existing history and presentation coordination. These algorithms now live in [gameRepresentations.svelte.ts](/workspace/libs/frontend-components/src/lib/model/gameRepresentations.svelte.ts) and [gameReconciliation.ts](/workspace/libs/frontend-components/src/lib/model/gameReconciliation.ts).

The focused collaborators address the immediate ownership concern before more modes are added. The busy-Undo finding below is an example of why presentation activity and authoritative data handling need distinct responsibilities. This is not a request for a broad rewrite of unrelated session behavior.

### S6 — Replay classification needs operational evidence (unsettled performance constraint)

[gameVisibility.ts:215](/workspace/libs/common/src/game/visibility/gameVisibility.ts:215) executes the complete cascade and then replays each supplied record to prove equivalence. History materialization repeats that per cascade, and backend delivery repeats it for requester, spectator, and Player perspectives. It also retains reconstructed state boundaries in memory.

This is a strong correctness check, but the cost and purity assumptions have not been measured under long histories and larger states. Catching all probe errors safely selects patches but gives authors little explanation for unexpected loss of replay. Add host-side diagnostics and representative benchmarks. Do not add persistent perspective caches or a second runtime before measurements justify them.

## Specification and hosted behavior

### P1 — Player-topic discontinuities do not trigger synchronization (P1, fixed)

Game Sessions now synchronize after a User-channel discontinuity when the runtime has visibility, as well as after a Game Instance-channel discontinuity. Existing hotseat and exploration synchronization rules still apply.

[authoritativeAction.spec.ts](/workspace/games/fresh-fish-ui/src/lib/stores/tests/authoritativeAction.spec.ts) exercises both channels through notification delivery and verifies projected incremental recovery without a full reload or canonical data exposure.

### P2 — Projected Undo can be dropped during unrelated busy work (P2, fixed)

Projected replacements and discontinuity recovery now share an ordered queue with notified Action batches and their Game metadata. A busy session retains these updates and drains them through the existing busy-to-idle lifecycle. A failed queued reconciliation restores its prior context and triggers synchronization. A complete representation replacement discards superseded queued updates.

[projectedHistory.spec.ts](/workspace/games/fresh-fish-ui/tests/projectedHistory.spec.ts) reproduces the former lost Undo in a real browser, then verifies Action → Undo → Action ordering during both local processing and a pending presentation listener. It checks resulting history, projected state, Game metadata, and recovery from a corrupt replacement. Existing direct Undo and privileged-view tests remain green.

No host dependency, bridge field, or notification discriminator changed for these fixes. Each affected Game Title must republish its UI Artifact to adopt the shared Game Session changes. Publishing the Site Frontend alone does not update a bundled Game Session. The Common guard changes also affect the embedded runtime; matching Logic/UI publication rules still apply.

### P3 — First adoption needs an explicit breaking-publication strategy (P1 release prerequisite)

Matching new Logic and UI Artifacts does not update already-open clients. Older Game Sessions ignore the new projected notification discriminators and do not understand projected forward-patch replay. The branch has not changed the Fresh Fish package versions from the baseline.

The repository's Loaded Client Compatibility guarantee permits older minor/patch clients within a major line. A first visibility adoption cannot rely on that guarantee without a migration mechanism. Choose a major-version transition with forced reload or explicit capability negotiation, and test an already-open old client. Generic initial-load/sync endpoints and idle realtime clients need attention in addition to versioned Action routes.

This is required release work, not an instruction to publish or bump versions during this review. Existing v2 games have no privacy-upgrade requirement. That removes retroactive privacy migration from release scope; compatibility with the payloads actually delivered to older clients remains required. Logic rollback after writing version-3 state also needs an explicit compatibility assessment.

## Additional cross-flow findings

### C1 — Fork preservation is still coupled to visibility (P2, reproduced)

[gameService.ts:211](/workspace/libs/backend-services/src/games/gameService.ts:211) loads canonical source state only when visibility exists or the public seed is absent. With creation now independent of visibility, a version-3 title can have a second PRNG without entering that preservation path.

Reproducing the no-projector path with Fresh Fish's runtime and fixed distinct initial seeds produced version-3 source and fork states with different protected PRNGs and different bags—even when forking before any Action. The reconstruction helper works when canonical state is supplied; the service does not always supply it. Existing fork tests exercise the helper and therefore miss this selection defect.

Fork initialization must be driven by source execution version and canonical initialization data. Add service-level coverage with and without visibility. Preserve the source version as well as random cursors. Retain a deliberate strategy for old histories lacking complete undo patches; blindly requiring every historical snapshot would remove existing seed-based reconstruction capabilities.

### C2 — Projection changes do not invalidate ETags (P2, verified by code path)

[gameRepresentation.ts:70](/workspace/libs/backend-services/src/games/gameRepresentation.ts:70) hashes only the canonical Game revision and Perspective. The current projection definition or Logic Artifact revision is absent. Publishing different projection rules without changing Game data can therefore retain the old validator, and [apps/backend/.../game/get.ts:49](/workspace/apps/backend/src/app/routes/api/game/get.ts:49) returns `304` before creating the new representation.

Include a stable representation revision in the ETag or invalidate validators on publication. This is distinct from already-disclosed knowledge: the endpoint can incorrectly claim an altered representation has not changed.

### C3 — Ordinary loads now require historical schema compatibility (reproduced architectural constraint)

`projectActionHistory` reconstructs every old state from undo patches and projects it with the current schema. `BuiltInProjector.project` rejects a historical state before replay fallback if it fails that schema.

A probe with a valid current state containing a newly required field and an older undo patch removing it could project the current state, but could not project the history. Initial loading consequently fails despite the latest state being supported.

This exceeds the repository's Operational Compatibility guarantee, which promises loading the latest canonical state and continuing, not historical replay compatibility. The new `protectedPrng` and auction `submitted` fields are optional and do not demonstrate this failure themselves. Decide among historical schema/projector versions, migration of reconstructed states, or an explicitly supported history boundary. Missing old undo patches need a related policy.

## What the design already does well

- One canonical rules model and Action type remain the source of truth. The redacted sentinel describes an unavailable record without inventing a second game-semantic Action.
- Forward and undo patches come independently from adjacent permitted states; they are not filtered canonical patches.
- Entire cascades are classified together, with both full execution and flattened application checked before removing forward patches.
- The public PRNG cursor solves the reproduced causal-ID replay failure. Undo, sibling/nested cascades, and reordered simultaneous execution have useful characterization coverage. No demonstrated requirement calls for a third stream.
- Host inspection explicitly retains canonical context and derives a separate acting-Player view. Generic notifications and start responses are state-free.
- Schema-local annotations, reusable DrawBag protection, and shared auction semantics reduce title-specific projection code. Public-by-default fields remain the intended authoring model.

## Scenario coverage and its limits

| Scenario family                                               | Evidence                                                                  | Remaining gap                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Hidden scalars, bags, hands, multi-Player deals               | Schema tests, Fresh Fish bag, synthetic card fixtures                     | Required scalar hydration; incomplete collections now fail closed                      |
| Hidden Actions, mixed cascades, secret shuffles               | Sentinel, guarded attempt, patched cascade followed by public replay      | Default confidentiality without a registered projector                                 |
| Sealed simultaneous submissions and Undo                      | Fresh Fish engine/client tests and previous hosted manual validation      | Old-client deployment behavior; recovery regressions now covered                       |
| Owner/team/private transfer, progressive/selective reveal     | Synthetic perspective fixtures                                            | Practical owner/team Action discovery in a complete game UI                            |
| Private observation and retained knowledge                    | Explicit card-knowledge fixture survives movement                         | History entitlement after later reveals, reassignment, and deliberate forgetting       |
| Initial load, sync, submission, notification, privileged view | Route, backend representation, and client tests                           | Old-client publication tests, historical schema compatibility, publication ETags       |
| Fork and exploration                                          | Fork helper tests; Fresh Fish population and checkpoint browser scenarios | Hosted Fork selection and Action-ID relationships; population support for other titles |

Fixture coverage demonstrates the mechanisms; it does not establish that complete Hearts, Rummy, Go Fish, or War implementations are ready without further authoring work.

## Decisions still open

1. **Confidentiality without custom visibility.** Creation no longer requires visibility, but canonical delivery still exposes the entire state when no projector is registered ([gameRepresentation.ts:92](/workspace/libs/backend-services/src/games/gameRepresentation.ts:92)). An unused second stream is harmless; `getProtectedPrng()` alone is not a secrecy guarantee. Decide whether using protected randomness requires explicit projection setup or whether common-field protection becomes automatic. Do not let a no-hidden-information/no-randomness title need boilerplate just to obtain the current system version.
2. **Available Actions and projected hydration.** Select the supported contracts before expanding the schema API further. Prefer a small set of useful owner/aggregate patterns over author-written parallel rules.
3. **Historical compatibility and knowledge.** Define which past states remain loadable across publication and whether history reflects entitlement at the event or knowledge acquired later. Software can remove a value from a view; it cannot make a Player forget previously delivered information.
4. **Fork/exploration semantics.** The user settled Exploration’s privacy rule: unknown information must be hypothetical and consistent with permitted knowledge; the real hidden state must not supply new revelations. [Slice 4](game-session-refactor.md#slice-4-hypothetical-exploration) records the rule and implementation follow-up. Historical branches use only knowledge available at that position. Recorded source History remains navigable while inherited Undo stops at a forward-patched/non-optimistic cascade. Debug/Admin Host View Exploration remains available. The [Exploration plan](hidden-information-exploration.md) covers implementation; Hosted Fork treatment remains open. Canonical history reconstruction and hypothetical sampling have separate randomness requirements; the Hosted Fork policy remains undecided. Generic remapping of title-owned references to rewritten Action IDs is still unsupported.
5. **Release and cache migration.** Establish the old-client transition, projection revision, and rollback boundary. Existing v2 games retain their historical behavior and have no privacy-upgrade requirement.
6. **Classifier cost and diagnostics.** Set realistic latency/memory targets and define an author-facing explanation for patch fallback. Keep the two-stream design unless a real scenario demonstrates another requirement.

The current threat model deliberately accepts broad Ably subscription capabilities and public Action existence/count. Those are existing constraints, not newly discovered defects. Secret-dependent rejection behavior remains a title conformance obligation. These constraints should stay visible in acceptance criteria without expanding this project into unrelated security hardening.

## Recommended remaining work

1. Discuss fork source selection together with exploration before changing C1. C2 publication ETags is deferred as low risk. The four targeted guard/recovery defects have permanent regression coverage and are fixed.
2. Settle projected hydration and Action availability; collection completeness now uses a conservative execution guard. Add one realistic private-hand game flow whose legal choices depend on the owner's known cards.
3. Write and exercise the publication/migration plan: open old client, current client, old stored v2 instance continuing without a privacy upgrade, new instance without visibility, projection-rule change, and older history schema.
4. Exercise remaining fork/exploration and knowledge lifecycle decisions; include actual service selection and browser timing rather than only engine/helper tests.
5. Benchmark long histories and larger cascades, add patch-fallback diagnostics, then simplify Game Session ownership around the measured and tested contracts.
6. Separate a concise authoring contract from the exploratory scenario catalog and implementation log, and record accepted architecture only after the unresolved boundaries are decided.

## Validation and limits

The existing suites passed after the versioning fix: 108 common tests, 28 Fresh Fish logic tests, 36 backend service/Undo-window tests, 11 backend route tests, and 31 Fresh Fish client tests (214 total). Common, Fresh Fish, and backend-services builds passed through `turbo run build`; `git diff --check` passed.

The review's targeted probes intentionally exposed behavior absent from those suites: numeric Record access, incomplete collection operations, User-channel discontinuity, busy projected Undo, fork initialization without a projector, and historical schema changes. Temporary probe files were removed. The busy-Undo probe tested the handler boundary; no fresh full-hosted browser run or cross-publication deployment test was performed. Existing passing tests do not negate those reproduced gaps.

No commits or publication were performed. The pre-existing Dockerfile contents were verified unchanged.

### Follow-up validation for defects 1–4

The fixes pass 119 Common tests, 28 Fresh Fish logic tests, 32 targeted Fresh Fish client tests, and five Chromium browser scenarios (184 total). Browser coverage includes pending processing, a pending presentation listener, a corrupt queued replay that requires recovery, a User-channel discontinuity during queued delivery, and projected History round-trips. Both Frontend Components and Fresh Fish UI type checks report zero errors (existing Svelte warnings remain). Common, Frontend Components, and Fresh Fish builds pass through `turbo run build`; `git diff --check` passes.

This follow-up changes no host dependency or payload shape. It does not resolve old-client publication strategy, fork/exploration semantics, or projection ETags. No hidden-information commit or publication was requested for these fixes.

### Slice-6 completion review

See [Hidden-information compatibility and completion review](hidden-information-compatibility.md) for the new findings and fixes. The original P3 old-client migration and C3 historical-schema requirements remain release prerequisites. C1 Hosted Fork remains a product decision, and C2 ETags remains deferred. Exploration implementation and the Game Session ownership extractions are complete; their current conformance coverage does not remove those release requirements.

# Hidden-information implementation review

This is the historical review of `3fd8c5e5` through `0d32b361` and the worktree reviewed on 2026-09-04, with resolution notes added after subsequent slices. The unrelated Dockerfile edit was excluded. Findings and validation counts below describe their respective slices, not the current release status.

The targeted guard/recovery defects, canonical Forks, shared hydration, owner-hand discovery, and planned GameSession extractions are complete. Major-version reload and forward-play compatibility are implemented and tested. C2 projection ETags remain deferred as low risk; S6 performance/diagnostics and actual mixed-publication rollout remain work. Use the [current contract](hidden-information.md) and [remaining-work list](hidden-information-compatibility.md#remaining-development-slices) for current decisions and scope.

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

Public collection membership remains usable when only nested fields are protected, when an Actor policy proves every member visible, or when whole-member replacement retains membership. Individual protected values remain guarded. Custom policies that cannot prove membership locally still require authoritative execution; the supported owner-hand resolution and custom-policy limit are recorded in S3 below.

The public-projector tests cover empty and nonempty arrays, shifted union indexes, Record enumeration, reference schemas, custom policies, and preservation of safe public operations. The A9 availability scenario now reports the collection path where execution stops.

### S3 — Custom-policy Action discovery (owner-hand contract integrated; custom-policy limit retained)

The original custom owner policy could project a hand correctly but could not prove its safety during guarded local discovery. Arbitrary custom callbacks may depend on canonical fields missing from the client, so the guard deliberately rejects them.

`808537fe` adds `Policy.Owner`, based on the immediate containing object's public, stable `playerId`. Permanent private-hand tests exercise owner-known rule methods, legal discovery, optimistic play, and authoritative fallback while preserving guards on opponents' hands and hidden decks. Titles with team or retained-knowledge rules must expose sufficient permitted data or add a tested policy; there is no generic authoritative availability endpoint or relaxation of custom-policy guards.

### S4 — Projected types and hydration (integrated)

The original client contract used canonical validators in hydrated constructors, rejecting projections that omitted required secret fields. `9f128dd6` first established complete-state validation at canonical execution, initialization, loading, persistence, Undo, Fork, and Exploration boundaries.

`808537fe` then adopted a shared hydration type and validator derived from the canonical visibility schema. Canonical schemas remain strict; constructors accept both representations without a mode flag. `GameRuntime.visibility` carries the shared state type through projection. Required nested hands and secret scalars are covered by permanent Common, backend, and browser tests, and Fresh Fish adopts derived hydration schemas. See [Schemas and hydration](DESIGN.md#schemas-and-hydration).

### S5 — Game Session responsibilities (planned extractions complete)

Follow-up on 2026-09-05: the first three [Game Session refactor slices](game-session-refactor.md) extract accepted-history reconciliation, queued delivery/recovery, and submission/Undo response handling into `GameReconciliation`. Slice 5 now extracts retained host contexts, projections, representation loading, and request cancellation into `GameRepresentations`. `GameNotifications` subsequently takes ownership of subscription lifecycle, notification validation/routing, and discontinuity handling. GameSession retains Action initiation, mode selection, and presentation publication. The original concern below motivated those extractions; Fresh Fish hypothetical Exploration is now implemented through an optional population hook, with checkpointed History and conservative inherited Undo. Broader publication compatibility validation remains outstanding.

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

The repository's Loaded Client Compatibility guarantee permits older minor/patch clients within a major line. A first visibility adoption cannot rely on that guarantee without a migration mechanism. The user selected the existing frontend major-version transition with forced reload; no separate capability-negotiation protocol is required. Version precedence and the Logic-major error handler are now fixed and tested. Test the actual already-open old artifact during release rehearsal. Generic initial-load/sync endpoints and idle realtime clients need attention in addition to versioned Action routes.

This is required release work, not an instruction to publish or bump versions during this review. Existing v2 games have no privacy-upgrade requirement. That removes retroactive privacy migration from release scope; compatibility with the payloads actually delivered to older clients remains required. Logic rollback after writing version-3 state also needs an explicit compatibility assessment.

## Additional cross-flow findings

### C1 — Fork preservation coupled to visibility (P2, fixed)

The following reproduction describes the original defect. The [canonical Fork follow-up](#canonical-fork-follow-up) supersedes the original reconstruction recommendation: always use complete canonical source state, preserve inherited identities and random cursors, and fail explicitly when a historical point cannot be reconstructed.

[gameService.ts:211](/workspace/libs/backend-services/src/games/gameService.ts:211) loads canonical source state only when visibility exists or the public seed is absent. With creation now independent of visibility, a version-3 title can have a second PRNG without entering that preservation path.

Reproducing the no-projector path with Fresh Fish's runtime and fixed distinct initial seeds produced version-3 source and fork states with different protected PRNGs and different bags—even when forking before any Action. The reconstruction helper works when canonical state is supplied; the service does not always supply it. Existing fork tests exercise the helper and therefore miss this selection defect.

The initial review requested service-level coverage with and without visibility and preservation of source version and random cursors. The implemented canonical-copy path now provides that coverage. The user accepted explicit failure for incompatible historical reconstruction; seed-based replay fallback is not part of the final contract.

### C2 — Projection changes do not invalidate ETags (deferred as low risk)

[gameRepresentation.ts:70](/workspace/libs/backend-services/src/games/gameRepresentation.ts:70) hashes only the canonical Game revision and Perspective. The current projection definition or Logic Artifact revision is absent. Publishing different projection rules without changing Game data can therefore retain the old validator, and [apps/backend/.../game/get.ts:49](/workspace/apps/backend/src/app/routes/api/game/get.ts:49) returns `304` before creating the new representation.

A future fix could include a stable representation revision in the ETag or invalidate validators on publication. The user deliberately deferred this issue; it is not an active implementation requirement. This is distinct from already-disclosed knowledge: the endpoint can incorrectly claim an altered representation has not changed.

### C3 — Ordinary loads require historical schema compatibility (fixed)

`projectActionHistory` reconstructs every old state from undo patches and projects it with the current schema. `BuiltInProjector.project` rejects a historical state before replay fallback if it fails that schema.

A probe with a valid current state containing a newly required field and an older undo patch removing it could project the current state, but could not project the history. Initial loading consequently fails despite the latest state being supported.

This exceeds the repository's Operational Compatibility guarantee, which promises loading the latest canonical state and continuing, not historical replay compatibility. The new `protectedPrng` and auction `submitted` fields are optional and do not demonstrate this failure themselves. The user reaffirmed on 2026-09-05 that History need not work across schema changes, while forward play from the latest state must work. The fix now projects current state independently, preserves compatible recent cascades, and replaces the incompatible prefix with identity-only redacted envelopes. Missing patches stop History and Undo; the backend rejects Undo across that range before persistence. Historical schema versioning or full-history migration is not a requirement.

## What the design already does well

- One canonical rules model and Action type remain the source of truth. The redacted sentinel describes an unavailable record without inventing a second game-semantic Action.
- Forward and undo patches come independently from adjacent permitted states; they are not filtered canonical patches.
- Entire cascades are classified together, with both full execution and flattened application checked before removing forward patches.
- The public PRNG cursor solves the reproduced causal-ID replay failure. Undo, sibling/nested cascades, and reordered simultaneous execution have useful characterization coverage. No demonstrated requirement calls for a third stream.
- Host inspection explicitly retains canonical context and derives a separate acting-Player view. Generic notifications and start responses are state-free.
- Schema-local annotations, reusable DrawBag protection, and shared auction semantics reduce title-specific projection code. Public-by-default fields remain the intended authoring model.

## Current coverage and limits

| Scenario family | Evidence | Remaining limit |
| --- | --- | --- |
| Required hidden scalars, bags, nested private hands | Derived hydration schemas, strict canonical gates, permanent private-hand flow | Additional replacement shapes and deeply composed schemas need their own conformance coverage |
| Hidden Actions, mixed cascades, secret shuffles | Sentinel, guarded attempts, patched cascade followed by public replay | Titles must explicitly register visibility; protected randomness alone is not confidential delivery |
| Owner-known legal discovery | Owner policy, Common methods, actual browser GameSession play and fallback | Arbitrary custom/team/knowledge policy execution is not generally supported |
| Sealed simultaneous submissions and Undo | Fresh Fish engine/client tests and hosted checks | Actual old/new artifact rollout |
| Private observation and retained knowledge | Card-knowledge fixtures preserve represented knowledge | Title-owned lifecycle and entitlement rules; no universal memory model |
| Load, sync, notifications, History, privileged views | Backend, client, Chromium, and local hosted Fresh Fish checks | Mixed-publication verification and deferred projection ETags |
| Fork and Exploration | Canonical reconstruction/service tests, hosted historical Fork, hypothetical population and saved-branch browser tests | Population hooks for additional titles; historical reconstruction may explicitly fail |

The [scenario catalog](hidden-information-scenarios.md) is a title-adoption checklist. It does not establish that complete Hearts, Rummy, Go Fish, or War implementations are deployed.

## Decision resolutions

- **Explicit visibility setup:** confirmed on 2026-09-06. Titles relying on secret randomness or hidden information register state and Action projectors. There is no automatic common-field projection for unregistered titles and no new runtime rejection check in this documentation change. Titles with no hidden information need no registration to create system-version-3 instances.
- **Hydration and legal discovery:** one derived shared hydration representation with strict canonical gates; owner-known methods run through the existing guard. No parallel rules runtime is needed.
- **History and migration:** latest-state forward play is required; historical compatibility is not. Existing v2 games retain public behavior. Missing historical patches stop navigation/Undo without blocking current play.
- **Fork and Exploration:** Fork preserves a real canonical position; Exploration samples a hypothetical one using only knowledge at the selected point. Host View Exploration remains available. Inherited Fork IDs remain intact, avoiding generic remapping of title-owned references.
- **Loaded clients and rollback:** use the existing major-version reload and compatible Publication. Actual old/new rollout and reverse compatibility after newer writes remain release checks.

Public Action existence/count and the previously accepted broad Ably subscription capabilities remain threat-model constraints. Secret-dependent rejection behavior and retained knowledge are title conformance obligations, not newly promised generic framework capabilities.

## Remaining work

The [compatibility completion list](hidden-information-compatibility.md#remaining-development-slices) is the single current list: performance measurement, fallback diagnostics, and publication/rollback verification. C2 stays deliberately deferred. The authoring documentation and scenario catalog are now separated, and the planned GameSession extractions are complete.

## Historical validation and limits

The existing suites passed after the versioning fix: 108 common tests, 28 Fresh Fish logic tests, 36 backend service/Undo-window tests, 11 backend route tests, and 31 Fresh Fish client tests (214 total). Common, Fresh Fish, and backend-services builds passed through `turbo run build`; `git diff --check` passed.

The review's targeted probes intentionally exposed behavior absent from those suites: numeric Record access, incomplete collection operations, User-channel discontinuity, busy projected Undo, fork initialization without a projector, and historical schema changes. Temporary probe files were removed. The busy-Undo probe tested the handler boundary; no fresh full-hosted browser run or cross-publication deployment test was performed. Existing passing tests do not negate those reproduced gaps.

At the original review, no commits or publication were performed. The pre-existing Dockerfile contents were verified unchanged.

### Follow-up validation for defects 1–4

The fixes pass 119 Common tests, 28 Fresh Fish logic tests, 32 targeted Fresh Fish client tests, and five Chromium browser scenarios (184 total). Browser coverage includes pending processing, a pending presentation listener, a corrupt queued replay that requires recovery, a User-channel discontinuity during queued delivery, and projected History round-trips. Both Frontend Components and Fresh Fish UI type checks report zero errors (existing Svelte warnings remain). Common, Frontend Components, and Fresh Fish builds pass through `turbo run build`; `git diff --check` passes.

This follow-up changes no host dependency or payload shape. It does not resolve old-client publication strategy, fork/exploration semantics, or projection ETags. No hidden-information commit or publication was requested for these fixes.

### Slice-6 completion review

See [Hidden-information compatibility and completion review](hidden-information-compatibility.md) for the new findings and fixes. C3 is fixed. P3 uses the existing major-version reload with tested notice precedence; actual old/new artifact rollout remains a release check. C1 Hosted Fork was subsequently settled and fixed in the canonical Fork follow-up below; C2 ETags remains deferred. Exploration implementation and the Game Session ownership extractions are complete; their current conformance coverage does not remove those release requirements.

## Canonical Fork follow-up

C1 is fixed by the [canonical Fork slice](hidden-information-forks.md). The user settled Forks as real continuations and Exploration as hypothetical. Hosted Fork always loads canonical state, regardless of visibility registration; Hosted, Hotseat, and harness paths share suffix reconstruction without reinitialization or replay. Unsupported historical reconstruction may fail explicitly. The old recommendation to preserve seed-based replay fallback is superseded by that accepted compatibility policy. C2 remains deferred.

## Shared hydration integration follow-up

`9f128dd6` adds canonical validation boundaries; `808537fe` integrates shared hydration, owner visibility, and permanent private-hand regressions. The [integration record](projected-hydration-prototype.md#integration-follow-up) reports 322 unit tests and 22 Chromium scenarios passing, with all 11 title logic packages building. This is repository conformance evidence, not publication of a new private-hand title.

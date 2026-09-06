# Canonical Forks

Forks preserve the real position so players can play a different continuation. Exploration samples a hypothetical world. This settles the C1 Fork decision from the hidden-information review.

## Reconstruction

`createGameFork` in Common owns reconstruction for the backend, Site Frontend Hotseat service, and development harness. It validates source identity, contiguous Action indexes, count, and checksum. It copies the latest canonical state and reverses only Actions after the requested position. A position inside an automatic System Action sequence includes the remaining consequences before the next User Action; a Fork therefore starts at a player decision, without rerunning the cascade.

The source and reconstructed target must pass complete-state validation, and the selected state must hydrate with the current runtime and have a registered state handler. Shared hydration alone is not a completeness check. Failure returns `This game cannot be forked from that position.` without including hidden state or runtime validation details. No historical migration or replay fallback is attempted. Current-position Forks need neither old patches nor old Action schemas. Historical positions remain eligible for an attempt, independently of projected History and Undo restrictions.

Fork preserves hidden values, public and protected PRNG seeds and cursors, and the original execution system version. Existing v2 Games remain v2; Fork does not convert them to private v3 Games.

## Identity and persistence

Each Fork has a new Game ID and records its source as `parentId`. Inherited state and Action IDs remain unchanged: both stores scope those records by Game, and retaining IDs preserves title-owned references and checksums. Inherited records receive the new Game ID. Both patch directions end with setting that Game ID, including when a patch replaces the root state. Newly executed Actions use the ordinary engine identity rules.

Hosted Fork always reads canonical state, even when the title has no visibility declaration. It preserves the existing owner/Reserved/Joined lobby behavior and starts by activating the copied position. Game metadata, state, and inherited Action chunks are created in one Firestore transaction. New chunks use the current chunk size even when the source used older storage. Hotseat and harness use their existing atomic IndexedDB save operation. Forks appear separately from saved Explorations.

## Compatibility and publication

No API, injected service, or bridge signature changes. Older UI Artifacts call the corrected Site Frontend/backend Fork operation through their existing interface. New UI Artifacts remain compatible with the old host interface, but an old host retains its old Fork implementation until deployment/reload.

Deploy the backend for Hosted reconstruction and atomic writes. Publish the Site Frontend for Hotseat reconstruction and the corrected Exploration lookup. Republish each title's UI Artifact to adopt the shared cannot-fork toast and accessible Fork label. The development harness uses the updated shared service. No title rules or canonical schema changed in this slice; it requires no Logic-changing Publication. This work does not publish artifacts or change versions.

## Verification

The final regression run passed 286 tests: 123 Common, 30 Fresh Fish logic, 43 backend, 28 shared Game Client, 46 Fresh Fish client, and 16 Chromium scenarios. Backend/shared-client builds and all three client type checks passed with existing warnings (Site Frontend: two, shared client: seven, Fresh Fish UI: one).

Regression tests cover v1/v2/v3 state preservation, deterministic continuation, immutable source data, initial/current/historical positions, retained Action references, root patches, a real DrawTile/System Action cascade, invalid positions, incompatible schemas, and backend selection with and without visibility registration. Backend service failures are checked before persistence and notification.

The local hosted runner exercised a historical Fresh Fish Fork with three separate player accounts. Canonical state matched the selected source, inherited Action IDs matched, the original players joined and started, all clients received projected bags, and new play left the source unchanged. Site Hotseat Fork was saved in IndexedDB, loaded, played forward, and reloaded; it retained its full canonical bag and did not appear among Explorations.

An incompatible persisted old patch returned the safe cannot-fork error and created no new Game. A deliberately pre-existing destination state made Firestore creation fail; the transaction left no Game document or Action chunks. The test patch and collision fixture were removed, and the runner was stopped. These checks use current locally staged artifacts, not an old/new publication rollout or a long-history benchmark.

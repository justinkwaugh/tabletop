# Hosted Game Hidden Information

## Status and navigation

The core hidden-information implementation is complete through shared projected hydration and owner visibility (`808537fe`). This document describes the supported contract. Publication and operational verification remain separate from repository implementation.

- [Schemas and hydration](DESIGN.md#schemas-and-hydration): the game-authoring contract and permanent private-hand example.
- [Exploration](hidden-information-exploration.md) and [canonical Forks](hidden-information-forks.md): initialization, History, persistence, and compatibility details.
- [Game Session ownership](game-session-refactor.md): completed responsibility extractions.
- [Compatibility and remaining work](hidden-information-compatibility.md#remaining-development-slices): the current completion and release list.
- [Scenarios and title conformance](hidden-information-scenarios.md): card-game examples and the broader acceptance catalog.
- [Other-game adoption catalog](hidden-information-game-catalog.md): per-title state, Action, randomness, and Exploration requirements beyond Fresh Fish.
- [Lowenherz knowledge design](lowenherz-hidden-information-design.md): implemented private inspections, remembered observations, and constrained hypothetical card assignment.
- [Original review](hidden-information-review.md) and [hydration experiment](projected-hydration-prototype.md): dated findings and their resolutions.

## Explicit participation

A Game Title explicitly enables hidden-information delivery by registering `runtime.visibility.state` and `runtime.visibility.actions`. Unannotated fields are public. Shared fields such as `protectedPrng` and `DrawBag.items` carry visibility annotations, but those annotations only redact delivery when the runtime registers a projector. The platform does not install automatic common-field projection for a title without visibility.

**Decision, 2026-09-06:** games relying on secret randomness or other hidden information must explicitly configure visibility. `getProtectedPrng()` separates deterministic entropy; calling it alone does not make Game State private. Checking that a title has the appropriate registration is an authoring/conformance obligation. There is no new runtime check that rejects every use without visibility.

Games without hidden information or randomness need no visibility boilerplate. New instances created by the updated engine use system version 3 regardless of visibility registration. System version selects deterministic execution behavior; it does not select privacy. Existing v1/v2 instances retain their original behavior and must remain playable. In particular, existing v2 games are not expected to become private, be reseeded, or have already-public history concealed.

## Canonical state and permitted representations

The backend stores one complete canonical Game State and Canonical Action History. Ordinary networked clients receive a Player or spectator projection derived from authenticated membership. A client cannot authorize a Perspective by supplying a Player ID.

The projected Perspective type is `{ kind: 'player'; playerId: string } | { kind: 'spectator' }`. Host View is a separately authorized canonical-access path for Developer/Admin inspection, not another projector Perspective. Hotseat Play and local games already possess complete state; concealment there is a presentation convention.

Projection traverses declared schema fields as an allowlist, preserves permitted values, and omits or replaces protected values. It does not mutate canonical input, copy undeclared runtime properties, or encode visibility discriminators in stored domain objects. Missing policy/adapter implementations fail closed, and projected results are checked against the derived projection schema.

For a canonical transition `C0 --A--> C1` and Perspective `P`:

```text
V0 = projectState(C0, P)
V1 = projectState(C1, P)
Av = projectActionRecord(A, P)
Av.undoPatch = diff(V1, V0)
Av.forwardPatch = diff(V0, V1)  // retained when replay cannot be proven
```

Both patch directions are calculated from permitted states. Filtering canonical patches is unsafe: canonical array positions, movements, and replacement values can disclose secrets or produce invalid projected operations.

Every visible record preserves canonical Action identity and index for ordering and checksums. A disclosed Action retains its canonical game-semantic type. An undisclosed Action uses `tabletop.redacted-action`, retaining only the public envelope and safe patches; it never becomes an invented alternative game Action. The engine cannot hydrate or execute a redacted record through rules. Compatible redacted records require a forward patch, including an empty patch for no visible effect. Unavailable historical envelopes may have neither patch and form a History boundary.

The public redacted envelope includes `id`, `gameId`, `source`, and the sentinel `type`, plus present `playerId`, `index`, `simultaneousGroupId`, `revealsInfo`, `createdAt`, and `updatedAt`. Title payload, result metadata, canonical patches, and `skipOptimisticExecution` are removed before safe patches are attached.

## Authoring visibility and hydration

Use helpers from `Visibility` in `@tabletop/common` with the canonical TypeBox schema:

- `protect(schema, { policy })` defaults to omission for an unauthorized Perspective.
- `protectAction(schema, { policy })` protects a whole Action type and payload using the platform redacted envelope.
- `scope(schema, name)` gives protected descendants named canonical context through `context.requireScope(schema)`.
- `createProjectionSchema(schema)` derives the shared representation; `createProjector(schema)` builds the state projector. Register all possible User and System Action schemas with `createActionProjector`.

| Policy or component | Supported behavior |
| --- | --- |
| `Policy.HostOnly` | No ordinary Perspective receives the value |
| `Policy.Actor` | Matches the root value's `playerId`, normally on an Action |
| `Policy.Owner` | Matches the immediate containing object's public, stable `playerId`, such as `players[].hand`; does not search ancestors |
| `DrawBag` | Protects exact `items` with an empty-array replacement while leaving `remaining` public |
| `ProtectedPrngState` | Replaces a present protected cursor with `{ seed: 0, invocations: 0 }` |
| `SimultaneousAuction` | Owner-known bid before resolution, public bids after a winner is recorded, and public submission status |
| Named custom policy | Pure snapshot projection using canonical context; not trusted for local guarded execution |

Keep canonical schemas strict. Derive the projected type and validator from visibility metadata, and use that single validator in constructors for both canonical and projected input. Name the input type `SolProjectedState` or `FreshFishProjectedState`; reserve `Hydrated` for the class with rule methods. Omitted protected fields are optional in hydrated types; replacement shapes may require unions. Instantiate optional nested objects only when present and preserve exact omissions. Never fill secrets during hydration. The [authoring guide](DESIGN.md#schemas-and-hydration) and [private-hand fixture](../libs/common/src/game/visibility/tests/privateHandGame.ts) give the complete pattern.

A runtime adopting broader hydration must supply `canonicalStateValidator`. Complete-state validation runs at initialization, authoritative execution, canonical Undo, Fork reconstruction, completed Exploration population, canonical loading after normalization/migration, and writes including administrative replacement. Shared hydration, projected patch application, and History retain their broader representation. An absent Perspective alone does not establish completeness. Older published runtimes retain their existing hydrator validation when the optional canonical validator is absent.

Custom replacement adapters, arbitrary TypeBox composition with precise static inference, generic team/knowledge policies, and reusable partially known card zones are not promised by this authoring contract. Adopt additional shapes with title-specific conformance tests; do not relax guards to make unsupported declarations appear executable.

## Randomness and identity

| API or field | Contract |
| --- | --- |
| `Game.seed`, deprecated `GameState.seed`, `prng` | Public setup seed and persisted public stream |
| `getPublicPrng()` | Predictable public rules randomness and durable System Action identity generation |
| `getProtectedPrng()` | Independently seeded protected stream in v3; historical public stream in v1/v2 |

The protected seed is independently generated, not derived from `Game.seed`. A v3 protected access requires its cursor to exist. The neutral projected cursor is a redaction, not usable entropy, and guarded execution rejects its use.

Use public randomness only when prediction before committing a choice is acceptable. Gameplay dice normally use protected randomness even when their outcomes are revealed publicly. Secret shuffles use protected randomness; drawing from an already shuffled deck or bag ordinarily consumes neither stream.

Version 2 and 3 System Action identities consume the durable public cursor. Patches for hidden cascades advance that cursor, allowing a later public cascade to reproduce canonical IDs and checksums. No demonstrated scenario requires a third identity stream. Version 1 retains its historical identity behavior.

Fresh Fish uses protected randomness for tile-bag initialization, its existing local `boardSeed` stream for the board, and public setup randomness for colors, turn order, and the already-public final stalls. Existing legacy initialization remains covered by pinned tests.

Sol also explicitly registers state and complete Action projection. In v3 its deck shuffle uses protected randomness; public card identities, colors, turn order, selected suits, effect mapping, and board setup retain the public stream. Undrawn deck items are concealed while the remaining count, drawn cards, kept face-up cards, and flare results stay public. Pinned initialization and forward-play tests preserve v1/v2 behavior.

## Local execution, delivery, and recovery

`executeCanonicalAction` validates complete input and completed transitions for authoritative execution, Hotseat Play, and hypothetical Exploration. `executeAction` processes an initiating Action and its full System Action cascade; a supplied Perspective activates the projected execution guard. It sanitizes submitted result metadata and patches and works on an isolated clone.

A client attempts Optimistic Application when the Action permits it. The guard rejects protected reads and writes whose entitlement cannot be proven from the projection, including operations on collections whose hidden membership could change an answer. Owner-known hands remain usable. A protected read discards the attempt and waits for the host. `revealsInfo` and `skipOptimisticExecution` also suppress optimism; only the former creates an information-reveal Undo barrier.

Action-type discovery uses the same guarded projected state for the Acting Player. Concrete choices are title UI derivations from known data. If discovery accesses an unavailable value, the client advertises no Actions. Titles must expose sufficient public aggregates or permitted values for legal discovery. No second rules implementation or host-calculated legal-choice endpoint is required by the supported owner-hand flow.

For each Perspective, the host classifies the complete initiating User Action and System Action cascade. It removes all forward patches only when isolated projected execution reproduces the authoritative projected Action trace and every state boundary, and flattened Processed Action replay also matches. Otherwise every record retains a forward patch. Probe errors safely select patches. Rules must remain pure and deterministic; the probe must have no ambient access to secrets or external side effects.

`applyProcessedAction` applies an existing forward patch without hydrating or executing the Action. Without a patch it replays exactly that supplied record, without recursively executing generated children. `undoProcessedAction` reverses its supplied undo patch. Delivery never reprocesses authoritative children as new Actions.

Initial loading, Action responses, incremental synchronization, Realtime cascades, and direct/Realtime Hosted Undo use permitted representations. Generic Game notifications and the start response carry no Game State. Realtime delivery sends the spectator view to the Game topic and each Player view to the associated User topic. Clients accept their selected Perspective and preserve checksum continuity.

`GameReconciliation` owns accepted history, queued delivery, suffix replacement, optimistic acceptance, and recovery. `GameRepresentations` owns canonical Host contexts, projection selection, loads, and stale-response cancellation. `GameNotifications` owns subscriptions, message validation/routing, discontinuities, and cleanup. GameSession retains Action initiation and presentation coordination. Updates received while busy are queued; failed reconciliation recovers the primary game even during Exploration. A representation load invalidates stale payloads while preserving a request to recover updates newer than its snapshot.

## Host View, History, Exploration, and Fork

Host View requires explicit backend authorization and the optional `supportsHostView` capability from the injected host API. An older host API can continue ordinary play; the new UI requests a reload before Host View. Inspection keeps Acting Player selection separate from representation selection. Changing the inspected Player replaces a full projection derived from retained canonical state. Exiting privileged inspection publishes a safe ordinary projection, discards the canonical context, and reloads ordinary state even if that subsequent load fails.

History Navigation uses delivered records and patches. Current forward play must work with the latest stored state even if older historical schemas cannot be reconstructed. Historical projection keeps compatible recent cascades and replaces an unavailable prefix with public envelopes without patches. History and Undo stop at that boundary; backend Undo validation occurs before persistence. Latest-state migration is title-owned; migration of every historical snapshot is not required.

Ordinary Exploration samples a complete hypothetical state from permitted knowledge at the selected source position. Later revelations do not constrain an earlier branch. The optional title-owned population hook receives only the projection, permitted history, configuration, Perspective, and fresh sampling randomness. Fresh Fish reconstructs bag composition and hypothetical submitted bids. Unknown data must follow the game's constraints: previously drawn cards are excluded unless rules returned them. An identical permitted input and sample seed must produce the same hypothetical state regardless of undisclosed source secrets.

Recorded source History remains navigable within its supported range. Play uses the separate sampled state; inherited Undo stops at the first forward-patched or non-optimistically executable cascade. Saved checkpoints retain reversible source/hypothetical difference patches, preserving the sample without two full state copies or resampling on reload. Authorized Debug/Admin Host View Exploration retains the full-state initializer path without requiring projected population. See [Exploration](hidden-information-exploration.md).

A Fork is a real continuation of the canonical position. Hosted Fork always loads canonical state; Hotseat and the harness use their complete local state. Historical points remain eligible regardless of projected History/Undo restrictions. Reconstruction reverses the canonical suffix without rerunning setup or historical rules, preserves both random cursors and inherited identities, and may fail explicitly if the requested state cannot be reconstructed or validated. See [canonical Forks](hidden-information-forks.md).

## Title conformance and supported limits

Registration alone is not proof that every information channel is safe. Titles must enumerate their Action schemas, annotate secret state and result/animation/history metadata, keep legal choices based on known information, and ensure rejection behavior does not expose undisclosed facts unless the rules intentionally reveal them.

Processed Action existence, identity, order, count, and the public envelope are observable. Secret-dependent cascade length is unsupported unless that disclosure is allowed. Snapshot policies do not implement a universal memory model: titles requiring retained knowledge must represent the permitted facts explicitly. Reveals should disclose permitted information in state or later visible records; retroactive enrichment of earlier delivered records is not automatic. Finishing a game does not automatically reveal all secrets.

The project retains the previously accepted broad Ably subscription capabilities. Tightening transport authorization is separate work; projection does not itself prevent a credential from subscribing to another permitted transport topic. This limitation must remain explicit when assessing a title's confidentiality needs.

The [scenario catalog](hidden-information-scenarios.md) identifies additional title-level cases and conformance checks. It is not a promise that complete Hearts, Rummy, Go Fish, or War titles are deployed or supported without their own implementation.

## Validation and completion

Integration at `808537fe` passed 322 unit tests and 22 Chromium scenarios; all 11 title logic packages built and frontend checks reported zero errors with existing warnings. Tests include a permanent private-hand fixture using actual Common, backend representation/notification, and browser GameSession paths. It uses an in-memory authoritative host, not a newly deployed title. Earlier Fresh Fish hosted checks are recorded in the compatibility and Fork documents.

The [remaining-work list](hidden-information-compatibility.md#remaining-development-slices) tracks performance measurement, fallback diagnostics, and actual publication/rollback verification. Projection ETags remain deferred as low risk. New title adoption may require its own knowledge model or population hook; these are not unfinished GameSession refactor slices.

# Hosted Game Hidden Information

> **Work in progress:** This document is an exploratory design proposal. Every conclusion, requirement, invariant, interface shape, and example below is provisional and may change. Nothing in this document is an established architecture or accepted decision unless it is later adopted by a separate decision record. Words such as "must", "requires", and "invariant" describe what the current working proposal would require, not a finalized system contract.

## Status and purpose

This document records the current theoretical model and scenario catalog for preventing a Hosted Game Client from receiving information its Player Perspective is not allowed to know. The end-to-end capability is not implemented. Initial authoring and projection slices now exist for declaring protected TypeBox fields and named schema scopes, deriving canonical and projection schemas, registering state and Action projectors with a participating Game Runtime, executing the built-in host-only projection used by Fresh Fish's tile bag, applying the built-in actor policy to `PlaceBid.amount`, applying the shared simultaneous-auction bid policy to Fresh Fish state snapshots, capturing canonical Action cascades from Game Engine execution, materializing a supplied canonical Action cascade into projected Action records with safe patches, programmatically reconstructing and projecting either a complete Canonical Action History or a contiguous suffix from canonical current state and undo patches, projecting a complete Action-execution result without exposing its canonical transition capture, applying Processed Actions through either rules replay or an Action-carried forward patch, reconciling Hosted Undo from a complete replacement suffix containing both User and System Actions, projecting the generic Hosted Game initial-load response from persisted canonical state and history, and explicitly requesting that load as an authorized Developer/Admin Host View. Fresh Fish money intentionally remains unannotated because hidden money is not currently a game variant. The implementation does not yet classify cascade mode, project Action submission, synchronization, Realtime Update, or undo responses for their recipients, connect Debug/Admin toggles to a separate Host Game Context lifecycle, or enforce end-to-end confidentiality. Resolved-sounding statements are still parts of the working proposal, while explicitly open questions identify areas where even the proposal has not yet converged.

The catalog is intended to evaluate proposed designs and later serve as an acceptance-test matrix. A design is incomplete if it protects ordinary state delivery but leaks information through Actions, undo patches, System Action cascades, synchronization, persistence, or another Hosted Game flow.

## Scope and working assumptions

- Confidentiality is required for Hosted Games. Hotseat concealment remains a presentation convention and is outside this security model.
- A Game Title explicitly participates in hidden-information support. Existing Game Titles need not work without being redesigned or migrated.
- The host retains the complete canonical Game State and Canonical Action History.
- The UI presents information but is not a confidentiality control. Unauthorized canonical data must never reach the client.
- The existence and ordering of Processed Actions are currently assumed to be public because the Action History Checksum depends on Action identity and index. Whether Action type, source, or Player attribution is always public remains open.
- Deterministic Processed Action replay remains the normal forward-transition mechanism for ordinary Actions. The host supplies the authoritative Action trace, and the Game Client applies each record exactly once. The working direction adds player-relative forward patches as a fallback for cascades that a perspective cannot safely replay.
- Transition mode is classified for an initiating User Action together with its complete triggered System Action cascade, not independently for arbitrary Actions within that cascade.
- Stored Game State objects must not use perspective-dependent discriminated unions to represent whether their contents are visible.

## Theoretical model

### Canonical model

The backend stores one complete canonical Game State and one Canonical Action History. Each canonical Processed Action contains everything needed for authoritative validation, execution, replay, and Action Reversal, including its canonical undo patch.

Canonical undo patches are unavailable to ordinary Player and spectator clients. Their visible patches are independently derived from projected states even when they happen to contain identical operations. An explicitly authorized Host View used by Developer and Admin tooling receives canonical patches as part of its Canonical Action History.

### Player-relative projection

A participating Game Title projects canonical information for a Player Perspective. Projection can omit information, replace it with a placeholder or aggregate, retain it for an entitled Player, or reveal it when the rules permit.

Conceptually:

```text
visibleState = projectState(canonicalState, perspective)
visibleActionRecord = projectActionRecord(canonicalAction, perspective)
```

A public or spectator view can be represented as another perspective. Different Players may receive different projections of the same canonical transition.

The initial runtime model has exactly two ordinary projected perspectives:

```ts
type Perspective = { kind: 'player'; playerId: string } | { kind: 'spectator' }
```

Team membership, ownership, Action authorship, retained knowledge, and reveal state are relationships that policies derive from a Player Perspective and canonical information; they are not additional projected perspective kinds. Information delivery additionally supports an explicitly authorized **Host View**. Enabling Developer Debug Mode or Admin Mode selects this same Host View, which may receive all canonical game information, including canonical state, Action records, metadata, and patches. Host View does not enter the ordinary projection path or masquerade as a privileged projector argument; the host selects its canonical-access path only after authorization. For ordinary delivery, the host must derive a Perspective from authenticated Game membership rather than accept one asserted by a client.

Game Representation and Player Perspective are separate concerns. Debug Mode selects the Host View representation without changing the Player Perspective or Acting Player. Admin Mode also selects the Host View representation and may separately choose an Acting Player and Player Perspective for presentation and Action construction. Choosing that Player does not reduce the administrator's canonical visibility to that Player's projection.

Visibility belongs to the relationship between canonical information and a Player Perspective. It is not an intrinsic subtype stored on a domain object. A hand, deck, bid, or plan therefore does not change between `Visible`, `PartiallyVisible`, and `Hidden` discriminated-union branches according to its recipient.

When a shared fixed-shape state representation is useful, exact contents and an aggregate can coexist without placeholder objects or a visibility discriminator. An illustrative card-zone shape is:

```text
Card Zone
├── cards: complete Card identities present in this representation
└── unknownCount: number of additional Cards omitted from this representation
```

The invariant is `total count = cards.length + unknownCount`. Canonical state and an owner's hand contain every Card with `unknownCount = 0`; an uninformed opponent can receive no Cards and the full count; a Player who retains knowledge of three Cards in a thirteen-Card hand can receive those three Cards and `unknownCount = 10`. The exact names and reusable type remain design work. Ordered zones or partial attribute knowledge may require game-specific fixed-shape fields rather than stable unknown-card placeholders.

### Visible transitions and Action Reversal

For a canonical transition `C0 --A--> C1`, the backend derives the following for each relevant perspective `P`:

```text
V0(P) = projectState(C0, P)
V1(P) = projectState(C1, P)
Av(P) = projectActionRecord(A, P)
Uv(P) = diff(V1(P), V0(P))
```

`Av(P)` is the permitted visible record of the canonical Processed Action. It is not a second canonical Action. `Uv(P)` is attached as `Av(P).undoPatch` when the record is materialized. The visible undo patch is calculated from two already-safe projected states; it is not produced by filtering operations out of the canonical undo patch. Filtering a canonical patch could produce incorrect array indices, invalid structural changes, or secret replacement values.

A replayable record retains the canonical game-semantic Action type and enough permitted payload to satisfy:

```text
apply(V0(P), Av(P)) = V1(P)
```

A participating Game Title may need to record processed-result metadata in an Action so each permitted record has enough information to reproduce its visible consequence. Projection must not translate one game-semantic Action type into another; for example, a `SubmitPass` Action does not become a synthetic `PassSubmitted` Action. Its permitted contents may differ, and the UI may render a generic description from those contents, but it remains `SubmitPass` whenever its canonical type is disclosed.

If replay cannot be satisfied without revealing a secret, the visible record carries an explicit `forwardPatch`:

```text
Fv(P) = diff(V0(P), V1(P))
applyPatch(V0(P), Fv(P)) = V1(P)
```

The patch must be generated solely from the two safe projected states. A deterministic diff that sees only `V0(P)` and `V1(P)` cannot accidentally use canonical object identity or canonical movement paths to reveal more than those states permit.

A patched record need not be executable and may redact the canonical Action type itself. Because `GameAction.type` is currently required, a reserved platform sentinel such as `__redacted__` may be needed. The sentinel is not an alternative game-semantic Action type: it means the canonical type is unavailable to this perspective. Such a record must never enter a game Action hydrator or Action handler, and it must carry a visible forward patch. The exact sentinel and visible-record schema remain unresolved.

### Action identity and visible results

Every visible Action record preserves the canonical Action identity and index required by the Action History Checksum. Other Action fields are projected. Its type is either the canonical Action type or, for a patched opaque record, the reserved redaction sentinel. It never masquerades as another domain Action.

Visible results vary by their actual projected contents rather than a fixed actor-versus-opponents rule. Players may receive identical results, but the baseline does not need to group or persist those results. A tentative **Visibility Equivalence Class** remains a possible future optimization only if measurement justifies it.

Common public Actions normally project identically. A private draw may produce an owner result and a public result. A single deal to four Players may produce four Player results plus a public result because each Player sees a different hand.

### Persistence and on-demand projection

The working baseline persists one canonical current state and one Canonical Action History, including canonical undo patches. It does not persist projected Action History, projected state, or Action variants for any perspective.

A live Action response can materialize the requesting perspective's visible state, Action records, and safe patches from the canonical cascade already captured during execution. Initial load and full synchronization can reconstruct the required canonical transition boundaries from the canonical current state and Action History, then project the requested current state and history. Incremental synchronization needs to materialize only the missing canonical suffix.

`Visibility.projectActionHistory` now implements the full-history and replacement-suffix paths as one pure operation. It accepts canonical current state, a contiguous Canonical Action History segment ending at that state, an optional `startIndex` that defaults to zero, a Perspective, and the runtime visibility registration. It requires `currentState.actionCount === startIndex + actions.length` and Action indexes that exactly fill that range. It orders the Actions, walks backward by applying each canonical undo patch to reconstruct every supplied state boundary, and then reuses the ordinary cascade materializer to derive projected Action records and safe patches. The result repeats `startIndex`, including for an empty segment, so an undo response can unambiguously replace or delete a local suffix. It fails when the segment is incomplete or an Action lacks an index or undo patch, and it does not mutate its canonical inputs. Generic initial load now invokes the complete-history form; synchronization and undo do not invoke the suffix form yet.

The backend's ordinary `getGameForUser` load is the first transport integration. It resolves the current Game Runtime from the canonical Game's title, derives a Player Perspective from the authenticated User's Player membership or selects the spectator Perspective when no membership exists, loads the complete canonical Action History, and projects both current state and history when `runtime.visibility` is registered. A request cannot supply its own Perspective. A participating Game without current state may load only with an empty history, and a missing Game Definition fails closed rather than falling back to canonical delivery. A Game Title without visibility registration retains the legacy canonical response.

All initial-load responses carry `Cache-Control: private, no-cache`, allowing a private cache to store them while requiring revalidation before reuse. Perspective-specific responses derive their ETag from the canonical Game ETag and the Player or spectator Perspective. The backend can derive this validator from cached Game metadata before loading current state or Action History, so a matching conditional request retains the existing early `304` path. The Perspective key prevents one Player's validator from matching another Player's representation, while the canonical revision continues to invalidate every projection after a Game write. Legacy canonical responses retain the canonical ETag under the same explicit cache policy. This addresses the initial-load portions of H1 and H10 only. It does not make later transport paths confidential.

Opting in a Game Title requires a Logic-changing Publication with a matching UI Artifact that embeds the projected-state and Processed-Action patch support. For the current experiment that means Fresh Fish; non-participating Game Titles and their UI Artifacts retain the legacy path. The unchanged ordinary initial-load response shape does not by itself require a Site Frontend publication. The Host View request option is part of the host-provided client transport, however, so the Site Frontend must be published before a UI Artifact relies on it. Wiring the shared Game Session to replace contexts when Debug or Admin Mode changes will also require new UI Artifacts for the participating Game Titles because each UI Artifact bundles its Game Session implementation.

Hosted Undo's existing canonical reconciliation contract now carries that same complete suffix shape: `actions` contains every retained or redone Processed Action from `startIndex`, including System Actions, and its compact Realtime Update manifest identifies every one through `actionIds`. The Game Client truncates to `startIndex` and applies each supplied Processed Action exactly once, so it neither skips System Actions nor recursively regenerates them from User Actions. The former `userActions` and `userActionIds` members remain temporarily alongside the complete form solely for independently deployed older UI Artifacts. This is a prerequisite for projected Undo delivery; the payload remains canonical until backend Undo invokes projection.

This baseline intentionally requires no perspective cache, projection checkpoint, background synchronization of alternate contexts, persisted Visibility Equivalence Classes, or chunk-specific projection protocol. Those would be optional optimizations supported only by a demonstrated performance need; they are not prerequisites for the hidden-information design.

Persisted player-relative state or a smaller knowledge overlay may still be required when knowledge cannot be derived from current canonical state. For example, a Player may remain entitled to remember a card after the card moves elsewhere. The representation of durable Player knowledge is unresolved.

### Game Client and History View

An ordinary Hosted Game Client receives only its visible Game State, permitted Action records, and visible patches. History View is derived locally from those inputs and therefore needs no separate confidentiality mechanism.

The History invariant is:

```text
visible state + visible Action records + visible patches
    -> only visible historical states
```

Local backward navigation in a projected context uses visible undo patches. Local forward navigation replays the same visible Action records originally delivered or applies their visible forward patches. A projected context never accesses canonical undo patches.

### Developer and administrator Host View

The initial-load transport now accepts an explicit `view=host` request, authorizes it for an Account with the Developer or Admin role, and returns canonical current state and Canonical Action History with the canonical Game ETag. The ordinary URL continues to derive the caller's Player or spectator Perspective even when that caller is a Developer or Administrator. The client transport exposes the request through `getGame(gameId, { hostView: true })`; it does not yet activate that request from the Debug or Admin toggles.

Enabling Developer Debug Mode or Admin Mode must request a fresh authorized canonical load and construct a separate Host Game Context containing canonical current state and Canonical Action History. While either mode remains enabled, the Game Client temporarily uses that context for displayed state, Action history, History View, and authoritative updates.

Once neither mode remains enabled, the client discards the Host Game Context and performs a full load of the caller's ordinary Player or spectator projection. The client must not merge canonical information into the projected context or try to derive one Player's projection from another Player's local data.

No optimized context transition is required. A complete canonical load on entry and a complete projected load on exit are acceptable. The existing ability of Game Session to hold different Game Contexts provides the intended client-side shape; keeping both contexts synchronized, caching canonical responses, or incrementally transforming between views is explicitly unnecessary for the initial implementation.

### System Action cascades

Optimistic Application currently executes a new User Action and deterministically generates its System Action cascade. Authoritative delivery is different: the host supplies the complete ordered Processed Action trace, and the Game Client applies each supplied record exactly once. Hidden information can prevent rules replay when an Action depends on secret state or server-only randomness.

The working direction classifies the initiating User Action and its entire triggered System Action cascade together for each perspective or Visibility Equivalence Class. At minimum, the platform needs two modes:

1. **Processed-Action replay cascade**: the host supplies the complete permitted User and System Action trace. The client applies each Processed Action through game rules exactly once. System Actions scheduled while replaying one record are not recursively processed because their authoritative records occur later in the supplied trace.
2. **Forward-patched cascade**: the host supplies the same complete permitted Action trace, but every record carries a `forwardPatch`, including an empty patch when that Action has no visible state effect. The client applies only those patches and never hydrates, validates, or executes the Actions.

Cascade mode may differ by perspective. An acting Player may be able to replay a private Action that opponents receive as a patched cascade. The mode is not mixed arbitrarily inside one perspective's cascade because doing so risks locally generated children competing with authoritative children.

For a forward-patched cascade, the server must deliver every Processed Action identity and index needed for the Canonical Action History and Action History Checksum, including no-visible-effect System Actions. Each entry may retain its canonical type or use the redaction sentinel. The batch should be persisted and delivered atomically while retaining per-Action records for checksum, history, undo, and animation.

If the existence or number of System Actions is itself secret, the current common checksum is incompatible with that secrecy because every client observes the canonical Action identities and indexes. Hiding Action existence would require a different checksum contract, batching/coalescing of internal operations, or padding. It is not solved by payload or type redaction.

### Randomness and Action identity

Common card games clarify that a draw ordinarily does not consume randomness. A secret shuffle consumes randomness once and establishes a canonical ordered deck; later draws deterministically remove Cards from that hidden order. A draw is nevertheless host-resolved because the client lacks the deck contents.

The current state PRNG still requires separation before it can protect hidden randomness. System Action IDs currently use `gameState.getPrng().randId()`, so identity generation advances and exposes values derived from the same deterministic stream used by game rules. A cascade patched on one client can also leave that client's PRNG position different from the host before a later replayed cascade.

The current design direction therefore distinguishes three concerns:

- secret deterministic game randomness, whose seed and state remain host-only;
- public replayable randomness, if a game needs it; and
- Action identity generation, which must not expose or advance secret game randomness.

System Action identities could be server-assigned or derived from an initiating Action identity and a cascade ordinal. The exact mechanism is unresolved. Merely withholding PRNG state while publishing IDs derived from the same non-cryptographic stream is not considered a sufficient confidentiality design.

### Other projection surfaces

State and Processed Action delivery are not the only possible information channels. Participating games must also project or restrict:

- valid Action types and concrete legal choices, such as playable Hearts Cards or requestable Go Fish ranks;
- validation and rejection messages that could explain secret facts;
- processed-result, history-description, and animation metadata;
- Machine State names when an internal branch itself reveals a secret; and
- timing, cache keys, and response reuse where they distinguish perspectives.

## Current strategy assessment

This assessment records the leading proposal at this point in exploration; it is not an architectural selection.

| Candidate strategy                                                  | Current working assessment                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit state and Action projection with deterministic replay only | Fits ordinary private state and preserves the current runtime, but cannot cover every secret-dependent cascade or a redacted Action type without requiring visible Actions to reproduce hidden scheduling decisions.                                                                                                                                    |
| Visibility wrappers or schema annotations                           | Potentially useful authoring and validation helpers for common fields, but not a complete confidentiality, transition, persistence, or synchronization design.                                                                                                                                                                                          |
| Separate canonical and visible rules runtimes                       | Can theoretically cover every scenario, but duplicates rule behavior and creates a large drift and testing burden.                                                                                                                                                                                                                                      |
| Reusable hidden-information modules                                 | Promising for recurring hands, decks, sealed submissions, and aggregates, but must sit on a platform transition and projection mechanism with a game-specific escape hatch.                                                                                                                                                                             |
| Forward patches for every transition                                | Uniform and complete, especially for opaque Actions and hidden System Action cascades, but may unnecessarily replace deterministic replay for the majority of existing public Actions.                                                                                                                                                                  |
| Processed-Action replay with cascade-level forward-patch fallback   | Current leading proposal. The host supplies the complete authoritative Action trace in both cases. Each perspective either replays every supplied record exactly once or applies every supplied forward patch. This preserves ordinary rules execution without asking a replayed Action to process generated children that also arrive authoritatively. |
| User-Action replay that regenerates the System Action cascade       | Remains useful for explicitly safe Optimistic Application before a host result exists. It is no longer the proposed authoritative-delivery mechanism because generated children can compete with the complete host-supplied trace.                                                                                                                      |

## Candidate declarative visibility model

> **Implementation experiment status:** This remains a working proposal, not an accepted direction. Schema declaration and derivation, pure state and Action projection, optional Game Runtime projector registration, canonical Action-cascade capture, visible patch materialization, on-demand full-history materialization from persistence, and ordinary initial-load transport now have initial implementations. Projected hydration, replay classification, remaining transport paths, and the Developer/Admin Host Game Context remain design work.

The goal is for game logic to remain canonical and perspective-free. An Action or state handler should not normally contain branches such as `viewer === owner`. Instead, a participating game would declare visibility near its existing TypeBox state and Action schemas, and the platform would compile those declarations into the projection and transition behavior described elsewhere in this document.

The engine cannot infer that a field named `money`, `cards`, or `plan` is secret. The developer must supply the game-rule meaning somewhere. The proposed leverage is that the developer declares that meaning once while the engine owns traversal, recipient selection, visible results, safe patches, canonical reconstruction, synchronization, and conformance checks.

### Two independent declaration axes

A declaration separates **audience** from **redaction**:

- **Audience** answers which perspectives may receive the canonical value.
- **Redaction** answers what representation every other perspective receives.

Keeping these axes independent allows the same audience policy to be paired with omission, a count, a presence marker, or a game-specific projection. Candidate built-in audience policies include:

| Audience policy | Tentative meaning                                                              |
| --------------- | ------------------------------------------------------------------------------ |
| `public`        | Every ordinary perspective receives the canonical value                        |
| `owner`         | The owning Player receives the canonical value                                 |
| `actor`         | The Player associated with the current Action receives the canonical value     |
| `team`          | Members of an identified team receive the canonical value                      |
| `knowledge`     | Perspectives with a recorded knowledge entitlement receive the canonical value |
| `policy(name)`  | A registered game-specific policy calculates the entitled audience             |
| `hostOnly`      | No ordinary client perspective receives the canonical value                    |

Candidate redaction policies include:

| Redaction policy   | Tentative visible result                                                             |
| ------------------ | ------------------------------------------------------------------------------------ |
| `omit`             | The field is absent when the projected schema permits absence                        |
| `presence`         | A safe submitted, set, or present marker replaces the value                          |
| `count`            | Only an allowed aggregate is retained                                                |
| `project(adapter)` | A registered Adapter produces a fixed safe representation                            |
| `sentinel`         | A platform sentinel replaces an undisclosed Action type and forces patch application |

The names and exact set are placeholders. For example, `owner` still needs an unambiguous way to locate ownership, while `count` needs a declared output field or enclosing fixed-shape Module. These are semantic policies rather than assumptions based on property names.

### TypeBox annotations and authoring helpers

The initial implementation uses TypeBox's support for unknown schema options to attach a data-only `x-tabletop-visibility` keyword. Developers use typed helpers rather than writing raw metadata:

```ts
import { Visibility } from '@tabletop/common'

const PlanningRound = Visibility.scope(
    Type.Object({
        // protected descendants
    }),
    'example.planning-round'
)

const SubmittedAmount = Visibility.protect(Type.Number(), {
    policy: Visibility.Policy.Actor
})

const TileBag = DrawBag(Tile)

const Projection = Visibility.createProjectionSchema(Canonical)
```

The visibility helpers and types are exposed as the single `Visibility` namespace from `@tabletop/common`. `Visibility.protect(schema, { policy })` keeps the TypeBox schema as the primary operand and defaults to omission for an unauthorized perspective. The optional named `redaction` property additionally supplies a serializable Adapter declaration and the TypeBox schema for both possible projected representations. `Visibility.redaction.emptyArray()` is the first built-in replacement declaration. Schema generation records the Adapter identifier without executing it.

`Visibility.scope(schema, name)` marks the canonical value described by a schema as named context for its protected descendants without changing the value or its direct `Type.Static` type. During projection, a resolver can call `context.requireScope(scopedSchema)` to obtain the nearest active canonical value carrying that schema's scope name. Lookup fails when the scope is absent or its value does not validate against the scoped schema. This permits a reusable nested Module to inspect its own enclosing state without knowing an absolute root path or adding a visibility discriminator to stored state.

`DrawBag` owns the visibility declaration for its `items`: exact item identities and order are host-only, and an unauthorized projection receives an empty `items` array. Its `remaining` count stays public. Games inherit that behavior simply by declaring, for example, `DrawBag(Tile)`; they do not repeat or configure the protection at each use site.

An unannotated field is public. There is deliberately no `publicField()` wrapper, required object-level default, or strict classification mode in this first design. This keeps existing schemas unchanged and asks a game developer to mark only the protected exceptions. A missed annotation is treated as a correctable game implementation error rather than something this system can automatically recognize.

The visibility metadata belongs to the schema, not to each serialized state object. It therefore does not by itself introduce a `Visible | Hidden` discriminated union into stored state. The canonical value retains its ordinary domain shape and exact direct `Type.Static` inference. TypeBox compilation ignores the custom keyword while continuing to validate the canonical schema.

`Visibility.createProjectionSchema` recursively derives a separate schema without mutating the canonical schema. An omitted protected property becomes optional. A replacement property accepts either its recursively projected canonical representation or the declared safe replacement representation. Unannotated parents are still traversed so protected descendants are found. The current traversal covers the ordinary JSON Schema composition keywords used by this repository, including objects, arrays, tuples, unions, intersections, records, conditionals, and definitions.

`Visibility.createProjector(schema, { policies })` is the first pure runtime projection Module. It compiles canonical and projected validators once, returns the derived schema as `projector.schema`, and projects a canonical value through `projector.project(value, perspective)`. A game-specific policy registry is an explicit creation dependency rather than global mutable registration. Each named resolver receives the Perspective, canonical root, protected value, parent object, value path, and typed access to required schema scopes, then decides whether that Perspective may receive the canonical value. An authorized value is still recursively projected so a visible outer object cannot bypass a protected descendant.

A participating Game Runtime can expose compiled state and Action projectors through the optional `runtime.visibility` member. Fresh Fish is the first registration. This gives generic host code one game-independent discovery seam while leaving non-participating Game Runtimes unchanged. `runtime.visibility.state` accepts the Game Runtime's canonical state type, and its result must retain the shared `GameState` contract even when protected game-specific fields have a different projected shape. `runtime.visibility.actions` selects a precompiled projector by canonical Action type and fails when no schema is registered. Its optional policy registry is typed against the union of its registered Action schemas, allowing a game-owned resolver to narrow by Action type when necessary. Fresh Fish supplies a complete title-owned schema registry containing both its User and System Actions; its existing API Action registry remains the smaller User Action subset.

The common `Visibility.projectActionCascade` experiment accepts a canonical starting state followed by an ordered sequence of Processed Actions and their canonical after-states, together with a Perspective and the runtime registration. It projects each state boundary once and returns an ordered sequence of projected Action records. A one-Action sequence represents the smallest Action cascade. The engine-owned `GameAction.undoPatch` and `GameAction.forwardPatch` declarations are host-only for every Action schema that inherits them, and the Action projector removes both canonical patch fields before invoking the schema projector. The materializer calculates both safe patch directions by comparing only adjacent projected states and writes them directly onto each projected Action record. It currently retains a `forwardPatch` on every projected Action, conservatively making its result a forward-patched cascade. A later classifier can prove an entire perspective-specific cascade replayable and omit `forwardPatch` from every record in that cascade.

`Visibility.projectActionResult` is the host-facing result seam around that lower-level materializer. It accepts the canonical `ActionCascadeResult`, a Perspective, and the optional `runtime.visibility` registration. A participating runtime receives a result containing the projected final state, projected Processed Actions, and unchanged index offset. When the registration is absent, it receives those same three canonical result fields without projection, preserving the existing all-public behavior for a non-participating Game Title. Both branches construct the return value explicitly, so the host-only `actionCascade` capture cannot be included through object spreading or incidental serialization. The operation does not mutate the canonical result. Backend persistence and transport do not call this seam yet.

`Visibility.projectActionHistory` is the corresponding history-segment seam for a participating runtime. With the default `startIndex` of zero it projects a full history; with a later `startIndex` it projects the contiguous replacement suffix needed by synchronization or undo. It reconstructs the supplied canonical transition boundaries backward from canonical current state using the Action-carried canonical undo patches, then delegates visible Action and patch production to `projectActionCascade`. Returning the start index makes an empty replacement suffix meaningful. This keeps live, cold, and partial projection on the same materialization path instead of implementing separate history-redaction logic.

The Hosted Undo reconciliation path now consumes a complete Processed Action replacement suffix with the same start-index invariant. Its direct response carries the Actions, while its compact Realtime Update carries their IDs and the newly redone records needed when those IDs are not already local. Reconciliation applies each record through `GameEngine.applyProcessedAction`; it no longer treats User Actions as instructions to regenerate their System Action cascades. Recipient-specific projection of that canonical suffix remains future work.

`GameEngine.executeAction` accepts an Unprocessed Action, sanitizes its submitted `undoPatch`, `forwardPatch`, and result `metadata`, and executes the complete canonical cascade. Its result exposes `actionCascade`, containing a clone of the canonical input state and one ordered `{ action, after }` transition for every processed User and System Action. Each resulting Action carries its freshly generated canonical undo patch aligned with its recorded after-state. Sanitization applies only to the initiating Action; System Actions created inside `MachineContext` are already authoritative and retain their generated data.

`GameEngine.applyProcessedAction` accepts one authoritative Processed Action. When `forwardPatch` is present, including an empty array, it applies that patch to a cloned state without hydrating the Action, invoking game logic, consuming PRNG state, or generating System Actions. Otherwise it replays exactly that one record through game rules and does not recursively process scheduled children. `GameEngine.undoProcessedAction` applies the Action-carried undo patch without game execution. This lifecycle interface replaces the former public `run` mode flag, so backend execution, Hotseat Play, Processed Action delivery, and History Navigation select an operation by what kind of Action they hold rather than by where the engine instance runs. Fork reconstruction has a narrowly named `rebuildProcessedAction` operation because it recreates one historical canonical record with a new identity and undo patch rather than applying an existing record. The engine capture and Processed Action application paths are not yet connected to projected backend persistence or transport.

The `metadata` property is consequently reserved for Processed Action results. An Unprocessed Action that needs similar player-supplied data uses a domain-specific field name. Authentication and Player attribution remain outside the Game Engine: the host derives those facts from its authenticated request before calling `executeAction`.

The current implementation handles `hostOnly` as unauthorized for both client-facing perspective kinds, handles `actor` by matching a Player Perspective to the projected root value's required `playerId`, resolves simultaneous-auction bids through their enclosing schema scope, executes omission and the built-in empty-array Adapter, evaluates registered named audience policies, recursively projects schema-declared values, and does not mutate its input. It copies object fields from the schema as an allowlist rather than copying undeclared runtime properties. An actor-protected projection fails if its root has no Player attribution. A required scope fails if it is absent or contains the wrong canonical shape. Creation fails closed when a declaration names an audience policy or Adapter that has no implementation, and every result is checked against the derived projection schema. Custom Adapter registration and transition-aware policy context remain future work.

Runtime metadata survives the Fresh Fish composition paths exercised so far. TypeBox's own type-level transforms do not preserve arbitrary custom option types through every nested composition, even when the runtime schema retains the metadata. Direct declarations and derived schemas have precise static types; a deeply composed derived schema may currently have a conservative static type that does not express every redacted representation accepted by its runtime schema. This is a known boundary of the experiment rather than a reason to put visibility discriminators into stored state.

Schema metadata contains structured policy, scope, and Adapter identifiers, not executable functions. Game-specific functions live in a game-owned registry supplied when a projector is created, while policies owned by reusable common Modules are supplied by the common projector. This keeps published schemas serializable, inspectable, and potentially versionable while avoiding process-global registration order.

### Reusable projection Modules and Adapters

Annotations alone cannot safely invent a visible representation for an arbitrary domain value. A reusable hidden-information Module would pair a canonical schema with a fixed projected shape and the operations needed to maintain it. Candidate Modules include:

- hidden values;
- hidden collections and sequences;
- sealed submissions;
- Player-knowledge overlays;
- team-private state; and
- public aggregates.

`DrawBag` is the first implemented example of a common Module owning its visibility invariant rather than requiring every game to repeat it. A game that needs a public source of items should use a differently named Module whose semantics are public, rather than weakening `DrawBag` at each call site.

`SimultaneousAuction` is the first implemented scoped Module. Its schema marks the auction as `tabletop.auction.simultaneous`, and its participant schema protects every submitted bid with a common policy. Before the auction resolves, a submitted bid is visible only to its Player; after the auction records a winner, every Player Perspective and spectator may see every bid. A game inherits the scope, declaration, and policy by using `SimultaneousAuction`; it does not register a game-specific resolver or couple visibility to its Machine State.

For example, a hidden-card collection could own the proposed fixed shape of complete `cards` plus `unknownCount`, along with safe visible add, remove, transfer, and reveal operations. Canonical state uses the same fixed shape with every Card present and `unknownCount = 0`; projected state can contain the permitted Cards and a nonzero count. This gives the engine and game logic a representation that remains structurally valid without unknown-card placeholder objects or a visibility discriminator.

A pure custom Adapter is the escape hatch for cross-field or game-specific transformations that the standard Modules cannot express. The declaration stores its name, and the host resolves that name through the registered implementation. Standard Modules should cover common cases so custom Adapters do not become perspective checks scattered through Actions.

The initial implementation chooses separately derived schemas: canonical hydrators and validators continue to use the unchanged canonical schema, while visible records are validated against the projection schema. Omission makes the field optional only in the projection schema. Replacement creates a projection-only union. This resolves the immediate shape conflict without changing stored canonical objects, but projected hydration and execution remain intentionally out of scope.

### Dynamic visibility policies

Some visibility depends on the current rules state rather than permanent ownership: a passed Card remains known to its former owner, teammates share information only during a phase, or hands reveal at scoring. A game can supply a small number of named policies:

```ts
const policies = {
    'remember-passed-card': canViewRememberedCard
}
```

Fresh Fish separates three bid representations according to their lifetimes. `currentAuction.participants[].bid` inherits `tabletop.auction.simultaneous.bid`; the shared resolver permits a Player to see their own bid before the scoped auction resolves, omits other Players' bids, omits every bid for a spectator, and permits every Perspective after the auction records its winner. This decision depends on the auction's own state rather than Fresh Fish's transient Machine State. `PlaceBid.amount` uses the common `actor` policy and remains omitted from every other Player's and spectator's copy of that Action record. `EndAuction.metadata.participants` is the public disclosure record containing every bid.

After play leaves `MachineState.AuctionEnded`, Fresh Fish removes `currentAuction` from current Game State. Previously disclosed bids do not become secret again: the public `EndAuction` record remains in visible Action history, while a later auction receives a new independently protected `currentAuction`. This treats revelation as a monotonic knowledge event rather than continually recalculating historical Action visibility from the current Machine State. If a future game must enrich an earlier private Action record instead of publishing a later disclosure record, it will require persisted knowledge or an explicit update keyed to the reveal event.

The initial value-policy context contains the Perspective, canonical root and protected values, parent object, annotated path, and `requireScope` lookup. The projector maintains active canonical scopes along the current schema traversal path, so sibling or successive scoped values do not affect one another and a nested repeated scope name resolves nearest-first. This is sufficient for snapshot-relative ownership and reveal rules, as well as an actor-relative Action value whose root carries `playerId`. Classifying a cascade or changing historical knowledge at a later reveal will require a transition context containing canonical before- and after-state plus the Processed Action. That extension is intentionally not simulated with optional snapshot fields in the current Interface. Policy resolvers must remain pure and deterministic. Common policies such as owner-until-phase or reveal-after-all-submit should be engine-provided declarations; a custom callback should remain a centralized exception rather than ordinary Action logic.

### Action declarations

The same declaration vocabulary now applies to registered User Action and System Action schemas, including their payloads, processed results, and other Processed Action metadata. The schema projector constructs a visible record from declared fields as an allowlist. Canonical undo data is removed at the Action-projection seam before that traversal because it is platform-owned rather than game-visible Action content.

The built-in `actor` audience policy permits a protected value only when a Player Perspective matches the root Action's `playerId`. It does not require game-specific registration. A root without Player attribution fails projection rather than guessing an actor; unattributed System Actions must use another policy.

An Action type can be treated as another classified field. If a perspective is not entitled to it, the engine emits the reserved redaction sentinel, prevents game hydration or execution of that record, and selects a forward-patched cascade. This preserves one canonical game-semantic Action type rather than introducing a second type for another perspective.

For this to be exhaustive, the engine must be able to enumerate the schemas for every User and System Action that a game can produce. Fresh Fish now does so in a title-owned registry used by its Action projector. The generic runtime does not yet derive or verify that registry against every Action its hydrator and Machine State Handlers can produce, so completeness remains a participating-game responsibility in this experiment.

### Compiled projection plan and engine Interface

At publication or runtime startup, a hidden-information compiler could turn the state schema, all Action schemas, named policies, and Adapter registry into one projection plan. This should be a deep Module with a small Interface such as:

```text
projectSnapshot(canonicalState, perspective)
projectActionResult(canonicalResult, perspective)
```

Behind that Interface, the Module would own recursive traversal, visible Action records, forward and undo patch derivation, cascade mode, and checksum-preserving results. That keeps the projection Seam out of individual game Actions and transport handlers. Grouping results into Visibility Equivalence Classes remains an optional internal optimization rather than part of the Interface.

The current narrower implementation exposes `runtime.visibility.state`, `runtime.visibility.actions`, the lower-level `Visibility.projectActionCascade` operation, and the host-facing `Visibility.projectActionResult` operation. This establishes the opt-in result, snapshot, Action-selection, ordered-cascade, Action-carried-patch, and patch-application parts of that Seam without prematurely choosing the canonical-history reconstruction or cascade-classification protocol. A completed Action cascade is already the outer materialization unit and remains the intended unit for later classification and delivery; callers must not independently remove forward patches from individual Action entries because replay versus patching is one decision for the complete perspective-specific cascade.

Compilation could fail a participating game before publication when:

- a named policy or Adapter is missing;
- a projected representation does not validate against its projected schema;
- the redaction sentinel collides with a game Action type;
- a redacted Action type lacks a patch-capable path;
- a System Action schema cannot be discovered; or
- client-visible state contains a host-only PRNG or another explicitly forbidden field.

Existing games and unannotated fields retain their current all-public behavior. A participating game opts individual protected fields into projection. The engine can still reject unresolved policy or Adapter identifiers and invalid projected values, but it does not require exhaustive public classifications.

### Automatic whole-cascade replay selection

The developer should not have to predict manually which of mostly public Actions can safely replay for every perspective. A possible engine-owned probe is:

1. Execute the initiating Action and its complete System Action cascade canonically on the host.
2. Project the canonical before- and after-state for one Visibility Equivalence Class.
3. Project the complete visible Action trace for that class.
4. Remove the candidate forward patches and replay that trace one Processed Action at a time in an isolated visible runtime.
5. Compare its final visible state and generated Action identities and trace with the authoritative projection.
6. Use deterministic replay only on an exact match.
7. On an exact match, omit `forwardPatch` from every record in the visible cascade; otherwise retain it on every record.

A sentinel Action makes the record non-executable and therefore selects patching without a probe. Replay would be chosen because the engine demonstrated visible equivalence for this particular cascade and perspective, not because a developer guessed that an Action type was always safe. Dynamic rules state means the result generally cannot be cached solely by Action type.

This probe is itself only a candidate. It may be too expensive to run for every transition, and it must not duplicate side effects, consume shared PRNG state, or allow visible execution to consult canonical values. It may prove more suitable as a conformance-test mechanism, with a smaller explicit runtime declaration for production. Runtime cost would be per Visibility Equivalence Class rather than necessarily per Player, but it still needs measurement.

Optimistic execution is a separate concern because a client must decide whether to execute before the host has produced a result that can be probed. A hidden-information game may need to mark a small set of Actions explicitly safe for optimism and wait for authoritative results for the rest.

### Tentative developer workload

If the proposal works, a game developer would normally:

1. Annotate the small number of protected state and Action schema fields.
2. Reuse built-in audience and redaction declarations where their semantics fit.
3. Use standard fixed-shape Modules for hands, decks, sealed values, and aggregates.
4. Register a named policy or custom Adapter only for unusual reveal or retained-knowledge rules.
5. Explicitly approve the Actions that may execute optimistically.

The engine would then handle snapshot and Action projection, opaque sentinels, forward and undo patches, System Action cascades, on-demand materialization, synchronization, and most validation of the confidentiality contract.

### Initial TypeBox findings and remaining questions

The initial implementation establishes that:

- a typed helper can attach serializable metadata without changing a directly declared canonical `Type.Static` type;
- canonical and projection schemas can be generated from one annotated definition without TypeScript assertions;
- omission and replacement produce independently compilable projection schemas;
- visibility and scope metadata survive the Fresh Fish runtime schema composition exercised by the bag, auction, game state, and `PlaceBid`;
- the pure runtime projector requires an explicit Player or spectator Perspective, executes the built-in host-only, actor, and simultaneous-auction bid policies plus registered audience policies, makes the nearest named schema scope available to a resolver, recursively protects authorized values, validates its result, and rejects unresolved declarations before projecting a value;
- a participating Game Runtime can register that state projector through its optional visibility configuration without changing existing Game Titles or transport;
- the same runtime registration can enumerate and project all title-owned User and System Action schemas, rejects unregistered Action types, and removes canonical patch fields before Action projection;
- `GameEngine.executeAction` sanitizes engine-owned submitted results, captures the canonical before-state and every ordered User/System Action after-state, and does not sanitize internally generated System Actions;
- `GameEngine.applyProcessedAction` selects Action-carried forward patching by field presence, including an empty patch, before any attempt to hydrate or execute the Action, while its replay path applies exactly one supplied Processed Action;
- `GameEngine.undoProcessedAction` uses the undo patch carried by either a canonical or safely projected Processed Action;
- a pure cascade materializer preserves public User and System Action identity fields while deriving visible forward and undo patches solely from adjacent projected states and attaching them directly to the projected Actions;
- the host-facing result projector returns projected state and Processed Actions for a participating runtime, preserves the canonical result for an absent visibility registration, and excludes the host-only canonical transition capture from both results;
- the pure history-segment projector validates and orders either a complete Canonical Action History or a contiguous suffix ending at current state, reconstructs every supplied canonical state boundary from canonical undo patches, produces the same visible state and Actions as live cascade projection, preserves an explicit start index for empty replacements, and does not mutate its input;
- generic Hosted Game initial load resolves the participating runtime, derives Player or spectator Perspective only from the authenticated User and canonical Game membership, projects Fresh Fish state and complete Action History on demand, fails closed when its title definition or required history is unavailable, and preserves legacy canonical delivery for a runtime without visibility registration;
- perspective-specific initial-load responses derive private revalidating ETags from the canonical Game revision and Perspective, preserving early `304` responses without allowing one Player's validator to match another Player's representation;
- an explicit initial-load Host View request is limited to Developer and Admin roles, bypasses projection without changing Acting Player or Player Perspective, retains the canonical ETag, and is available through the client transport without yet driving the separate Host Game Context lifecycle;
- Hosted Undo reconciliation carries all User and System Actions in its replacement suffix, resolves newly redone records supplied with Realtime Updates, applies each Processed Action exactly once, and retains the former user-only fields only for mixed UI Artifact compatibility;
- the shared simultaneous-auction policy produces distinct owner, opponent, spectator, and resolved-bid projections for Fresh Fish while the Draw Bag remains redacted;
- Fresh Fish projects `PlaceBid.amount` with the common actor policy, produces different actor and non-actor transition records and patches, and publishes lasting bid knowledge through the public `EndAuction` record; and
- TypeBox type-level composition may erase custom option types even where the runtime metadata survives.

The broader proposal still needs answers to the following:

- Do custom annotations survive every TypeBox builder and transform the repository may use, including references, `Pick`, and `Partial`?
- How should projected static types remain precise after a TypeBox transform erases custom option types?
- Which projection-capable Modules should declare a richer fixed visible shape instead of using generic omission or replacement?
- Can existing hydrators and state classes accept omitted, aggregated, or fixed-shape projected values without receiving canonical-only fields?
- Is using one fixed shape for canonical and projected state viable for common cases, and which standard Modules are actually acceptable to game authors?
- Would a parallel visibility registry compose more reliably than schema metadata while retaining locality at the declaration site?
- Where are named policies and Adapters registered, and how are they versioned when a Game Title publication changes?
- Can all System Action schemas be enumerated before publication?
- Is isolated replay pure, deterministic, performant, and compatible with current Machine Context and PRNG behavior, or should probing remain a test-only tool?
- What is the exact projected Action-record and redaction-sentinel schema?

## Card-game case studies

Hearts, Go Fish, basic draw-meld-discard Rummy, and War were used to test the model. Exact rule variants differ, but several common conclusions hold:

- shuffle establishes a secret ordered zone; an ordinary draw removes from that zone without consuming more randomness;
- a small number of Action families carry secret payloads, but many public Actions still validate or mutate private zones and therefore cannot automatically use canonical replay against every perspective;
- a complete Card identity is either present or omitted from a projection; generic unknown-card objects with stable identities are unnecessary and may create tracking leaks;
- retained Player knowledge may be supplied by visible Action History, by a current-state knowledge overlay, or by both; and
- concrete legal choices and validation failures are perspective-sensitive alongside state and Processed Actions.

### Hearts

A representative machine proceeds through deal, simultaneous pass submission, pass resolution, repeated card play and trick resolution, then hand scoring.

- Hidden state includes the shuffled deal, other Players' hands, and uncompleted pass selections.
- Public state includes scores, pass direction, turn, current and completed tricks, hand counts, and whether hearts are broken.
- A Player may retain exact knowledge of Cards they passed into another Player's otherwise private hand.
- When its type is disclosed, `SubmitPass` remains the same Action type for every recipient. Its actor-visible record can contain the Cards while another record contains only the permitted count or no payload. A UI phrase such as "pass submitted" is presentation, not a replacement Action type. If even `SubmitPass` is secret, its opaque record uses the platform sentinel and a forward patch rather than another game-semantic type.

An illustrative fixed-shape payload is:

```text
SubmitPass
├── cards: complete Card identities permitted in this record
└── unknownCount: additional submitted Cards omitted from this record
```

The canonical and submitting-Player records can carry three Cards and `unknownCount = 0`; an opponent record can carry no Cards and `unknownCount = 3`. The server must still reject an Unprocessed Action that attempts to submit unknown Cards: the permissive processed-record shape does not relax canonical command validation.

- Pass resolution naturally creates Player-specific projections because every Player receives a different set of Cards.
- An accepted `PlayCard` becomes public, but an opponent cannot run canonical validation that depends on the actor's hidden hand. A projected operation can remove the Card from the known subset when present or decrement the unknown count otherwise.
- Trick resolution and scoring are normally public and deterministic from already revealed Cards.

### Go Fish

A representative machine alternates between asking for a rank, resolving a transfer or miss, drawing after a miss, checking for a completed book, and choosing whether the same Player continues.

- Hidden state includes hands, stock order, and a privately drawn Card.
- Public state commonly includes the requested Player and rank, success or failure, permitted transfer count, hand and stock counts, completed books, and active Player.
- `AskForRank` may be public even though its validity proves a private fact about the asker's hand.
- Transfer records can disclose exact Cards to giver and receiver while disclosing only rank and count to other Players.
- A draw record can disclose the Card to the drawing Player and only count changes to others. If the rules require a matching draw to be shown, that result is public.
- Most turns branch on private hand or stock contents, so many Go Fish cascades are host-resolved even though their initiating User Action type is public.

### Rummy

A representative machine requires a draw, permits melds or layoffs, requires a discard, advances the turn, and eventually scores the round.

- Hidden state includes hands, stock order, private stock draws, and unsubmitted local selections.
- Public state commonly includes phase, active Player, stock count, discard pile, table melds, hand counts, and scores.
- A stock draw is host-resolved and projected privately; taking a public discard creates retained public knowledge that the Card entered that Player's hand.
- Accepted meld, layoff, and discard payloads become public, but their visible application still removes from a partially represented private hand.
- A stock reshuffle is host-only secret randomness. Whether remaining hands reveal during scoring is an explicit game rule rather than an automatic end-game policy.

### War

A representative machine deals, reveals battle Cards, compares them, places face-down Cards on a tie, repeats the reveal, collects the pot, and checks for game end.

- Both Players' future pile orders and face-down war Cards are hidden from every ordinary Player, including the pile owner.
- Public state includes pile counts, face-up battle Cards, face-down pot count, battle outcome, and game result.
- Most Players share one public Visibility Equivalence Class rather than owner-specific views.
- `RevealBattleCards` is host-resolved from hidden pile order, but its result immediately becomes public and can be represented by an executable result-bearing record or by a forward patch.
- Tie cascade length is derived from public revealed ranks under ordinary rules, so it does not add a hidden-existence leak.

Within the current proposal, these examples suggest that reusable fixed-shape hidden-zone operations could make many host-resolved records executable without requiring a second full visible rules runtime. Forward patches are the proposed fallback when a permitted record cannot express its visible consequence safely.

## Scenario catalog

### Information patterns

| ID  | Scenario                              | Required perspectives                                                          | Primary stress                             |
| --- | ------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| I1  | Hidden scalar, such as money          | Owner sees the value; others see nothing or an allowed indicator               | Owner and public patches differ            |
| I2  | Private hand mutation                 | Owner sees card identities; others see backs or a count                        | Arrays and placeholder handling            |
| I3  | One Action deals to several Players   | Each Player sees their own cards; public sees none                             | Potentially one result per Player          |
| I4  | Team or shared secret                 | A subset of Players shares exact information                                   | Audiences beyond owner and public          |
| I5  | Hidden pieces with a public aggregate | Exact contents are hidden; a count or capacity is public                       | Projection transforms structure            |
| I6  | Hidden deck order                     | Order and identities are hidden; size is public                                | Secret randomness and replay feasibility   |
| I7  | Private transfer or random theft      | Participants may learn different facts; others see only an occurrence or count | Multiple asymmetric perspectives           |
| I8  | Private observation                   | One Player peeks without publicly changing physical state                      | Durable Player knowledge                   |
| I9  | Simultaneous sealed submissions       | Owner sees their submission; others see submitted status                       | Concurrency and delayed resolution         |
| I10 | Progressive reveal                    | Owner-only information becomes team-visible and later public                   | Visibility changes over time               |
| I11 | Selective reveal                      | Only part of a hand, plan, or bid becomes public                               | Partial replacement of redacted structures |
| I12 | Permanently hidden information        | An unused deck, losing hand, or secret plan stays concealed after completion   | No implicit end-game disclosure            |

### Action and execution patterns

| ID  | Scenario                                              | Question exercised                                                                         |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A1  | Public Action with a private consequence              | Can the Action replay against every visible state?                                         |
| A2  | Public Action type with a secret payload              | Can the payload be projected while preserving correct visible execution?                   |
| A3  | Secret-dependent public consequence                   | Can a client reach the public result without knowing the secret input?                     |
| A4  | Hidden Action type                                    | Can an opaque Action envelope advance state, or is a forward patch required?               |
| A5  | Action changes another Player's secret                | Are all asymmetric results produced rather than assuming actor and public results suffice? |
| A6  | Processed-result metadata contains secrets            | Are history descriptions, animation metadata, and result metadata projected?               |
| A7  | Canonical undo contains secrets                       | Is each visible undo patch independently derived from projected states?                    |
| A8  | Canonical and visible undo operations happen to match | Do client interfaces still exclude the canonical patch conceptually and operationally?     |
| A9  | Legal choices depend on private state                 | Are valid Action types and concrete choices returned only to entitled Players?             |
| A10 | Validation or rejection explains a secret             | Does an error reveal only the permitted reason rather than a hidden rule fact?             |

### System Action patterns

| ID  | Scenario                                            | Primary stress                                                                                        |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| S1  | Public User Action produces public System Actions   | Existing deterministic cascades continue working                                                      |
| S2  | Public User Action produces a private System Action | Perspectives receive different visible consequences                                                   |
| S3  | Secret User Action produces a public resolution     | Opponents cannot necessarily replay the initiating Action                                             |
| S4  | System Action depends on hidden state               | A redacted runtime may choose a different transition or fail validation                               |
| S5  | System Action creates private random results        | Server-only randomness may prevent client replay                                                      |
| S6  | Mixed cascade                                       | One User Action produces several public and private System Actions                                    |
| S7  | Patched cascade                                     | Every Processed Action identity and index still reaches the client                                    |
| S8  | System Action IDs consume the state PRNG            | Concealing random state does not break Action identity or synchronization                             |
| S9  | Perspective-specific cascade mode                   | Is one complete cascade replayed for one perspective and patched atomically for another?              |
| S10 | Secret-dependent cascade length                     | Does the common Action checksum intentionally make the existence and number of System Actions public? |

### Hosted Game workflows

| ID  | Scenario                                              | Expected behavior                                                                        |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| H1  | Initial load                                          | The server returns the requesting perspective's current state and visible Action records |
| H2  | Acting Player submits an ordinary Action              | Optimistic replay works when the visible result is replayable                            |
| H3  | Acting Player submits an Information-Revealing Action | The client waits for authoritative acceptance as it does today                           |
| H4  | Another Player receives a Realtime Update             | Only that Player's result and visible undo patch arrive                                  |
| H5  | Realtime discontinuity                                | Reconciliation returns only permitted visible Action records                             |
| H6  | Simultaneous stale submission                         | Missing Actions are projected for the requester                                          |
| H7  | Full synchronization                                  | Current visible state and visible Action history agree                                   |
| H8  | Reconnect after a reveal                              | The client receives everything currently permitted without canonical remnants            |
| H9  | Server rejects an optimistic Action                   | The client restores its prior visible state without canonical data                       |
| H10 | Cache or ETag reuse                                   | One Player's projected response is never served to another Player                        |
| H11 | Developer Debug or Admin Mode is enabled              | A fresh Host Game Context supplies canonical state, history, patches, and updates        |
| H12 | Developer/Admin Host View is exited                   | The Host Game Context is discarded and a fresh ordinary projection replaces it           |

### Undo and local History View

| ID  | Scenario                                 | Expected behavior                                                                    |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| U1  | Local History Step backward              | Navigation uses only the stored visible undo patch                                   |
| U2  | Local History Step forward               | Navigation replays the stored visible Action or applies its visible forward patch    |
| U3  | Server-authorized Undo                   | The backend reverses canonical history and reports changed Action identities         |
| U4  | Undo reapplies simultaneous submissions  | Every retained or redone User and System Action is projected again for the recipient |
| U5  | Undo crosses an information reveal       | Existing information-reveal policy prevents unauthorized reversal                    |
| U6  | Reveal has perspective-specific undo     | An informed Player and uninformed opponents receive different inverse changes        |
| U7  | Repeated backward and forward navigation | Visible state round-trips without divergence                                         |

### Knowledge and lifecycle

| ID  | Scenario                            | Question exercised                                                                   |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| K1  | Player sees a card that later moves | Where is the Player's retained knowledge recorded?                                   |
| K2  | Player forgets information by rule  | Can knowledge entitlement be explicitly removed?                                     |
| K3  | Player Perspective changes          | Is the projected context replaced without retaining the prior perspective's secrets? |
| K4  | Spectator observes                  | Does the public perspective have a complete safe projection?                         |
| K5  | Developer or administrator inspects | Is explicit Host View canonical access isolated from ordinary Player delivery?       |
| K6  | Game Instance finishes              | Which secrets reveal, and which remain hidden permanently?                           |
| K7  | Exploration begins                  | Can it reveal hidden deck order or another unknown future?                           |
| K8  | Hosted Fork is created              | What knowledge and hidden state may the derived Game Instance retain?                |
| K9  | Game Title publication changes      | Do delivered visible Action records and current projection rules remain compatible?  |

## Candidate conformance checks

Under the current proposal, every participating Action fixture would be evaluated for every relevant Player Perspective. Given canonical before-state `C0`, canonical Action `A`, and canonical after-state `C1`, calculate `V0`, `V1`, `Av`, and `Uv` as defined above and verify:

1. Visible state, Action contents, metadata, and patches contain no unauthorized canonical values.
2. Stored state schemas do not encode perspectives as visibility-discriminated union branches.
3. Visible replay produces `V1`, or an explicit visible forward patch does.
4. Forward and undo patches are deterministic functions of safe projected states rather than filtered canonical patches.
5. Applying `Uv` to `V1` restores `V0`, and reapplying the visible transition restores `V1`.
6. A disclosed Action record retains the canonical game-semantic type; an undisclosed type uses only the reserved redaction sentinel and a forward patch.
7. A sentinel Action record is never hydrated or executed by the game runtime.
8. Every visible result retains the same canonical Action identity and index.
9. One perspective uses one classified transition mode for the complete initiating User Action and System Action cascade.
10. A patched cascade includes every Action identity and index required by the Action History Checksum, including entries with no visible state effect.
11. Initial load, synchronization, Realtime Updates, and Action responses materialize compatible projected results and cascade modes for a perspective.
12. Legal choices, validation failures, history descriptions, and animation metadata reveal no additional canonical information.
13. No ordinary Player or spectator interface or fallback can expose a canonical undo patch.
14. Repeated backward and forward History Navigation remains stable.
15. Enabling Developer Debug Mode or Admin Mode replaces the active client data with a separately authorized Host Game Context containing canonical state, Action history, patches, and updates.
16. Once neither Developer Debug Mode nor Admin Mode remains enabled, the client discards the Host Game Context and fully reloads the ordinary projected context without retaining canonical records.
17. Host View remains independent from the administrator's selected Acting Player and Player Perspective.

## Open questions within the proposal

- How does the platform classify each perspective's complete authoritative Action trace as Processed-Action replay or forward-patched, and how is replayability verified rather than merely trusted?
- What is the exact redacted-type sentinel and cascade-envelope schema around the current Action-carried patch fields?
- Besides identity and index, which Action fields are necessarily public: type, source, Player attribution, timestamps, simultaneous group, and information-reveal metadata?
- What exact fixed-shape state representations should reusable hidden-zone modules provide without using perspective-dependent discriminated unions?
- Which remaining TypeBox composition paths lose runtime metadata, and how should deeply composed projection schemas preserve precise static types?
- How are secret game randomness, public replayable randomness, and System Action identity generation separated?
- Does a later reveal leave earlier delivered visible Action records unchanged, enrich later full-load results, or maintain both event-time and current-knowledge representations?
- Is durable Player knowledge stored in canonical state, in a separate knowledge model, or in persisted player-relative projections?
- How should the initial `runtime.visibility.state` and `runtime.visibility.actions` Interface evolve when transition-aware policies, cascade classification, and opaque Action types are implemented?
- How should the separate Host Game Context request canonical Action, synchronization, Realtime Update, and undo results while Debug or Admin Mode remains enabled?
- How are public spectators, Player reassignment, and post-game visibility represented?
- How are projection changes handled when a Hosted Game follows a newer Game Title publication?

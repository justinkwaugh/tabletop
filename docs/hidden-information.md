# Hosted Game Hidden Information

> **Work in progress:** This document is an exploratory design proposal. Every conclusion, requirement, invariant, interface shape, and example below is provisional and may change. Nothing in this document is an established architecture or accepted decision unless it is later adopted by a separate decision record. Words such as "must", "requires", and "invariant" describe what the current working proposal would require, not a finalized system contract.

## Status and purpose

This document records the current theoretical model and scenario catalog for preventing a Hosted Game Client from receiving information its Player Perspective is not allowed to know. The end-to-end capability is not implemented. Initial authoring and value-projection slices now exist for declaring protected TypeBox fields and named schema scopes, deriving canonical and projection schemas, executing the built-in host-only projection used by Fresh Fish's tile bag, applying the built-in actor policy to `PlaceBid.amount`, and applying the shared simultaneous-auction bid policy to Fresh Fish state snapshots. Fresh Fish money intentionally remains unannotated because hidden money is not currently a game variant. The implementation does not yet project Action transitions, alter transport, persist visible variants, or enforce confidentiality. Resolved-sounding statements are still parts of the working proposal, while explicitly open questions identify areas where even the proposal has not yet converged.

The catalog is intended to evaluate proposed designs and later serve as an acceptance-test matrix. A design is incomplete if it protects ordinary state delivery but leaks information through Actions, undo patches, System Action cascades, synchronization, persistence, or another Hosted Game flow.

## Scope and working assumptions

- Confidentiality is required for Hosted Games. Hotseat concealment remains a presentation convention and is outside this security model.
- A Game Title explicitly participates in hidden-information support. Existing Game Titles need not work without being redesigned or migrated.
- The host retains the complete canonical Game State and Canonical Action History.
- The UI presents information but is not a confidentiality control. Unauthorized canonical data must never reach the client.
- The existence and ordering of Processed Actions are currently assumed to be public because the Action History Checksum depends on Action identity and index. Whether Action type, source, or Player attribution is always public remains open.
- Deterministic client replay remains the normal forward-transition mechanism for ordinary Actions. The working direction adds player-relative forward patches as a fallback for cascades that a perspective cannot safely replay.
- Transition mode is classified for an initiating User Action together with its complete triggered System Action cascade, not independently for arbitrary Actions within that cascade.
- Stored Game State objects must not use perspective-dependent discriminated unions to represent whether their contents are visible.

## Theoretical model

### Canonical model

The backend stores one complete canonical Game State and one Canonical Action History. Each canonical Processed Action contains everything needed for authoritative validation, execution, replay, and Action Reversal, including its canonical undo patch.

Canonical undo patches are backend-only. A client never receives or has a code path to access one, even when a permitted patch would happen to contain identical operations.

### Player-relative projection

A participating Game Title projects canonical information for a Player Perspective. Projection can omit information, replace it with a placeholder or aggregate, retain it for an entitled Player, or reveal it when the rules permit.

Conceptually:

```text
visibleState = projectState(canonicalState, perspective)
visibleActionRecord = projectActionRecord(canonicalAction, perspective)
```

A public or spectator view can be represented as another perspective. Different Players may receive different projections of the same canonical transition.

The initial runtime model has exactly two client-facing perspectives:

```ts
type Perspective = { kind: 'player'; playerId: string } | { kind: 'spectator' }
```

Team membership, ownership, Action authorship, retained knowledge, and reveal state are relationships that policies derive from a Player Perspective and canonical information; they are not additional perspective kinds. Host and administrator access do not enter the ordinary projection path. They use an explicit canonical-access path so `hostOnly` cannot become client-visible through a privileged projector argument. The host must derive a Perspective from authenticated Game membership rather than accept one asserted by a client.

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

`Av(P)` is the permitted visible record of the canonical Processed Action. It is not a second canonical Action. `Uv(P)` is its visible undo patch. The visible undo patch is calculated from two already-safe projected states; it is not produced by filtering operations out of the canonical undo patch. Filtering a canonical patch could produce incorrect array indices, invalid structural changes, or secret replacement values.

A replayable record retains the canonical game-semantic Action type and enough permitted payload to satisfy:

```text
apply(V0(P), Av(P)) = V1(P)
```

A participating Game Title may need to record processed-result metadata in an Action so each permitted record has enough information to reproduce its visible consequence. Projection must not translate one game-semantic Action type into another; for example, a `SubmitPass` Action does not become a synthetic `PassSubmitted` Action. Its permitted contents may differ, and the UI may render a generic description from those contents, but it remains `SubmitPass` whenever its canonical type is disclosed.

If replay cannot be satisfied without revealing a secret, the visible record carries an explicit forward patch:

```text
Fv(P) = diff(V0(P), V1(P))
applyPatch(V0(P), Fv(P)) = V1(P)
```

The patch must be generated solely from the two safe projected states. A deterministic diff that sees only `V0(P)` and `V1(P)` cannot accidentally use canonical object identity or canonical movement paths to reveal more than those states permit.

A patched record need not be executable and may redact the canonical Action type itself. Because `GameAction.type` is currently required, a reserved platform sentinel such as `__redacted__` may be needed. The sentinel is not an alternative game-semantic Action type: it means the canonical type is unavailable to this perspective. Such a record must never enter a game Action hydrator or Action handler, and it must carry a visible forward patch. The exact sentinel and visible-record schema remain unresolved.

### Action identity and visible variants

Every visible Action record preserves the canonical Action identity and index required by the Action History Checksum. Other Action fields are projected. Its type is either the canonical Action type or, for a patched opaque record, the reserved redaction sentinel. It never masquerades as another domain Action.

Variants are organized by distinct visible result rather than a fixed actor-versus-opponents rule. Players whose visible Action contents and patches are identical belong to the same tentative **Visibility Equivalence Class**, allowing one stored variant to serve several perspectives.

Common public Actions normally have one shared variant. A private draw may have an owner variant and a public variant. A single deal to four Players may require four Player variants plus a public variant because each Player sees a different hand.

### Persistence shape

The working persistence model stores one canonical current state and augments each canonical Processed Action with its distinct visible variants:

```text
Canonical current state

Canonical Processed Action
├── full canonical contents
├── canonical undo patch
└── visible variants
    ├── audience
    ├── permitted Action record or opaque record
    ├── cascade transition mode
    ├── visible undo patch
    └── visible forward patch when required
```

This does not require a complete current-state copy for every Player. Initial load and full synchronization can project the one canonical current state for the requesting Player Perspective. Visible variants and their patches should be committed atomically with the canonical transition so projection failure cannot leave a partially updated Game Instance.

Persisted player-relative state or a smaller knowledge overlay may still be required when knowledge cannot be derived from current canonical state. For example, a Player may remain entitled to remember a card after the card moves elsewhere. The representation of durable Player knowledge is unresolved.

### Game Client and History View

A Hosted Game Client receives only its visible Game State, permitted Action records, and visible patches. History View is derived locally from those inputs and therefore needs no separate confidentiality mechanism.

The History invariant is:

```text
visible state + visible Action records + visible patches
    -> only visible historical states
```

Local backward navigation uses visible undo patches. Local forward navigation replays the same visible Action records originally delivered or applies their visible forward patches. It never accesses canonical undo patches.

### System Action cascades

The current Game Client ordinarily receives a User Action and deterministically regenerates its System Action cascade, including deterministic System Action identities. Hidden information can prevent that replay when a System Action depends on secret state or server-only randomness.

The working direction classifies the initiating User Action and its entire triggered System Action cascade together for each perspective or Visibility Equivalence Class. At minimum, the platform needs two modes:

1. **Deterministically replayed cascade**: the client executes the visible User Action and generates the same complete System Action cascade.
2. **Forward-patched cascade**: the host executes the complete canonical cascade, then sends the perspective's visible Action records and visible transitions as one authoritative batch. The client executes none of the cascade and does not ask redacted System Actions to generate children.

A possible intermediate mode is a **host-resolved projected cascade**, in which the host supplies the complete permitted System Action trace and the client applies executable result-bearing Action records without generating additional children. Whether that mode earns its complexity or whether forward patches should cover the same cases remains open.

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

| Candidate strategy                                                  | Current working assessment                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit state and Action projection with deterministic replay only | Fits ordinary private state and preserves the current runtime, but cannot cover every secret-dependent cascade or a redacted Action type without requiring visible Actions to reproduce hidden scheduling decisions.                                                                                                      |
| Visibility wrappers or schema annotations                           | Potentially useful authoring and validation helpers for common fields, but not a complete confidentiality, transition, persistence, or synchronization design.                                                                                                                                                            |
| Separate canonical and visible rules runtimes                       | Can theoretically cover every scenario, but duplicates rule behavior and creates a large drift and testing burden.                                                                                                                                                                                                        |
| Reusable hidden-information modules                                 | Promising for recurring hands, decks, sealed submissions, and aggregates, but must sit on a platform transition and projection mechanism with a game-specific escape hatch.                                                                                                                                               |
| Forward patches for every transition                                | Uniform and complete, especially for opaque Actions and hidden System Action cascades, but may unnecessarily replace deterministic replay for the majority of existing public Actions.                                                                                                                                    |
| Deterministic replay with cascade-level forward-patch fallback      | Current leading proposal. It preserves ordinary replay while materializing an entire perspective-specific cascade when redacted state, payload, type, validation, randomness, or child scheduling prevents safe replay. It adds two transition paths that should be hidden behind one client-facing transition interface. |
| Host-resolved projected cascade between replay and patching         | Potentially allows permitted result-bearing Actions to remain executable without locally generating children. It may reduce patch use for card games, but its added mode and runtime semantics have not yet been justified.                                                                                               |

## Candidate declarative visibility model

> **Implementation experiment status:** This remains a working proposal, not an accepted direction. Schema declaration, schema derivation, and pure state-value projection through built-in and game-specific audience policies now have initial implementations. Action and cascade projection, hydration, runtime replay, persistence, and transport remain design work.

The goal is for game logic to remain canonical and perspective-free. An Action or state handler should not normally contain branches such as `viewer === owner`. Instead, a participating game would declare visibility near its existing TypeBox state and Action schemas, and the platform would compile those declarations into the projection and transition behavior described elsewhere in this document.

The engine cannot infer that a field named `money`, `cards`, or `plan` is secret. The developer must supply the game-rule meaning somewhere. The proposed leverage is that the developer declares that meaning once while the engine owns traversal, recipient selection, visible variants, safe patches, persistence, synchronization, and conformance checks.

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

The same declaration vocabulary would apply to User Action payloads, System Action payloads, processed results, and other Processed Action metadata. A visible record would be constructed from an allowlist-producing projection plan, not by cloning a canonical Action and deleting known secrets afterward.

The built-in `actor` audience policy permits a protected value only when a Player Perspective matches the root Action's `playerId`. It does not require game-specific registration. A root without Player attribution fails projection rather than guessing an actor; unattributed System Actions must use another policy.

An Action type can be treated as another classified field. If a perspective is not entitled to it, the engine emits the reserved redaction sentinel, prevents game hydration or execution of that record, and selects a forward-patched cascade. This preserves one canonical game-semantic Action type rather than introducing a second type for another perspective.

For this to be exhaustive, the engine must be able to enumerate the schemas for every User and System Action that a game can produce. Whether the current game runtime already exposes enough System Action schema information remains to be investigated.

### Compiled projection plan and engine Interface

At publication or runtime startup, a hidden-information compiler could turn the state schema, all Action schemas, named policies, and Adapter registry into one projection plan. This should be a deep Module with a small Interface such as:

```text
projectSnapshot(canonicalState, perspective)
projectCascade(canonicalBefore, canonicalResult, perspective)
```

Behind that Interface, the Module would own recursive traversal, visible Action records, Visibility Equivalence Classes, forward and undo patch derivation, cascade mode, checksum-preserving records, and persistence output. That keeps the projection Seam out of individual game Actions and transport handlers.

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
4. Replay that trace in an isolated visible runtime.
5. Compare its final visible state and generated Action identities and trace with the authoritative projection.
6. Use deterministic replay only on an exact match.
7. Otherwise store and deliver a forward patch for the complete cascade.

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

The engine would then handle snapshot and Action projection, opaque sentinels, forward and undo patches, System Action cascades, equivalence grouping, persistence, synchronization, and most validation of the confidentiality contract.

### Initial TypeBox findings and remaining questions

The initial implementation establishes that:

- a typed helper can attach serializable metadata without changing a directly declared canonical `Type.Static` type;
- canonical and projection schemas can be generated from one annotated definition without TypeScript assertions;
- omission and replacement produce independently compilable projection schemas;
- visibility and scope metadata survive the Fresh Fish runtime schema composition exercised by the bag, auction, game state, and `PlaceBid`;
- the pure runtime projector requires an explicit Player or spectator Perspective, executes the built-in host-only, actor, and simultaneous-auction bid policies plus registered audience policies, makes the nearest named schema scope available to a resolver, recursively protects authorized values, validates its result, and rejects unresolved declarations before projecting a value;
- the shared simultaneous-auction policy produces distinct owner, opponent, spectator, and resolved-bid projections for Fresh Fish while the Draw Bag remains redacted;
- Fresh Fish projects `PlaceBid.amount` with the common actor policy and publishes lasting bid knowledge through the public `EndAuction` record; and
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
| I3  | One Action deals to several Players   | Each Player sees their own cards; public sees none                             | Potentially one variant per Player         |
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

| ID  | Scenario                                              | Question exercised                                                                           |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A1  | Public Action with a private consequence              | Can the Action replay against every visible state?                                           |
| A2  | Public Action type with a secret payload              | Can the payload be projected while preserving correct visible execution?                     |
| A3  | Secret-dependent public consequence                   | Can a client reach the public result without knowing the secret input?                       |
| A4  | Hidden Action type                                    | Can an opaque Action envelope advance state, or is a forward patch required?                 |
| A5  | Action changes another Player's secret                | Are all asymmetric variants produced rather than assuming actor and public variants suffice? |
| A6  | Processed-result metadata contains secrets            | Are history descriptions, animation metadata, and result metadata projected?                 |
| A7  | Canonical undo contains secrets                       | Is each visible undo patch independently derived from projected states?                      |
| A8  | Canonical and visible undo operations happen to match | Do client interfaces still exclude the canonical patch conceptually and operationally?       |
| A9  | Legal choices depend on private state                 | Are valid Action types and concrete choices returned only to entitled Players?               |
| A10 | Validation or rejection explains a secret             | Does an error reveal only the permitted reason rather than a hidden rule fact?               |

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
| H2  | Acting Player submits an ordinary Action              | Optimistic replay works when the visible variant is replayable                           |
| H3  | Acting Player submits an Information-Revealing Action | The client waits for authoritative acceptance as it does today                           |
| H4  | Another Player receives a Realtime Update             | Only that Player's variant and visible undo patch arrive                                 |
| H5  | Realtime discontinuity                                | Reconciliation returns only permitted visible Action records                             |
| H6  | Simultaneous stale submission                         | Missing Actions are projected for the requester                                          |
| H7  | Full synchronization                                  | Current visible state and visible Action history agree                                   |
| H8  | Reconnect after a reveal                              | The client receives everything currently permitted without canonical remnants            |
| H9  | Server rejects an optimistic Action                   | The client restores its prior visible state without canonical data                       |
| H10 | Cache or ETag reuse                                   | One Player's projected response is never served to another Player                        |

### Undo and local History View

| ID  | Scenario                                 | Expected behavior                                                                 |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------- |
| U1  | Local History Step backward              | Navigation uses only the stored visible undo patch                                |
| U2  | Local History Step forward               | Navigation replays the stored visible Action or applies its visible forward patch |
| U3  | Server-authorized Undo                   | The backend reverses canonical history and reports changed Action identities      |
| U4  | Undo reapplies simultaneous submissions  | Every redone Action is projected again for each recipient                         |
| U5  | Undo crosses an information reveal       | Existing information-reveal policy prevents unauthorized reversal                 |
| U6  | Reveal has perspective-specific undo     | An informed Player and uninformed opponents receive different inverse changes     |
| U7  | Repeated backward and forward navigation | Visible state round-trips without divergence                                      |

### Knowledge and lifecycle

| ID  | Scenario                            | Question exercised                                                                        |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| K1  | Player sees a card that later moves | Where is the Player's retained knowledge recorded?                                        |
| K2  | Player forgets information by rule  | Can knowledge entitlement be explicitly removed?                                          |
| K3  | Player Perspective changes          | Is the client replaced or synchronized without retaining the prior perspective's secrets? |
| K4  | Spectator observes                  | Does the public perspective have a complete safe projection?                              |
| K5  | Administrator inspects              | Is canonical access explicit and isolated from ordinary Player delivery?                  |
| K6  | Game Instance finishes              | Which secrets reveal, and which remain hidden permanently?                                |
| K7  | Exploration begins                  | Can it reveal hidden deck order or another unknown future?                                |
| K8  | Hosted Fork is created              | What knowledge and hidden state may the derived Game Instance retain?                     |
| K9  | Game Title publication changes      | Do stored visible Action records and current projection rules remain compatible?          |

## Candidate conformance checks

Under the current proposal, every participating Action fixture would be evaluated for every relevant Player Perspective. Given canonical before-state `C0`, canonical Action `A`, and canonical after-state `C1`, calculate `V0`, `V1`, `Av`, and `Uv` as defined above and verify:

1. Visible state, Action contents, metadata, and patches contain no unauthorized canonical values.
2. Stored state schemas do not encode perspectives as visibility-discriminated union branches.
3. Visible replay produces `V1`, or an explicit visible forward patch does.
4. Forward and undo patches are deterministic functions of safe projected states rather than filtered canonical patches.
5. Applying `Uv` to `V1` restores `V0`, and reapplying the visible transition restores `V1`.
6. A disclosed Action record retains the canonical game-semantic type; an undisclosed type uses only the reserved redaction sentinel and a forward patch.
7. A sentinel Action record is never hydrated or executed by the game runtime.
8. Every variant retains the same canonical Action identity and index.
9. One perspective uses one classified transition mode for the complete initiating User Action and System Action cascade.
10. A patched cascade includes every Action identity and index required by the Action History Checksum, including entries with no visible state effect.
11. Grouping identical variants does not change any recipient's result.
12. Persistence, synchronization, Realtime Updates, and Action responses select the same variant and cascade mode for a perspective.
13. Legal choices, validation failures, history descriptions, and animation metadata reveal no additional canonical information.
14. No client interface or fallback can expose a canonical undo patch.
15. Repeated backward and forward History Navigation remains stable.

## Open questions within the proposal

- Will the platform adopt the proposed replayed-cascade and forward-patched-cascade modes, and is a host-resolved projected-cascade mode also worthwhile?
- How does a Game Title declare or calculate cascade mode for each perspective, and how is replayability verified rather than merely trusted?
- What is the exact visible Action-record schema, including the redacted-type sentinel and the location of forward and undo patches?
- Besides identity and index, which Action fields are necessarily public: type, source, Player attribution, timestamps, simultaneous group, and information-reveal metadata?
- What exact fixed-shape state representations should reusable hidden-zone modules provide without using perspective-dependent discriminated unions?
- Which remaining TypeBox composition paths lose runtime metadata, and how should deeply composed projection schemas preserve precise static types?
- How are secret game randomness, public replayable randomness, and System Action identity generation separated?
- Does a later reveal leave earlier stored visible Action records unchanged, enrich them, or maintain both event-time and current-knowledge representations?
- Is durable Player knowledge stored in canonical state, in a separate knowledge model, or in persisted player-relative projections?
- What exact interface does a participating Game Runtime expose for state and Action projection?
- Are visible variants stored with canonical Actions or in separately protected persistence records?
- Are visible forward and undo patches stored for only patched cascades or for replayed cascades as well?
- How are public spectators, administrators, Player reassignment, and post-game visibility represented?
- How are projection changes handled when a Hosted Game follows a newer Game Title publication?

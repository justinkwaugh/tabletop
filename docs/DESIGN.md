# Game Implementation Design

This document is the architectural map for implementing a new game title or making a structural change to an existing one. It records stable boundaries, runtime invariants, and where agents should read next. The current TypeScript interfaces are the source of truth for exact shapes.

## Route the work

- Always follow [the repository coding policy](agent-coding-policy.md).
- Read the [game-runtime domain context](../libs/common/CONTEXT.md) and [game-client domain context](../libs/frontend-components/CONTEXT.md), including any ADRs they route to.
- For a structural change to an existing game, inspect the current canonical interfaces and trace the affected behavior through that game. The new-game completion checklist is not relevant unless the change alters game registration or package boundaries.
- For a new game, use a maintained sibling game for package configuration and integration conventions, while treating the canonical interfaces as authoritative.
- For a Hosted Game that must conceal game information from clients, read the current [hidden-information model and scenario catalog](hidden-information.md). It is a design exploration, not an implemented capability.
- For UI-only work, also read [user interaction semantics](user-interactions.md), the game’s visual contract when present, and the [game UI animation skill](../.agents/skills/game-ui-animation/SKILL.md) when animation is involved.

## Canonical interfaces

Read these before changing their corresponding contracts:

- [Game definition](../libs/common/src/game/definition/gameDefinition.ts): logic-package registration and runtime composition.
- [Game action](../libs/common/src/game/engine/gameAction.ts): action identity, source, metadata, and hydrated behavior.
- [Machine state handler](../libs/common/src/game/engine/machineStateHandler.ts): action availability, state entry, and transitions.
- [Machine context](../libs/common/src/game/engine/machineContext.ts): deterministic creation and scheduling of system actions.
- [Game state](../libs/common/src/game/model/gameState.ts): serialized and hydrated state contracts.
- [Game UI definition](../libs/frontend-components/src/lib/definition/gameUiDefinition.ts): client registration, session, and UI runtime composition.

The domain-context documents own terminology and invariants. These interfaces own the required implementation shapes.

## Package boundary

`games/<slug>` contains deterministic game logic shared by the backend and frontend. It must not depend on the DOM or frontend packages. Its serialized state and actions must remain JSON-compatible.

`games/<slug>-ui` contains the Svelte Game Client: presentation, the game session, and local Action Draft state. It may depend on the logic package. UI components call session methods to initiate actions rather than constructing or applying actions directly.

Mechanisms that are genuinely shared across games belong in `@tabletop/common` or another shared package. Follow the coding policy before adding a game-local substitute for an existing shared concept or extracting a new abstraction.

## Runtime composition

The logic package exports a `GameDefinition`:

- `info` provides the stable game id, metadata, and an optional configurator.
- `runtime` provides the initializer, hydrator, player-color mapping, API action schemas, machine-state handlers, and an optional state logger.

The UI package exports a `GameUiDefinition`. Its info adds the thumbnail, and its lazy runtime provides the Game UI component, session class, colorizer, optional player-color palette, and the complete game runtime.

Every action type that may cross the serialized boundary must be registered in the API action schema and hydrator. Every machine-state value must have a handler.

## Deterministic execution

Given the same initial configuration, state, and ordered processed actions, the runtime must produce the same game state and the same cascade of system actions. Random values and identifiers that affect game state must come from the state PRNG.

For each processed action, the engine:

1. Hydrates and validates the action against the active player and current machine-state handler.
2. Applies the action to game state.
3. Asks the current handler for the next machine state.
4. Records the action and changes the machine state.
5. Enters the resulting state, even when the handler returned the same state.
6. Dehydrates the resulting state and records the undo patch for that processed action.
7. Repeats the same loop for any pending system actions.

Automatic rule consequences are first-class System Actions created or scheduled through `MachineContext`. A Svelte effect or other reactive UI loop must never commit gameplay. Gameplay-relevant mutation belongs inside runtime processing so history, undo, replay, and remote clients observe the same sequence.

## Schemas and hydration

TypeBox schemas define the serialized contract. Keep them JSON-compatible, derive TypeScript types with `Type.Static`, and compile validators where runtime validation is required.

Raw state and action types are data. Hydrated classes add behavior. Declare hydrated fields explicitly and hydrate nested values deliberately; do not rely on incidental object assignment to preserve class behavior.

Game state contains facts needed to replay and continue the game. Local selection, drafts, hover state, and presentation-only state belong in the Game Client. Follow the coding policy for shared types, type reuse, and casts.

## Actions

An action type defines:

- Stable action identity and a serialized schema.
- Hydrated behavior for validation and application.
- A type guard for narrowing when the runtime or UI needs one.
- Immutable input describing the player or system decision.
- Optional metadata describing the result for history, logging, or UI without reconstructing prior state.

Validation protects the action invariant. The current machine-state handler and shared rule helpers determine when the action is available. User versus System identifies the action’s origin; player attribution is independent of that origin. Set information-reveal and simultaneous-group semantics when the rules require them.

Register every serialized action with both the API schema and hydrator.

## Machine states and handlers

Machine states should name precise phases or steps in the rules. Each state has one handler responsible for:

- Determining whether an action is valid in that state.
- Reporting the valid actions available to a player.
- Establishing entry invariants and scheduling automatic consequences.
- Choosing the next state after an action, including intentionally remaining in the same state.

Terminal states expose no further actions. Handlers orchestrate the state machine; reusable calculations and domain behavior belong on the state model or in focused game-model modules rather than accumulating in handlers.

## Game state and reusable mechanisms

`GameState` contains the complete replay-relevant model. `PlayerState` contains player-specific game facts. Initialization, dehydration, and hydration must round-trip without losing behavior or changing serialized meaning.

### Player relationships

Every Game State or Action relationship to a Player must use that Player's stable ID. Name the field for the relationship it represents, such as `playerId`, `actingPlayerId`, or `winnerPlayerId`. Do not identify or resolve a Player through color, display name, seat, turn-order position, array index, or another Player attribute.

A game may store color when color is itself a rule-relevant fact, but color is not Player Identity. Changing preferred colors, color-blind presentation, or another visual treatment must not change player attribution, game rules, scoring, action availability, replay, or undo.

Before implementing a game-model mechanism, search `libs/common/src/game/components` and existing games for the same concept. Prefer extending an established mechanism when the semantics match. Keep game-specific rule differences local when they do not justify changing a shared contract.

“Game-model component” in this document means a reusable logic mechanism, not a Svelte component.

## Game UI

The game session owns action construction and application. Svelte components render state, collect input, and call session methods. For multi-step local selection, follow [the staged interaction, Back, and Undo semantics](user-interactions.md).

A game UI with cross-layer visual effects, interaction precedence, or shared transient visual state must maintain a contract using the [UI interaction visual-contract guide](ui-interaction-visual-contract.md). Animation must follow the [game UI animation skill](../.agents/skills/game-ui-animation/SKILL.md), including its rules for coordinated timelines, history navigation, and the narrow `animate:flip` exception.

UI code may stage, preview, or preselect a choice. Only explicit user input or a runtime System Action commits gameplay.

## Workflow for structural changes

Trace the affected contract end to end:

1. Serialized schema and raw type.
2. Hydrated class and nested hydration.
3. Initializer, hydrator, and definition registration.
4. Action/API contract and metadata.
5. Machine-state availability, entry, and transition behavior.
6. Session methods and UI consumers.
7. History, undo, replay, and deterministic system-action behavior.

Update every affected integration point and its tests. Track unresolved rule ambiguity in the repository issue or specification; encode resolved behavior in tests and durable domain documentation.

## Verification

Verify the parts affected by the change:

- Every machine state is mapped to a handler.
- Every serialized action is present in the API schema and hydrator.
- Initialization, dehydration, and hydration preserve the game model.
- Player relationships remain correct when player attributes or presentation colors change.
- Actions validate, apply, and emit metadata correctly.
- State entry, transitions, and system-action cascades follow the rules.
- Seeded behavior is deterministic.
- UI drafts, Back, Undo, and history navigation have coverage when applicable.
- Relevant package tests, checks, and builds pass. Inspect current package scripts rather than relying on commands copied into documentation.

## New game completion

A new game is structurally complete when:

- Logic and UI responsibilities follow the package boundary.
- Both definitions provide every required runtime dependency.
- All states and serialized actions are registered.
- Rule ambiguities are tracked and resolved behavior is covered by tests.
- UI behavior that meets the visual-contract trigger has a maintained contract.
- Relevant package verification passes.

## Maintaining this document

Keep this document limited to stable invariants, architectural decisions, and canonical pointers. Do not add copied code examples, file inventories, scaffolding instructions, implementation plans, or work logs. Update it when an architectural contract or routing destination changes.

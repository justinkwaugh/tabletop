# UI Interaction Visual Contracts

Use this guide to create or update a game UI’s visual contract. The contract records product-visible interaction behavior and the non-obvious boundaries needed to preserve it; current code remains the source of truth for filenames, symbols, and render structure.

## When a contract is required

Create `games/<slug>-ui/docs/ui-interaction-visual-contract.md` before or alongside the first interaction that:

- coordinates a visual effect across render layers;
- needs precedence or composition rules with another interaction; or
- exposes transient visual state to more than one consumer.

When the interaction is owned by the shared Game Client and has the same contract across Game Titles, maintain it under `libs/frontend-components/docs/` instead of duplicating it in every Game UI Artifact.

An isolated hover, focus, pressed, or disabled style owned entirely by one component does not require a contract. Do not create an empty placeholder contract.

Update the contract in the same change whenever visible intent, precedence, shared-state semantics, lifecycle, or render ownership changes.

## Read first

- Follow the [repository coding policy](agent-coding-policy.md).
- Use the terminology and history model in the [Game Client context](../libs/frontend-components/CONTEXT.md).
- For staged selections, `Back`, or `Undo`, follow [user interaction patterns](user-interactions.md).
- For motion, replay, or silent restoration, follow the [game UI animation skill](../.agents/skills/game-ui-animation/SKILL.md).

## Build the contract from the game

Inspect the game’s current interaction state, session derivations, and rendering before writing. Describe only behavior the product requires and boundaries that are not obvious from local code. Derive implementation details from the repository rather than copying another game’s contract.

Keep issue work in GitHub Issues. Keep current file inventories, exhaustive symbol lists, status dates, implementation plans, and refactor backlogs out of the contract.

## Required sections

### Visual intents

Account for every user-visible interaction mode covered by the contract. For each intent, record:

- its domain-level name and trigger;
- what becomes emphasized, de-emphasized, or interactive;
- what remains visually unaffected; and
- any equivalent pointer, keyboard, focus, or touch path the UI supports.

Name intents by product behavior, not component names, implementation booleans, or styling mechanisms. Two modes with different visible results are two intents.

### Coexistence and precedence

Account for every pair of intents that can overlap in a reachable UI state. State whether they coexist and give the observable composition or winner. If an overlap is impossible because of a game-state invariant, record that invariant instead of inventing a precedence rule.

Precedence belongs in one semantic derivation. Render layers consume its result rather than reconstructing it from lower-level hover, selection, or game-state signals.

### Shared visual state

For every transient visual value consumed across layers or used to decide precedence, record:

- semantic meaning;
- producer and affected consumers;
- visible effects it is allowed to drive;
- lifetime boundary: when it is cleared;
- validity boundary: when its current value stops applying; and
- behavior in Live View, History View, backward/forward navigation, replay, and silent restoration where relevant.

Use dedicated semantic values for distinct effects. A board-wide spotlight, piece emphasis, selection chrome, and mask exemption may coexist, but one does not imply another unless the product contract explicitly joins them.

### Render ownership

Record only cross-layer or otherwise non-obvious rendering boundaries. For each such effect, identify:

- its visible result and semantic input;
- its single render owner;
- other layers affected by the result; and
- any required z-order, mask, transform, or hit-target relationship.

Document the complete layer stack only when its order is itself a maintained invariant. Otherwise inspect the current render tree when implementing a change.

### Verification scenarios

Define an observable scenario for every intent and every affected coexistence rule. Each scenario states:

- the starting UI/game state;
- the input or state change;
- the expected visible result;
- the expected result after cancellation, exit, or replacement by a higher-priority intent; and
- whether verification is automated or manual.

Include history navigation and rapid interruption when the interaction depends on committed state or motion. Verification is complete only after every scenario affected by the change has been exercised; reasoning through a checklist is not verification.

## Completion criterion

The contract is complete when every in-scope intent and reachable overlap is accounted for, every cross-layer visual state has explicit lifecycle and history semantics, every non-obvious render boundary has one owner, and every affected behavior has an exercised verification scenario.

Maintain one statement of each behavior. When code makes a documented lookup obvious or a contract entry no longer changes agent behavior, remove it.

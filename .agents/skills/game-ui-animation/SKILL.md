---
name: game-ui-animation
description: Design, implement, debug, or review game UI animation, including AnimationContext timelines, GSAP, transient rendering, SVG transforms, and undo or history behavior.
---

# Game UI Animation

Use the repository's [canonical animation pattern](../../../libs/frontend-components/src/lib/utils/ANIMATION_PATTERN.md) as the source of truth. Read it completely before changing or judging animation code.

## Establish the transition contract

Trace the exact `from -> to` state transition and the action that produces it. Identify separately:

- structural render presence: which elements exist before, during, and after the transition;
- interaction eligibility: when the user may act again;
- animation trigger: the action or state change that owns the motion.

Choose one authoritative input for each concern. If the root cause of broken motion is not known, keep tracing instead of adding guards, delays, or cleanup effects.

## Choose the owner

Treat the game-session state-change animator and shared `AnimationContext` as the default owner for motion caused by a committed game-state transition. Use them when motion explains what an action did, must precede the reactive state swap, gates interaction, coordinates elements, sequences with another animator, or must distinguish live action, undo/history fallback, full-action replay, and silent restoration.

Animation mechanism does not determine ownership. A local Svelte directive, CSS animation, or GSAP timeline is not sufficient merely because the effect is interruptible or touches one element. Keep motion local only when its complete coordination contract is local: hover/focus feedback, continuous affordance cues, non-semantic entry or exit, or reactive layout settling that satisfies the exception below. Local GSAP timelines must own cancellation and teardown.

Select Pattern 0, A, B, C, or D from the canonical document based on element lifetime. Prefer the shallowest pattern that satisfies the contract.

## Reactive layout settling exception

Use Svelte `animate:flip` outside `AnimationContext` for keyed player cards, ranked score rows, history rows, and similar rendered lists only when every condition holds:

- the same stably keyed elements persist and only their rendered order or layout changes;
- the final layout is a projection of the latest visible state, not a depiction of an action's semantic path or intermediate states;
- interruption, retargeting, coalescing, or skipping intermediate arrangements cannot hide game meaning;
- no interaction, state update, cleanup, or other animation depends on Svelte `animate:flip` completing;
- no animator needs to start before, with, or after the reorder;
- the settling behavior remains correct during rapid consecutive changes and history navigation, with explicit suppression when a restoration path requires silence.

This exception applies specifically to Svelte `animate:flip`. Evaluate GSAP's `Flip` plugin and custom implementations of the FLIP technique under the normal ownership rules; their use does not inherit this exception.

Svelte `animate:flip` is intentionally non-blocking and outside the shared timeline. Do not coordinate it with timers, delays, or guessed durations. When any condition fails, move the motion into a state-change animator.

Svelte `fade` may remain local for non-semantic entry and exit when mount lifetime and completion have no game-state coordination contract. Use a state-change animator when the appearance or disappearance explains a committed action, must be ordered with other motion, or must obey replay and silent-restoration semantics.

## Implement both modes

For `action` present, use action semantics when cinematic motion helps explain the change. For `action` absent, interpolate directly from `from` to `to` and keep all context-owned work at or below 200ms.

Append coordinated work to `actionTimeline` or `finalTimeline` according to its role. Give every tween an explicit position; independent motion starts at `0`. Animate DOM or SVG properties directly. Reactive transient state controls presence only and is scoped to the current replayed action.

For SVG motion, animate a centered outer wrapper. Keep world placement and payload coordinates on separate nodes so GSAP owns the animated transform.

## Verify

Exercise every relevant path:

- live action;
- undo and state-only backward/forward navigation;
- full-action replay, including contiguous system actions;
- silent restoration when applicable;
- interruption, remount, and teardown;
- multiple animators responding to the same transition.

Inventory every state-derived animation mechanism and classify it as framework-owned semantic motion or local presentation. For each local Svelte `animate:flip` use, verify every condition in the reactive layout settling exception; stable keys and visual smoothness alone are insufficient. Exercise rapid reordering and confirm that transform ownership does not conflict with inline SVG transforms, CSS, or another animator.

Inspect the effective duration of every actionless listener path, including nested context timelines, positions, repeats, delays, and `ensureDuration`. Completion requires every context-owned path to be bounded at or below 200ms, every local state-derived animation to satisfy its stated exception, every element reference to be cleared on teardown, and no per-frame reactive writes or animation side effects in `$effect`.

When reviewing rather than implementing, report each concrete race, drift, transform conflict, lifecycle leak, history mismatch, or duration violation with its exact path and remediation. Do not modify code unless requested.

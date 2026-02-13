# Shared Animation Pattern

This is the canonical pattern for game UI animators that use `AnimationContext`.

Use this to keep new animations predictable, composable, and efficient across games.

## Goals

- deterministic sequencing across multiple animators
- minimal reactive churn during motion
- clean pre-state-change rendering
- stable behavior for undo/redo/history playback

## `AnimationContext` Timeline Model

`AnimationContext` exposes two timelines:

- `actionTimeline`
- `finalTimeline`

They play **sequentially**, not in parallel:

1. `actionTimeline` plays first
2. `finalTimeline` starts at `actionTimeline.duration()`

This means animator authors can intentionally split work:

- Use `actionTimeline` for the direct action result (piece placement, movement, removal, etc.)
- Use `finalTimeline` for post-action settlement transitions that should happen after action visuals finish
  Example: "end of round" cleanup motion that should not overlap with the action animation itself.

## Execution Modes

Animators should support two execution modes:

1. `action` present (deterministic/cinematic)
2. `action` absent (fast fallback for undo/history/back/forward-no-action)

### Mode 1: `action` Present

- Use action semantics for richer motion when useful.
- Example: passenger delivery follows route, then scales into destination site.

### Mode 2: `action` Absent (Fast Fallback)

When `action` is missing (undo, backward history, forward history without requested animation):

- still animate spatial transitions so users can track movement
- use direct from->to interpolation (no expensive semantic pathing)
- keep total animator work short and non-blocking
- **hard limit target: <= 200ms per fallback transition**

Examples:

- Passenger delivery undo: quickly scale up while moving directly back to source node.
- Building placement: quick appear/disappear or short pop may be identical to action path if already simple.

## Core Rules

1. Animate DOM/SVG elements directly whenever possible.
2. Always provide explicit timeline positions (`0`, `0.18`, etc.).
3. Start independent animations at position `0`.
4. Avoid per-frame reactive state writes (`onUpdate -> state = {...}`).
5. Use transient reactive state only for presence (spawn/despawn), not frame-by-frame motion.
6. Avoid side effects in `$effect`.
7. Branch behavior on `action` presence: cinematic when present, fast fallback when absent.

## Pattern 0: Persistent Element Animator (Single Attached Node)

Use when the same visual element exists for the entire game/session and never needs key-based mounting logic.

Examples:

- clock hand
- instability marker
- a persistent deck pulse target

How it works:

- Attach animator once with `attachAnimator(...)` (or equivalent).
- Animator stores `this.element` from attachment.
- On any relevant state change, tween `this.element` directly.
- No element registry, no add/remove bookkeeping.

This is the simplest pattern and should be preferred whenever the target node is truly persistent.

## Lifecycle

Animation flow for one state change:

1. session builds one shared `AnimationContext`
2. each registered animator receives `{ from, to, action, animationContext }`
3. animators append tweens to the shared timelines
4. timelines play (`action` then `final`)
5. `afterAnimations` callbacks run
6. reactive state update applies

Implication:

- If something must be visible before reactivity catches up, render it transiently first, then tween the real element.

## Pattern A: Existing Element Tween (Keyed or Multiple Elements)

Use when one or more elements exist in both `from` and `to`, but are not handled by a single persistent attachment.

- Register refs with a `use:` action
- Resolve element in `onGameStateChange`
- Tween `x/y/scale/opacity` (or other direct props)
- If `action` is absent, use fallback durations (<= 200ms)

```ts
animationContext.actionTimeline.to(element, { scale: 1.1, duration: 0.2 }, 0)
animationContext.actionTimeline.to(element, { scale: 1, duration: 0.12 }, 0.2)
```

## Pattern B: New Item (Transient + Element Tween)

Use when `to` includes a new piece that doesn't yet exist in DOM.

1. write transient spawn state once (`onStart`)
2. `await tick()` for mount
3. resolve mounted element via ref registry
4. tween the element directly on timeline
5. let normal reactive update replace transient state

Important:

- no per-frame `onUpdate` reactive writes
- transient state controls presence, not animation interpolation
- if `action` is absent, prefer simple appear/disappear/direct move (<= 200ms)

## Pattern C: Pre-Reactivity Override

Use when a layer must show to-state values before reactive state update.

- maintain a writable derived override consumed by renderer
- set override immediately during animator callback
- do not eagerly clear it in same cycle
- allow state reactivity to naturally supersede it

## Element Registration (`use:` action)

For keyed SVG/HTML nodes:

```ts
export function animateThing(
  node: HTMLElement | SVGElement,
  params: { animator: SomeAnimator; key: string }
) {
  params.animator.setElementForKey(params.key, node)
  return {
    update(next) {
      // handle key changes if needed
    },
    destroy() {
      params.animator.setElementForKey(params.key, undefined)
    }
  }
}
```

Why:

- lifecycle-safe ref ownership
- works cleanly with keyed each blocks
- avoids global/single-element coupling
- use Pattern 0 instead when a single persistent node is enough

## SVG Guidance

Prefer local-origin wrappers:

- wrap piece with `translate(worldX worldY)`
- render internals near `(0,0)`
- tween wrapper `scale/x/y`

Only rebuild full transform strings when unavoidable.

## Anti-Patterns

- implicit timeline cursor placement
- per-frame reactive object recreation
- side-effectful `$effect` animation logic
- clearing pre-reactivity overrides before state update applies
- mixing coordinate systems without wrapper normalization

## Checklist For New Animator PRs

- [ ] Uses shared `AnimationContext`
- [ ] Explicit timeline positions for all tweens
- [ ] Independent tweens start at `0`
- [ ] No per-frame reactive writes for motion values
- [ ] Ref registration is lifecycle-safe
- [ ] Works with undo/redo/history
- [ ] Has explicit `action`-absent fallback behavior (<= 200ms)
- [ ] No focus/interaction regressions
- [ ] If transient exists, it is for presence only

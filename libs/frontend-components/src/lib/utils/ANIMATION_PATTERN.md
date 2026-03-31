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
- do **not** use cinematic `ensureDuration(...)` holds in fallback mode

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

## Root-Cause Debugging Protocol

Use this sequence before shipping animation bug fixes:

1. Model the transition contract first.
   - Trace the exact action/state transition sequence before editing animator code.
   - Write down which step should trigger render changes vs animation changes.

2. Choose one source of truth per concern.
   - Explicitly choose authoritative inputs for:
     - structural render presence,
     - interaction eligibility,
     - animation triggering.
   - Avoid combining multiple inferred signals unless required by design.

3. Change one behavioral axis at a time.
   - Apply and verify fixes independently for:
     - rendering,
     - interaction,
     - animation,
     - history/undo behavior.
   - Do not bundle multiple axis changes into one unverified patch.

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

## History Replay Semantics

There are three distinct history animation intents:

- `full-action`
- `state-only`
- `silent-swap`

These are not interchangeable, and animator behavior must be designed with the distinction in mind.

### `full-action`

- Used when history replay is explicitly requested as animated action playback (for example, Shift-forward).
- Animators receive replayed actions one by one.
- This is the cinematic mode.
- `ensureDuration(...)` is appropriate here when the action needs to remain readable.

Important:

- `full-action` replay may auto-step across contiguous system actions.
- Even when the UI lands on the last system action in the batch, the replay contract is still **per action**, not one collapsed state diff.

### `state-only`

- Used for normal history navigation where the UI only needs a readable state transition.
- Animators should treat this as a fast fallback transition.
- Do not rely on per-action semantics here.
- Total motion should remain short (`<= 200ms` target).

### `silent-swap`

- Used when history setup/restore should change visible state without transition noise.

## Terminal System-Action Batches

Special rule for `full-action` replay:

- if the replay batch ends on auto-skipped system actions,
- history must not exit before the visible transition settles.

Otherwise the intended `full-action` replay can collapse into one final `from -> to` diff, which defeats:

- per-action transient visuals
- per-action descriptions
- per-action `ensureDuration(...)`

When debugging history issues near phase boundaries, era transitions, or cleanup chains, check this first.

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

## Transient Lifetime Rules

Transient render state must be scoped to the current replayed action, not to the eventual reactive state swap.

Why:

- during `full-action` history replay, animators may process multiple replayed actions while reactive `gameState` is still frozen
- if transient state is only cleared when `gameState` changes, transient visuals can accumulate across replayed actions

Preferred model:

- current replayed action writes the transient presentation state
- the next replayed action overwrites it
- `afterAnimations(...)` can clear or finalize that action-scoped transient state

Do not accumulate transient markers across replayed actions unless the design explicitly calls for cumulative visuals.

Related rule:

- if an action description, label, or highlight needs to animate alongside replayed actions, prefer a **game-local** pre-reactivity override
- do not add game-specific transient presentation state to shared session infrastructure unless multiple games truly need the same abstraction

## Pattern C: Pre-Reactivity Override

Use when a layer must show to-state values before reactive state update.

- maintain a writable derived override consumed by renderer
- set override immediately during animator callback
- do not eagerly clear it in same cycle
- allow state reactivity to naturally supersede it

## Pattern D: Aggregate Glyph Animator (One Icon, Count/Value Changes)

Use when the UI intentionally renders many logical units as one persistent visual
element (for example: a single passenger icon with a numeric count).

Goal:

- animate the same persistent glyph instead of spawning/removing transient per-unit visuals
- update displayed aggregate value before motion so `0 -> N` and `N -> 0` stay smooth

How it works:

1. Register the persistent glyph element by key/node id via `use:` action.
2. On state change, compute aggregate delta (`fromCount -> toCount`).
3. Write a pre-reactivity override for display count/value (Pattern C).
4. `await tick()` if needed so `0 -> N` mounts before tween.
5. Tween the registered element directly (pop in / pop update / pop out).
6. Let normal reactive state supersede override on state update.

Heuristics:

- Prefer this pattern over transients when the user perceives one aggregate glyph.
- Keep a single visual owner for a concept; avoid rendering static + transient versions
  of the same thing at once.
- Use transients only when topology truly changes (no persistent target element exists).

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

### Nested SVG Pop/Scale Pattern (Important)

For pieces composed of nested SVG components (icon components inside wrappers), scale origin can drift to a corner if geometry is not normalized.

Use this structure:

1. outer wrapper: world placement (`translate(worldX worldY)`) and animation attachment
2. inner payload wrapper: `translate(-width/2, -height/2)` so visual content is centered around outer `(0,0)`
3. icon content rendered in positive local space (`x=0..width`, `y=0..height`)

Animate the **outer wrapper** with standard scale tweening:

- `gsap.set(node, { transformOrigin: 'center center' })`
- tween `scale` on that same node

Do not mix coordinate systems on the same animated node (for example, alternating between `attr.transform` and GSAP scale on nested wrappers) unless absolutely necessary.

If scaling appears to originate from upper-left, the usual root cause is:

- wrong animated layer (animating payload instead of world wrapper), or
- payload not centered around `(0,0)` before animation.

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
- [ ] For SVG pop/scale: animated wrapper is world-positioned and payload is locally centered

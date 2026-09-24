# Review corrections: closure and automatic history

The [logic/design review](reviews/2026-09-14/README.md) identified missing PEIR
train disposal and incomplete display of automatic stock/lifecycle consequences.
The review report describes the pre-fix snapshot; this note records the correction.

## Family scope

Revisited the full researched title catalog's corporate-control, closure,
reorganization, and phase-event profiles through `18xx-domain-model-study.md`,
`18xx-game-variation-catalog.md`, and `top-rulebook-comparison.md` in the local
research package. TOP final PEIR closure loses cash and trains (prototype §§6.7.5,
7.7). This is not a universal closure destination: 1889 discards can enter the
Market; Ardennes/Dixie/Norway/Uruguay reorganizations can transfer or select assets;
1841 ownership changes can involve corporate presidents. Those distinctions remain
title policy, not a shared rule that closing any company always destroys trains.

## Implementation boundary

TOP's existing flotation callback removes PEIR-owned trains only when the last
numbered share disappears, using shared `unownedTrain(..., 'removed')`. Finite and
unlimited train identities remain in inventory. The flotation callback receives
train state explicitly; financial eligibility calculations still need only stock
state. The disposal is part of the canonical flotation action and its replay/Undo.

The shared certificate exchange record contains surrendered and received IDs and
the receiving Owner. A flotation callback may return those records as processed
metadata. The field is optional so older processed actions remain hydratable;
calculating eligibility does not generate exchange outcomes or mutate state.

History reconstructs the before/after company presidencies and closures from
recorded company patches, following the existing cash-history projection pattern.
It does not use current owners as historical owners, run game rules, or mutate
canonical state. Only flotation and phase entries consume these changes. Explicit
flotation exchange records identify numbered shares; phase effects already identify
forced private exchanges and income changes. No general-purpose event framework or
new game-state field is introduced.

Meaningful CompleteStockRound market moves remain under that stock round and form
a system-event entry. No-op movements and empty bookkeeping stay hidden. Flotation
and phase consequences stay grouped with their existing triggering entries.

## Compatibility and verification

Both titles continue to share the same library boundaries. Adopting these changes
requires rebuilding affected Logic and UI Artifacts; the host bridge API is unchanged.
Older flotation records without exchange metadata still render their recorded
capital and patch-derived company consequences; no missing exchange is fabricated.

Regressions cover final PEIR closure with 3H, 7 and D trains, full action-cascade
replay/Undo, a flotation changing two presidencies, phase-forced exchanges and a
private income change, and meaningful versus no-op sold-out movements. Existing
finance/phase tests now inspect complete automatic cascades. Ordered-discard tests
still inspect the intermediate restored operator before automatic completion.

Public title, UI and harness READMEs now describe real setup, playable runtime,
prototype table/workbench exports and the explicitly deferred features.

## Verification results

- Development harness: 300/300 unit tests pass, including both complete games and
  the 1,071-action TOP fixture with exact replay and Undo.
- Shared logic: 150/150 tests pass. Shared UI: 32/32 tests pass.
- Shared UI and development harness checks: zero errors and warnings. The harness
  check includes its hosted TypeScript configuration.
- Shared logic, both title logic packages, shared UI and both title UI builds pass.
- Full checking also identified three test typing issues: inline action literals
  now use their canonical action types, and the construction differential test
  loads its internal helper from the same built package as its map state.
- No browser audit was added. The development preview was restarted with rebuilt
  dependencies; existing local saved games remain intact.

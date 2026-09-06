# Shared projected hydration: prototype findings

The experiment supports one projection-compatible hydrated representation, with strict canonical validation at operations that require complete state. This is a recommendation for the next implementation slice, not a production change.

Prototype: local branch `codex/projected-hydration-prototype`, commit `35448a8f`, based on `c984a981`. Its source, README, observations, and standalone captured walkthrough are under `libs/common/src/game/visibility/prototypes/projectedHydration/` on that branch. The prepared worktree is `/tmp/tabletop-hydration-prototype`.

Run it there with `pnpm --dir libs/common prototype:hydration`. The command type-checks the experiment and runs actual repository engine, projection, hydration, and guard code. The HTML is a results viewer, not a replacement implementation of those mechanisms.

## What worked

The fixture uses a small matching-card game with two players. Each canonically required hand is a nested hydrated object containing hydrated cards and rule methods. Other players' hands are omitted; a required secret scalar is also omitted, while a protected draw bag uses its existing empty-array replacement and public count.

The existing `Hydratable` base works unchanged with the derived shared schema/validator. No constructor needs a canonical/projected mode. Canonical and projected hydration/dehydration preserve their respective data exactly. Visible malformed card data still fails validation.

With the experimental owner policy described below, owner-hand methods and legal Action discovery work through the execution guard. Player execution equals canonical execution followed by projection. Delivery through projected patches and projected Undo preserve the expected state. Canonical historical Fork reconstructs complete state. Hypothetical population preserves known cards while supplying a complete, valid state.

The fixture type-checks against the existing `GameRuntime` and actual `GameContext` constraints using its shared state type as `T`. No additional framework type parameters were needed. Hydrated classes must declare optional fields and use the shared schema in their base-class generic arguments. A strict canonical check can restore the narrower canonical DTO type at complete-state operations.

## Prerequisites revealed by the experiment

**Canonical checks must be explicit and mandatory.** Paired with the broader hydrator, the existing raw engine and `createGameFork` both accepted incomplete state. The prototype's explicit canonical input/output checks rejected it. Those wrappers demonstrate the required behavior but are bypassable; production must enforce the checks centrally before adopting broader hydration.

Cover initialization, authoritative execution and persistence, canonical loading after migration, canonical Fork reconstruction, and completed Exploration population. Preserve broader validation for projected History and replay. `applyProcessedAction` can replay projected state without a Perspective argument, so the absence of a Perspective is not a reliable canonical-mode signal inside the shared execution implementation.

**Owner visibility must be locally decidable.** The original custom owner policy projected the correct hand but the execution guard still blocked the owner from reading it. That guard deliberately rejects custom policy access. A narrow experimental built-in policy based on the immediate parent's public `playerId` allowed the known hand while continuing to block opponents' hands and hidden bag order. Supplying another player's hidden hand did not grant permission. This is evidence for an explicit owner policy, not permission to relax arbitrary custom-policy guards.

**Preserve actual omissions.** A nested constructor should instantiate an optional child only when present. Eagerly assigning `undefined` changed the in-memory shape even though JSON serialization concealed the difference. A `knownHand()` assertion helper kept shared rule methods straightforward without pretending the field always exists.

## Recommended next slice

Implement complete-state validation first, retaining existing title behavior. Then opt one realistic private-hand fixture into shared hydration and add locally decidable owner visibility. Keep canonical schemas strict and derive shared schemas from their protection declarations. Convert the prototype observations into permanent framework/client regressions during that implementation.

The experiment did not exercise a real hosted private-hand title, production persistence, arbitrary custom visibility, or replacement redactions with unrelated field types. It changed no production code, versions, deployed artifacts, or validation defaults on `feature/hidden-information`.

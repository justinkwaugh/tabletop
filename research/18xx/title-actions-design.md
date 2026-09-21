# Title-contributed Actions

`EighteenXXTitleRules.titleActions` lets a title register Actions that the shared
runtime does not know about. Each entry is made with `defineAction(schema, guard,
hydrate)`. The runtime adds it to the same registry as the shared Actions, so one
entry supplies both the API route and hydration. TOP's `SplitCompany` is the first
consumer and replaces the hand-written spread of `apiActions` and wrapped
`hydrateAction` in its definition.

## Evidence surveyed

Traits `reorganization-operations`, `round-sequence`, `treasury-share-transactions`,
`borrowing-parties`, `interrupting-decisions`, `formation-method` and
`equity-structure` in `data/title-traits.json`, with the engine and domain studies.

Title-specific Actions are common: mergers in about 41 titles, acquisitions in 44,
conversions in 30, nationalization in 19, redemption in 53, corporate loans in 22.
Splits are rare: 1841 and TOP. They arrive at three different times:

- inside an existing state as an extra option, such as TOP's split in the stock
  round, 18OE conversion as a stock action, and 1822 minor acquisition as an
  operating step;
- in a dedicated round, such as the 1817 merger and acquisition rounds, the 18Norway
  nationalization rounds, and the exchange rounds of 1824 and 1837;
- as an interrupt raised by an event, such as nationalization on the first 6-train in
  1856, forced conversion phase events in 1858 and 18GB, and 1841's secession queue.

The same mechanism takes different timings in different titles. Conversion alone
appears in all three.

## Decision

An Action and the state that accepts it are separate concerns. The studies are
explicit: an Action type existing does not imply a game supports it, and steps grant
it meaning and eligibility. Registration is the one part every timing needs, so the
extension point is a plain list of definitions and carries no handler.

Acceptance stays with handlers. A title that adds an option to an existing state wraps
that state's decision handler through `decisionHandlers`, which is what makes the stock
round accept `SplitCompany`. See [title-owned state](title-state-design.md).

The registry refuses two definitions for one Action type, so a title cannot shadow a
shared Action silently.

## Intentional limits

- Dedicated rounds and their pending state are now expressible as title machine states
  and fields, but no title has one yet; see the limits in
  [title-owned state](title-state-design.md).
- Event interrupts need title wrappers around shared handlers. `decisionHandlers` wraps
  a state's decisions, not the family handlers around them.
- Seven titles have no reorganization profile: 1826, 1832, 1833NE, 18PA, 18WE, 18West
  and 2038. 1833NE is known to insert a takeover round. These are evidence gaps, not
  proof of absence.

None of these limits is made harder by registering Actions separately from handlers.

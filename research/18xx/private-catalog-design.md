# Private catalog

A title declares its private companies once, as data, in a `PrivateCatalog`: for each, an
id, name, face value, revenue and description, and optionally what it is exempt from when
privates close, the locations it blocks, and its sale price bounds. The catalog also
names the phase at which the title's privates close. From that it answers:

- `closureEffects(state)`: the `close` and `income` effects due once the closure phase is
  reached, in company order, for the privates still open;
- `blockedBy(state, locationId)`: the open private whose block on a location still holds;
- `priceRange(id)`: the bounds for a sale to a company, half (rounded up) to double face
  value unless the definition says otherwise, or nothing for a private that is never sold;
- `faceValue(id)`, `definition(id)` and `lots(state)` for scoring, display and auctions.

The family's effect procedure is unchanged: titles still return `PrivateEffect`s from
`PrivateRules.phaseEffects`, and the family applies and records them. The catalog
supplies the ordinary ones, and a title adds or replaces what is its own.

## Evidence surveyed

The 1,764 companies and their abilities in `data/engine-setup-samples.json` (117 titles
declare companies; default options; concessions, minors and 18Zoo inflate the total), the
ability classes and `close_companies` in the research source, and the engine study §7
and the domain study's power-lifecycle trait.

- **Closure.** A phase or train event closes privates in 61 of 117 titles; others use a
  named event (the 1822 and 1858 families) or code (1817, 1860, 1867). An exemption is
  ordinary data, `close` `on_phase: 'never'`, in 14 titles (1889's ferry, TOP's Union
  Bank, 1846's Mail). Privates also close when their ability is used up (43 titles), when
  the owning company buys a train (21), when a named company operates (TOP, 1894), and
  always on exchange. 17 titles override the closing event; TOP does, to exchange three
  privates first.
- **Blocking.** `blocks_hexes` while player-owned in 36 titles (1830, 1889, 1846); until
  closed whoever owns it in 3; with the owner's consent in 5 (the 1822 family, TOP); finer
  predicates are code in 7 (18EU and 1822 exempt the owner's own companies).
- **Revenue.** A fixed integer everywhere. It changes by phase in 15 titles (1889's
  ferry, 1807, the 1858 family) or when sold or when the owner has a train (1828, 1817).
- **Sale.** The window is a phase status, `can_buy_companies`, in 66 titles. The price
  defaults to half, rounded up, to double face value; about 10 titles set other bounds
  (TOP's Hunslet 1–200, 1807 1 to face). `no_buy` marks unsellable privates in 45 titles,
  11 of TOP's 12. Who may buy is code in 33 titles (TOP bars PEIR, 1846 bars minors).
- **Abilities.** No type is universal: `tile_lay` 77 titles, `shares` 51, `blocks_hexes`
  41, `tile_discount` 37, `token` 37, `exchange` 32. Owner, timing, hexes, count and tiles
  qualify almost all of them, and the timing strings are conventions that step code
  interprets. The engine study: "these powers are not a complete declarative rules
  language… unusual powers need executable title rules." 76 of 117 titles refer to a
  private by literal id in code; Hunslet, Union Bank and Schreiber are code there too.

Before this, 1889 closed privates in a hand-written `phaseEffects` with its ferry's
exemption inline, blocked K4 and C4 inside `TrackRules.restriction` by location and
private id, and computed its sale bounds in `TransferRules.priceRange`; both titles looked
face value up by id for final scoring from a list separate from the one the auction used.

## Shared behaviour and title-owned choices

Shared: what a private's definition holds; that privates close together at a phase unless
exempt; that an exempt private may survive only while a player owns it, at a new revenue;
that a block on a location holds until a company owns the private or until it closes; the
default sale bounds.

Title-owned: the sale window and who may buy (`TransferRules`); exchanges, and TOP's
forced exchanges before closure; closure on first operation (TOP's concessions) and the
retiring of unused pieces (Schreiber); consent to build (Vernon River Bridge); every
special power — 1889's port tile, seller's tile lay and terrain discount, TOP's early
train. A description that depends on the State stays a title function; a fixed one is
data.

## Support now and later

Now: closure with `never` and survives-while-player-owned exemptions; blocking until
company-owned or until closed; price bounds and unsellable; face value, revenue, fixed
description; auction lots.

Considered, not built:

- A typed ability vocabulary (`tile_lay`, `tile_discount`, `exchange`, `shares`, `token`).
  The qualifiers it needs from the start are known — owner, timing, locations, tiles,
  count — but 1889 and TOP have one instance each of three different powers, and the
  timing conventions are where the titles differ. `PrivatePowerRules` stays a pair of
  callbacks, each stubbed by the title that does not use it.
- Closure when an ability is used up or when the owning company buys a train.
- The sale window as a phase status.

Intentional limits: one closure phase per title; blocking is by location, not by action
(18EU blocks only plain track) and does not exempt the owner's companies.

## Compatibility

Nothing serialized changes: `privateRevenue` and the `PrivateEffect`s a phase change
records are as before, in the same order. The deployed game's recorded transitions and
both titles' runtime-contract and seeded-setup guards must be unchanged. Logic Artifacts
only.

## Examples that verify the decision

1889: at phase 5 every open private closes except a player-owned ferry, whose revenue
becomes 50 once; a company-owned ferry closes; K4 and C4 are blocked until a company owns
the private or it closes; bounds are half to double face. TOP: Union Bank never closes;
only Hunslet has sale bounds. Family: an unknown closure phase, a duplicate id and an
unknown private are refused; nothing is due before the closure phase.

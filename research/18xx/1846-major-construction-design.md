# 1846 first major construction

This slice extends the first major's finance decision through ordinary phase-I
construction: up to two yellow tile lays and one station, in any order. It stops
at `ReadyForRoutes`, without running or marking the major operated. Private
purchases and powers, later tile colors, major routes/earnings/train buying and
later operating turns remain unsupported and are labelled in the prototype.

## Evidence and family survey

GMT 2021 second printing §§6.43–6.55 require interleaving track and tokens,
including remote B&O Cincinnati ($100) and PRR Fort Wayne ($60) tokens before a
tile is laid. Connected placements in those cities cost $40. IC Centralia and
Erie Erie reserved destinations also cost $40; ordinary tokens cost $80. Home
placement at launch does not consume the operating allowance. Chicago permits
only one token per corporation across all four cities. The private-company text
reserves C&WI's southeast Chicago spot until the company is purchased or removed.

Surveyed the full station-placement and station-blocking profiles in
`research/18xx-2026-09-08/data/title-traits.json` and the domain-model study's
stations/access section. Assignments include connected stations/home stations
(126 each), special stations (52), replacement stations (25), slot reservations
(94), whole-tile reservations (15), future capacity reservations (3), blocking
exceptions (20), and not-applicable (4). Profiles overlap; unresolved evidence
is not absence. Counterexamples include 1830's private teleport tied to a tile
lay, 1858's future reservations and gauge restrictions, and 1866 regional rights.
Those are not reduced to 1846's permanent destination permission. Research
snapshot 715567bdc7e5cc68a68a286b21dc8edd1a125e50: 1846 `entities.rb` provides
remote token abilities and C&WI's city index; shared token placement supplies
ordinary capacity/connected-price behavior. No source implementation is copied.

## Boundaries and reuse

Shared StationPlacement retains ownership, finite allowance, open-slot,
reservation, same-hex, network and cash validation. One optional policy permits
explicit disconnected requests; absence preserves mandatory connection for every
existing consumer. Placement cost now receives the request plus the evaluator's
station-purpose connectivity result, avoiding a second network calculation in
the title. Existing cost policies ignore the additional argument unchanged.
Remote permission does not bypass capacity, duplicate-location, cost or quota.

1846 owns destination permissions/prices and composes the existing LayTile,
PlaceStation, FinishTrack and FinishStations actions. Both step records remain
open while the player alternates construction actions. Finish construction commits
FinishTrack, followed by automatic System FinishStations, then the prototype
boundary. Exhausting tile lays must not automatically end station placement.
StationStep is composed into 1846's state only. No other title acquires new fields.

C&WI is represented as an ordinary reservation owned by the actual private
company. It is omitted when removed during setup. The existing map renderer
shows the reservation at city-3 (southeast); it blocks placement, not route
traversal. The future private purchase implementation must release it on purchase
and separately offer its free extra token. Permanent printed destination pricing
uses map definitions, not outstanding reservation state.

UI uses the existing track selection and direct complete station-choice buttons.
Choices recalculate after each tile/token action and use Game Session submission.
No new staged selection, Back flow or animation is introduced. Undo clears manual
track selection before undoing a committed action; History disables all controls.
Only the 1846 UI would need republishing to adopt these controls; there is no
host-bridge or shared Game Client contract change.

## Verification

Engine examples cover the remote B&O token enabling a Cincinnati lay, a prepared
connected network allowing two lays before a token, wrong actor/source/stale cost,
affordability, token allowance, reservation release, C&WI setup reservation,
phase boundary and replay/undo. Shared evaluator regressions exercise remote
permission with capacity, cash and allowance constraints. Existing title and
shared station/construction tests verify default behavior remains intact.

Validation completed: 71 tests passed across 1846 and shared construction/station
modules. Logic/UI checks, touched-file lint, package builds and both 1846 bundles
passed (existing dependency bundle warnings remain). All four earlier title logic
packages type-check with the extended station policy interface. In the native
1280×800 preview, B&O placed the $100 remote station, laid #291 at H12 for $20,
and finished at the route boundary with $80 remaining. Undo reopened construction,
then reversed the tile and station, restoring $200, the reservation and the remote
station choice. Mobile and physical-artwork presentation were not verified.


Follow-up compatibility fix: the shared station price callback’s placement context
is optional because the existing generic station UI displays/sorts base token
prices before a destination is chosen. 1846 returns the ordinary $80 base price
for that query; actual placement always supplies context and computes the reserved
or remote destination price. No fabricated position or connection is introduced.

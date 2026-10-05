# 1846 Phase III brown construction

Add the complete GMT second-printing brown supply and permit ordinary brown
upgrades in Phase III. Gray tiles, Phase IV trains and remaining game endings
are later slices. Evidence: GMT 2021 §§6.42–6.48 and 9; pinned research snapshot
`g_1846/map.rb` tile inventory and `config/tile.rb` standard faces.

## Family mechanisms and boundaries

Surveyed all trait assignments for construction-allowance (320), upgrade-preservation
(135), tile-supply (179), and construction-connectivity (147). They include single
lay/upgrade, two actions with one upgrade, multiple upgrades, construction points,
finite/unlimited/paired pieces, special remote construction, gauge conversion,
extended color sequences, and titles without track construction. Counts are scoped
assignments, not title counts. Unverified profiles remain evidence gaps.

Reuse TrackConstruction for phase gating, track preservation, rotation, map-edge
legality, city connectivity, token/reservation migration, pricing and returning
replaced pieces. Existing 1846 policy retains two actions with at most one upgrade;
connected city upgrades need not add track. 1889's ordinary brown cities have
six exits, whereas 1846's standard 611 has five. 1830's metropolis upgrades and
1822's more varied construction rights are counterexamples to imposing 1846's
shape or allowance on the family. No new shared mechanism or serialized state
is needed for this slice.

Supply adds shared 39–47, 70 and 611, plus title Z 297 and Chicago 299. Standard
faces have been checked against the pinned primary catalog. The 1846 catalog
retains its explicit identity separate from printed numbers. Green/brown Chicago
share the same four-city topology and renderer layout but have distinct physical
pieces and $40/$70 revenues. Z 297 adds a third station slot and pays $60. Gray
51, 290 and 300 remain excluded from the implemented supply.

## Verification and playground

Canonical construction tests cover phase availability, both action orders,
wrong color/type/rotation, one-upgrade limit, $20 repeat-terrain cost, returned
green pieces, finite brown supply, Chicago cities/stations/reservations, Z slots,
and the rulebook's four locations that cannot upgrade to brown. Replay/Undo must
restore inventories, cash and migrated objects. Renderer tests exercise every
supplied tile in both orientations and six rotations, checking the brown Chicago
layout and separation of its revenue labels at every rotation. Chicago uses
explicit title-owned annotation positions because automatic placement overlapped
two revenues in the pointy orientation. The real title picker, board and tile library consume the same catalog;
remove the prior brown-construction warning and expose the extended tile library.

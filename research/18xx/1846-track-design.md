# 1846 phase-I construction slice

The next executable step is Michigan Southern's first construction step. Normal
play completes distribution and the first stock round, starts the operating set,
pays private income, and starts MS. It permits up to two yellow tile lays and
stops at `ReadyForRoutes`. It does not skip independent operations, invent revenue,
or enter later corporations' finance steps. Other companies' track rules can be
verified in prepared test positions; they are not shortcuts in ordinary games.

## Evidence and family variation

Rules: GMT 2021 second printing, §§2.4, 4.31–4.33, 6.1, 6.4, 6.53 and the printed
map. The pinned research reference supplies independently checked location/tile
facts: `g_1846/map.rb`, `entities.rb`, and `game.rb`, snapshot
715567bdc7e5cc68a68a286b21dc8edd1a125e50. Definitions use this repository's Common
hex coordinates and family tile/map topology; no reference engine code is copied.

Surveyed all recorded trait assignments for construction usefulness (128),
allowance (320), preservation (135), connectivity (147), tile supply (179), actor
order (388), round sequence (208), and capacity representation (204). Mechanisms
range from one lay/upgrade, two actions with at most one upgrade, multiple/point
budgets and extra private powers; finite/unlimited/paired tiles; permissive,
semi-restrictive and remote construction; ordinary price order, minors first,
first-OR ascending prices, and non-OR calendars. Titles without track remain
counterexamples to mandatory construction state. Unrecorded profiles are gaps.

1830/1889 use different construction allowances. TOP and 1817 also challenge
assuming every player owns/controls an ordinary corporation with fixed homes.
1846's bridge/tunnel price is paid only by the second connection. Add an optional
border-price policy to TrackRules, called only for a newly added exit, leaving
existing titles' default charging unchanged. The title checks the neighboring
track, then combines the resulting border cost with max($20, terrain). IC land
grant hexes omit the ordinary $20. Private-reserved hexes remain blocked while
MC/O&I are player-owned. Their special lays remain outside this slice.

## Assets and boundaries

The title owns its semantic map: all printed hexes, terrain, charged/impassable
borders, homes and secondary reservations, fixed track, cities, offboards, staged
revenue and port/land-grant/private-block markers. East offboards form the mutual
exclusion stop group. Later route rules must enforce Chicago city exclusion and
apply east/west and private bonuses; this slice does not claim route support.

Reuse standard yellow #5/#6/#7/#8/#9/#57. Define the three yellow Z variants under
1846 identities. The phase-I inventory has the exact finite city counts and
unlimited basic track. Green/brown/gray supply is deliberately deferred until its
upgrade rules and phases are executable. The initial depot supplies player-count
plus two ordinary 2-trains; the two independents' trains are separate owned assets.
Later train types, variants and retirement rules are not yet modeled.

Reuse operating-set/round/turn Actions, private-income settlement, shared track
Actions/handler/construction, map rendering and tile rendering. The first OR sorts
major prices ascending without reversing equal-price stacks; MS and Big4 precede
majors. Operating and map fields are added only to 1846's composed state.

The board is generic/boardless; no physical-board artwork is claimed. Market and
phase-I depot occupy declared areas clear of hexes. Market cell scale matches TOP
within rounding (1700/1934 versus 817/942). Tile selection is manual and session-
owned. Back clears the selected hex; Undo clears a manual selection first, then
reverses a committed action. Selection is invalidated before visible-state publish,
on perspective/action changes, and on history navigation. No auto-selection.

## Review fixes

Sales now commit one complete company block. Closure is a System Action carrying
former president, cash payments, retired certificate IDs, removed token and
reservation IDs/data, and former market space. It runs before another stock
decision or the operating-set handoff, including closure after round-end drops.

## Verification

Check both closure triggers and semantic records, presidency transfer in an atomic
block, and reversal. Exercise exact phase-I supply, map topology/home alignment,
private-income timing, first-OR tie order, two lays and affordability, second-side
border charging, blocked/private/off-map/sea/fixed-edge lays, ownership and stale
cost rejection, tile placement/migration, and replay/undo. Inspect the board and
manual-selection lifecycle in the development harness.

Validation: 42 title tests and 24 construction, board-layout, 1830 operations,
and 1889 runtime regression tests pass. Shared logic, title logic, title UI and
playground checks pass, as do touched-package lint and both artifact bundles.
Bundles retain existing Common/Flowbite warnings. The native browser rendered
the draft and semantic board, but subsequent automation timed out or failed;
the full construction interaction walkthrough and narrow-viewport inspection
remain unverified. No publication or commit was made.

# 1846 revenue private powers

This slice implements Steamboat, Boomtown, Meat Packing and Mail Contract in
phases I–II, including the playground. Special track and station powers, train
trading/emergency funding and phase III/IV transitions remain subsequent slices.
Requirements come from GMT 2021 §§6.64, 6.93 and p.12, and the research snapshot's
g_1846 entities and route revenue behavior. Source classes are not templates.

Surveyed all assignments for visit/payment limits (259), revenue modifiers (416),
interruptions (488), power effects (464), and lifecycle (680). Titles vary between
global hex benefits (1817 bridges/mines/ranches), company-owned markers (1846),
selected-stop bonuses, visit-based mail, freight sets (1862), subsidies and titles
without route income (Rolling Stock). Private lifetimes include one use, recurring
activation, phase expiry and rights surviving the originating private.

1846 therefore stores its beneficiary, private identity, location and last-used OR
in title-owned revenue markers. This is deliberately separate from 1817's shared
location markers, which benefit every company and can be placed several times by
one private. The current shared PlacePrivateMarker Action lacks beneficiary and
replacement semantics. No optional 1846 fields are added to other titles. The
beneficiary survives private closure, so later phase-III work can retain the
marker without recovering ownership from a retired certificate.

MPC and BT placements are permanent. SC may move once per operating round before
routes; a purchase offers an immediate optional placement even after running.
Purchase clears the player-owned SC assignment first. A title-owned pending
placement choice suspends the current operating step until placement or explicit
skip; it does not re-run routes or reset construction. Outside that purchase
window, marker choices are available before routes. Choices, cancellation and
authority are validated by the runtime. Their Actions record before/after markers.
Closing a corporation removes its markers and records them in closure metadata.

Existing stop bonuses and paying-stop selection implement counted marker revenue.
Mail requires the complete set of legal routes, so RouteEvaluation gains an
optional run-aware per-train bonus policy. It runs after route and shared-track
validation, adds ordinary RouteBonus records and recalculates the run total.
1846 chooses a longest visited route deterministically and awards $10 at each
visited location, including unpaid 3/5 stops. Other titles retain identical results
and serialized contracts. This additive policy does not claim to model freight
sets, subsidies or other distinct settlement mechanisms.

UI controls call session Actions, suspend during pending offers/marker decisions,
and respect perspective, publication and History. Map labels name the benefiting
company; route previews and completed runs include the run-aware bonus. Check
purchase timing, skip, per-OR movement, permanent placements, counted-vs-visited
revenue, multiple trains, actor/source rejection, closure, replay and Undo.

Verification (2026-10-04): all 829 shared-runtime and five-title tests pass,
including eight new revenue-power scenarios. All 207 shared UI tests pass.
Shared/title logic and UI builds,
1846 logic/UI artifact bundles, shared/title UI and playground type checks, and
touched-file lint pass. The native playground ran a five-player seed-7 game
through OR1.2: corporate purchase cleared the player SC assignment, placement
suspended finance, Undo restored the pending choice, Skip allowed subsequent
placement, and History disabled choices. Seller consent led to permanent MPC/BT
placements. The next OR offered only SC movement. A Detroit–Port Huron route
showed $60 base plus $20 Mail consistently in its preview, saved row, committed
run and dividend choices. No browser errors occurred.

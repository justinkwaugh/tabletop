# 1846 independent operations

This slice completes Michigan Southern and Big 4 in the first OR, then stops at
`ReadyForCorporations`, even if no major floated. It does not skip the missing
major finance/token/train/private-purchase procedures or start another round.

Evidence: GMT 2021 §§6.1, 6.62–6.64, 6.72 and the Steamboat sidebar on p12;
pinned snapshot 715567bdc7e5cc68a68a286b21dc8edd1a125e50, g_1846 game.rb and
steps assign/dividend. Research informs behavior; implementation reuses this
repository's route tracing, evaluation, editor, cash settlement and turn ending.

Surveyed every recorded assignment for distance (249), visit/payment limits
(259), track reuse (157), repeated-stop payments (141), fleet constraints (165),
revenue modifiers (416), dividend choices (345), entitlement (275), rounding (183).
Examples challenge generalization: TOP counts hex edges; 1889 pays visited stops;
1846 later trains visit more than they pay; other titles pool fleet capacity,
permit train-group reuse, charge fees, or lack routes altogether. Minor automatic
owner/treasury splits differ from shareholder elections, short liabilities and
market-linked dividends. No title gains unrelated serialized fields.

1846's initial 2-trains use existing stop-count routes, token inclusion, blocked
city checks, no track reuse, East stop-group exclusion and one stop per hex (the
Chicago restriction). A 2-train including its station cannot visit both an east
and west offboard, so east/west bonuses cannot arise here. Later train support
must add that bonus and visit/payment distinctions before becoming executable.

The SC owner can assign a port and any started independent/floated corporation,
or skip, during initial private income. One committed assignment records both
markers; the UI offers complete choices without transient auto-selection.
A title-only optional assignment stores the persistent right. The existing
stop-bonus policy pays $20 per printed port symbol only to the assigned company.
Corporation-owned private powers and reassignment in later ORs remain deferred.

RunTrains remains shared. Mandatory independent settlement is a title System
Action, composing EarningsDistribution with one owner entitlement and exactly
half retained, settleCashPayments and endOperatingTurn. No market movement,
private acquisitions, train-buy step, or optional dividend decision is fabricated.
Semantic metadata records the earnings and owner/treasury payments. First MS,
then Big 4; no second private-income payment between them.

Route selection reuses RouteEditor with title prototype controls. Selection is
manual: train, start, successive paths, save, confirm. Back retreats one manual
choice; Undo clears the whole local route selection before committed history.
Visible-state publication, perspective and History invalidate selections. Route
path overlays use the shared map renderer. No automatic route choice is introduced.

Verify station-connected runs and wrong-owner/foreign-train/disconnected/overlong
rejection, SC ownership and bonus attribution, exact $5 split of odd tens, no-run
settlement, MS→Big4→boundary, conservation, metadata, replay and undo. Retain
construction/stock regressions, and exercise the prototype route controls.


The existing RoutesModule session dependency and RouteBuilding prop are narrowed
to the capabilities they actually consume, letting 1846 reuse both without adopting
the full family session or unrelated state. This changes no host bridge messages,
GameSession ABI or artifact manifest. Existing artifacts continue to work with
their bundled code; only 1846 needs its new artifact to expose this slice. No
publication is part of this change.

Validation: 49 title tests and 20 shared route/editor regressions pass. Shared UI,
title logic/UI and playground checks, lint and artifact builds pass. Browser DOM
walkthrough verifies assignment/skip, a $60 Detroit–Port Huron run, owner payment,
Big 4 handoff, committed Undo restoring the cash and MS route step, route Back,
local-selection Undo, History inspection, and the final independent-operation
boundary. Native screenshots remain unavailable; narrow-view visual inspection
is not claimed.

The browser check found an existing hydration boundary issue: action availability
receives an already-hydrated title state. The title hydrator now dehydrates that
instance before constructing another, so internal validator fields cannot enter
the serialized-state validation. A regression covers the actual availability
call with a hydrated state. This is not a saved-state compatibility reader.

Review correction: completed runs are displayed from RunTrains metadata in the
visible Action Step, rather than the cleared routeStep. The shared route panel
accepts a read-only recorded result, and the title uses the same result for its
map paths. Results survive the settlement/handoff cascade and clear at the next
User Action. Native Previous/Next navigation now verifies the $60 MS run and
$40/$20 breakdown after settlement; four regression tests verify step boundaries
and prevent future results leaking into earlier History positions.

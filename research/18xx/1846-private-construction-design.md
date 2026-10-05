# 1846 private construction powers

Implements MC/O&I paired yellow lays, LSL's green upgrade, LM's connecting lays/upgrades,
C&WI's extra Chicago station and TBC's recurring mountain/pass/tunnel discounts in
phases I–II. Sources: GMT 2021 §§6.43, 6.93 and p.12; pinned g_1846 entities,
special_track and Little Miami validation. Later phases and emergency funding remain
separate. Existing source behavior supplies requirements, not class templates.

Surveyed all assignments for construction allowance (320), connectivity (147),
usefulness (128), station placement (331), power effects (464) and lifecycle (680).
Important variants include 1889's player-owned remote tile and ordinary free token,
1817's reusable multi-lay powers and global markers, 1846's corporate extra token
and linked two-hex construction, purpose-specific networks in 1862, and titles
without geographical construction. Free construction differs from a fixed discount;
extra tokens differ from spending existing tokens or consuming the normal placement.

Reuse privateTrackConstruction, TrackRequest/TrackLayDetails, applyTrackLay,
PrivatePowerFields and station placement/inventory. A title action commits one or
two fully validated tile requests together, consuming the power once without
consuming ordinary construction. This permits a manual, cancelable draft without
persisting incomplete paired lays. A single MC/O&I lay explicitly forfeits its second
lay. LM must connect the cities, initially unconnected, and each changed hex must
contribute a new exit to a connecting path. Paths may take an indirect route and
ignore station blocking for this geographical test. Existing track flood traversal
is extracted into ConnectedTrack; company TrackNetwork retains its station origins
and blocking policy. No fictitious company or station is introduced for LM.

C&WI uses one extra station, only in its Chicago city, without needing a route and
without consuming the normal station placement. Private ownership, phase, operating
company, pending purchase/marker decisions and usage are checked by the runtime.
TBC adjusts mountain terrain and each completed mountain hexside independently;
water terrain/bridges and the ordinary base cost retain their normal rules.

The title session owns the manual private/tile draft. Back pops a selected lay then
its power; Undo clears the draft before reaching committed history. Confirmation
commits the whole power. Publication, perspective and History invalidate the draft.
The board previews the staged tiles; controls name costs and forfeited unused lays.
Actions record placements, payments and power identity; ordinary track/station steps
and already-recorded routes are preserved. History is read-only.

Verify disconnected/free construction, supply exhaustion, linked placements and
forfeiture, LM previously connected/dead-end/new-exit tests, LSL phase restrictions,
TBC discount categories, extra station availability/ownership, late use, interruption,
ordinary allowances, replay/Undo, draft cancellation and playground behavior.

Verification (2026-10-04): 844 shared-runtime/five-title tests and 208 shared UI
tests pass. Fifteen new title tests cover the private powers, including exhausted
tile supply and an LM upgrade that connects the cities but contributes no new exit
to that connection. The Mail regression covers drafting, saving, editing, removing
and invalid overlapping routes. Shared/title builds, UI/playground checks, lint and
1846 logic/UI bundles pass. Bundling retains the existing shared-dependency warnings.

Native playground, five-player seed 7: MC paired tiles previewed correctly; Back
and Undo canceled staging, confirmation consumed the power, and committed Undo
restored availability. A private draft disabled finance/acquisition controls.
History cleared the draft. C&WI placed an extra Chicago token and Undo restored the
button. LM rejected a non-connecting first tile; a connecting pair confirmed.
O&I confirmed one tile after routes and forfeited the second without changing the
recorded zero run. No browser errors occurred. Playground remains at `/1846`.

Review follow-up: the title session now resolves interaction precedence in one
place, and derives capabilities for ordinary actions, acquisitions, seller
responses, revenue markers and private construction. The existing family survey
still applies: titles have different private-power and interruption windows, so
this UI priority policy stays in 1846. Shared Game Session lifecycle and runtime
Action legality remain the underlying authority; no family state or host contract
changes. Components consume capabilities instead of duplicating exclusion lists.

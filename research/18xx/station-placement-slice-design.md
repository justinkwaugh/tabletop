# Station placement and access

## Evidence and scope

The full recorded title-trait corpus was surveyed for home establishment (172
assignments across 129 profiles), station placement (331/128), station blocking
and reservations (277/128), network types (151/128), and additional access rights
(132/128). Unverified profiles remain evidence gaps. The domain study's station
access section separates physical occupation, future entitlement, connection,
placement permission, and train travel.

The corpus includes 52 titles with special or remote placement, 25 with station
replacement or inheritance, 15 with whole-tile reservation blocking, three with
future-capacity rights, and 20 with purpose-specific blocking exceptions. Rolling
Stock's lack of a railway map remains explicitly not applicable. The 1858 primary
formation/reservation rules were inspected: future reservations may exceed current
capacity, and a private's reserved home may not yet be usable for formation.
1849/1858 gauge, 1850 permits, 1866 regional rights and neutral tokens challenge any
claim that station-based ordinary traversal alone establishes universal access.

For the current consumers, TOP prototype §§6.7.5, 7.3–7.3.2 and 7.7 and Shikoku
1889 §§7.4, 8.4 and 8.5 establish the executable rules. TOP's four station tokens
include its home; the PEIR has its existing stations and no extras. 1889's title
roster supplies two tokens for AR/IR/SR/KO, three for TR/UR, and one for KU. The
local research title definitions were consulted for those roster facts, without
copying their implementation. Research provenance stays in this document.

Both games permit one connected ordinary placement per operating round, forbid
more than one company station per hex, and protect unoccupied reserved home
capacity. Extra placement costs $80 in TOP and ¥40 in 1889. Both have free home
stations. TOP's associated-company home replaces the PEIR station at flotation;
that existing action remains the owner of the exchange. All newly floated 1889
homes are placed at operating-round start before any company lays track. A home
does not consume the ordinary placement allowance.

## Shared implementation

StationPlacement evaluates explicit station identity and semantic city/slot
position. It shares StationState, RailwayMapState, TrackNetwork and cash
settlement with existing mechanisms. The same evaluator supplies legal choices
and validates PlaceStation. StationRules supplies cost, allowance, pending homes,
and an optional identity occupying a future replacement reservation. The latter
keeps a PEIR-backed reservation from being counted as a second occupied space.
It does not grant permission to displace a station through ordinary placement.

Occupied capacity and reserved capacity are separate. An ordinary placement may
use surplus capacity, but may not consume another company's last reserved space.
The reservation owner may occupy its home. Placement consumes only that company's
reservation in that city. Future rights persist without creating extra physical
slots. Automatic homes select a free slot deterministically and are planned as a
batch before mutation. Unresolvable fixed homes are an invariant failure; a future
title needing home choice requires its own decision state.

PlaceStation settles company cash to Bank, places the existing supply token and
records its identity in StationStep. FinishStations completes the step, including
when no placement is possible. FinishTrack initializes StationStep and transitions directly to PlacingStation;
PlaceHomeStations precedes StartOperatingTurn when homes are pending. Every
consequence is a registered System Action, preserving replay and Undo. The example
still stops after the first operating company's implemented steps; it does not
skip running trains to pretend that a complete operating round exists.

TrackNetwork reports reachable blocked cities as well as paths/endpoints. A full
rival city remains reachable as an endpoint, but traversal cannot leave through
it. Own stations retain traversal. Recomputing against current station ownership
handles replacement, placement and Undo without a separate mutable access cache.
The current single-gauge, ordinary station-blocking traversal serves construction
and station connection in these titles. Train route legality, neutral tokens,
remote powers, alternate gauges and regional permits require their own policies
when implemented; this slice does not claim those rules are supported.

## Prototype and verification

The Station placement example has prepared connected track, available station
supply and a completed track step. Fixture version 12 preserves old examples.
The session owns manual station and position selections, token previews, and
confirmation through GameSession. Back unwinds position then station; Undo clears
a draft before reverting committed actions. History and visible-state transitions
hide drafts; beforeNewState clears them. Treasury and supply remain canonical
until confirmation. Access inspection can select another company; its blue track
overlay and blocked-city list reflect the hypothetical station while previewing.
Existing map tile/token rendering, hit targets and scaling are reused.

Verification covers shared reserved/surplus capacity, PEIR-backed reservations,
future rights and same-hex restrictions; title costs, allowances, supply,
authorization, affordability, home timing, blocked endpoints, replay, hydration,
determinism and Undo. Desktop interaction checks exercise previews, Back, Undo,
history, reload and both title examples. The surrounding controls remain
provisional; map rendering and semantic overlays remain shared assets.

Completed verification: 124 shared logic tests, 11 shared UI tests, and 99 harness
unit/integration tests passed. Sixteen browser checks passed across station,
construction, economy and stock-round flows, including the final station tests
on a stable development server. Shared/title logic and UI builds and Svelte
checks passed. Visual inspection confirmed the Saijou token preview, legal and
selection outlines, and AR's access stopping at the previewed IR station.

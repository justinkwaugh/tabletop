# Slice 16B: TOP setup and offer-pile auction

The Old Prince's opening now assigns Mainline and Shortline through seeded setup,
creates the public offer piles, auctions every item for three or four players,
and starts SR1 in ascending remaining-cash order. This uses the existing runtime,
Common auction participants, shared certificate settlement, and existing stock,
private-exchange, flotation, station, and control behavior.

## Rule baseline and family survey

The supplied `/workspace/TOP71_RULES_PROTOTYPE.pdf`, §§3, 5, 6.3, 6.7 and 11.3,
is the baseline. The comparison in
`/workspace/research/18xx-2026-09-08/top-rulebook-comparison.md` identifies conflicts
with the contextual implementation. This slice selects the book's $460 starting
cash for four players, $160 Union Bank face value, and $80 King's Mail income. The latter follows the designer correction relayed
by Justin on 2026-09-12, superseding the book's incorrect $60.
Three players start with $580. Ice Boats is four-player-only, following the detailed
setup and private description rather than the contradictory final cheat sheet.
Shortline's home remains reserved until flotation; detailed setup explicitly places
Mainline's home, whereas the contextual implementation places both immediately.

The full 130-title survey in the preceding
[auction design](opening-auction-slice-design.md) applies to the shared auction,
settlement, and UI work here. Rechecked allocation, money commitment, information,
setup variation, control resolution, and company availability in the full trait
catalog. Setup has verified profiles for 129 titles and availability for 128;
unverified entries are evidence gaps. Random selection occurs in 63 scoped setup
assignments, alongside player-count scaling and configured modules.

Relevant counterexamples:

- 1889/1830 reserve bids across ordered waterfall lots. TOP has one active lot,
  no standing portfolio, and two designated bidders. The seller of the offer,
  eligible bidders, winner, and forced purchaser are distinct roles.
- 1817 nomination auctions, 1822 bid boxes, 1841's sealed concessions, 1846's
  sampled draft, 18CO's moving bids, and titles without opening auctions do not
  share TOP's decision order. A generic all-auctions state machine is unwarranted.
- Common's `HydratedSimpleAuction` treats a passed participant as withdrawn.
  TOP's first opening pass instead preserves one chance to re-enter if the second
  player bids. The shared offer-pile procedure records this opening pass separately;
  permanent withdrawal still uses Common's component.
- Control resolution includes ordinary presidencies, direct ownership, corporate
  chains, manager/director distinctions, and PEIR's numbered-interest tie breaker.
  Union Bank remains a Company owned through its private certificate, not an extra
  human player. Auction ownership never copies its assets to its controlling owner.
- Company availability includes phases, concessions, ordered release, reserved
  companies, and special formation. TOP's Mainline and Shortline assignments are
  optional named `Company.role` values, independent of geographic identity and
  company kind. This is a single setup assignment, not a general capability system.

Contextual paths checked under the research package include `g_1871/game.rb`,
`g_1871/companies.rb`, and `g_1871/step/auction.rb`, plus the mechanism chapters in
`18xx-domain-model-study.md`. They establish rule meaning and discrepancies; no
implementation was copied or translated. Checked-in runtime and tests contain no
research references.

## Shared and title-owned boundaries

`OfferPileAuction` records public piles, auctioneer, current lot, Common bidding
participants, temporary opening pass, awards, and forced-purchase income progress.
`OfferAuction` handles offers, alternating bids, restricted participation,
withdrawal, the designated receiver, richest-player fallback, and repeated income.
The current procedure has two bidders, clockwise offer rotation, increment-multiple
bids, and a forced recipient three seats after the auctioneer. Other auction forms
compose the underlying components instead of claiming this procedure fits them.

`OfferAuctionLot`, `BidOnAuctionLot`, shared `PassAuction`, and system
`ResolveAuction` run through the canonical engine. TOP supplies lot definitions,
face values, award effects, player-private income, and SR1 ordering. The runtime
selects one opening procedure per title; composing distinct auction stages in one
future title would need a continuation extension.

TOP also opts into a system `OfferAuctionLot` when its auctioneer has exactly one
lot remaining. The shared handler and action use the same cardinality check, so
the offer is recorded for replay and Undo before bidding begins. Multiple remaining
lots still require a player choice. The allocation survey above includes waterfall,
nomination, bid-box, sealed, and draft procedures with different choice sequences;
this option applies only to the offer-pile procedure and is enabled by TOP's rules.
No automatic bid, pass, or award behavior is inferred from a single offer.

`awardCertificates` charges once for a bundle and transfers existing certificates.
It is also used by the waterfall's private award helper. A concession or bundled
share therefore has one economic asset identity; no synthetic duplicate PEIR
private is needed. The shared `startFirstStockRound` handles round and turn reset
for both openings. Company roles affect TOP's exchange, concession closure, and
formation rules without replacing company ids. PEIR rights now retain their printed
numbers from the full seven-company set; earlier prepared examples were updated
accordingly. PEIR control counts awarded player-owned rights while unawarded rights
remain in the Bank during setup.

TOP's initializer owns seven geographic companies, the selected roles and Union
Bank holdings, five retained PEIR rights and homes, private roster, treasury grants,
reserved/bundled certificates, the stock markers, and equal public offer piles.
Mainline begins floated/funded with $920. Shortline has three reserved exchange
shares and needs one additional ordinary share purchased after the concession
award to float, receiving its $860 once and its free home. The Bank is unlimited;
PEIR starts with $200 and owns King's Mail. King's Mail is excluded from auction
payouts because those payouts are only to player-owned privates.

The shared offer panel takes a model, manual selection, player names and callbacks.
The Game Session owns drafts and constructs Actions. TOP supplies role labels.
The economy viewer supports either opening, with 3–4 players for TOP and 2–6 for 1889. Prototype save identity 24 preserves earlier saved examples separately.

## Unfunded rule edge case

The rules' repeated-payout instruction has no terminating fallback when all players
lack the purchase price and no player-owned private produces income. This is
reachable through legal play: three players can each bid their entire $580 on a
PEIR right before any income-producing private is sold. The implementation records
one zero-income payout, preserves the stalled forced purchase, disables further
auction Actions, and leaves Undo available. It neither invents income nor loops
forever. A fallback rule remains a rules decision, raised with the user separately.

## Verification

Tests cover seeded setup and varying geographic roles, both supported player counts,
full opening completion, first-pass re-entry, bid restrictions and authorization,
the single-lot system offer for three and four players,
forced purchasers and auctioneer-based ties, repeated income excluding King's Mail,
zero-income stalls including a fully legal sequence, exact replay/Undo, bundled
certificate identity, Shortline flotation/funding/home placement, and the earlier
finance examples. Browser checks exercise offer/bid drafts, Back/Undo, reload,
forced sales, completion into stock trading and Undo back into the auction.

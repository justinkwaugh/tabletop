# Slice 16A: reserved-bid waterfall auctions

The reserved-bid waterfall is a shared 18xx procedure. Shikoku 1889 is its first
consumer, supplying the Standard Game setup, private definitions, and rule choices.
TOP's offer-pile procedure remains slice 16B; it can reuse bid commitments, Common
auction participants, and financial settlement without adopting waterfall turns.

## Evidence and family variation

Surveyed all 130 researched title profiles in `data/title-traits.json`, especially
`allocation-method`, `bid-commitment`, and `allocation-information`, alongside the
allocation sections in `18xx-domain-model-study.md` and `18xx-game-variation-catalog.md`.
Paths here refer to `/workspace/research/18xx-2026-09-08`.
The profiles contain 46 waterfall assignments, 17 selection-auction assignments,
11 bid-box assignments, and numerous draft, ordered, Dutch, stock-round, and
no-allocation alternatives. Counts are scoped assignments, not disjoint title counts.

- 1830 and regular 1889 combine ordered lots, standing reservations, restricted
  bidding, and cascading awards. The profiles identify 43 all-standing-bid
  commitment assignments across the catalog.
- 18Chesapeake remains a waterfall but commits only leading bids and requires
  increment multiples. Checked `source/lib/engine/game/g_18_chesapeake/game.rb`
  around its auction constants. Neither restriction can be inferred from the
  term waterfall alone. Those options are considered, not implemented in this slice.
- 1822 reserves bid tokens on outstanding bids while reserving money only on
  leading bids; checked its `step/buy_sell_par_shares.rb` bidding-token and
  affordability rules. Token portfolios need their own component when implemented.
- 1841 version 1 can enter a waterfall after a sealed concession auction; its
  later versions use nomination. A waterfall is not necessarily the entire setup.
- 1817 selects lots through nomination; TOP has public offer piles, two designated
  bidders, an auctioneer, and a distinct forced purchaser. These do not share the
  waterfall decision sequence.
- 18CO moves bids between lots. This slice permits replacing a bid on the same lot,
  not transferring it between lots.
- 1846 has hidden sampled drafts or open two-player allocation; checked its
  `step/draft_distribution.rb`. Other researched titles use snake drafts, random
  allocation, or no private allocation. A bid is not a universal allocation model.

The supplied **Shikoku 1889 Rulebook**, §§2 and 5, is the rule baseline. Its restricted
auction starts with the eligible player clockwise from the highest bidder, then
continues clockwise. The contextual waterfall implementation instead chooses the
lowest bidder. The shared procedure exposes these two explicit bid-order policies;
1889 selects the supplied book's clockwise policy. Reservation bids and raises
must exceed the higher of face value and current bid by at least 5; an integer bid
need not be a multiple of 5. All standing reservations consume available capital.

Research was used to establish rules and counterexamples, not as implementation
source. Runtime and tests contain no research provenance or copied implementation.

## Implemented boundary

Common provides `BidCommitment`, summed committed amounts, and available money
when replacing a commitment. Callers decide which bids count as commitments.
Active restricted bidding uses Common's existing `SimpleAuction` and
`HydratedSimpleAuction`, including its participant bid/pass validation.

The 18xx library owns `WaterfallAuction` state, `ReserveBidAuction` behavior,
purchase/reserve/raise/pass Actions, system resolution, and the auction state
handler. Remaining lots, saved outer player, public reservations, current bidding,
passes, discounts, and awards are canonical state. Opening an auction moves that
lot's bids into the Common auction participants, avoiding two serialized copies.
Other lots remain committed. Automatic awards, discount/free awards, income, and
completion run through system Actions and normal engine history.

Rules supply an ordered lot catalog, bid increment/order, award settlement, and
income settlement. `awardPrivate` transfers a bank-owned private and payment using
existing financial primitives. Different assets or concession bundles can supply
a different award operation. The current handler completes into the first stock
round; other continuations would extend the handler rather than change bid meaning.
Discounts use the increment, the first lot becomes a free purchase at zero, and
post-sale all-pass cycles pay income. Different all-pass policies and leading-only
cash commitments require explicit future extensions, not a universal auction flag bag.

The shared UI's `WaterfallAuctionPanel` takes the model, player names, active
player, a manual draft, and callbacks. It has no title imports or Action creation.
The Game Session constructs Actions and owns draft lifecycle. This prototype shows
public bids, available money, restricted participation, purchases, and awards.
It is not the eventual desktop/mobile game layout.

1889 owns the seven private definitions and all setup data. Its default initializer
now starts the Standard Game with 2–6 players: 5/6/7 privates for 2/3/4+ players,
420 per player for 2–4 or 390 for 5–6, seven unstarted majors, all major shares in
the IPO, empty market markers, available stations, untouched tiles/depot, and a
7000 total bank. Seeded priority rotates the existing seating order. The beginner
allocation variant is outside this slice. Earlier example positions remain explicit
configurations. Prototype save identity is version 23 and includes player count.

## Verification

Canonical engine tests exercise 2–6 player setup, reservation replacement and
portfolio affordability, invalid and stale Actions, automatic award chains,
clockwise and lowest-bid-first policies, bidder withdrawal, saved outer priority,
discount/free awards, income, the first stock round, company formation/flotation,
and free home placement. Processed Actions replay and undo exactly, including
system cascades, without serializing rule dependencies.

Browser checks exercise manual Back and Undo, restricted bidding across reload,
completion into stock trading, reversing completion, player-count sets, and all-pass
free allocation. The existing finance/runtime suites guard previous slices.

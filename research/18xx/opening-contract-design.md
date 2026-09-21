# Opening contract

A title supplies one function, `createOpening({ players, prng, config })`, returning an
`Opening`:

- `position`: the typed initial position — finances, companies, stations, tile and train
  inventories, phase and the stock market;
- `titleState`: the initial values of any fields the title added to its State;
- `begin(state)`: puts the freshly hydrated State into the title's first machine state,
  with its procedure state, first player and turn order.

The family keeps hydration, the invariants, initial phase effects and a library of
opening procedures. `beginWaterfallAuction(rules)` and `beginOfferPileAuction(auction)`
return a `begin`; a title calls the one it uses, or writes its own for a machine state it
owns. The initializer no longer knows which opening a title has.

This replaces `createFinances` and `createMarket`. `createFinances` returned the whole
position; TOP also passed `stockMarket` and `offerAuction` through it, outside its
declared type, and its market silently replaced `createMarket()`'s because of spread
order. The initializer chose the procedure by looking for an `offerAuction` field, built
the waterfall auction itself but left the offer-pile auction to the title, required one
of two auction rule sets, and asserted two to six players.

## Evidence surveyed

`allocation-method`, `actor-order`, `setup-variation`, `player-count-scaling`,
`rules-configuration`, `startup-operating-before-stock`, `startup-draft-operating` and
`recurring-auction-rounds` in `data/title-traits.json`; the first rounds of the 130
constructed samples; the domain study's "Allocating companies and rights" and the engine
study §9.

- **Kinds.** `allocation-method` has 26 values over 130 titles, 15 of them used by one
  title: waterfall auction 46, open draft 20, nominated-lot auction 13, bid boxes 11
  (the 1822 family), ordered auction 10, snake draft 7, and TOP's offer pile alone.
  Hybrids run two procedures in turn (1873, 1880, 18Cuba, 1840). 22 sampled titles begin
  in a stock round and two options begin in an operating round (1858 Quick Start, 1822PNW
  Starting Packet). Only 25 titles use the unmodified waterfall. The domain study: data
  fits inventories and increments; "drafting, competitive bidding, and concession
  settlement need processes that preserve their own pending choices and obligations."
- **First player.** Not a family rule: seat order, a draw, reverse or snake order, the
  result of a first auction (1873), richest player (Steam over Holland).
- **Randomness** shapes the position itself in the titles checked: 1846 removes random
  privates and corporations, 1822 shuffles its deck into bid boxes, TOP draws its
  Mainline and Shortline and deals the piles, 18USA randomises hexes and subsidies.
- **Player count** changes cash and certificate limit almost everywhere (122 and 121 of
  124 profiles) and components in several (1846, 1849, 1840, TOP's Ice Boat). Ranges run
  from 1 to 12 players.
- **Options** are recorded for 75 titles, named variants for 33, map selection for 8, and
  can select the opening itself (18Tokaido: waterfall, snake draft or stock round).
- **Beyond cash and paper.** TOP sets pars, places two home stations, reserves exchange
  shares and funds Union Bank; 1846 tokens removed corporations' homes; 1822 fills bid
  boxes; ten titles start with loans; 20 have a national or system company.
- **Handover.** Usually to the first stock round after a reorder. Five titles operate
  before the first stock round (18EU, 18Ardennes), six resume an unfinished opening after
  operating rounds (1835, 1846 two-player), four repeat an auction round, and the 1822
  family has no opening apart from its stock rounds.

The playground's `ScenarioInitializer` is a second consumer: it starts a game directly in
a stock round or an operating step.

## Shared behaviour and title-owned choices

Shared: building and validating the State from a position, the initial phase effects, the
waterfall and offer-pile procedures and what each needs in order to begin.

Title-owned: the position and how randomness, player count and configuration shape it;
which procedure opens the game and who acts first; the supported player counts, already
in the title's metadata; what follows the opening, which its procedure's rules decide
(`firstStockOrder`, the waterfall's completion).

`begin` is a function, not data, because a procedure's first state depends on the
hydrated State (the waterfall's lots are the privates in play) and a title's own opening
cannot be described in a family vocabulary.

## Support now and later

Now: the two procedures 1889 and TOP use, a stock-round or operating start for the
playground scenarios, and `titleState` for a title that extended its State.

`config` is passed through and unused; its place is fixed because options select
components and openings in a majority of titles.

Intentional limits:

- An opening runs once. Resuming it after operating rounds (1835) or repeating it (1862,
  18Ardennes) needs round sequencing the family does not have.
- Two procedures in turn (1873, 1880) work only as far as the first can hand over to a
  machine state; nothing sequences openings.
- The family offers no draft, bid-box or nominated-lot procedure. A title can supply one
  as its own machine state and handler.

## Compatibility

Nothing serialized changes. Setup must consume randomness in the same order — the
title's draws, then the waterfall's first player — so that seeded games, the finished-game
fixture and the complete-game test reproduce. Runtime-contract snapshots and the deployed
game's recorded transitions must be unchanged. Logic Artifacts only; no UI change.

## Examples that verify the decision

1889 and TOP create the same initial State for the same seed as before (compared before
and after the change); the complete-game and finished-game tests pass; a title with its
own State opens in its own machine state with its own initial field; a title that gives
no opening procedure state cannot begin one of the family's auctions.

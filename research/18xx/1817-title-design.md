# 1817: title plan and slice 1 design

1817 is the fourth executable 18xx title, after TOP, Shikoku 1889 and 1830. This
note records the title's delivery plan and the design review for its first slice,
following the standing [18xx design rule](../../docs/agents/18xx-design.md).
Later slices add their own sections before implementation.

1830 shared 61 of the 70 compared traits with 1889 and needed few new mechanisms.
1817 shares 19 with 1830 and 25 with 1889. Most of its rules are mechanisms the
family libraries do not have yet: companies started by auction, 2-, 5- and 10-share
structures, corporate loans with a variable interest rate, short selling, merger and
acquisition rounds, and liquidation. The plan therefore introduces one family
mechanism per slice. Each is surveyed across the researched titles before its
interface is settled.

## Authority and scope

**Project decision (2026-10-01):** the research site's 1817 implementation defines
the rules, as it did for 1830. Its metadata names the 1817 Rules v1.0 (5 March 2015)
and the Volatility expansion rules. Neither is in the workspace, so the
[game configuration][game], [entities][entities], [map][map] and the title's
[steps][steps] and [rounds][rounds] are the primary evidence. Citations pin
`715567bdc7e5cc68a68a286b21dc8edd1a125e50`. Where the reference engine and a printed
rule may differ, follow the engine and record the difference.

- **Hosting:** 18xx playground only, like 1889 and 1830. Not added to `games.json`.
- **Artwork:** none. Boardless map, generic share and private presentation.
- **Players:** 3 to 12, as the reference. The reference warns that more than 7 is
  untested. Prepared playground positions use 3 or 4 players.
- **Optional rules:** all four of the reference's [options][meta] (project decision,
  2026-10-01):
    - Short Squeeze;
    - 5 Shorts;
    - Modern Trains;
    - the Volatility expansion.

    Each option is added to the configurator in the slice that implements it, so the
    configurator never offers an option that has no effect.

- **Variants:** 1817NA, 1817WO and 18DE are out of scope. They subclass 1817 with
  their own maps, roster and parameters. They are recorded here because they challenge
  which 1817 rules are title-owned (see [Family variants](#family-variants)).
- **Verification target:** the five recorded games in
  `/workspace/research/18xx-2026-09-08/source/public/fixtures/1817`. The 1830
  converter in `fixture-conversion/` is the precedent.

    | Game                     | Players | Options    | Ending                                                                                              |
    | ------------------------ | ------- | ---------- | --------------------------------------------------------------------------------------------------- |
    | `15528`                  | 4       | none       | Normal end after the 8-train; uses every mechanism (30 shorts, 12 conversions, 7 mergers, 98 loans) |
    | `16281`                  | 4       | none       | Ended manually in a merger round                                                                    |
    | `16852`                  | 4       | none       | Ended manually in an acquisition round                                                              |
    | `20758`                  | 5       | none       | Ended manually in the second stock round                                                            |
    | `1817_game_end_bankrupt` | 5       | Volatility | Bankruptcy                                                                                          |

    Manually ended games have no final result. They are verified by replaying every
    action and comparing the final cash and holdings, not by reaching game over.

## Trait comparison

From the [title traits](/workspace/research/18xx-2026-09-08/data/title-traits.json),
`g_1817` against `g_1830`: 19 traits share their values and 51 differ. Against
`g_1889`, 25 share and 45 differ. The differences group as follows.

| Area      | 1817                                                                                                                        | 1830                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Equity    | 2-, 5- and 10-share companies with conversion; short positions                                                              | President's certificate plus equal shares         |
| Capital   | Incremental, treasury receives share sales; floats on the president's certificate                                           | Full capitalization at 60%                        |
| Market    | One-dimensional, $0 acquisition and liquidation spaces; no price drop on sales; drops for shares in the market pool         | Two-dimensional; sales move the price down        |
| Formation | Company auction in the stock round; the bid goes to the treasury; the president chooses the home                            | Par from the start spaces; fixed homes            |
| Debt      | Corporate loans; one interest rate for the whole game, from the loans outstanding                                           | None                                              |
| Failure   | Liquidation; player cash crisis and elimination                                                                             | Emergency train funding; bankruptcy ends the game |
| Rounds    | A merger round and an acquisition round after every operating round                                                         | Stock and operating rounds                        |
| Opening   | A selection auction (players nominate privates), with seed money                                                            | Waterfall auction                                 |
| Track     | Two lays, at most one upgrade, the second costs $20; unlimited tiles                                                        | One lay or upgrade                                |
| Trains    | No obligation to own a train; a company without one is liquidated; trains exported after each OR; 2+ trains become obsolete | Compulsory train; rusting only                    |
| Ending    | First 8-train, then one more full set; bankruptcy                                                                           | Bank broken; bankruptcy                           |

Two corrections from the survey:

- **The train limit depends on the phase only.** It is the same for every company
  size: 4/4/4/3/3/2/2/2 ([game]). Size-dependent limits exist in 50 other titles, but
  not in 1817.
- **The 18DE trait profile is wrong about shorts.** It lists short positions, but
  18DE's stock step forbids shorting. The variation catalog records this correctly.

## Family variants

Seven titles subclass 1817's game: 1817DE (18DE), 1817NA, 1817WO, 18USA, 1877
Venezuela, 18FR and 18Hiawatha. Their differences show which 1817 numbers and rules
are title data rather than family invariants:

- **Seed money:** 200 in 1817; 150 in NA and DE; 100 in WO; 160 in 18Hiawatha; none
  in 18USA.
- **Interest:** 5 loans per rate step in 1817; 4 in NA; 3 in WO, with a 65% maximum.
  18USA uses 6 loans per step with 5+ players and moves the price 2 spaces per loan.
- **Shorts:** forbidden in 18DE. 1877 and 18Hiawatha loosen eligibility. 18FR raises
  a player's certificate limit for each short.
- **Sizes:** 18FR has only 2 and 5. 1877 and 18Hiawatha start at 5 and grow to 10.
- **Homes:** chosen when the auction starts in 1817; placed in the operating round in
  18DE. WO restricts Nieuw Zeeland and adds a second token there.

None of these variants is planned. They are the first counterexamples checked against
each 1817 interface.

## Delivery slices

1. **Title data, opening and company starts** (this note). The package with its
   complete data: map, tiles, market, roster, base privates (data only), trains and
   phases. The selection auction with seed money. Company auctions in the stock round,
   with size, home, private contribution and station purchase. 1817's stock-round
   share rules. Operating rounds configured from the existing family hooks.
2. **Operating rules:**
    - train exports after each OR, which can start a phase;
    - routes that may not visit a hex twice;
    - city upgrades that must keep the most exits;
    - the 8-train ending with its 2- or 3-OR final set.
3. **Loans, interest and liquidation:**
    - loans and repayments in the OR;
    - the stock-round corporate action (a loan or buying back shares);
    - the interest rate, fixed at the start of each OR;
    - interest at the end of a company's turn, with automatic loans;
    - liquidation for a missing train, unpaid interest or stations left unpaid at
      formation;
    - the player's cash crisis and bankruptcy, and the bankruptcy ending.
4. **Short selling:** signed positions, dividends owed on shorts, closing shorts,
   their valuation, and the market's own shorts. Adds the 5 Shorts and Short Squeeze
   options.
5. **Merger and conversion round:**
    - the merger and acquisition round scaffolding after every OR;
    - conversion from 2 to 5 shares and from 5 to 10;
    - 2+2 and 5+5 mergers;
    - post-conversion trading and loans;
    - the station top-up and token reduction.
6. **Acquisition round:**
    - offers;
    - acquisition-zone and liquidation-zone auctions;
    - settlement, including the debt of a liquidated company;
    - resetting a company so that it can be started again.
7. **Private powers:** the eleven base privates:
    - mine lays and their route bonus;
    - bridges and their route bonus;
    - Mountain Engineers;
    - the Pittsburgh Steel Mill's X00 lay;
    - mail contracts;
    - the Train Station's extra token.

    Route bonuses reach route evaluation and the autorouter. Adds Modern Trains.

8. **Verification:** replay the four recorded base games, with the converter and
   playground specs. 15528 becomes the playground's finished 1817 game.
9. **Volatility:**
    - the thirteen extra privates;
    - the pyramid auction;
    - the random choice among the city-tile privates;
    - replaying the bankruptcy game.
10. **Title UI:** prompts and panels the shared table lacks after slices 3–9,
    including signed holdings, loans and the interest rate, and the merger and
    acquisition rounds.

Slices 3 to 6 each introduce a family mechanism that other titles share; their
design notes carry the full survey. The ordering keeps the playground playable
after every slice. Until slice 3, a company without a train simply earns nothing;
until slices 5 and 6, a company in the acquisition zone keeps operating.

## Slice 1 design

### Package and identity

Logic is in `games/1817` (`@tabletop/1817`) and UI in `games/1817-ui`
(`@tabletop/1817-ui`). The title ID is `1817` and exports are prefixed
`EighteenSeventeen`. The package follows 1830's anatomy: one module per data set or
rule area, composed into `EighteenXXTitleRules` in `definition/gameDefinition.ts`.
1817's rule modules compose family helpers and are not shared with 1830 or 1889.

### Bank, players and limits

- **Bank:** unlimited (`amount: 'unlimited'`); the bank never breaks.
- **Starting cash** for 3 to 12 players: 420, 315, 252, 210, 180, 158, 140, 126, 115
  and 105.
- **Certificate limits** for 3 to 12 players: 21, 16, 13, 11, 9, 8, 7, 6, 6 and 5.
  The president's certificate counts as one certificate in every size. Privates do
  not count. Recalculating the limit after a bankruptcy comes in slice 3.

### Share structure

**Evidence.** Every 1817 company is printed with one president's certificate. Its
size decides what that certificate is worth ([game] `size_corporation`):

- a 2-share company has only the president's certificate (100%);
- a 5-share company adds three 20% shares, so the president holds 40%;
- a 10-share company adds eight 10% shares, so the president holds 20%.

Conversion rewrites the existing shares (5 to 10 turns each 20% into 10%), and so
does a merger. Shorts rewrite with them.

**Survey.** The `two-five-ten-share-conversion` value appears only in the 1817 family
(8 titles). Conversion to more shares of the same company appears in about a dozen
more titles: 1873 (2 to 5 to 10); 1858, 1866, 18Ardennes, 18FL, 18GB and 18VA (5 to
10); 1854. Minor-to-major conversion (1807, 1812, 1861, 1867, 1841 and others) is a
different mechanism, because a different company results. In every 1817 size and
conversion, the president's certificate is two shares and every other certificate
one; only the total number of shares grows. Slice 5 checks the other conversion
titles against this before conversion becomes a family procedure.

**Decision.** Count shares, not percentages, as the family already does. The
president's certificate is always 2 shares and every other certificate 1 share.
The company's `shareCount` is 2, 5 or 10. A company is set up with only its
president's certificate and `shareCount: 2`. Sizing it at formation issues three or
eight 1-share certificates into its treasury and sets `shareCount`. A later
conversion (slice 5) only issues more certificates and raises `shareCount`; no
existing certificate changes. Shorts (slice 4) are then one share each in every
size.

- **Certificate numbers are never reused** within a game. A newly issued
  certificate takes the next number after the highest the company has ever had,
  including retired certificates. This covers the extra certificates that shorts,
  mergers and restarted companies create later.
- **Percentage checks stay title rules.** `ownershipLimit` is 100% for a 2-share
  company and 60% otherwise. `certificateWeight` is 1 for each share certificate.

No family schema change is needed: `shareCount` and the certificate list are already
state, and certificates can be added at runtime.

### Market

**Evidence.** The [market][game] is one row of 32 spaces:

- a liquidation space at $0;
- three acquisition spaces at $0;
- then $40, $45, $50 and so on up to $600.

Par-marked spaces and "safe" spaces (55, 70, 120) are information only. A company's
starting price is the highest space at or below half its winning bid, so any space
from $50 to $200 can be a starting price.

**Survey.** 42 title profiles have a one-dimensional market, among them:

- the 1817 family;
- the 1822 family;
- 1846;
- the 1858 family;
- 18CZ;
- 18Ardennes;
- 18USA;
- Rolling Stock.

The $0 liquidation and acquisition zones belong to the 1817 family. The family
market is already a move graph, so a row needs no new structure: left and right are
the down and up moves.

**Decision.** The title builds its spaces directly. In the 1D market, up is right
and down is left. The colours stand for zones that the title interprets:
liquidation, acquisition, par, safe and ordinary.

- **A family schema widening:** a market space's price may be 0, where today it must
  be at least 1. Share sales and purchases still require a positive price; 1817
  forbids both in the $0 zones. This widens a field that existing states hold. It is
  a superset, so every TOP, 1889 and 1830 state stays valid. The runtime-contract
  snapshots are regenerated, as in 1830's slice 3.
- **No ordinary move enters the liquidation space.** Down moves from the first
  acquisition space have nowhere to go. Only liquidation (slice 3) places a company
  there.

### Roster, privates, trains and phases

**Companies.** The 20 companies are identical except for names: A&S, A&A, Belt, Bess,
B&A, DL&W, J, GT, H, ME, NYOW, NYSW, PSNR, PLE, PW, R, SR, UR, WT and WC. None has a
home. Each starts with one free station; extra stations are bought at formation
(below).

**Privates.** The eleven base privates are data in a `PrivateCatalog`:

| Private               | Value |
| --------------------- | ----- |
| Minor Coal Mine       | $30   |
| Ohio Bridge           | $40   |
| Mountain Engineers    | $40   |
| Pittsburgh Steel Mill | $40   |
| Coal Mine             | $60   |
| Minor Mail            | $60   |
| Train Station         | $80   |
| Union Bridge          | $80   |
| Mail Contract         | $90   |
| Major Coal Mine       | $90   |
| Major Mail            | $120  |

All pay $0 to players. None can be bought by a company from a player. A private
reaches a company only when contributed at formation, or through a merger or
acquisition. Powers come in slice 7.

**Trains:**

| Train | Count     | Price  | Effect                                                     |
| ----- | --------- | ------ | ---------------------------------------------------------- |
| 2     | 40        | $100   | Rusts on the 4                                             |
| 2+    | 4         | $100   | Obsolete on the 4, using the family's run-once-more status |
| 3     | 12        | $250   | Rusts on the 6                                             |
| 4     | 8         | $400   | Rusts on the 8                                             |
| 5     | 5         | $600   |                                                            |
| 6     | 4         | $750   |                                                            |
| 7     | 3         | $900   |                                                            |
| 8     | unlimited | $1,100 |                                                            |

**Phases** start with each train: 2, 2+, 3, 4, 5, 6, 7 and 8. Each phase allows tile
colours and company sizes:

| Phase         | 2      | 2+     | 3       | 4       | 5       | 6       | 7      | 8      |
| ------------- | ------ | ------ | ------- | ------- | ------- | ------- | ------ | ------ |
| Tile colours  | Yellow | Yellow | + green | + green | + brown | + brown | + gray | + gray |
| Train limit   | 4      | 4      | 4       | 3       | 3       | 2       | 2      | 2      |
| Company sizes | 2      | 2      | 2 or 5  | 5       | 5 or 10 | 10      | 10     | 10     |

There are two ORs in every set. Obsolete trains count toward the limit. Phase 8 also
forbids new shorts (slice 4).

The allowed company sizes are title phase data that the formation rule reads. The
family phase table is not extended.

### Map and tiles

**Map.** The map is the reference's 92-hex pointy layout, counted from its
[map definition][map]:

- **Offboards** with staged revenue: Montréal, Maritime Provinces, Chicago,
  St. Louis, Atlanta and Raleigh-Durham.
- **Printed gray locations:** Toronto, Cleveland and the F1 junction.
- **Printed yellow cities:** Detroit, Boston and Baltimore, labelled B; New York, a
  two-city NY hex.
- **Terrain costs:** mountains $15, water $10, lakes $20.
- **One impassable border**, between C10 and D11.

The mine hexes are listed with the mine privates in slice 7, not marked on the map.

**Tiles.** Every tile is unlimited except X00, which has one copy. 1817 uses the
reference's base definitions of 54, 62 and 63, which are already in the catalog from 1830. Ten tile numbers are not yet in `StandardTileCatalog`: junctions 80, 82, 83,
544, 545 and 546; cities 619 and 592; and B cities 593 and 597.

**Decision.** Add the ten tiles as `18xx:<number>` shared definitions matching the
research's base catalog, following 1830's precedent. X00 (a yellow B city worth $30
with three exits) and X30 (a gray single NY city worth $100 with four slots) are
title tiles in an 1817 `TileCatalog`, as TOP does with its own tiles. Each new face
is checked so that its drawn paths match the logical topology in both orientations.

### Opening: the selection auction with seed money

**Evidence.** In the reference's [selection auction][selection] all privates are
available at once.

- **Nominating.** On their turn, a player either opens an auction on any remaining
  private with a bid, or passes. If every player passes in a row, the unsold privates
  close.
- **Opening bid.** The minimum is the private's value less the remaining seed money,
  and never below $0.
- **Bidding.** Bids rise by multiples of $5, up to the player's cash. Bidding runs
  from the player after the high bidder. A pass withdraws from that auction, and the
  last bidder left wins.
- **Payment.** The winner pays the bid. The seed money falls by the private's value
  less the price paid.
- **After each auction**, nomination resumes with the player after the one who
  opened it.

**Survey.** `selection-auction` appears in 13 titles: the 1817 family, 1837, 1840,
1841, 1862, 18Ardennes, 18Dixie, 18Hiawatha, 18USA and System18. `single-auction`
bid commitment appears in 37. Seed money is not a trait; the `SEED_MONEY` parameter
exists only in the 1817 family and 18Hiawatha, and 18USA sets it to nothing. The
Volatility pyramid (slice 9) limits which lots can be nominated and forbids passing
while nominating. 18Ardennes switches from auction to purchase once every player has
less than 100F, an evidence gap this slice does not address.

**Decision.** The family gains a nomination auction beside the waterfall and offer
pile, built on Common's `SimpleAuction` as they are. Each title supplies:

- the lots;
- the lots a player may nominate (`nominationLotIds`), which Volatility will restrict;
- the opening minimum for a lot (`openingBid`);
- the increment;
- whether passing is allowed while nominating (`passingWhileNominating`);
- what happens to unsold lots when everyone passes;
- `award`, which pays and transfers.

1817's seed money is title state, read by `openingBid` and reduced by `award`. The
family auction has no notion of seed money.

The order after an auction is family behaviour: nomination resumes after the player
who opened it. Volatility's "resume after the winner" becomes an option when slice 9
needs it.

### Company starts in the stock round

**Evidence.** In the reference's [stock step][stock-step], on their turn and before
buying, a player may open an auction for any unstarted company.

- **Opening.** The player names the company, a bid from $100 to $400, and its home:
  any city with an open slot.
- **Bidding power.** The player's cash plus the face value of their privates. It is
  $0 for a player at the certificate limit.
- **Bidding.** Every player bids in turn order, in $5 steps; players who cannot reach
  the minimum drop out. A pass withdraws from that auction, and the last bidder wins.
- **The win** sets the company's price to the highest market space at or below half
  the bid.
- **Settlement:**
    - the winner takes the president's certificate and pays the whole bid into the
      company's treasury;
    - the winner then chooses a size the phase allows;
    - the winner may contribute privates, which the company buys at face value. This
      is how a bid above the winner's cash is paid.
- **Stations.** The company then buys the stations its size needs (1, 2 or 4) at $50
  each from its treasury.
- **Turn.** Opening an auction is the opener's purchase for the turn, and the turn
  ends when the auction is settled.

**Survey.** `corporation-auction` appears in 17 titles, in two groups:

- **The bid becomes the treasury and the starting price derives from it:** the 1817
  family; 1867 and its descendants 1807, 1812 and 1861; 18NY; 18Ireland. 18NY and
  18Ireland cap the starting price.
- **The bid goes to the bank, followed by an ordinary par and subscription:** the 1862
  charter auction, 1877 Stockholm Tramways, System18 Parliament.

`eligible-location-choice` homes appear in 35 titles. The timing differs: chosen when
the company starts (1817), in the operating round (18DE), or at first operation
(1830's Erie, already supported by `StationRules.homeChoice`). `nested-auction`, an
auction inside a stock turn, appears in 22 titles.

**Decisions:**

- **Company auctions are a family stock-round feature.** The stock round holds a
  nested auction in the optional family field `companyAuction`, with the actions
  `AuctionCompany` (company, opening bid, home city), `BidForCompany` and
  `PassCompanyAuction`. `StockRules.companyAuction` is optional, and only titles that
  set it register the actions. It supplies:
    - the bid range and increment;
    - bidding power, and whether a player could form a company at a given price
      (`formable`);
    - the eligible home cities;
    - the start space for a winning bid.

    TOP, 1889 and 1830 keep `StartCompany` and register no new action or machine
    state. Like `pendingPar` in 1830's slice 4, the new optional family fields
    (`companyAuction`, `selectionAuction`) appear in every title's state schema but
    are only written by titles that use them.

- **Settlement is one decision.** The winner answers with `FormCompany`, choosing a
  size and the privates to contribute. It settles atomically:
    1. the winner pays the bid;
    2. the company pays the contributed privates' face value;
    3. the size's certificates are issued;
    4. the home station is placed;
    5. the extra stations are bought.

    The winner's cash may not end below $0. It is applied automatically when the phase
    allows one size and none of the winner's privates could be contributed toward the
    price, as in the reference. This replaces the reference's temporary negative cash
    with one validated settlement, with the same outcomes.

- **Every bid can form a company.** A bid is accepted only at an amount the bidder
  could pay and form a company with in the current phase, so a won auction always has
  a valid formation.

- **The home is placed at settlement, not when the auction opens.** No other map
  change can happen between the two, because the auction completes within the
  opener's turn, so the result is the same as the reference's.
- **Stations are added when bought.** A company starts with one station. Formation
  and conversion add stations as they are bought, up to the reference's limit of 8.
- **Flotation and capital.** The company floats when the auction is settled; there
  are no flotation payments. Later treasury shares are sold at the current price
  into the treasury, through the family's treasury pool and purchase terms.

**Limit until slice 3:** the reference lets a company short of station money take
loans before the round ends, or be liquidated. Without loans, a size or contribution
that leaves the treasury unable to buy its stations is refused, and so is a bid at
which no formation could pay for its stations (for example under $150 in phases 6–8,
where companies have 10 shares).

### Stock-round share rules

| Rule             | 1817                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Turn order       | `sell-buy`: any sales come before the turn's single purchase, short or auction                                                                         |
| Repeat sales     | `separate`; selling never moves the price, so the policy only matters for presidency changes                                                           |
| Sell eligibility | Only once the company has operated                                                                                                                     |
| Rebuying         | A company sold this round cannot be bought again this round (family behaviour)                                                                         |
| Purchases        | One share per turn, from the treasury or the market, at the current price                                                                              |
| Market pool      | Unlimited; sales go to the market at the current price, with no movement                                                                               |
| Holding limits   | 100% for a 2-share company, 60% otherwise                                                                                                              |
| Over a limit     | The player may only sell (family behaviour)                                                                                                            |
| End of round     | A company with more than two shares, whose players hold all of them, moves up one. Then each company moves down one space per share in the market pool |
| Next round       | Priority goes to the player after the last to act                                                                                                      |

**Survey of the end-of-round market drop.** The reference's `POOL_SHARE_DROP` is set
in 10 titles:

- one space per pool share: only 1817;
- one space if any shares are in the pool: 1841, 1846, 1849, 1862 USA-Canada,
  18Ardennes, 21Moon;
- one space left per block: 1844, 1854, 18Norway.

Every other title drops nothing at the end of the round.

**Decision.** `StockRoundRules` gains an optional `poolDrop(state, companyId)`. It
returns the number of down moves at round end, applied after the sold-out move.
TOP, 1889 and 1830 do not set it.

The Short Squeeze option's second move belongs to slice 4.

### Operating rounds in slice 1

Slice 1 configures the existing family hooks, so that companies can operate:

- **Order:** companies operate by market order.
- **Track allowance:**
    - two lays a turn, of which at most one is an upgrade;
    - the second lay costs $20 and may not be on the hex of the first;
    - terrain from the map;
    - semi-restrictive usefulness, like 1889: a lay must add track or raise a city's
      revenue.
- **Stations:** one placement per turn, at no cost.
- **Dividends:** pay, half or withhold.
    - Half pay retains half the revenue, rounded down to a multiple of the share
      count.
    - Price moves come from the amount distributed: nothing moves it down one;
      at least the share price moves it up one; at least twice the price, up two.
    - In the acquisition zone, the comparison uses $40.
- **Trains:** no obligation to own one. A company may buy from the depot or from
  another company through the family's purchase offer.
- **Ending:** none yet. The 8-train ending comes with exports in slice 2.

The turn's earlier lays are already in `trackStep.lays`, each with its hex and tile
colour, as TOP's two-lay allowance uses them. In 1817 every upgrade is green or
later and every new lay is yellow, so `allowance` tells upgrades apart by colour.
`restriction` refuses a second lay on the first lay's hex. No hook changes.

### Implementation notes for slice 1

Decisions made while implementing, beyond the design above:

- **The company auction lives inside the stock round.** While `companyAuction`
  stands, the stock round accepts only `BidForCompany`, `PassCompanyAuction` and
  `FormCompany`, and makes the current bidder or the winner the active player. Every
  stock-round wrapper keeps working, and the opener's turn ends as soon as the company
  is formed.
- **The selection auction is one machine state,** `SelectionAuction`, with the
  optional family field `selectionAuction` and the actions `NominateLot`, `BidForLot`,
  `PassSelectionAuction` and the system `ResolveSelectionAuction`. As in the
  reference, players who have passed are skipped until a lot is sold. The player who
  would nominate next has priority in the first stock round. 1817 nominates from every
  remaining lot and allows passing; Volatility (slice 9) will change both.
  `ResolveSelectionAuction` records its outcome in its metadata, which history reads.
- **The formation choices come from the rules.** `CompanyAuctionRules` names the
  share counts allowed now (`shareCounts`) and the privates the winner may contribute
  toward the price (`contributions`). The family applies the formation without a
  decision when there is one size and nothing to contribute.
- **Seed money is optional state.** Prepared positions after the opening have none.
- **Standing stock instructions wait** while another player decides during the turn,
  such as bidding for a company.
- **A 2-share company is paid as one dividend unit.** Its single certificate takes
  the whole distribution, so half pay is exact, as in the reference.
- **New York's gray tile joins its two cities.** 1817's `preservesStops` accepts the
  NY-labelled upgrade from two cities to one.
- **Lakes are their own terrain kind,** apart from rivers, which the bridge privates
  will discount in slice 7. The map draws them with their own symbol.
- **Board.** The [18xx design rule](../../docs/agents/18xx-design.md) requires every
  title's map view to declare `boardAreas`, so the board layout comes with slice 1
  rather than the title UI slice. The one-row market runs below the map, at TOP's
  market scale, and the depot sits in the map's empty lower-right corner. A playground
  test keeps both clear of every hex.
- **Shared presentation.** 1817's light company colours made white token labels
  unreadable, so a token's label takes a contrasting colour and four-letter labels
  shrink to fit. TOP, 1889 and 1830 draw their tokens with artwork, so only tokens
  without artwork change. The selection auction needed its own lot table and bidding
  card in the shared UI to be playable.
- **Playground.** The example host validates saved games with the title's canonical
  schema rather than the family's, so title fields such as seed money load.

### Intentional limits after slice 1

- **No train exports.** Phases advance only on purchases (slice 2).
- **Route and upgrade rules.** A route may visit a hex twice, and city upgrades need
  not keep the most exits (slice 2).
- **No ending.** The game does not end on the 8-train (slice 2) or on bankruptcy
  (slice 3).
- **No debt or failure.** There are no loans, interest, liquidation or player cash
  crisis. A company without a train earns nothing but keeps operating (slice 3).
- **Station money.** A formation that cannot pay for its stations is refused
  rather than allowed to borrow (slice 3).
- **No shorts** (slice 4).
- **No merger or acquisition rounds.** A company in the acquisition zone keeps
  operating (slices 5 and 6).
- **Privates have no powers** (slice 7). Players keep any private they do not
  contribute.
- **No title UI.** The shared table shows both auctions through its generic panels;
  title prompts and presentation come in slice 10.
- **Playground positions.** The shared positions that 1817 cannot yet reach, such as
  bankruptcy, private purchases and negotiated purchases, open on the generic
  1817 company fixture.

### Acceptance examples

- Opening positions for 3 to 12 players match the reference's starting cash and
  certificate limits, with an unlimited bank.
- The tile library lists 1817's 26 tiles, and the ten new catalog faces and the two
  title tiles render correctly in both orientations.
- The boardless map draws all 92 hexes in pointy orientation, with the offboards,
  the printed B and NY cities, terrain costs and the C10–D11 border.
- In the opening, a $30 private can be bought for $0 while $200 of seed money
  remains, and the seed money falls by $30. When every player passes in a row, the
  unsold privates close.
- A player auctions a company for $100 at Pittsburgh and wins:
    - the company starts at $50 with $100 in its treasury;
    - it has one 100% certificate and a station at Pittsburgh.
- In phase 3, a $250 winner chooses 5 shares:
    - the price is $120;
    - three 1-share certificates go to the treasury;
    - one extra station costs $50, leaving the treasury $200.
- A $300 bid paid with $200 cash and a $90 and a $40 private (bidding power $330):
    - the company holds both privates;
    - the company pays the winner $130;
    - the winner ends with $30.
- Selling a share leaves the price unchanged. At round end, the company moves down
  one space per share in the market pool.
- A company withholding its revenue moves down one space; one paying at least twice
  its price moves up two.
- A company lays two yellow tiles in one turn, paying $20 for the second, but cannot
  lay two upgrades.

## Slice 2 design: operating rules

Slice 2 adds the four operating rules slice 1 left out: train exports after each
operating round, the route limit of one stop per hex, city upgrades with the most
exits, and the ending after the first 8-train.

### Evidence

- **Exports.** After every OR the reference [game] exports the next depot train. If
  that train is a 2, every remaining 2 is exported together. An export starts a phase
  exactly as a purchase does, so it can rust and obsolete trains and lower the train
  limit. Obsolete trains still count toward the limit
  (`OBSOLETE_TRAINS_COUNT_FOR_LIMIT = true`).
- **Discards.** Companies over the limit discard one at a time in corporation-list
  order (`crowded_corps`), whether a purchase or an export lowered the limit; the
  buyer is not put first. After an export the reference resolves them in the
  following merger round.
- **One stop per hex.** The reference rejects a route whose stops' hexes repeat
  (`route.hexes`, the hexes of its revenue centers). A route can therefore stop at
  only one of New York's two cities.
- **Most exits.** `TILE_UPGRADES_MUST_USE_MAX_EXITS = [:cities]`: on a hex with a
  city, of the tiles with a legal placement, only those of each colour with the most
  exits are offered. For 1817 a brown city upgrade must use #63 when it fits, else
  #611, else #448.
- **Ending.** The first 8-train, bought or exported, ends the game after one more
  full set. That set has 3 ORs if the 8 came in the second OR of a set, otherwise 2.

### Survey

- **Exports** (`automatic-export`, 37 profiles). They export at the end of each OR
  (the 1817 family, 1867, 18GB unless a train was bought that round) or at the end of
  a set (18Chesapeake, 1824, 18CZ, 1844, 1888), often only while the next train is of
  certain ranks. 18USA exports several ranks by turn.
- **Hex re-entry** (`hex-reentry-forbidden`, 29 profiles): the 1817 family, the 1822
  family, 1812, 1826, 1860, 1861, 1866, 1867, 1873, 1877, 18FL, 18FR, 18Hiawatha and
  18USA.
- **Most exits**: `[:cities]` in 1817, 1822, 1858, 1867 and 1880;
  `[:cities, :track]` and `[:unlabeled_cities]` in one title each.
- **Ending** (`additional-operating-set`, 31 profiles; `technology-event` triggers,
  26). 1817 is the only one whose final set length depends on when the trigger
  came.

### Decisions

- **Exports are an operating rule.** `OperatingRules.trainsToExport` names the kinds
  of the depot trains to export, in order, when an operating round ends. A title that
  exports at the end of a set returns none until its last round, so one hook covers
  both timings and every rank or purchase condition. The family exports them with a
  system `ExportTrains` after the round's last company and before the next round or
  stock round, and records the round in the operating set (`exportedRound`,
  optional). The depot removes each exported train, minting it first when its supply
  is unlimited, as for the 8s; the latest phase they start begins as after a
  purchase.
- **A phase change can happen between rounds.** The phase change's continuation no
  longer needs an operating company. Trains over the new limit are discarded in the
  title's `discardOrder`, which now accepts no starting company, and play returns to
  the operating set. Until merger rounds exist (slices 5 and 6) they are resolved
  straight after the export. 1817 discards in corporation order, replacing slice 1's
  market order with the operating company first.
- **One stop per hex is a route rule.** `RouteRules.oneStopPerHex` rejects a route
  with two revenue centers in one hex. The autorouter encodes each such hex as an
  exclusive stop group, as it already does for named stop groups.
- **Most exits is a track rule.** `TrackRules.mostExits(before)` names the hexes it
  applies to; 1817 names hexes with a city. Track construction refuses a tile when
  another tile of the same colour with more exits has a legal placement there.
- **The final set's length is part of the ending.** `GameEnding` gains an optional
  `finalOperatingRounds`. 1817's trigger fires when the first 8-train leaves the
  depot and names the next set as final, with 3 rounds after a second-round 8 and 2
  otherwise. The family's operating-set start uses that number for the final set in
  place of the title's round count, so the ending rules see train state.

All new fields are optional, and TOP, 1889 and 1830 set none of the new rules.
Their runtime contracts still change: the schemas of `ScheduleGameEnd`,
`StartOperatingSet` and `StartOperatingRound` gain the optional fields, and a phase
change's `continuation.companyId` becomes optional. Stored games stay valid, and their
UI artifacts need republishing only to adopt the new family code.

### Implementation notes for slice 2

- `ExportTrains` records the exported trains and any phase they started. History
  shows it as an "Exported" row; a phase change it starts names no company to
  resume.
- `discardOrder(state, companyId)` takes an optional company. 1830, 1889 and TOP
  share `marketDiscardOrder`, which puts that company first and then follows the
  market.
- Most exits compares each colour's tiles that could legally replace the current
  tile, so where a #63 would run off the map (C14) #611 is offered, and where
  neither fits (B5) #448.

### Limits after slice 2

- The ending checks run after the final set's last OR; with no merger rounds yet
  (slices 5 and 6) there is nothing after it. The game therefore ends before that
  OR's export, which the reference still makes; as the next train is always an 8,
  nothing visible differs.
- The game still cannot end by bankruptcy (slice 3).

### Acceptance examples

- After the first OR every remaining 2-train is exported. After a later OR the next
  train is exported; exporting the first 4 starts phase 4, rusts the 2s, obsoletes
  the 2+s and makes companies over the new limit discard.
- A route through both New York cities is rejected, and the autorouter never offers
  one.
- On a brown city upgrade where #63 fits, #611 and #448 are not offered; where it
  would run off the map, #611 is.
- Companies over a lowered limit discard in corporation order, not market order.
- An 8-train bought in the first OR of set 5 makes set 6 final with 2 ORs; one
  exported after the second OR makes it final with 3. The game ends after that set.

## Slice 3 design: loans, interest and liquidation

Slice 3 gives 1817 its debt and failure: corporate loans, the interest rate, interest
with automatic loans, the stock-round corporate action, liquidation, the player's cash
crisis, bankruptcy and the bankruptcy ending. It is delivered in two parts:

- **3a, loans and liquidation:** loans and repayments, the rate, interest, the
  stock-round corporate action, stations owed at formation, and liquidation for a
  missing train, unpaid stations or unpaid interest.
- **3b, cash crisis and bankruptcy:** a president who cannot pay a liquidated
  company's interest sells shares or goes bankrupt; bankrupt players leave the game,
  which ends when one player remains.

### Evidence

- **Loans** ([game], [loan-step]). A loan is $100. A company may hold as many loans
  as it has shares (2, 5 or 10). The bank has 70. Taking a loan moves the price one
  space left, never into the liquidation space; repaying one moves it right.
- **Rate.** 5% per 5 loans outstanding in the game, rounded up: 0–5 loans 5%, 6–10
  10%, up to 70%. It is fixed when each operating round starts and floats during the
  stock round. A company owes the rate × its loans, in dollars.
- **Operating turn.** A company may take loans at any point of its turn until it has
  paid interest. Interest is paid after its trains, from its treasury; if the treasury
  is short it takes loans automatically, each moving the price and adding to what is
  owed. Then the president may repay loans ($100 each), or take more; a loan taken
  then ends the repayments. Unable to pay even after borrowing to its limit, the
  company is liquidated: its cash goes to the president, who owes the interest.
- **Stock-round corporate action** ([stock-step]). Instead of acting for themselves, a
  player may act for one company they preside: take loans, then buy back shares from
  the market at the current price with its treasury cash. Buy-backs do not move the
  price and are refused in the acquisition and liquidation zones. The corporate
  action is the player's action for the turn.
- **Stations owed at formation.** A 5-share company needs 2 stations and a 10-share
  company 4, at $50 each beyond the first. A company that cannot pay at formation owes
  them; it buys them as soon as its treasury can, after sales of its shares or its
  loans. A company still owing at the end of the stock round is liquidated.
- **Missing train.** A company without a train at the end of its turn is liquidated.
- **Liquidation.** The price moves to the liquidation space. The company stops
  operating, its shares cannot be sold or bought back, its trains cannot be bought,
  and it keeps its loans and president. The acquisition round then sells or closes it
  (slice 6).
- **Cash crisis and bankruptcy** ([operating-round], [cash-crisis], [bankrupt]). In
  this slice only unpaid interest can leave a player owing money (shorts add
  dividends in slice 4, acquisitions settle debts in slice 6). The player sells
  shares, only as many as needed, never in the acquisition or liquidation zones nor
  giving away a presidency, at no price drop. A player may declare bankruptcy instead:
  their shares go to the market, their companies are liquidated, the bank absorbs
  the debt, and the certificate limit is recalculated for the remaining players.
  The game ends at once when one player remains.

### Survey

- **Loans** (`borrowing-parties`): 22 of 131 titles have corporate loans: the 1817
  family (8), the 1867 family (4), 1856 (3), 18NY (2), 1866, 18Uruguay, 1848 and the
  1849 bond. 27 titles have player loans only, and 82 none.
    - **Value:** 100, but 50 in the 1867 family and 18NY, and 500 for the 1849 bond.
    - **Limit:** the share count in the 1817 family and 1866; player-held shares in
      1856, 18NY and 18Uruguay; by company type in the 1867 family; 1 in 1849; and a
      lender other than the bank in 1848 (the Bank of England, 20 loans).
    - **Interest:** a game-wide variable rate in the 1817 family; a fixed amount per
      loan elsewhere (10% in 1856, 20% in 1866, none in 1848). It is paid after
      trains (1817, 1866), after dividends (1867, 18NY), after routes (1856) or at
      the end of the round (18Uruguay).
    - **Price:** one step left in 1817, 18NY and 1849, two in 18USA and 1848, none in
      1856 and 1867. 1867 pays out 45 for a 50 loan.
    - **Automatic loans:** for interest in the 1817 and 1867 families and 18Uruguay;
      for track and trains in 1867, 1812 and 18NY.
    - **Repayment:** optional after interest in 1817 and 1866; automatic in 1867 and
      18NY; one take or repay a turn in 1856.
- **Failure:** liquidation in the 1817 family, receivership in 11 titles,
  nationalization or closure in 16.
- **Bankruptcy:** ends the game in 45 titles, including 1856; eliminates the player
  until one remains in 29, including the 1817 family, 18NY, 1846 and 1849.
  Obligations that can force a player's sale include train purchases (common),
  interest (1817, 1856, 1849, 1866), forced repayment (1856), shorts and
  liquidation debts (1817) and merger shortfalls (1844, 18Dixie).

### Decisions

- **A loan count on the company.** `Company.loans` (optional) counts its loans; every
  surveyed title's loans are interchangeable, and a count travels with the company
  through a merger. 1848's second lender is a recorded limit.
- **`LoanRules` is title policy:** the loan value, a company's limit, the loans left
  in the bank, the rate for the round about to start, and the price move for taking
  and repaying. Interest owed is the fixed rate × loans × value / 100, which covers
  1817, 1856, 1866 and the 1867 family. 1817's rate needs the game's loans, so the
  rate is fixed in the family field `interestRate` when each operating round starts
  and cleared when a stock round starts.
- **Actions.** `TakeLoan` and `RepayLoan` name the company and record their payment
  and price move. The state handlers say when they are allowed, as with every other
  action. The system `PayInterest` records the interest, the automatic loans and
  any default.
- **Loans in the operating turn.** For a title with loans, every operating step
  accepts `TakeLoan` until interest is paid, and the turn gains a last step,
  `RepayingLoans`, after `BuyingTrains`:
    - `BuyingTrains` then ends with the new `FinishTrains` rather than
      `FinishOperatingTurn`;
    - on entering `RepayingLoans`, `PayInterest` settles interest, taking loans
      automatically while the treasury is short;
    - the president then repays, borrows (which ends repaying) or finishes the turn,
      and the turn finishes automatically when nothing else is possible.

    The step strip shows Loans as the turn's sixth step for such titles. Other
    timings (1867, 1856) would choose where interest falls; that is left until a
    title needs it.

- **Liquidation is a 1817 action.** `LiquidateCompany` names the company and the
  reason, and moves its price to the liquidation space. The market space is the
  liquidated state: 1817's sales already refuse the zone, and its operating order,
  buy-backs and train sales read it too. It is issued by the system:
    - at the end of the turn of a company without a train;
    - at the end of the stock round for a company still owing stations;
    - by interest default, which `LoanRules.interestDefault` hands to the title.
- **Stations owed.** Formation no longer refuses a company that cannot pay for its
  stations; the system `BuyOwedStations` buys them when its treasury can.
- **The corporate action wraps 1817's stock round**, as TOP's company split does. The
  player's turn accepts `TakeLoan` for one company they preside, then the 1817 action
  `BuyBackShares`, after which only finishing the turn remains.
- **Cash crisis (3b).** The interest default leaves the president owing the bank. A
  family `cashCrisis` (player and amount) and machine state `RaisingCash` accept
  share sales within the title's crisis terms, or bankruptcy at any time, as in the
  reference. The train-funding flow of 1830 and 1889 stays separate: its obligation is
  a purchase with contributors, not a debt.
- **Bankruptcy (3b).** `bankruptPlayerIds` records players who have left. Stock
  rounds skip them and the title recalculates the certificate limit; final scoring
  still ranks them, as the reference does. `EndingRules.trigger` ends 1817 when one player remains; 1830 and 1889 keep
  ending at the first bankruptcy.

### Implementation notes for 3a

- **Stations owed are derived, not stored.** A company that has not operated owes its
  size's stations less those it holds, as the reference counts them. Formation accepts
  privates up to the whole bid and buys the stations only when it can pay for all of
  them. The stock round issues `BuyOwedStations` as soon as a company can pay, and the
  operating set's start buys any still affordable before liquidating the rest.
- **The missing-train liquidation runs between companies,** before the round's
  exports, which can rust the last company's trains after its turn has ended.
- **The train step waits while the company may borrow.** The reference waits only
  when borrowing could buy a train; here the president finishes the step whenever a
  loan is still possible.
- **A defaulting president pays what they have,** and `PayInterest` records the
  unpaid rest as their cash crisis (3b).
- **Family fixes.** The automatic stock-turn finish waits for actions already queued,
  so a title's system action in the stock round is not overtaken by a second finish.
  Prepared operating positions fix the rate for titles with loans.
- **UI.** Loans are shown and taken from the step strip, and the Loans step has its
  own panel. 1817's corporate actions sit above the stock actions as immediate
  buttons; the title UI (slice 10) will refine both.

### Implementation notes for 3b

- **The crisis is family state.** `cashCrisis` names the player, the amount and the
  machine state to return to; `RaisingCash` accepts `SellSharesToPay` and
  `GoBankrupt`. A sale is refused when one share fewer would still cover the debt or
  when it would pass on a presidency. Proceeds pay the debt at once and any rest
  stays with the player. In an operating round, where every crisis arises in this
  slice, a company that has not yet operated may be sold; the acquisition round
  (slice 6) will need the ordinary timing.
- **Bankruptcy.** The title's `CashCrisisRules.bankrupt` puts every share the player
  holds in the market and liquidates the companies they preside, leaving them without
  a president and out of the round's remaining order. The reference first sells what
  the crisis rules allow, but those sales can neither pass a presidency nor exceed the
  debt, and the bank takes their proceeds, so the outcome is the same. The family then takes the player's cash, forgives the debt, adds
  them to `bankruptPlayerIds` and removes them from the turn order, which every stock
  round, auction and presidency already follows. A company left without a president
  has its turn ended for it. 1817's certificate limit uses the players left, but never
  fewer than three players' limit, as the reference keeps the last defined limit.
- **History.** The table now lists system events that change no company's cash:
  exports (slice 2's row never showed), interest, and title-described actions such as
  liquidation.
- **Playground.** 1817's bankruptcy position is its own: Boston & Albany at its loan
  limit with nothing to pay interest, and a president without cash.

### Limits after slice 3

- Loans taken after conversion or during acquisitions, and loans moving with a
  merger, come with slices 5 and 6.
- Liquidated companies stay in the liquidation space until the acquisition round
  (slice 6).
- The Loan Shark private's extra interest comes with Volatility (slice 9).

### Acceptance examples

- With 7 loans taken in the game the rate fixed for the next round is 10%; a company
  holding 3 loans owes $30.
- Taking a loan in the operating round pays $100 and moves the price one space left;
  a company with 5 shares cannot take a sixth.
- A company that cannot pay its interest borrows until it can; one at its limit that
  still cannot is liquidated and its president pays.
- After interest the president repays two loans, then takes one and cannot repay
  again.
- A company that ends its turn without a train moves to the liquidation space and is
  skipped in later rounds.
- A 10-share company formed for $100 owes 3 stations ($150). A treasury share bought
  by a player gives it the cash, and it buys them at once. One that never can is
  liquidated when the stock round ends.
- A player buys back two market shares for their company with its treasury cash and
  cannot then buy shares themselves.
- (3b) A president who cannot pay sells only enough shares; one who cannot raise it
  goes bankrupt, their companies are liquidated, and with one player left the game
  ends.

[game]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/game.rb
[meta]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/meta.rb
[entities]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/entities.rb
[map]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/map.rb
[steps]: https://github.com/tobymao/18xx/tree/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/step
[rounds]: https://github.com/tobymao/18xx/tree/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/round
[selection]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/step/selection_auction.rb
[stock-step]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/step/buy_sell_par_shares.rb
[loan-step]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/step/loan.rb
[operating-round]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/round/operating.rb
[cash-crisis]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/step/cash_crisis.rb
[bankrupt]: https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1817/step/bankrupt.rb

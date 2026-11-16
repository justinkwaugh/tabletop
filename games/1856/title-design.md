# 1856 — title design

Rules authority: the Mayfair rulebook. Its two texts are the v2.2d web PDF (June 1994) and the
1995 printed rewrite, both saved with text copies in `/workspace/artassets/1856`
(`rulebook-v2.2d-mayfair-online/`, `rulebook-1995-printed-transcript/`). Where they differ, the
1995 text is followed unless the designer, Bill Dixon, has ruled otherwise. His rulings come from
the 18xx mailing list and Steve Thomas's 1999 clarifications, which he helped write. They are
collected with their sources in `/workspace/artassets/1856/rulings.md`, alongside all 219 BGG
threads (thing 423). Dixon never posted on BGG. Section names below are the rulebook's. The
research engine (`g_1856`) supplied hex coordinates, terrain and track layouts, checked against
the rulebook's tile manifest and upgrade list.

Scope: the whole game for 3–6 players, with the Alternate Destinations and 8-train variants as
game options.

## What makes 1856 different

| Mechanism                                                                                                                                                                           | Rulebook                                    | How                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Capitalization fixed by the train on sale as the president's certificate is bought: escrow (2s–4s), incremental (5s), full (6s, Diesels: 10× par at the sixth share)                | Public Company Starting Treasury            | `funding` in title state; `purchaseTerms`/`startTerms` choose the recipient; `afterSharePurchase` records escrow; `CapitalizeCompany` |
| Escrow released when track joins home to destination, ignoring distance and other stations; any company's tile can do it                                                            | Public Company Starting Treasury, Variants  | `ReachDestination` system action after every lay, family `reachRoutes` with nothing blocked                                           |
| A company operates for the first time only with as many shares sold as the train on sale (Diesel = 6), tested at its turn                                                           | Initial Shares Needed to Operate            | Family `FloatCompany` issued between companies; `PassOverCompany` for one that fell short in the round                                |
| Pool shares pay the company, IPO shares the bank                                                                                                                                    | Declare Dividends                           | Family pay-or-withhold pools                                                                                                          |
| $100 loans, one an operating round, up to the shares players hold, until the 6s; $10 interest after the run, before dividends; a loan after interest pays $90                       | Government Loans                            | Family loans with the new `interestBeforeEarnings` and `loansPerTurn`                                                                 |
| Interest the treasury cannot pay in $10s comes off the run, then from the president, who may have to sell shares                                                                    | Pay Interest                                | `interestDefault` with the new `fromRevenue`; family cash crisis                                                                      |
| Loans beyond the shares players hold are redeemed at the end of the turn, the president paying the shortfall                                                                        | Redeem Government Loans                     | `RedeemExcessLoans` at the loan step                                                                                                  |
| Waterloo & Saugeen: #59 in Kitchener and/or a free station there, each in place of the company's own, without a route; closes as the round ends                                     | Private Companies                           | Private track terms (`countsAsOrdinaryLay`) and token terms; `CloseWaterloo`                                                          |
| Canada Company: a free extra lay in its hex                                                                                                                                         | Private Companies                           | Private track terms                                                                                                                   |
| Great Lakes Shipping: +$20 port token on a reachable anchor city, closes the private, removed at the first 6                                                                        | Private Companies; designer                 | Family private marker on one stop; `port` names the company paid                                                                      |
| Bridge and tunnel: +$10 to Buffalo / Sarnia for the owning company; others buy the right for $50 from it, or from the bank once closed, never while a player owns it; three of each | Private Companies; designer                 | Family access rights, with the new seller `recipient`                                                                                 |
| CGR formation after the first 6-train's buyer's turn                                                                                                                                | Canadian Government Railway                 | `FormingNational` title state                                                                                                         |
| CGR price frozen and earnings withheld until its first permanent train; borrows a Diesel while trainless; buys only permanent trains at face value; limit 3; never closes           | CGR Trains, Off Market                      | Title train, earnings and sale rules; `BorrowTrain`, `ReturnBorrowedTrain`, `NoteNationalPermanentTrain`                              |
| A 20-share CGR when the exchange needs more than ten shares: 5% shares, half a certificate each                                                                                     | Share Exchange, CGR Share Limits            | `shareCount` 20 on the company; `certificateWeight`; `holderDividend`                                                                 |
| Certificate limit by companies left, fixed once the CGR forms or fails to                                                                                                           | Share and Certificate Limits; designer 2021 | `certificateLimitCompanies`                                                                                                           |
| Shares count $10 less for each loan their company owes at the end                                                                                                                   | Winning                                     | `EndingRules1856.certificateItems`                                                                                                    |
| Small cities up- or downgraded from the 6s; #125 only on L hexes; Hamilton brown to #123                                                                                            | Tiles and Upgrades                          | Track rules (see `track.ts`)                                                                                                          |

## Family additions

Surveyed against the research catalogue (`/workspace/research/18xx-2026-09-08`): the loans,
financing and nationalisation entries of the domain study and variation catalogue. 1836jr56 and
18KA reuse 1856's loans and national formation; 1817, 1849, 1861 and Railheads use the family
loans already.

- **Interest before earnings** (`LoanRules.interestBeforeEarnings`). The family charged interest
  as the loan step began, borrowing for it (1817, 1849). 1856 charges it after the run and
  before dividends, borrows nothing for it, and lets its default take part of the run's revenue
  (`InterestDefault.fromRevenue`, recorded in the new optional `turnInterest` state field and
  read through the new `EarningsRules.revenueDeduction`; `EarningsDetails.deducted` records it).
  The runtime issues `PayInterest` as earnings begin; the loan step then neither charges interest
  nor lends. A loan taken after the run pays its interest at once ($90).
- **Loans a turn** (`LoanRules.loansPerTurn`), counted in the existing `turnLoans`.
- **An access right's seller** (`AccessRightTerms.recipient`): the bank unless given; 1856 pays the
  company owning the bridge or tunnel private.
- `reachRoutes` is exported for title use.
- **A private marker on one stop** (`PrivateMarkerTerms.stops`, `PlacePrivateMarker.nodeId`,
  `LocationMarker.nodeId`): the port goes on one small city of a pair.
- **A president-funded purchase** (`TrainPurchaseStep.funded`), so a title can end train buying
  after it.
- **What a bankruptcy settles** (`EliminationRules.eliminate`'s `settling`: the crisis debt and
  where play would resume), so 1856 can leave unredeemed loans on their company.
- **A turn's purchases kept for a title's rules** (`StockRules.recordsTurnPurchases`): the
  family's `stockTurnPurchases`, cleared as each turn ends, for 1856's rule that a share bought
  this turn is kept while selling others of its company.
- **A bank that breaks on a shortfall** (`Bank.breaksOnShortfall`): broken by the first payout it
  cannot make in full, not by reaching exactly $0 (Dixon).

Every other 18xx title's runtime-contract fixture changes additively: `turnInterest`,
`EarningsDetails.deducted`, `InterestDefault.fromRevenue`, `TrainPurchaseStep.funded`,
`Bank.breaksOnShortfall`, the marker `nodeId`s, and the `DistributeEarnings`, `PayInterest` and
private-marker digests.

## Rulings and decisions

1. **Interest on a loan taken this round** is charged (1995; the v2.2d exemption was dropped): a
   loan before the interest step pays $10 there, one after it gives $90.
2. **The president pays interest in whole $10s** (ST-FAQ p18).
3. **One loan a round**, never in the redemption step, none from the first 6-train.
4. **A certificate bought this turn**: shares of that company may be sold if one is kept (Dixon,
   ST-FAQ p12, against the printed p12).
5. **No half certificate over the limit** (Dixon 2021).
6. **The certificate limit is set once** as the CGR forms or fails to form, counting surviving and
   unstarted companies and the CGR (Dixon 2021). 18xx.games misses the non-formation case.
7. **CGR loan repayment**: treasuries repay in $100s first; a president may add the rest from
   cash, the treasury's remainder counted (1995), never by selling shares. A company whose
   president cannot is absorbed without a decision.
8. **CGR price**: the nearest top-row space right of $100 to the average, rounded down to $5
   first; $105 gives $110.
9. **CGR presidency**: the most CGR shares, the first from the 6's buyer going left; a president on
   one share buys the second as their first action in the next stock round, selling if they must,
   and gets no dividend on the missing share until then (1995). Another player buying a second
   share first takes the presidency, their share completing the certificate.
10. **CGR open market over 50%** (Dixon 2021): in the next stock round each CGR holder buys an
    open-market CGR share on their turn while too many remain, and no initial-offering CGR share
    may be bought until then. A holder short of cash sells first or buys at once
    (`BuyNationalMarketShare`) and raises the rest in a cash crisis; one who cannot is bankrupt.
    Dixon left open the certificate limit: a holder who could not legally buy the share, cash
    aside, owes none.
11. **CGR stations**: homes first; one per tile; every station that can be kept must be; the
    president chooses only where there is a choice.
12. **CGR trains**: permanent trains kept up to three, 4-trains optional. It borrows a Diesel (or 8) before running whenever it has no train and has never owned a permanent one; it may not
    refuse (Dixon). It must buy a permanent train once it has $1,100, or $750 with a 4 to trade in
    ("at least", ST-FAQ p24); its president never pays.
13. **CGR dividends** are withheld until it has owned a permanent train (printed rules, ST-FAQ).
14. **Escrow** counts as bank money and is lost if the company joins the CGR (Dixon).
15. **Port token**: only a city or town the company can reach, never a red area (Dixon 2000).
16. **Bridge/tunnel rights**: three of each including the owner's (Dixon); the buyer must reach
    Buffalo or Sarnia (Dixon 2000); the owner cannot refuse.
17. **Waterloo & Saugeen station**: one of the company's own markers, so one must be left; it may
    go on bare Kitchener (Dixon).
18. **Home station placed as the company first operates** (Dixon 2020). In a bare Hamilton the
    THB's station goes in a city at once and the company laying the first tile there chooses
    which city it ends in, through the lay's node mapping (by Dixon's Waterloo & Saugeen ruling
    for a bare Kitchener; as 18xx.games). Once Hamilton has track, the THB chooses between its
    open cities.
19. **Forced redemption ending in bankruptcy**: loans are redeemed one $100 at a time as money
    arrives (Dixon 2021). The bankruptcy leaves the unredeemed loans on the company, with what
    fell short of another loan in its treasury.
20. **Port on a double small city**: on one small city, the placer's choice ("any one city").
21. **A train the president helped pay for** is the turn's last, even after a loan (Dixon).
22. **Selling the train-buying company into Closed**: the company closes, no train is bought,
    and the president loses what they held toward the train, keeping only cash beyond its price
    (Dixon, 18xx list 4198, 14251).
23. **Full capitalization**: ten times par as the sixth initial-offering share is sold (1995;
    v2.2d paid it at the first operating round).
24. **Private sales between players** in any stock round, the initial one included (1995).
25. **Bank break**: at the first payout the bank cannot make in full; exactly $0 is not broken
    (Dixon 2014).
26. **Share sales raising a debt** in an operating round reorder the companies yet to operate.

## Owner decisions

- **#43 from #28/#29** is allowed (the family's geometric upgrades, as 18xx.games). The upgrade
  list omits it and Dixon did not know if the omission was deliberate.
- **The CGR's $750 trade-up** is compulsory (ST-FAQ, BGG consensus); Steve Thomas 2002 and
  Puddifoot say only at $1,100.
- **Otherwise the designer's rulings are followed**, with no simplification that changes play.

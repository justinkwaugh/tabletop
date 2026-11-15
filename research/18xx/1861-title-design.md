# 1861: The Railways of the Russian Empire — title design

Rules authority: _1861 The Railways of the Russian Empire, Rules of Play_ v2.0 (Ian D Wilson,
9 January 2012), saved with text copies in `/workspace/artassets/1861` (`rules.txt` keeps the
two-column layout, `rules-flow.txt` the reading order). Section numbers below are the rulebook's.
The research engine (`g_1861` on `g_1867`) supplied hex coordinates, terrain, tile track layouts
and counts, the grid market's cells and certificate limits, checked against the rulebook; where
the two differ the rulebook wins and the difference is listed under "Data notes" in the data
files.

Scope: the base game for 2–6 players, with the Grand Trunk edition's optional rules as game
options (see "Grand Trunk edition and the designer's rulings"). Not built: the column market and
the 1861S short games.

## What makes 1861 different

| Mechanism                                                                                   | Rulebook        | Family support                                                                                                     |
| ------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Privates auctioned in order at the first stock round's start; all pass lowers the next by 5 | §9.4            | Selection auction with a single nominable lot and an all-pass discount (new `allPass`)                             |
| Nikolaev must be auctioned next; minors auctioned in stock turns from R100 in R5 steps      | §9.2, §9.4      | Family company auction (1817); title homes, start space at half the bid                                            |
| Minors: one charter, two shares of value; half the earnings to the owner                    | §6, §7.2, §10.7 | Two-share company with one president's certificate; `holderDividend`                                               |
| Minor prices rise up the seventh column instead of right of it                              | §10.7           | Title market moves                                                                                                 |
| Majors started from phase 4 by buying the director's certificate at R70–R200                | §9.3            | Family `StartCompany` with `startHomes` (unconnected cities) and incremental treasury                              |
| Only the director's sales move the price, one row a sale                                    | §9.1            | Family sale terms                                                                                                  |
| 100% held by players rises; majors on the top row move right and down                       | §9.5            | Family stock round end with title market                                                                           |
| Two lays, one an upgrade, the second R20; private hexes closed until phase 3                | §10.4           | Family lay allowances (1817)                                                                                       |
| Station costs R20/R40 times the hex distance from the company's stations                    | §10.5           | Title `placementCost`                                                                                              |
| Loans of R50 taken only when a payment needs them, interest R5 at once and each turn        | §10.2, §10.8    | Extended `LoanRules` (automatic borrowing, interest when taken, compulsory repayment, the loan step before trains) |
| A trainless company must buy, borrowing; nationalised when it cannot                        | §10.10          | Family train funding with company borrowing and insolvency                                                         |
| Nationalisation: shareholders paid the price less a step a loan; assets to the RSR          | §11             | New family nationalisation module                                                                                  |
| The Russian State Railway operates phases 4–7, run by the system                            | §7.4, §10       | Receivership-style operation of an unshared company                                                                |
| Merger rounds after every operating round in phases 3–7: convert or merge minors            | §12             | Title merger round composed of family company merger helpers                                                       |
| Private bonuses R10 per train at Odessa, Moscow or Poland                                   | §7.1            | `RouteRules.stopBonus`                                                                                             |
| Ekaterinburg doubled with Moscow                                                            | §10.6           | Connection bonus                                                                                                   |
| 5+5E: any five cities or off-boards, doubled; 2+2 doubled                                   | §10.6           | Express distance, train multiplier                                                                                 |
| Game end: first 8-train (two or three more ORs) or the bank                                 | §13             | `EndingRules`                                                                                                      |
| Final values: price less a step a loan; minors twice their price                            | §13             | Title valuation                                                                                                    |

## Family additions

Surveyed against the researched catalogue (`/workspace/research/18xx-2026-09-08`): the variation
catalogue's 1861/1867 and nationalisation sections, and the 1817, 1849 and 1822 loan and auction
designs already in the family.

- **All-pass discount in the selection auction** (`SelectionAuctionRules.allPassDiscount`,
  `SelectionAuction.discount`, resolution `discount`). 1861 and 1867 lower the next private by a
  step when everyone passes, and give it free at nothing; 1817's selection auction closes the
  unsold lots instead (kept as the default). The waterfall auction's own all-pass discount
  (1830-style) stays separate: it discounts the first lot and pays income, a different procedure.
- **Automatic borrowing** (`LoanRules.automatic`, `LoanRules.interestWhenTaken`,
  `loans/automaticBorrowing.ts`, `TrackRules.borrowing`, `TrainRules.borrowing`, `turnLoans`,
  `turnInterestOwed`). 1867 and 1861 take loans only as a payment needs them; 1817 and 1849 borrow
  by choice (unchanged). Shared: the fewest loans a payment needs, their proceeds net of interest
  paid when taken, and affordability counting what could still be borrowed. Title: which payments
  may borrow (1861: track, a trainless company's bank train, interest) and the interest step. An
  automatic title has no family loan step and no `TakeLoan`/`RepayLoan` Actions.
- **National companies** (`NationalCompanyKind`, `inReceivership`). A company with neither shares
  nor president, run by the system and its title's receivers: 1861's RSR. 1867's CN only holds
  tokens; 1856's CGR has shares and a president, so it is an ordinary company. The family
  receivership handler runs it; its receivership now waits for any system action its step queues
  first.
- **Nationalisation** (`company/nationalisation.ts`). 1867 and 1861 buy a company out: repay
  loans from cash, drop the price a step and a step (two in 1867) for each loan left, pay players
  for their shares, give the national company the assets (the bank in 1867), replace stations,
  close or reset the company. 1837/1824 exchanges and 1856's CGR are formations, not this.
- **Auction turn order** (`CompanyAuctionRules.nextTurnFollowsWinner`, `StockTurn.auctionWinnerId`).
  1861's next stock turn follows the auction's winner (§9.2); 1817's the opener's (unchanged).
- **Lengthening the set under way** (`ScheduleGameEnd`). An ending whose final set is the current
  one and names its round count extends it at once, as the first 8-train in a set's first round
  does in 1861 (§13). 1817's endings always name the next set.
- **Phase decision states** (`railwayStateValidation({ phaseDecisionStates })`). A title state
  that decides a phase's effects while its discards wait: 1861's trainless public companies.

## Rulings

Made while implementing. Which the designer, the GTG text or the owner has since confirmed or
changed is listed under "Grand Trunk edition and the designer's rulings".

1. **Majors may start from phase 4.** §7.3 says "after the start of Phase 5", §8 (Phase 4) and
   §9.3 say Phase 4. Phase 4, as the research engine.
2. **The RSR's routes earn private bonuses.** §7.1 gives them to "the Company that owns them" and
   the RSR is not a Company in the rulebook's sense, but privates go to it at phase 6. The
   research engine pays them; followed.
3. **Who runs the RSR's trains.** §10 has the Banker find the best run. The system runs it: the
   priority deal holder submits the run (as the research engine), the UI offering the autorouter's
   best.
4. **Certificate limits** are not in the rulebook text (they are on the board): 21/16/13/11 for
   3–6 players from the research engine, and 21 for two (GTG §16).
5. **Minor Y.** §7.2 lists a minor "D"; the research engine has "Y, Yuzovka Railway" at the same
   home. Y, as the owner chose.
6. **Merger commitments before the merger.** §12.4 reverses a merger when no player has two
   shares after the shareholders' purchases. Rather than undoing a merger, the shareholders'
   purchases are committed first and the merger happens only once someone would hold two shares;
   otherwise nothing has changed. The director's choice of the two stations comes before the
   purchases, as the research engine's designer-confirmed order has it.
7. **RSR station replacement ties.** §11 breaks ties between cities of equal value at random;
   they are broken by location id, so a game replays the same way.
8. **One round of single-share purchases.** After the shareholders' purchases (§12.4), every player
   is offered one share once, the director first, as the research engine reads "all players have
   either bought or declined a share".

## Merger round (§12)

After each operating round in phases 3–7, each minor still open, in operating order, is offered to
its owner: convert it, merge it with other connected minors, or pass.

1. **Proposal.** A conversion names an unstarted major; its minor's price must be in the
   convert range (the seventh column, R100–R165) and the major starts at the par space of the same
   value. A merger names the minors (2–10, at most six of one owner, connected to the proposing
   minor's stations by legal routes with the merging companies' stations not blocking) and an
   unstarted major, priced at the best par space not above the highest plus the lowest minor's
   price, at least R100 and at most R200. Owners of the other minors answer the proposal; any refusal ends it.
2. **Stations.** Where the merging minors have more than two placed stations, or two in one hex,
   the director-to-be chooses the two (in different hexes) that become the major's.
3. **Shareholders' purchases.** Each minor becomes one share. From the active minor's owner
   clockwise, each player with a share buys any number of treasury shares in one go (at most 60%,
   within the certificate limit). The first player to hold two shares directs the company, and
   anyone who then holds more than the director takes over. If nobody would hold two shares, the
   proposal lapses and nothing changes.
4. **Formation.** Assets (cash, trains, privates, loans) move to the major; minors close; the
   director's certificate goes to the director; the purchases are paid to the treasury.
5. **Open purchases.** Every player, the director first, may buy one treasury share.
6. **Trains.** A major over its train limit discards to the market.

## Verification

- `src/fullGame.spec.ts`: seeded bot games (`test/bot.ts`) for 2, 3, 4 and 6 players play to the end;
  `SWEEP=1` plays thirty seeds of each.
- `src/loans.spec.ts`: automatic loans for a trainless company's train, interest and compulsory
  repayment, and nationalisation for unpaid interest (price, payout, the RSR's Moscow station).
- `src/mergers.spec.ts`: a conversion from the yellow column with the shareholders' and open
  purchases; a conversion refused outside it.
- `src/phaseEffects.spec.ts`: a minor buying the first 8-train in its own turn is nationalised
  with every other minor, and play goes on with the next public company; the RSR buying the
  first 8-train buys more while it can pay, then never operates again.
- `src/competition.spec.ts`: assigned seating for every player count and option, the private
  auction opened in seat order, and a finished game's result ranked by final scores.
- `src/track.spec.ts`: private hexes closed until phase 3, the home hex first, the R20 second lay.
- `src/opening.spec.ts`: the private auction in order, the all-pass discount, the Nikolaev first,
  and the §14 options.
- `src/ending.spec.ts`: the bank breaking ends the game after its round.
- Harness scenarios: `src/scenarios.build.spec.ts` with `SCENARIOS=1` writes positions into
  `games/1861-ui/src/scenarios`.

## Data notes

The research engine (`g_1861`) supplied the map, tiles, market grid, homes and certificate limits;
the rulebook prints no map or market, so these were checked against what it names.

- **Map** (§5): large cities, small cities (the family's towns), red off-board areas with four
  values (§10.6) and grey areas each match. The hexes "shown as belonging to a Private Company",
  closed to track until phase 3 (§10.4), are E3, H6, I5, I9 and J10; which private each belongs to
  is read from the geography (the rulebook names none). Nizhnii Novgorod (K7) prints yellow track
  and R20 of water, paid when the printed track is first upgraded (§10.4). Each red area over
  several hexes counts as one stop, the edges between its hexes closed.
- **Tiles** (§18): counts are the chart's; the engine has three #621 against the chart's two.
  Plain track (#7, #8, #9) is unlimited (§10.4: make more if it runs out). Kiev's green #635 pays
  R40 to become brown.
- **Market** (§6): the engine's 1861 grid, with the brown minor starts (R50–R65), red shared
  starts (R70–R135), purple public starts (R150–R200) and the yellow seventh column (R100–R165).
- **Companies**: homes and names are the engine's; minors have colours of their own (the engine
  shares several with public companies). Public company colours are the engine's.
- **Trains** (Table 2, §8): the 2+2 is in the supply only with §14.1/§14.2.

9. **Routes may re-enter a hex.** §10.1 forbids passing a city, town or off-board area twice
   and two spaces of a separated city; the research engine also forbids any hex twice. The
   rulebook's narrower rule is followed: a route may cross a hex again on other track.
10. **City and town routes.** "At least two" cities and off-board areas (§10.6) is read with the
    research engine as at least two stops, a town among them counting where the train counts it.
11. **The RSR's trains.** When trainless it buys the cheapest train from the bank or its pool,
    borrowing; otherwise it buys the next new train while its treasury pays (§10.10, GTG §8.13).
    In the turn it buys the first 8-train it goes on buying 8-trains while it can pay, as GTG §8.13
    has it buy all it can afford; it does not operate after that turn (§7.4).

Further rulings (mine):

12. **The Nikolaev may be passed.** §9.4 has it "must be auctioned" after the privates; nothing
    forces a bid, so players may pass and the stock round may end with it unsold (the research
    engine reads it the same way). No other minor may be auctioned before it.
13. **A new public company's station** (§9.3, "any unreserved and unconnected city circle") goes in
    a city with no station yet, as the research engine has it, not a free circle of a city where
    another company already stands.

## Checked against 18xx.games

Compared on 2026-11-14 with the research checkout of the 18xx.games engine (`g_1861` on `g_1867`).

Agreeing: 1 (majors from phase 4), 2 (RSR private bonuses), 3 (priority holder runs the RSR), 4
(certificate limits), 5 (minor Y), 6 in effect (the engine merges first and asks for an undo when
no one holds two shares; the director's stations come before the purchases there too), 8 (one
round of single shares), 10 (city and town routes), 11 (the RSR keeps buying 8-trains in the turn
it buys the first, by the owner's choice on 2026-11-15), 12 (the Nikolaev may be passed), 13 (a
city with no station, from which no track reaches another stop). The merger floor of R100 and
unpaid interest (none paid, loans repaid from cash, the rest to the RSR) agree since the owner's
decisions below.

On 13, the engine walks any track from the city with full cities not blocking. A full city blocks
only a route that passes it, and the shortest such route ends at the first stop the track
reaches, so a full city never changes the answer: both read §9.3's "cannot trace a legal route"
the same way.

Differing:

- 7: the engine breaks ties between equal cities by hex id, the highest first; here the lowest.
- 9: the engine refuses any route that enters a hex twice; here only stops and separated city
  spaces may not be used twice (§10.1's wording).
- Merger agreement: the engine has no consent step; here every owner of a merging minor agrees
  (§12.1 "all parties to a proposed merger must agree").
- Merger connection: the engine lets a merger grow in a chain, each minor connected to any minor
  already in it; here one minor reaches every other (§12.3).
- 5+5E: the engine counts the route's off-board areas first and then the best cities; here the
  best five stops of any kind (§10.6 "any five cities").
- Options: the engine offers none of §14 (only 1867's column market); here the GTG edition's
  options. Both have two players, the engine's not from the v2.0 rulebook, here the GTG §16 setup.

## Grand Trunk edition and the designer's rulings

Sources, saved in `/workspace/artassets/1861`:

- `grand-trunk/rulebook-rulespal.txt`: the Grand Trunk Games (2020) combined 1861/1867 rulebook as
  transcribed by RulesPal (`rulespal.com/1861-1867-railways-combo/rulebook`), tables recovered
  from the page. The publisher's PDF is BGG file 212807 (login needed); not checked against it.
- `bgg/forums.txt`: every Rules thread of BGG 23817 (1861), 292187 (1861/1867) and 184524 (1867),
  and 292187's General forum, fetched 2026-11-14; `bgg/designer-answers.txt` holds the threads
  Ian D Wilson (BGG user 249989) answered.

The designer says the editions were meant to be the same apart from variants, but that the GTG
rulebook "has some mistakes, mostly minor or corner cases" (thread 3159357).

Confirmed by the designer or the GTG text:

- 1 (phase 4): §7.3's "Phase 5" is a typo (threads 1333027, 1051637).
- 2: the RSR takes the privates' income and their +R10 bonuses (2620698, 3440689).
- 3: the priority holder runs the RSR's trains for its maximum revenue (GTG §8.13).
- 4: certificate limits 21/16/13/11 (GTG §7.5).
- 8: one round of single shares after the shareholders' purchases (GTG §9.1D, §9.2D); every
  player contributing a minor may buy several (2682914).
- 10: towns are optional; a 2-train may run Riga–Poland past a town (3082348).
- 13: a new public's city must have no station in it and an unreserved space (1051637, 3134613).
- The RSR is a company: one station per hex (2854444).
- No player ever holds more than 60% (2036021).
- A merged company over its train limit discards at once (2957344; GTG §9.2F).
- A minor that has ever operated is nationalised at phase 4 or 6 if trainless, even before its
  turn (1529566).
- Brown large cities take a six-exit tile where one fits (3214581, 2571944).
- Moscow's grey tile gives the RSR its station in the fourth space, a station kept for it; the GTG
  rulebook omitted this (2575164).

Decided by the owner on 2026-11-14, after comparing the GTG edition and the designer's posts:

- Mergers worth less than R100 are illegal (the designer's 2021 ruling).
- The first player to hold two shares directs a merged company; the active minor's owner buys
  first; anyone who then holds more than the director takes over (GTG §3.3, §9.2C). The director
  still chooses the stations before the share purchases (the research engine's order).
- A company that cannot pay its interest pays none of it and is nationalised; its loans are
  repaid from its cash and the RSR takes the rest (GTG §8.10, §10.1).
- The RSR keeps v2.0's station limit: six outside Moscow and St. Petersburg, plus those two.
- Moscow's grey tile places the RSR's Moscow station (designer, thread 2575164), and as phase 8
  begins the RSR places any reserved station still unplaced (GTG §8.13, §11).
- The minor at Yuzovka is "Y, Yuzovka Railway", as 18xx.games has it.
- The options are the GTG edition's (§14, §16): unlimited 2+2 and 5+5E (on by default) or two of
  each; no price floor on nationalisation; RSR train exports; long game; left of auctioneer; and
  two players (R420, certificate limit 21, 70%, a smaller train roster, two privates removed at
  random). v2.0's "RSR station from the start" is gone.

Not built yet:

- The column stock market (GTG §4). Every family rule and the board read one market chart; a
  game choosing between two needs the family to take its market from the game's state.
- The 1861S short game and the two-player short game (GTG §15, §16.3): bundle auctions, RSR
  exports with no treasury, and the end at the first 6-train.

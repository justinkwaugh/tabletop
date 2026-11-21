# 1828 — title design

Rules authority: the 1828 English Rules, build 2022-04-19, version 1.0-2-g54341c3
(`/workspace/artassets/1828/1828-Rules.pdf`, text copy beside it), from kanga.nu. The
designer's game files (map, market, tile manifest `track_tiles.csv`, tile designer file) are
cloned in `/workspace/artassets/1828/repo`. Rulings from the BoardGameGeek forums (thing 272538,
all 53 threads, downloaded to `/workspace/tmp/1828-bgg/all.txt`) are digested, with authors,
dates, thread ids and their standing against the rulebook, in
`/workspace/artassets/1828/bgg-rulings.md`. The designer, J C Lawrence, posts as clearclaw; he
holds that the rules take precedence over his posts ("if it isn't in the rules, it isn't a
rule"), so forum answers settle gaps and never override the text. Section numbers below are
the rulebook's.

The research engine (`g_1828`, 18xx.games's "1828.Games") supplied hex coordinates, terrain,
pre-printed track and the market grid, each checked against the designer's map and market. The
designer called its 2021 merger trading wrong (thread 2732606) and it is a renamed variant, so it
is not a rules reference: where it differs from the rulebook, the rulebook wins.

Scope: the whole game for 3–5 players, with the rulebook's beginners' advice (one of the GT, N&W
and OS&H privates kept) as a game option.

## What makes 1828 different

| Mechanism                                                                                                                                                                                          | Rulebook        | Family support                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| Privates auctioned in rows of one price; the last unbid lot of the cheapest row is bought at face, then the row's bids resolve left to right                                                       | §6.1, §6.2      | New `WaterfallAuctionRules.priceRows`                                               |
| A $250 private holds one bid, an overbid releasing the earlier                                                                                                                                     | §6.1            | New `WaterfallAuctionRules.singleBid`                                               |
| All pass: every bid resolves, every private pays, the auction resumes                                                                                                                              | §6.1            | `allPass: 'resolve-bids-then-income'`                                               |
| $250 privates bring the director's certificate and a share; the buyer sets a yellow par; they close when their company or its system acquires a train                                              | §6.3, §13.2.3   | Award, `requirePar`, `awardParSpaces`, `privatesClosedByPurchase`                   |
| Pars by phase: yellow, then green, blue and brown; no director's certificate in purple                                                                                                             | §7.4, §17       | `startMarketSpaces`                                                                 |
| Sell–buy–sell; one certificate a turn, or two for a gray-area director; 60% cap outside the gray area; no certificate limit; no pool limit                                                         | §7.1–7.3, §12   | `turnOrder`, `multipleBuys`, `marketZoneHoldingLimits` (as 1894)                    |
| Pass order sets the next stock round                                                                                                                                                               | §7.1            | `passing: 'pass-order'` (as 1894)                                                   |
| Sold out: up a row, another for a director with 80%, another from the gray area; up at the top moves right                                                                                         | §12.2           | `soldOutRises`; the market's own `up` moves on row 0                                |
| Mergers into systems: the survivor keeps its shares and marker; pairs trade one for one, singles trade up or are sold; one share donated to the treasury                                           | §7.5, §13.4     | Title (`merger.ts`); see [Systems stay title code](#systems-stay-title-code)        |
| A system's two shells, each held to the train limit                                                                                                                                                | §8.3.5.1, §15.4 | New `TrainRules.trainGroups`; title shells (`shells.ts`)                            |
| A system lays two tiles, never two upgrades; B&M and NYH, or a system with them, lay extra yellows for $40                                                                                         | §8.3.1, §13.3.2 | `TrackRules.allowance`, `restriction`                                               |
| Coal markers: three, a company holding at most one, bought for $120 by a company whose track reaches the Coalfields, or taken by building the tunnel; only holders run, build or trace through K11 | §14.3.1, §16    | `AccessRightRules`, `StopAccess` (as 1832 and 1850)                                 |
| The tunnel takes only tile #4                                                                                                                                                                      | §14.3.1.2       | `TrackRules.restriction`, `afterLay`                                                |
| 3+D: three cities and any towns, doubled; 8E: eight cities, towns unpaid                                                                                                                           | §15.3           | `cities-and-offboards` distances, `stopRevenue`                                     |
| The C&P: its owner lays a tile each round and earns half a 2-train run through it; a company buying it takes its treasury and may replace its station                                              | §13.2.2.5       | A player-run minor (`CPRY`) in the family operating steps; title run (`cobourg.ts`) |
| C&StL, D&H, E&K tile powers; St. Clair's higher revenue to a company; C&A's PRR share; M&H's exchange                                                                                              | §13.2.2         | `PrivateTrackTerms`, `OperatingRules.privateIncome`, award, `exchangeTerms`         |
| The Erie's home city chosen as soon as a tile reaches Buffalo/Dunkirk                                                                                                                              | §13.3.2         | `StationRules.homeChoice` (as 1830); title `placesErieHome`                         |
| Unparred companies leave at the first purple stock round, blocking stations in their homes                                                                                                         | §7.1, §17.7     | Title system action                                                                 |
| Bankruptcy ends at once; $500 at once after a stock round, after the operating round otherwise; the first set starting in purple is the last                                                       | §9.1            | `EndingRules.trigger`                                                               |

## Family additions

Surveyed against the research catalogue (`/workspace/research/18xx-2026-09-08`: the variation
catalogue's auction, merger and train-limit entries, the trait profiles) and the implemented
titles.

- **Auction rows** (`WaterfallAuctionRules.priceRows`, `ReserveBidAuction.buyOnlyLotIds`). The
  waterfall auction hard-wired the first lot as the only purchase and its bids as the only ones
  to resolve. 1830, 1889, 1882, 1856, 1894, 18Chesapeake and 1833NE all sell lot by lot, which
  is a row of one; only 1828 groups equal prices (1817's tiers belong to its selection auction).
  Rows by price are the smallest addition that keeps every title's lot order: `buyOnlyLotIds`
  replaces the first-lot checks in the auction, its handler and the auction table, and equals
  them without rows. The table's Buy button now follows `buyOnlyLotIds`.
  `ReserveBidAuction.priceRows()` reports each row and how far its sale has come, and the
  shared auction table groups its lots by it; titles without rows keep their flat list.
- **No projected run for some companies** (`TitlePresentation.projectsRun`). The C&P pays only
  for a run through the tile just laid, so the projection built from its network would show money
  the rules do not pay.
- **Action observers** (`EighteenXXTitleRules.actionObservers`). The M&H's timing depends on
  whether the first share company has begun its turn (§13.2.2.6). A count of actions also counted
  other players' standing instructions, and a decision handler does not see every action, so the
  runtime calls an observer with each action a machine state processes.
- **Held stock instructions** (`StockInstructionRules.held`). A standing purchase must not act in
  the middle of a merger, which is the turn's action.
- **Single-bid lots** (`WaterfallAuctionRules.singleBid`). A bid on such a lot drops the other
  bids on it, so it is never contested. Only 1828's $250 privates do this among the researched
  titles.
- **Train groups** (`TrainRules.trainGroups`, `trainsOverLimit`). Discards were judged against
  one limit per company. 1832's systems pool both shells' limits (its rules do); 1828's shells
  each hold the limit, so a system over the limit in one shell discards even with room in the
  other. The hook returns groups with their limits; the phase change and `DiscardTrain` read
  the first group over its limit. Purchases still check `trainLimit` (twice the phase's for a
  system): a train always fits a shell when the total is under it, and the title places it.
- **A fee on a lay counting as the ordinary lay** (`PrivateTrackTerms.layFee` with
  `countsAsOrdinaryLay`). The fee was ignored for such lays; the D&H's $120 lay counts as the
  company's lay. No other title combined the two.
- **An exchange that is the stock turn's purchase** (`PrivateExchangeTerms.stockAction:
'purchase'`). The M&H is a player's whole stock action (§7.1), unlike 1830's out-of-turn
  exchange. The exchange's metadata schema gains the value, an additive change to every 18xx
  title's `ExchangePrivate` and `ExchangePrivateOutOfTurn` digests.

- **A title's own private exchange** (`EighteenXXTitleRules.privateExchangeActions`, the
  session's `titlePrivateAction`, `GameTable`'s `offTurnPanel`). The M&H's half-directorship sets
  a par and pays, which the share-for-private exchange cannot express. The title's actions pass
  through the family's exchange handler, on and off turn. A title declaring them lists every
  exchange itself, so the family's exchange controls step aside, and it sends share exchanges
  through `PrivatesModule.submitExchange`. A float that
  puts a company ahead of the one whose track step has opened ends that turn unstarted
  (`leaveOperatingTurn`).

### Family hooks for the table and the rules

Surveyed against the same catalogue, its engine sources under `source/lib/engine/game`, and every
title in this repository. Each hook is optional or leaves other titles' results unchanged unless
the entry says otherwise; 1828 is the first consumer of each.

Logic:

- **No certificate limit** (`NoCertificateLimit`, returned by `StockRules.certificateLimit`). The
  limit stays a number, so every check keeps working, and the table drops certificate counts when
  no player has one (`session.noCertificateLimit`). The catalogue writes "none" as 99: 1828 at
  every player count, 1822 Africa likewise, and 18OE at two players only, which is why the test is
  on the position's players and not a title flag. Verified by 1828's `session.spec.ts`.
- **A sale train funding may not make** (`permitsSale` on `presidentTrainFundingRules`). The hook
  already existed on `TrainFundingRules`; the helper that eleven titles use now passes it on.
  Research titles restrict emergency sales in several ways (`EBUY_PRES_SWAP = false` in 16 games
  including 1817, 1860 and 1880; `EBUY_CAN_SELL_SHARES = false` in 1840, 1848, 1858, 1866 and
  18CZ), so the rule stays a predicate over the sale. Title-owned: 1828's `dumpsTrainSeller`.
  Verified by `rulings.spec.ts`.
- **A second share after a turn with no purchase** stays title code. `furtherShareAllowed` reads
  an empty purchase list as "every earlier purchase matched", and 1828 needs the opposite after a
  merger or an M&H exchange, which set `turn.bought` and record no share. Other titles reach the
  same case with their own rules: 1832's London investment and 1882's Central exchange mark the
  purchase with none recorded. So 1828's `allowsAnother` asks for exactly one earlier purchase and
  the family's reading stays. `recordTurnPurchase` now replaces the list rather than pushing into
  it, with the same result.
- **A private's station within the round's limit** (`privateStationPositions`). It offered a
  station after the company had already placed its `placementLimit` for the turn, though the
  placement counts as the turn's (`useTurnStationPlacement`). It now refuses once a station has
  been placed and the limit is used. A limit of zero with none placed still offers the station:
  1849's SMS lay sets that limit to keep out any other station, and its own must still be offered
  (§7.1). 1830's D&H, 1849's SMS, 1894's two station lays
  and 18Chesapeake's C&OC also use this; a lay after the turn's station now brings none there.
  Verified by `rulings.spec.ts` and 1849's `reviewFixes.spec.ts`.
- **Ending a turn without completing the company** (`leaveOperatingTurn`), split out of
  `endOperatingTurn` for a float that puts a company ahead of the one in its track step. The
  exchange handler is the only caller, and only a title floating companies mid-round reaches it.
- **Lays counting as ordinary after the track step** (`privateTrackConstruction` runs them with
  `completed: false`), for the D&H in the station step (§13.2.2.4). The other titles with such
  lays (1817, 1822, 1830, 1849, 1856, 1894, 18Chesapeake) offer them only in `LayingTrack`, so
  nothing changes for them.

Table:

- **Closed companies' stations** (`MapViewDefinition.closedCompanyStation`). A station here keeps
  its company's id when the company closes, so the map needs one look for those that stay. The
  catalogue's other survivors are neutral tokens from setup or events (1867's and 1893's, 18EU's,
  1817WO's), which `neutralStation` already draws and 1882 uses; 1828 alone leaves closed
  companies' markers standing. Unset, a closed company's token keeps its look. Verified by
  `sharedStations.spec.ts`.
- **Crowded printed hexes** (`nameOffsets`, `terrainSymbolsBelow`). Eleven titles' map views place
  terrain by location through `terrainPositions`; these two extend the same per-location data to
  a name kept in its usual type and to symbols too wide for their row. Only 1828 needs them now
  (New York, G23). Verified by `mapDrawing.spec.ts`.
- **A par a company has left behind** (`CompanyPricePresentation.parRetired`, `shownParPrice`). An
  1828 system keeps the survivor's record, including its par, so the table asks. 1832 needs no such
  test: its System is a new company with its own start. Verified by `companyPresentation.spec.ts`.
- **What Autorun does** (`TitlePresentation.autorunDescription`). The family's sentence says a
  company runs and builds nothing; the C&P lays and then takes its best run. Undefined keeps the
  sentence, so a title describes only the companies that differ.
- **The stock action in hand** (`session.chosenStockAction`). The turn recap folds away for a
  chosen Buy or Sell menu or title panel. It covers every title with `titleStockPanels` (1817,
  1822, 1828, 1832, 1850, 1870, 1882); 1828 adds a merger under way.
- **What a panel holds** (`TitleStockPanel.selection`). What is picked inside a panel goes when the
  panel closes, whether for another panel or a stock menu, so Undo never removes something hidden
  (`docs/user-interactions.md`). A held panel keeps its picks. 1882's Central par has the same
  shape and could adopt it when that title is next touched. Verified by
  `titleStockPanels.svelte.spec.ts` and 1828's `session.spec.ts`.
- **The rulebook's words** (`TitlePresentation.terms`, `tableTerms`, `reword`, `phaseNames`,
  `phaseName`, `phaseLabel`, `session.historyWording`). 1828's designer asks that its terms stay
  unchanged. They are data with the family's words as defaults, so other titles read as before.
  Verified by `tableTerms.spec.ts`.
- **A title's private on and off turn** (`session.titlePrivateAction`, `GameTable`'s
  `offTurnPanel`), which serve the M&H exchange above.
- **Impassable hexside width.** `mapDrawing` now defaults impassable borders to 5 where the map
  view sets none, in place of 3. Unlike the entries above, this changes how every title with
  impassable borders draws.

The title's own modules: `merger.ts` (proposal, consent, shared-hex stations, single shares,
formation), `mergerPreview.ts` (the outcome the table shows before it is settled), `shells.ts` (placing new trains, naming the shell for the next one, moving and
swapping trains at the start of the train step),
`cobourg.ts` (the C&P's run, purchase and closure), `mohawk.ts` (the M&H for half a
directorship), `unparred.ts` (purple removal), `coal.ts`.

### Systems stay title code

Of the implemented titles only 1832 also forms systems, and its lookups (`isSystem`, `shellsOf`,
`systemOf`) resemble 1828's (`isSystem`, `constituents`, `systemAbsorbing`), but they read
different facts. An 1832 System is a new company from a fixed list, with 20 shares, recording its
two components, and its trains share one pooled limit. An 1828 system is the surviving company,
keeping its id and ten shares, recording the absorbed company and which train stands in which
shell. So `shellsOf` leaves the system out where `constituents` includes it, and `systemOf` finds
either component where `systemAbsorbing` finds only the absorbed one. All that is common is a
one-line membership test over a state shape the titles do not share, and the procedures above it
(price, share trading, director, stations) differ throughout. What both do need is already in the
family, such as moving a company's assets (`transferCompanyAssets`). A third title forming systems
like either one would justify revisiting this.

## Decisions

1. **Shares in a merger are counted, not juggled** (§7.5.2.1). The rulebook trades physical
   certificates in a strict order, swapping set-aside singles between players with money
   changing hands only for those. Counting each holder's shares of the two companies gives the
   same system holdings, and the swap payments net to what each player pays or receives for
   their own single: a player trading up pays the system price less their single's price, and
   one selling receives their single's price. The swap is modelled only where it can force a
   sale: a player whose set-aside share another must take has to be able to pay any rise in its
   value, or sells (§7.5.2.1 item 3).
2. **A player holding both companies at different prices chooses the single to set aside**
   (`ChooseSetAsideShare`, §7.5.2 step 4), in turn from the acting player; with one company or one
   price there is nothing to choose. Until they choose, the preview counts their dearer share,
   which costs least to trade up and sells for most. They then trade up or sell, a choice offered
   only when a system share remains, the player sold neither company this round, and they can pay.
3. **Shares left over go to the bank pool** (§7.5.2 step 6), after the pool's and the IPO's
   own trades, pairs before singles.
4. **Only a player who never agreed can make a merger fail** (§7.5.1, §7.5.2.1, §7.5.2.2). The
   acting player and the two directors are not offered a choice that makes it fail, which narrows
   their right to decline a trade-up. Any other holder keeps every choice. The merger fails when
   no player holds the director's certificate and a share to donate when the share trading is
   complete: nothing changes hands, the table announces the failure through the next player's
   turn, and the acting player's turn ends as a pass, after any sale already owed. The game
   accepts every choice the rules allow, including one that makes the merger fail; only the table
   holds these choices back.
5. **The other director must agree** to a merger of two directors' companies (§7.5.1); a
   refusal returns the turn to the acting player.
6. **A merger is offered only when it can succeed.** The game still accepts any merger the rules
   allow, and a doomed one amounts to a pass; the designer says the failure rule exists "if some
   bright spark really insists" (BGG thread 2365803). `ProposeMerger` is listed only for one that
   can work, so a player with nothing else still passes automatically, and once a merger cannot
   form no more choices are asked. The check runs in the rules, so it is bounded: three pairs
   settle it; otherwise it needs a player with two pairs and a single who can pay to trade up.
   Others' set-asides matter only through a swap costing more than the trade-up, which needs the
   absorbed company priced above the system, and then at most 16 combinations are tried. The M&H
   cannot be exchanged while a merger is under way.
   If the C&P builds the Virginia Coalfields Tunnel, its coal marker returns to the Coalfields:
   the builder takes it (§14.3.1.2), but only share companies acquire markers (§16.1).
7. **Shared-hex stations**: in one city the absorbed company's becomes the blocking station; in
   different cities the acting player chooses (§7.5.2 step 3). A blocking station is a station
   of a closed company: the absorbed company, an unparred company removed in purple, or the
   C&P's railway.
8. **The C&P is a player-run minor company** (`CPRY`) apart from its private, operating first in
   each round while a player owns the private. It lays through the family's track step from its
   Peterborough station, paying terrain from its treasury. Its **owner then chooses any run** of
   half a 2-train through the tile (§13.2.2.5; designer, thread 2162379: the owner's choice, not
   the maximum), listed best first: two stops joined by one line of track that includes the tile
   and a stop on it if it has one. The tile may lie off one end; other companies' stations do not
   block it, as it runs no train (open point 8 of the digest); the Coalfields stay closed to it.
   With no run, it pays nothing. In 90 bot games no lay offered more than two runs. **Autorun**
   on the C&P is the owner's standing choice of the best run: the owner still lays the tile, as
   the family's Autorun building nothing would leave the C&P nothing to run through.
   Runs paying the same come to the same for owner and treasury, so the owner is shown one of
   them; different amounts are drawn on the map and offered side by side (family hook
   `titleMapRoutes`, general to any title choosing among whole runs).
9. **The C&P's buyer replaces its station during the buyer's turn**, if it has placed no station
   that round and has none in Peterborough already, a company holding one station in a hex
   (§8.3.2); the replacement is its station for the round. Otherwise the C&P's station stays as a
   blocking station.
10. **A new system train goes to the shell its director names**, if that has room
    (`ChooseTrainShell`, offered while both shells are below the limit), and otherwise to the
    shell with fewer trains, the first on a tie: the only shell with room when one is full and
    never worse for a later fall of the limit. At the start of the train step, before buying, the
    director may move trains between shells, or swap one from each when both are full
    (`SwapShellTrains`), since trains arrange freely between them (§8.3.5.1). The shells close
    with the step's first train, and once a train has come from another company.
11. **Emergency buying fills the empty shell** (§8.3.5.1; designer, thread 2368855). A system with
    a train in one shell need not buy for the other, but its director may fund a train, from the
    depot or another company, when that train goes to an empty shell, and only then. A system with
    no empty shell gets no funding.
12. **The M&H is exchanged from one list** (§13.2.2.6): a 10% share, or half a director's
    certificate for one share's par and the company's par. It is the owner's whole stock action on
    their stock turn, and open at any time in an operating round, on or off their turn. A company
    it floats joins that round, by price, until the first share company has acted, a home station
    included; the C&P's turn does not count. It cannot change the director of a company buying a
    train in an emergency (§8.3.5.2).
13. **The Erie's home waits for track in Buffalo/Dunkirk**, and meanwhile no one may place a
    station there. If it has floated when a tile first goes there, its director chooses the city
    at once, on whichever company's turn the tile was laid, and that company's track step goes on;
    otherwise it chooses as it next operates (§8.3.2, §13.3.2).
14. **Tile counts follow the designer's manifest** (`track_tiles.csv`): three #4, fifteen #8,
    twelve #9, where the research engine has four, sixteen and sixteen.
15. **The bank is unlimited** (`amount: 'unlimited'`), as the designer advises for digital play, so the board shows no bank. Games started before this change (logic 0.4.1 and earlier) keep a $1,000,000 bank in their stored state.
16. **The game ends after the set of operating rounds that starts in purple** (designer, thread
    2377057).
17. **The D&H is used in the owning company's track step or its station step** (§13.2.2.4), and the
    station step waits while it could be (`StationRules.holdsStationStep`). Its lay counts as the
    company's yellow lay or upgrade and its optional station as the round's station. It costs $120
    in all, Scranton's mountain included: §13.2.2.4 does not say, but the designer's card prices
    the tile and optional station "for $120".
18. **No dumping a train seller in the same turn** (designer, thread 2368855). A system is one
    company, so after buying a train from a company it may not fund a further train by a sale that
    hands that company to another director (`dumpsTrainSeller`, through `permitsSale`). The
    rulebook has no such wording; the ruling fills the gap §8.3.5.2 leaves.
19. **Canada prints spikes, not track**: A13 and A15 show that a route may only start or end there
    (§11), and the two hexes print as one red area.

## Phone rendering

Measured as `docs/phone-rendering.md` asks, on 2026-11-18 with `tools/webkit-probe` (Playwright
WebKit, 390 × 664 at 3x, `--repeat 3`, medians) against a fresh dev harness. The position is the
`coal-marker-for-sale` scenario, 964 actions in, in the red phase; the interaction opens the track
tile picker over a hex, with 20 hexes offered. Steps module:
`/workspace/tmp/1828-ui/probe/steps-tile-picker.mjs`.

| Measure                             | Empty harness | Position | Over the harness | Picker open | Over the harness |
| ----------------------------------- | ------------- | -------- | ---------------- | ----------- | ---------------- |
| Steady memory (MB)                  | 767           | 1200     | 433              | 1144        | 377              |
| Peak memory (MB)                    | 791           | 1211     | 420              | 1209        | 418              |
| Board repaint (ms, `svg.map-scene`) | n/a           | 32       |                  | 34          |                  |

Opening the picker: longest frame 464 ms, two long frames, settled in 518 ms, no reloads. The dev
harness inflates absolute memory, so compare these only with other runs of a harness.

The title adds no filter, mask, blend, texture, animation or touch listener of its own. Its only
effect is `opacity` on disabled buttons in the merger and M&H panels, each piece-sized and still.
The board is the family's map, drawn with `renderAtViewScale`.

## Names

The table uses the rulebook's words, which the designer asks stay unchanged: director, directorship,
Stock Market, Bank pool, station markers, Supply, the colour phases, the Diesel,
table 13.1's company names and symbols, and paired cities as Buffalo/Dunkirk. They come from
`TitlePresentation.terms` and the phase chart's `phaseNames`; the operating steps keep the family's
Track, Station, Run, Payout and Trains, and the director's mark stays the family's "P".

## Open questions for the owner

- **Licence.** 1828 was released under CC BY-NC-SA 4.0 with a README rider that a changed
  version must not be called 1828. On 2026-06-26 the designer wrote that he was withdrawing all
  reproduction licences pending review (thread 3728904), and on 2026-07-20 asked a builder not to
  use the name (thread 3740027). Ask him before publishing.
- The designer's unofficial wish to let systems rearrange trains when they rust (thread 2782216) is not offered; the rulebook forbids it.

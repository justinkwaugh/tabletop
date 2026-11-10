# 1862: title plan and design

1862: Railway Mania in the Eastern Counties (Mike Hutton, GMT Games 2019 edition; also known as
18EA) joins the shared 18xx family. This note records the evidence, the family changes, the
delivery slices and the rulings, under the standing [18xx design rule](../../docs/agents/18xx-design.md).

## Authority and sources

**The GMT rulebook (© 2019, `1862_TRAIN_RULES-Final.pdf`) is the rules authority.** Section numbers
in the code and below refer to it.

- `/workspace/artassets/1862/1862_TRAIN_RULES-Final.pdf`, from GMT's public asset bucket, and its
  `pdftotext -layout` extraction `rules.txt` beside it.
- The research site's `g_1862` (pinned at `715567bdc7e5cc68a68a286b21dc8edd1a125e50`, production):
  evidence for the map's hex grid, tile manifest, market spaces and train roster, checked against the
  rulebook. Its procedures are evidence only, never the rules.

- **Players:** two to eight (§2.4).
- **Coordinates:** the printed board's flat-topped grid, columns A–I and rows 0–15, as the research
  data uses.
- **Artwork:** boardless map. No physical-board artwork is claimed.

## Rules digest

The mechanisms 1862 adds to the family's 1830-style base, by rulebook section.

- **Rounds (§3).** Two Parliament Rounds, then a Stock Round, then 1, 2 or 3 Operating Rounds by
  phase; repeated as Parliament, Stock, Operating. The number of ORs changes only after the next
  Stock Round.
- **Parliament (§4).** From the priority holder, each player may open an auction on an available
  company with a bid in multiples of £5 from £0, or pass. Bidding goes around; passing leaves the
  auction. A player with less than three times the lowest par plus the smallest legal bid, or at the
  certificate limit, must pass. A player who won a charter this round may not open another but may
  bid. The winner pays the bid, sets a chartered par (54–100), buys the director's certificate at
  3×par and may buy up to two more shares at par; 50% floats it. The round ends when every player
  in turn declines to open. Priority does not move.
- **Obligation (§4.3).** A charter not floated by the end of the following Stock Round fines its
  winner 5×par: cash first, then that company's shares, then other shares. The company returns to
  the IPO.
- **Availability (§2.4, §3.2).** The 20 director's certificates are shuffled: 8 available at once,
  4 from phase B, 4 from phase C, 4 out of the game (one or two fewer removed with 7 or 8 players,
  adding them to the first group). A company may start only if its home can take its station when it
  first operates (§3.2).
- **Permits (§2.4, §6.5.4.3).** 16 permits (6 Freight, 5 Express, 5 Local; 6 of each with 7–8
  players) are dealt one per company. A company runs only trains it has a permit for, gains permits
  only by merging, never loses one.
- **Chartered and non-chartered (§3.1, §6.5).** A chartered company sells its shares from the IPO at
  par, money to the bank, and receives 10×par when 50% is sold. A non-chartered company starts in a
  Stock Round: the director chooses a market price 54–200, pays 3× it to the company; the rest of the
  shares sit in the company's treasury and sell at market price to the company. Its par is the
  highest non-chartered par at or below its price, and is used only for refinancing.
- **Stations (§3.1, §6.5.4.2, §7.7).** Bought at flotation: chartered three at £60; non-chartered
  two to seven (eight with §11.4) at £40, the director's choice. One placement per OR, already paid.
  Only by mergers can a company gain more.
- **Stock (§6).** Sell then buy one share; no limit per company; no buying a company sold this round;
  no selling shares bought this round. Sales drop the price one space per share (zig-zag), except a
  non-director's first share above 200 or below 40 and first two at 400+; none before flotation or
  after the LNER. A train-less company's shares sell at half price. Directors need three shares; the
  director's certificate may be sold to the pool, leaving the company in receivership until a player
  with three or more shares and the most claims it. Certificate limit by player count.
- **Operating order (§7.1).** Descending price, stack order; a company's marker goes to the bottom
  of its stack whenever its price moves or it operates.
- **Operating turn (§7.1).** Merge; track; station; run; pay or withhold; buy trains; redeem one
  pool share; acquire.
- **Track (§7.6).** One of: one yellow N tile; up to two other yellow tiles; one upgrade; one small
  station on plain track anywhere; or a London link (a station in one of London's four spaces), which
  also forbids a station that turn. N/Y letters; Ipswich and Harwich russet tiles reserved. Yellow
  plain track always carries a printed small station; small stations carry forward on upgrades.
- **Home (§7.2).** Placed first; if absent the first build must be the home tile; if full, the first
  build must upgrade it; if still full, the last-placed foreign station is displaced to its owner.
- **Routes (§7.4, §7.8).** Begin and end at large stations or off-board areas; two large stations
  or one and an off-board. Off-boards and ports are terminal; at most one red off-board and one port;
  no red-to-red or port-to-port. London only with an own London station, and never traced out of or
  solely from London. One run must include the home; every other run must meet an earlier run at a
  large station. Trains may share track; each train may not reuse its own. Each stop pays once per
  company.
- **Freight (§7.8.1).** Counts hexes (N further hexes). Scores its two ends plus £20 per intervening
  hex as the crow flies (£30 if an end is a port). Non-permanent freight trains chain end to end into
  one scored run; permanent ones (F6–F9) may run separately. Two runs between the same two places
  score the distance once.
- **Local (§7.8.2).** N large stations, plus every small station passed (£20 each); no off-boards.
  £10 per distinct hex visited to the treasury as subsidy, outside revenue.
- **Express (§7.8.3).** Large stations and off-boards; ignores small stations. N/M trains visit up to
  M and score N, the director skipping any.
- **Dividends (§7.8.5–6).** Pay 10% per share including treasury shares, or withhold (left one). A
  payment moves right by multiples of the share price, up to four. The George Hudson manoeuvre tops
  up revenue of £10 or more below the share price to it, in tens, from treasury, then must pay.
- **Trains (§7.9–7.12, §9).** Bands A–H; the first of a band changes phase. Type chosen at purchase.
  Earlier bands sell at half face once a later band is sold. Limits: A–D three per type, E–F two per
  type, G–H three in all. Warranties £50, up to three per train, one removed after each run; A and D
  carry one free; a warrantied train rusts only when its last warranty goes. A train-less company
  must buy: sell treasury shares (minimum, full price, price drops), or refinance, else bankruptcy.
- **Bankruptcy (§7.12).** No train and cannot afford one, or price at the bottom. Holders receive the
  (train-less half) price; the company resets and may be restarted.
- **Mergers and acquisitions (§5, §7.5, §7.14).** By both directors' consent, between companies
  connected by track. Survivor chosen by the active director; new price is the lower plus half the
  higher, train-less halved first. Shares merge 2:1 in clockwise order with option shares redeemed or
  relinquished; assets and permits pass; duplicate stations removed; the other company resets.
- **Receivership (§7.3, §8).** No director: run for most, retain, buy one permitted train, no track
  or stations, no mergers or train sales.
- **Ending (§10).** Top of market (finish the OR); bank broken (finish the set, or one more set from
  a Stock Round); the LNER forms after the set in which the first H train is bought, then a Stock
  Round and one last set in which each company runs and buys three times. Wealth is cash plus shares.
- **Variants (§11).** Fewer train types, shorter game, new-player rules, eight stations. Game length
  (short/standard/long) changes the train roster.

## Family survey and decisions

Surveyed against the family library and the research catalogue (`18xx-game-variation-catalog.md`
§"1860/1862 and gauge games", `data/title-traits.json`). 1862 is the first consumer of each
addition below; every addition is optional and leaves released titles' behaviour unchanged.

| Mechanism                                                                                                 | Family addition                                                                                                                                                                                                                                                       | Other consumers considered                                                                                   |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Small stations on plain track, carried through upgrades (§7.6.2–7.6.4)                                    | `tiles/trackStops.ts`: `TilePlacement.trackStops`, `withTrackStops` decorating the placed face in `RailwayMapState`, `TrackRules.carriesTrackStops` carrying a lone town on a line onto the replacing tile's plain line                                               | 1860 halts; the research's hidden tile variants were rejected as a representation                            |
| Trains sharing track, stops paid once, a connected fleet, chained freight, the Local subsidy (§7.4, §7.8) | `routes/fleetRules.ts`: optional shared track, payment groups, home connectivity, run shape, train payment/subsidy policies and freight chain geometry; family settlement and the Rust autorouter consume the same policy; train access is precomputed by the encoder | 1860 connectivity, 18GB joint revenue, 1877 Stockholm shared payments, 1825 double-headers (not implemented) |
| Limits per kind of train (§7.9)                                                                           | `TrainRules.limitReason`, judged for depot and intercompany purchases                                                                                                                                                                                                 | per-type limits in 18VA-style mixed fleets                                                                   |
| Director's certificate sold into the pool, receivership (§6.3, §8)                                        | `StockRules.presidencyLapses`; a sale's `lapse` part-exchanges with pool shares                                                                                                                                                                                       | 1830-family receiverships through bankruptcy only                                                            |
| George Hudson manoeuvre (§7.8.6)                                                                          | `EarningsChoice` `top-up` and `EarningsRules.treasuryTopUp`                                                                                                                                                                                                           | none known                                                                                                   |
| Game ending after the current operating round (§10.1)                                                     | `GameEnding.finalOperatingRound`, preferred over a set-end ending in the same set                                                                                                                                                                                     | 1817-style ends at a set's end                                                                               |
| Eight players (§2.4)                                                                                      | an eighth player colour, Brown                                                                                                                                                                                                                                        | 1862 only                                                                                                    |
| A company reset to an unstarted charter (§4.3, §7.12)                                                     | `resetCompany` takes `CompanyResetTerms`: every certificate back to a bank pool, and whether the home station stays                                                                                                                                                   | 1817's merged and acquired companies (the defaults)                                                          |
| A further choice at a chosen hex, such as the line a small station takes (§7.6.4)                         | UI: `MapLocationChoice.followUp`, offered beside the hex by `LocationFollowUpPicker`, which shares `followHex` with the tile picker                                                                                                                                   | any title choosing among a hex's lines, cities or tokens                                                     |

Title-owned, as no other surveyed title shares them closely enough: the Parliament Round and
obligations; chartered and non-chartered capitalization by company; permits; warranties; the 2:1
share merge with option shares (mergers, acquisitions, refinancing); company bankruptcy and
restart; the LNER.

## Rulings on gaps and ambiguities

To confirm with the owner:

- **Returning half (§5.2.4 step 1)** is done by every holder at once, as the rules allow; Example
  #2 needs it, and Example #1's final holdings come out the same. Swaps then come only from the
  Bank Pool.
- **The director's exchange (§5.2.4)** applies to the survivor's director holding fewer than six
  merging shares (both companies' shares together), which is how Example #1 reads; the
  non-survivor's shares are handled as counts, since they all leave play.
- **Stations beyond the limit after a merger (§7.5.6)** are removed automatically: unused ones
  first, then the last placed. The rules give the director the choice.
- **Fines (§4.3)** come from cash first, then from the fined charter's shares sold at par, only
  as many as the remainder needs; the charter's other shares return to the IPO without
  compensation, and anything still owed is raised from the player's other shares.
- **A fine nobody can pay (§4.3)** is forgiven once the fined player has nothing left to sell.
- **A company reset for a missed obligation** may be started again from the next stock round, not
  in the Parliament Round before it (§4.3).
- **Final wealth** values shares at what they would sell for, half price for a train-less company.
- **The displaced home station (§7.2)** is the one in the city's highest space, as spaces fill in
  order.
- **Bankruptcy**: a train-less company that can raise nothing declares it; a director-less one is
  bankrupted by the system only once its own operating turn has ended without a train.
- **A forced train purchase (§7.11)** after the company sold its own shares or refinanced is from
  the bank's depot only, not from another company.
- **Acquisition (§5.1.2, §7.14)** at the end of the turn needs a train in either company, not both.
- **A stalemate (§10)**: once no company is running and no player can pay for the cheapest
  start (a director's certificate at £54), nothing can change again, so the game ends at once and
  wealth decides. The rules do not foresee it; the bot sweep reached it (seed 127, three
  players, the last company bankrupt at the bottom of the market).
- **Two freight runs between the same two places (§7.8.1)** score the distance between them once,
  the higher amount. Their ends already pay once for the company, so a second run over the same
  ends earns nothing. The places are the two ends as they pay, a whole off-board area being one
  place, so a detour between the same ends earns no second bonus either. Confirmed by the owner on
  2026-11-09, who thought it unlikely that the rules allow an exact duplicate route; the rules
  do not address it.
- **Permanent freights that share one end (§7.8.1)** each score their own distance, since the rules
  let them run separately. The research engine joins every freight that touches another into one
  chain and pays only that chain's outer ends, which comes to less in 31 of 5,232 recorded runs.
  The owner left this reading in place on 2026-11-09 without ruling on it.
- **Not built:** the §11 variants (fewer train kinds, shorter game, new players). Game length and
  eight stations are options.

## Verification

- **Routes:** `routes.spec.ts` reproduces the rulebook's "Calculating Train Routes" ENR examples
  (1F, 2F from a port, 2E with 2/3E skipping an already paid stop, 2/3L with its £40 subsidy,
  2F with 2L and chained 1F trains), and adds two permanent freights between the same two places.
  Seven native WASM examples agree exactly with canonical revenue and subsidies.
- **Mergers:** `mergers.spec.ts` reproduces §5.2.6 Example #1 (N&E and WStI at £134) and §5.2.7
  Example #2 (train-less N&E and I&B at £86): final holdings, prices and option payments.
- **Openings and operations:** Parliament, charters, obligations and fines, non-chartered starts,
  station purchase, home placement, builds, warranties and limits by kind.
- **Whole games:** a seeded bot (`test/bot.ts`) plays games of two to eight players from the
  Parliament rounds to the LNER, the broken bank or the top of the market; three run in the suite
  and a 28-game sweep runs with `SWEEP=1`.
- **Other titles:** every other 18xx title's suite passes. Their runtime-contract snapshots
  changed only by the additive optional fields above, but those change the canonical state
  schema, so every 18xx title (1817, 1830, 1832, 1833NE, 1846, 1850, 1870, 1894, Shikoku 1889,
  The Old Prince) needs a logic major at its next release.

## Native autorouter verification

The native migration uses the declared family policy described in
[the autorouter design](autorouter-design.md#declared-fleet-settlement-and-native-search).
1862 no longer owns settlement algorithms or search bounds. Both bot and UI
worker use `Autorouter`; WASM imports only the deadline clock. Canonical family
settlement checks the returned routes and exact revenue and subsidy.

The old freight code selected the first permanent train as the required chain's
anchor. Settlement now considers every eligible anchor, as part of choosing the
highest-paying legal grouping. Chains reject branching and any endpoint cycle,
including a loop internal to a purported longer chain. Required freight alone
must form one chain before a permanent run can extend it.

The fleet stage of the native solver was then rewritten as a weighted cover
searched by branch and bound, described in the autorouter design. The
measurements below are of that solver, with the first native solver's
(`0ea2f9e1e`) beside them.

Measurements below use the saved WStI position (five BL, one BF, two AL, two AF),
now in `test/fixtures/wsti-10-trains.json`. Timing is wall time on the development
container, not a performance guarantee. The solve budget applies to native
search; encoding and canonical validation are additional work.

| Native search budget | TypeScript solver | First native solver | Native revenue | Native treasury subsidy | Native wall time | Exhaustive |
| -------------------- | ----------------: | ------------------: | -------------: | ----------------------: | ---------------: | ---------- |
| 25 ms                |                 — |         £700 + £170 |           £680 |                    £180 |            40 ms | No         |
| 150 ms               |                £0 |         £700 + £170 |           £680 |                    £180 |           157 ms | No         |
| 2 s                  |                £0 |         £700 + £170 |           £680 |                    £180 |          2.006 s | No         |
| 20 s                 |                £0 |         £700 + £170 |           £700 |                    £190 |         20.009 s | No         |

The 25 ms solve establishes a positive returned operation inside 150 ms including
encoding and validation; the 150 ms _search_ budget itself is not a 150 ms wall-time
promise. The best company income found, £890 at 20 s, is not proved optimal. Up to
2 s the rewritten solver returns £860, £10 less than the first native solver's
£870: it searches the ways of grouping the freight trains in turn, and the first,
seven other trains beside one freight, is not proved inside 2 s. The position is
a stress case that play cannot reach. It holds seven Local trains where §7.9
allows three of a type, and recorded games reach seven trains in all. The path
search hands the fleet stage 84/34/13/11 candidates per profile (BL/BF/AL/AF);
equivalent ones are dropped there by dominance.

Two six-train reductions of the same position completed exact native proofs:

| Fleet                 | Revenue | Subsidy | Native exhaustive wall time | First native solver | TypeScript solver             |
| --------------------- | ------: | ------: | --------------------------: | ------------------: | ----------------------------- |
| 5 BL + BF             |    £610 |    £170 |                      449 ms |             36.35 s | Still non-exhaustive at 120 s |
| 2 BL + BF + AL + 2 AF |    £460 |     £90 |                       98 ms |             11.94 s | Still non-exhaustive at 120 s |

Timings vary with load. The repeated-path regression requires two identical N/M
trains to use the same physical route to collect different stop payments.

A search cut short used to report less than the game pays for the routes it
returned, which `Autorouter.solve` refuses: WStI at a 25 ms budget reported
£650 + £180 for routes that settle at £680 + £180. The search scores a fleet
under the paid stops and chain grouping it came to, and canonical settlement
chooses both afresh. The solver now searches the routes it returns again, alone
and to the end, so the two agree at every budget.

Recorded play: 100 finished 1862 games from 18xx.games, 5,263 runs, each solved
with a 5 s cap. All 5,232 positions that set up are proved optimal: none reaches
the cap, the slowest takes 156 ms (ECR in phase D with six trains), and the
median for six trains is 17 ms. None pays less than the recorded run and 1,131
pay more. The first native solver proved 4,622 and left 610 at the cap. The
same-two-ends ruling changes none of these totals, since no recorded answer runs
two freights between the same two places. Valued in the research engine, 5,201
answers agree and 31 are lower there, the shared-end case in the rulings above.

The bot sweep now audits every zero-revenue operation with an independent DFS
through `RouteNetwork`, using canonical validation to find a positive legal
single-route witness. This check is independent of the solver under test. Logs
are written to `/tmp/1862-sweep.log` and archived with measurements under
`/workspace/tmp/1862-autorouter/`.

The same 28 seeded games completed before and after:

| Sweep                      | Operations | Zero-revenue operations | Zero runs with a positive legal witness |
| -------------------------- | ---------: | ----------------------: | --------------------------------------: |
| Previous TypeScript solver |      1,818 |                     189 |                                      93 |
| Native solver              |      1,804 |                      92 |                                       0 |
| Rewritten native solver    |      1,765 |                      95 |                                       0 |

The final `SWEEP=1 pnpm exec vitest run src/sweep.spec.ts` passed in 812.33 s.
The original audit failed on the 93 false zero runs. Game trajectories differ
because the bot now collects revenue it previously missed. A complete earlier
native sweep also passed with the same totals. The sweep on the rewritten solver
with the same-two-ends ruling passed in 739.16 s; no solve disagreed with
canonical settlement.

Verification for this migration:

| Package                |                                        Passing tests |
| ---------------------- | ---------------------------------------------------: |
| `libs/18xx`            |                                                  313 |
| `libs/18xx-autorouter` |                                                   38 |
| Autorouter Rust core   |                          57 (9 unit, 48 correctness) |
| `games/1862`           | 60, with 2 opt-in tests skipped in the default suite |
| `games/1817`           |                                                  202 |
| `games/1830`           |                                                  184 |
| `games/1832`           |                                                  350 |
| `games/1833ne`         |                                                   70 |
| `games/1846`           |                                                  383 |
| `games/1850`           |                                                  141 |
| `games/1870`           |                                                  198 |
| `games/1894`           |                                                   69 |
| `games/shikoku-1889`   |                                                  121 |
| `games/the-old-prince` |                                                  111 |

`pnpm lint` and `npx tsgo --noEmit -p .` passed in all three changed packages
(`18xx`, `18xx-autorouter`, `1862`). The family and autorouter libraries were
rebuilt before game tests. The 1862 UI build and bundle passed; executing the
emitted module worker against its emitted WASM returned £700 plus £170 subsidy
for WStI. A 1,434-position ordinary-title corpus completed exhaustively with
identical routes and revenue before and after the native migration.

The rewrite and the same-two-ends ruling touch only fleet policies, which 1862
alone declares. Every row of the table was run again on the rewritten solver
with the counts shown. The 1862 UI build and bundle passed again, and the
emitted worker returned £680 plus £180 subsidy for WStI with a 150 ms budget.
The ordinary-title corpus was not run again.

## Open items

- **Exhaustive fleet solving:** every recorded run proves in well under a second, but a fleet
  beyond the train limits (the ten-train WStI position) still times out before proving
  optimality. Standing run instructions must continue to honor `exhaustive`; timed projected
  runs and the run panel return the best validated operation.
- **Freights sharing one end:** each scores its own distance; the research engine pays one
  chain. See the rulings.
- **18xx playground:** not registered; it needs a `@tabletop/1862/scenarios` module of prepared
  positions.
- **Merged station choice:** stations beyond the limit after a merger are removed automatically
  (see rulings).
- **Variants:** §11's fewer train kinds, shorter game and new-player rules are not built.

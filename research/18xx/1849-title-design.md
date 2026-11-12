# 1849: The Game of Sicilian Railways — title design

Rules authority: _1849 Rules of Play_, rules version 6 (Jason Begy and Scott Petersen), with the
1.1 and 1.0 player aids. PDFs and text copies are in `/workspace/artassets/1849`. Section numbers
below are the rulebook's. The research engine (`g_1849`) supplied hex coordinates, terrain, tile
track layouts and counts only, checked against the rulebook.

## What makes 1849 different

| Mechanism                                                                                     | Rulebook                | Family support                                                                                             |
| --------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Narrow, standard and dual gauge track; gauge changes only at stops                            | §10.1, §10.3, §10.5.1   | New: `TilePath.gauge`, gauge-aware reach, routes, upgrades and the autorouter; see `track-gauge-design.md` |
| Hex trains weighting gauges (R6H reversed)                                                    | §10.5.1                 | `'hex-edges'` measure plus per-gauge weights (gauge work)                                                  |
| Two non-port stops per run; ports only at a run's ends                                        | §10.1, §10.5.1          | Ports are offboards (terminal); declared minimum non-offboard stops (gauge work)                           |
| Terrain cost by gauge of new track, paid again on every upgrade; SIGI halves standard gauge   | §10.3.1                 | Title `TrackRules.terrainCost` with the family new-track helper                                            |
| Grey cities' three revenue values                                                             | §10.5.2                 | Staged revenue by phase (`revenueStagesByPhase`)                                                           |
| Incremental capitalization, 20% float                                                         | §9.3, §9.4              | `treasuryShareStockRules` / `treasuryShareCompanyRules` (1846)                                             |
| President buys 20–40% in the start                                                            | §9.4                    | New: `CompanyRules.additionalStartCertificates`, `StartCompany.additionalCertificateIds`                   |
| Fixed, dealt start order; Garibaldi chooses its home; closed corporations go last             | §2.2, §9.4, §9.4.1, §11 | Title order in state, gated by `startMarketSpaces`; Garibaldi through `startHomes`                         |
| Token fee paid by the corporation at start                                                    | §9.4                    | Home placed on float with the fee (others), `StartHome.cost` (Garibaldi)                                   |
| Two-share "last certificate"                                                                  | §9.3, §9.6              | Certificates already sized by shares; purchase rule in `purchaseTerms`; sales pick ten-percents first      |
| Market blue zone closed until phase 16                                                        | §5                      | Title: a second chart without the blue spaces drives dividend and round-end moves                          |
| Dividend ≥ price → right; withheld or no train → left; otherwise no move                      | §10.5.3                 | Title `EarningsRules.marketEffect`                                                                         |
| Financial activities after buying trains: issue any treasury certificates or redeem one       | §10.8                   | New: `CorporateFinanceRules.timing: 'after-trains'`; certificates move by shares                           |
| Closed box, closure and restart with home reserved                                            | §5, §11                 | Zero-price closure with new restartable `closeShareCompany(…, restart)`, `keepsAllStations`                |
| Emergency money raising closes the corporation, president may take a loan or leave            | §10.7                   | New: `TrainFundingRules.insolvency`, `DeclareBankruptcy.choice`                                            |
| L.750 per loan off final wealth                                                               | §13                     | New: `ValuationRules.playerItems`                                                                          |
| Ends after a corporation reaching L.377 operates; bank broken ends the set                    | §13                     | Title trigger; `bankExhaustionAtSetEnd`                                                                    |
| Messina earthquake at the first 12H                                                           | §6, §12                 | Title `PhaseRules.changes`                                                                                 |
| Waterfall private sale with bids; SCE price falls                                             | §8                      | `waterfallAuction` as 1830                                                                                 |
| RSA gives the first corporation's president's certificate, par 68/100, treasury from the bank | §8.1                    | `awardCertificates` + `requirePar`; title funding on par                                                   |

## Family surveys for the new family assets

- **Start with further certificates.** Researched titles that sell more than the president's
  certificate in the start action: 1849 and its Two Sicilies sibling (up to 40%); most titles
  sell one certificate (1830, 1846, 1889, TOP), 1862 sells a three-share director's certificate
  as one. Shared: each further certificate is an ordinary purchase evaluated on the state the
  earlier ones leave (limits, ownership cap, price). Title: how many. Not done: buying from the
  market pool in the start.
- **After-train corporate finance.** 1846, 1833NE and 1894 issue and redeem before running;
  1849 does it after buying trains. Shared: one action and one choice list; the step is the
  title's timing, and once used the company buys no more trains. Certificates now move by share
  count, so a two-share certificate works; single-share titles are unchanged.
- **Restartable closure.** 1846, 1833NE, 1850 and 1870 retire a closed corporation; 1862 and 1817
  reset one through their own procedures; 1849 closes (assets lost, holders unpaid) and later
  restarts. Shared: `closeShareCompany` with a `restart` term that returns the certificates to a
  bank pool and clears the charter through `resetCompany`. Title: where the certificates go and
  the reservation of its home.
- **Insolvency.** 1830-style titles bankrupt the president (end of game); 1846 and 1817 eliminate
  the player; 1849 closes the company and keeps the player, who may take a loan or leave. Shared:
  `TrainFundingRules.insolvency` replaces bankruptcy and elimination, the president's choice is
  carried on `DeclareBankruptcy`, and the company's turn ends.
- **Player wealth items.** 1849's loans are the first player-level item beyond cash and
  certificates; `ValuationRules.playerItems` sees the other items so a title can floor a total.

## Rulings to confirm with the owner

(Filled in as they arise.)

## Implemented later or not at all

- Variants (§14): acquiring station tokens, bonds, Electric Dreams.

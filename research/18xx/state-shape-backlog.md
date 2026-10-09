# State shape: definition data out of the 18xx State

The title-state composition and removal of unused mechanism fields were implemented on
2026-10-03; see [composed title state](title-state-design.md). This note covers the
remaining definition-data reductions tracked in issue #87. It was first written for TOP
alone and revised on 2026-10-09 across TOP, 1889, 1830, 1846, 1817 and 1832.

## Release constraints (2026-10-09)

The Old Prince is the only published 18xx title (alpha visibility). It has one hosted
game that matters, `cPP23MM5f4tdggTpOAz3L`, in its final operating set after the
first-diesel trigger; a second TOP game started on 2026-10-08 will be deleted. The owner
decided that the finished game may become unviewable. So:

- No saved-state reader or undo-patch migration is written. TOP's existing reader for its
  empty `usedPrivatePowerIds` placeholder is deleted. The deployed-game replay stays: its
  raw fixture is unchanged, and the spec converts each recorded State to the current
  shape before replaying. When the game ends, its full history replaces the fixture.
- The change ships as TOP Logic and UI `2.0.0`, published only after that game ends. The
  branch may merge to main before then; TOP is not released from it until the game ends.
- 1889, 1830, 1846 and 1817 have no published artifacts or hosted games; their shape
  changes freely. 1832 merges to main before this work, so the changes cover it.

## Measurements

Final State of each title's recorded finished game, compact JSON, in KB. Measured by
replaying the playground's finished-game fixtures (`apps/18xx-playground/src/demo/fixtures`)
and comparing every state path between the opening and each later State.

| Field                                   | TOP  | 1889 | 1830 | 1846 | 1817 | 1832 |
| --------------------------------------- | ---- | ---- | ---- | ---- | ---- | ---- |
| Whole State                             | 75.1 | 48.9 | 58.7 | 37.1 | 92.4 | 76.0 |
| `stockMarket.spaces`                    | 6.6  | 10.3 | 13.9 | 3.8  | 3.9  | 18.7 |
| Fixed certificate fields                | 11.7 | 5.9  | 6.7  | 4.4  | 17.3 | 11.1 |
| of which `certificateLimitCount`        | 3.5  | 1.8  | 2.0  | 1.3  | 5.4  | 3.3  |
| Retired certificates                    | 1.6  | 0.7  | 0.6  | 0.5  | 13.8 | 9.3  |
| Removed stations and rusted trains      | 2.3  | 0.5  | 1.1  | 1.2  | 6.0  | 2.6  |
| Company and pool names                  | 1.0  | 0.4  | 0.5  | 0.3  | 1.4  | 0.6  |
| `finalWealth` (game end only)           | 5.1  | 5.2  | 5.4  | 2.8  | 6.3  | 2.2  |
| `turnManager.series` (one entry a turn) | 16.4 | 10.2 | 13.5 | 8.5  | 23.2 | 17.4 |

TOP's deployed game at action 181 was 52.4 KB, 45% of it definition data; 11.4 KB of
that was its six unsplit branches' certificates and stations.

## Evidence surveyed

`research/18xx-2026-09-08/data/title-traits.json` and the research source, for each
mechanism below, plus the six implemented titles.

- **Certificates.** Once a certificate exists, only its owner, pool and retirement change,
  in every implemented title and nearly every researched one. The set of certificates is
  not fixed: 1817 issues shares on start and conversion and opens shorts; 1832 issues a
  System's certificates at formation, including two-share certificates exchanged from a
  component; 1856's CGR and 1828's systems do likewise; company resets (1817, 1849, 1858,
  18Norway, 18EU, 18VA, 18Neb) retire and reissue under the same company id. The set also
  depends on setup: TOP's PEIR roster is shuffled, IB exists only with four players, and
  1846 removes corporations and privates at random. Faces that genuinely change (1856
  CGR weights, 1880's president size at par) fit a rule of retiring and reissuing.
  Certificate-limit weight already belongs to `StockRules.certificateWeight` and market
  zones, not to the record.
- **Stock market.** No researched title changes spaces during play. Markets do vary by
  option, player count or map package (1825, 1861, 1867, 1870, 18Mag, 18Tokaido,
  System18), and movement is sometimes a rule over phase or company type (1849, 1844,
  1867, 1856) rather than a fixed graph. 1817 and 1846 are one-row markets; space colour
  carries rules (1817 liquidation, par colours, zone limits).
- **Trains.** The depot depends on options and player count (1830 extra 6-train, 1846,
  1832 diesels) and some titles insert or create trains during play (1882, 18EU, 1873,
  1846's independents). Depot order matters.
- **Names and existence.** Printed names are definition data. Which companies exist is
  not: setup removes them (1846, TOP), play creates them (1832, 1828, 1866), and resets
  revive them.
- **Stations.** Allowances change during play (1817 purchases and conversions, 1846
  absorptions and C&WI, 1832 Systems, mergers, resets), and actions and other State refer
  to station ids (`PlaceStation`, TOP's split allocation, merger transfers).

## Changes

0. **Preparation.** Delete TOP's saved-state reader and the family's `readStored` hook.
   The deployed-game spec rebuilds recorded States with `RecordedHistory` and converts
   them in test code; each later change extends that converter. The opening-position
   digest hashes setup without the definition data this plan removes, so its digests
   stay the check that setup randomness is untouched while the shape changes.
1. **1846 uses shared state composition.** Replace its hand-written schema and hydrated
   class with `composeEighteenXXState` and `defineEighteenXXState`, keeping its own
   runtime, handlers and visibility projector, and add its runtime-contract snapshot.
   Later changes then land once for all titles. The family validation splits into
   `validateRailwayComponents` (map stations, depot, stations, market, finances), which
   every title runs, and the operating-sequence checks of `validateRailwayState`. 1846
   runs the components and the sequence checks its own sequence satisfies; it leaves out
   the track-step, train-funding and earnings checks, because it keeps track construction
   open while shares can still be issued or redeemed, funds trains through its own
   emergency funding, and continues receivers' earnings through its own states. Its
   independents' 2-trains are declared depot `assignedTrains`: owned from purchase,
   never in the depot, and outside its supply numbering.
2. **Market spaces become a title definition.** State keeps `stacks`. Each title defines a
   `StockMarketChart` (its spaces, colours and move graph), carried on `StockRules.market`
   and in `TitleComponents`, so hydration validates the stacks against it. Chart methods
   read spaces, moves, company positions and market order and validate a placement;
   `placeStockMarker` and `restoreStockMarker` stay chart-free for recorded moves whose
   spaces the chart already produced. Family helpers that need prices or order take the
   chart; the UI reads it from the session (`stockMarketChart`), title UIs from their
   title. Movement remains the chart's graph, which title rules may bypass (1832's sale
   descent, 1817's liquidation). **Intentional limit:** one chart per title. No current
   title's market depends on options or player count; a title that needs that would
   select its chart from its configuration when its rules are built.
3. **Certificates drop their redundant fields.** `certificateLimitCount` is removed: the
   limit weight belongs to `StockRules.certificateWeight`, which starts from
   `standardCertificateWeight` (one per certificate, none for a short) and applies title
   and market exemptions. `president` is recorded only when true. `kind`, `shares`,
   `companyId` and TOP's `number` stay on the record. Deriving the whole face from the id
   was rejected: it makes ids carry meaning that every title and every recorded action
   must follow, and 1832's four-share System president and carried-over two-share
   certificates and 1846's one-share independent president would each need an id
   scheme. Storing each kind of certificate once in a State table was measured at only
   1–2 KB more per finished game than this change, against a lookup at every reader.
4. **Retired and removed records are dropped.** Retired certificates, removed stations
   and rusted or exported trains leave State.
    - Certificates leave through `removeCertificates`, and the `retired` flag goes: every
      certificate in State is in play.
    - Ids must stay unique for the whole game, because recorded Actions and metadata name
      them. A company records `lastIssuedNumber`, the highest number of a certificate or
      station that has left play; `nextIssuedNumber` continues above it and above every
      number still in play. Random ids were considered and rejected: a 21-character id
      costs about ten bytes more at each mention, in State and in every Action naming it
      (about 1 KB more State in a finished 1817 game against 0.15 KB of counters), each
      new id would consume a draw from the game's randomness, and ids lose readability.
    - History describes an Action from its metadata, not from current State, where the
      certificate may no longer exist. Share purchases, starts and private exchanges
      record the certificate's `shares`; a private's exchange effect records the received
      company and shares; a certificate exchange records the surrendered company and
      number and the received company and shares.
5. **Names, depot and final wealth.** Company and pool names move to the definition. The
   depot's roster comes from the resolved configuration, with State keeping what remains
   in order and any trains created during play. `finalWealth` labels are built by the
   UI instead of stored. 1846's independents' 2-trains move into the supply, as upstream
   models them: players plus four 2-trains (seven in the two-player variant), with setup
   assigning the first two to MS and Big 4. Both independents are in every game and
   are always bought, but in the two-player game possibly only after preliminary
   operating rounds, so assigning at setup keeps the depot's count unchanged until then.
   `assignedTrains` is then removed.
6. **One buyer field for purchase offers.** `buyer: Owner` replaces both a company
   offer's `companyId` and a player offer's `buyerPlayerId`, in the State union and in
   `RespondToPurchaseOffer` metadata. `OfferPurchase` input stays a company buyer.

Changes 2 to 4 reduce a finished game's State by roughly a fifth (1846) to two fifths (1832);
estimated, not yet measured.

## Deferred

- **Stations as placed positions plus a count**, and creating TOP's branches at the
  split. Both change station identity in action inputs and other State, and the saving
  outside TOP is under 1.5 KB per game.
- **1846 on the shared runtime factory.** The factory builds the family's operating
  sequence and has no visibility projector; 1846's sequence differs.

## Not a change

`turnManager.series` stays. It is the index of the game's turns. Round and phase managers
recording their own starts and ends are wanted later for the same reason, and 18xx's
`operatingSet` and `phaseEvents` are candidates to be written through them.

## Verification

After each change: regenerate the runtime-contract snapshots deliberately, keep the
opening digests passing, and replay every title's finished-game and bankruptcy fixtures
to the same final wealth. Re-measure the table above when done.

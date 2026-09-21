# Helpers for ordinary title rules

The rule callbacks stay the seam between a title and the family. This adds plain
functions that compute the ordinary answers, so a title states only what differs:

- `openShares(state, companyId)` and `presidentCertificate(state, companyId)`;
- `sharesStillToFloat(state, companyId, soldPercent, unsold)`: how many more shares must
  leave the certificates the title counts as unsold;
- `fullCapitalizationPayments(state, companyId, sharesStillToFloat)`: nothing until the
  company can float, then par times its share count from the bank, once;
- `allSharesHeld(state, companyId, held)`: the sold-out test, with the title saying which
  holdings count;
- `marketSaleTerms(state, companyId, terms)`: a sale to a bank pool at the market price;
- `floatedCompaniesInMarketOrder(state)`: operating order by stock price;
- `certificateWealthItem(state, certificate, value)`: a final-wealth line;
- `RailwayMap.reservedLocationIds(companyId)` and `RailwayMap.stationReservations()`;
- `createCompanyStations(companyId, count)` and `homeStationId(companyId)`: a company's
  station markers, with the home first;
- `requiresStationRoute(map, tileSet)`: a company must own a train once it has a route.

## Evidence surveyed

`capitalization-method`, `capitalization-amount`, `capital-release-condition`,
`flotation-condition`, `flotation-counting-basis`, `stock-price-movement` and
`final-valuation` in `data/title-traits.json`.

- **Capital.** Full capitalization in 71 titles, always par times share units, released
  at flotation in 73; incremental in 84, where each share purchase pays the company and
  no flotation payment is due. `SharePurchaseTerms.recipient` already covers the second.
- **Flotation.** A percentage sold: 20 (53 titles), 50 (51), 60 (49), 100 (30), 40 (23),
  30 (11); by phase in 20 and by formation in 17. It is counted as shares outside the
  initial offering in 116, outside offering and market in 5, and with reserved shares
  counting in 2 — which certificates are "unsold" is the title's.
- **Sold out** moves the price in 110 titles; holdings in the market or in other pools
  count differently by title (22 move on market holdings).
- **Final value** is cash plus holdings in 82; debt, penalties, excluded privates or
  half-value trainless shares adjust it in about 30.

Before this, 1889 and TOP each wrote out the sold-out test, the flotation count, an
identical flotation payment with a literal 10 for the share count, the president
certificate lookup, market sale terms (1889 twice), operating order, the final-wealth
label, home locations, station markers under an `:home` id convention, and built a
`RailwayMapState` by hand to ask whether a company has a route.

## Shared behaviour and title-owned choices

Shared: the computations above. Title-owned: every parameter — the percentage, which
certificates count as unsold or as held, the pool, limits and price movement of a sale,
the value of a certificate, who else operates (TOP's PEIR), and whether the ordinary
answer applies at all (TOP's PEIR needs no train).

## Support now and later

Now: full capitalization and percentage flotation. A title with incremental
capitalization returns no flotation payments and needs none of this. Flotation by phase
or formation stays a title's own `sharesToFloat`.

Intentional limits: `fullCapitalizationPayments` pays par times the company's share
count; partial capitalization and escrow (3 titles) are a title's own payments.

## Compatibility

Nothing serialized changes and no rule changes its answer: both titles have ten-share
companies, so par times share count equals the literal ten. Seeded setups, runtime
contracts and the deployed game's transitions must be unchanged. Logic Artifacts only.

## Examples that verify the decision

Each helper at its boundary: a company one share short of floating and exactly floated,
at 50 and 60 percent; capital paid once; a sold-out company with a share in a pool the
title counts or does not; sale terms; operating order skipping unfloated and closed
companies; station markers and the home id; the playground's flotation, sold-out,
funding and ending tests for both titles.

# Railheads

`@tabletop/railheads` is the deterministic logic package for the Railheads series by Pontus Nilsson, a share-and-industry railroad game for 3–5 players. Its companion Game Client package is `@tabletop/railheads-ui`.

## Editions

One package serves the series. An edition (`src/editions/`) is data: its companies, hex map, Lay Track rules, track costs, revenue values, obsolescence bands, round timer and starting cash. `src/editions/germany/` is the first; the game configuration's `edition` option selects it. The shared rules (action-space pricing, share and sealed-bid auctions, track laying, payouts, the round loop) read only the edition definition.

Germany is the only edition implemented. The Midwest, Switzerland, Denmark and England & Wales need rule extensions the Germany rules do not use: demand areas and per-disc site pricing, loans and tunnels, bridges and government bonds with wealth tax, and per-action track costs with a Tube connection bonus. Each belongs in its own state, action and payout modules beside the shared ones, with its edition registered in `src/editions/editions.ts`.

## Rules

Where the rulebook is silent or conflicts with the printed board, the choices made are recorded in [rules interpretations](docs/rules-interpretations.md), each backed by a test.

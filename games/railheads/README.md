# Railheads

`@tabletop/railheads` is the deterministic logic package for the Railheads series by Pontus Nilsson, a share-and-industry railroad game for 3–5 players. Its companion Game Client package is `@tabletop/railheads-ui`.

## Editions

One package serves the series. An edition (`src/editions/`) holds its companies, hex map (orientation, sites, states, demand areas and lakes), round timer and starting cash, and supplies its rule differences as functions: track cost, site capacity, whether a company may build an industry site, and the game-end payout per share. `src/editions/germany/` and `src/editions/midwest/` are implemented; the game configuration's `edition` option selects one. The shared rules (action-space pricing, share and sealed-bid auctions, track laying, payouts, the round loop) read only the edition definition.

Switzerland, Denmark and England & Wales need further extensions: loans and tunnels, bridges and government bonds with wealth tax, and per-action track costs with a Tube connection bonus. Where one changes a rule the shared modules apply, it belongs in a new edition function; where it adds a mechanism, in its own state, action and payout modules beside the shared ones.

## Rules

Where the rulebook is silent or conflicts with the printed board, the choices made are recorded in [rules interpretations](docs/rules-interpretations.md), each backed by a test.

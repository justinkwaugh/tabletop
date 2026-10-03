# PROTOTYPE, throwaway: oracle styles

Question: should the oracle drop its white centre or be restyled to suit the board, keeping its
pointing and the favoured player's colour?

Styles (gallery at `/prototype-oracle`; on the board, `window.setOracleVariant('G')`):
A current, B clear tile, C clear and open temple, D sanctuary (city temple on a pin), E tholos from
above, F sanctuary with a road neck, G teardrop sanctuary with a marble precinct, H the same in
bronze, I G with a brighter temple.

Verdict (2026-10-03): G's teardrop precinct ending road-wide at the hex edge, I's brighter temple
when favoured, G's marble when unfavoured, temple at 88%. Shipped as the production OracleArt.

The `recording/` specs rendered the gallery and board crops (dev server on port 5191; move them into
`tests/` to run).

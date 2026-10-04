# 1846 opening, stock and initial construction

GMT second-printing setup and private distribution for 3–5 players, followed by
the first stock round and Michigan Southern's first track step. The runtime pays
private income, establishes operating order, and accepts up to two legal yellow
tile lays before stopping at `ReadyForRoutes`. No winner is declared.

The boardless map and phase-I tile/depot supply are implemented. Routes, earnings,
remaining operating steps, later tile colors and train variants, private powers,
and two-player play remain unimplemented. Physical-board artwork is not supplied.
The two independent railroads receive their real ownership, cash, train, and
station assets at settlement. Removed corporations retain blocking home stations.

Run `pnpm --filter @tabletop/1846 build` and
`pnpm --filter @tabletop/1846-ui build`, then open `/1846` in the 18xx playground.
Alternatively run `pnpm --filter @tabletop/1846-ui dev` on port 4193.
Run logic tests with `pnpm exec vitest run games/1846/src`.

Use the harness's Protected mode to inspect Player, spectator, and Host views.
Ordinary hotseat conceals cards until explicitly opened, but retains canonical
state locally. Each selection reveals the next packet and blocks player Undo;
recorded history remains reversible. Projected Exploration is not yet supported.
No existing title or saved-state compatibility reader is changed.

See [the design note](../../research/18xx/1846-opening-design.md) for the family
survey and boundaries, and [the stock-round note](../../research/18xx/1846-stock-design.md)
for the second slice.

See [the construction design](../../research/18xx/1846-track-design.md) for this slice.

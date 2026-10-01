# 1830

`@tabletop/1830` is the deterministic logic package for 1830: Railways & Robber Barons.
It depends on `@tabletop/18xx` and `@tabletop/common`; its companion Game Client
package is `@tabletop/1830-ui`. The title is hosted only by the
[18xx Playground](../../apps/18xx-playground/README.md).

The public entry point exports `EighteenThirtyMap` (the complete pointy-hex map),
`EighteenThirtyTileSet` (46 shared definitions, 85 pieces), the companies, privates,
trains, phases and market, and the `Definition` whose opening is the reserved
waterfall auction for 2–6 players. The configurator offers the extra 6-train and
multiple brown shares from the IPO. Scenario
initialization is available from `@tabletop/1830/scenarios`.

## Rule evidence

The rules follow the Lookout 1830-RE rulebook. See the
[title design note](../../research/18xx/1830-title-design.md) for sources, the
delivery slices, and the intentional limits so far. Canada's two hexes are one
area, as are the Gulf's: a route visits only one of each pair. A company that must buy a train may
buy another company's for up to its face value, its president paying what the
treasury cannot. The three recorded games replay to their recorded final wealth;
one is the playground's finished game. The privates carry their powers and awards: C&A's PRR share, B&O's
presidency and par (and its closure on B&O's first train), C&StL's and D&H's lays,
D&H's station, and M&H's exchange for an NYC share. Stock turns are sell–buy–sell,
brown-zone shares of one company can be bought several at a time, and players sell
privates to one another by offer and acceptance. Erie reserves both Buffalo cities; its home goes in the first
city when it first operates, unless Buffalo already has a tile with track, when its president
clicks the city on the map.

## Development

Run `pnpm --filter @tabletop/1830 build` to emit JavaScript and declarations into
`esm`, `pnpm --filter @tabletop/1830 check` to check types, and
`pnpm --filter @tabletop/1830 test` for the specs.

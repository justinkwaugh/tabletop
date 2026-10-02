# 1817

`@tabletop/1817` is the deterministic logic package for 1817. It depends on
`@tabletop/18xx` and `@tabletop/common`; its companion Game Client package is
`@tabletop/1817-ui`. The title is hosted only by the
[18xx Playground](../../apps/18xx-playground/README.md).

The public entry point exports `EighteenSeventeenMap` (the pointy-hex map),
`EighteenSeventeenTileSet` (24 shared tiles and the X00 and X30 title tiles, all unlimited
but X00), the twenty corporations, the eleven privates, trains, phases and the one-row
market, and the `Definition` for 3–12 players. Scenario initialization is available from
`@tabletop/1817/scenarios`.

The opening is a selection auction: players nominate any private, and the bank's $200 of
seed money covers privates sold below face value. Companies are started by auction during a
stock turn. The winning bid becomes the treasury and sets the starting price, and the winner
chooses the company's size (2, 5 or 10 shares, as the phase allows), may contribute privates
at face value, and buys the stations the size needs.

## Rule evidence

The rules follow the reference implementation recorded in the
[title design note](../../research/18xx/1817-title-design.md), which lists the delivery
slices and the intentional limits so far: no train exports, loans, shorts, merger or
acquisition rounds, private powers or game end yet.

## Development

Run `pnpm --filter @tabletop/1817 build` to emit JavaScript and declarations into `esm`,
`pnpm --filter @tabletop/1817 check` to check types, and `pnpm --filter @tabletop/1817 test`
for the specs.

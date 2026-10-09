# 1832

`@tabletop/1832` is the deterministic logic package for 1832: The South, for two to seven
players. It depends on `@tabletop/18xx` and `@tabletop/common`; its companion Game Client
package is `@tabletop/1832-ui`. The title is hosted only by the
[18xx Playground](../../apps/18xx-playground/README.md).

## Rule evidence

The rules follow the 1832 rulebook, version 4.2c (W. R. Dixon, 2006). The board data
(map, stock market, charters) comes from the research implementation, checked against a
photograph of the printed map; coordinates are the printed board's. See the
[title design note](../../research/18xx/1832-title-design.md) for sources, slices, rulings
on ambiguities and intentional limits.

## Development

Run `pnpm --filter @tabletop/1832 build` to emit JavaScript and declarations into
`esm`, `pnpm --filter @tabletop/1832 check` to check types, and
`pnpm --filter @tabletop/1832 test` for the specs.

# Shikoku 1889

`@tabletop/shikoku-1889` is the deterministic logic scaffold for Shikoku 1889.
It depends on `@tabletop/18xx` and `@tabletop/common`; its companion Game Client
package is `@tabletop/shikoku-1889-ui`.

The public entry point exports `Shikoku1889Tiles`, `Shikoku1889TileSet`, and
`Shikoku1889BeginnerTileSet`: 40 shared definitions with 63 standard pieces or
71 beginner pieces. `Shikoku1889PreprintedTiles` supplies all 52 preprinted tiles.
`Shikoku1889Map` exports the complete semantic map, including geography,
construction facts, reservations, and markers. See the [M1 map design](../../libs/18xx/maps.md).
See the [T3 inventory design and evidence](../../libs/18xx/inventory.md), including
the rulebook's extra beginner #57. There is no Game State, initializer,
Action registration, or `GameDefinition` yet, and the title is not registered in
the site catalog. Shared mechanisms will be developed against both Shikoku 1889
and TOP before composing their title runtimes.

## Rule evidence

- Supplied rulebook: `Shikoku 1889 Rulebook.pdf`, 32 pages, available locally at
  `/workspace/Shikoku 1889 Rulebook.pdf`.
  SHA-256: `cb8a11af8adb0467571e24c6d828279b8ac290a950bd1ac60e04afa3ca2ba7a2`.
- [Pinned research implementation](https://github.com/tobymao/18xx/tree/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1889),
  identified there as production. Its game definitions and inherited engine
  behavior can be consulted for canonical rule questions alongside the supplied PDF.

Standard and Beginner Game supplies are separate manifests; their complete runtime
rules remain later work. Shikoku 1889 owns its map, private
powers, setup, rule choices, and round composition. Shared stock, operating, and
financial mechanisms belong in the family library when their semantics match.
See the [family mechanism map](../../libs/18xx/README.md#initial-title-pair).

## Development

Run `pnpm --filter @tabletop/shikoku-1889 build` to emit JavaScript and
declarations into `esm`, or `pnpm --filter @tabletop/shikoku-1889 check` to
check types without emitting files.

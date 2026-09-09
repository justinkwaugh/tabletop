# Shikoku 1889

`@tabletop/shikoku-1889` is the deterministic logic scaffold for Shikoku 1889.
It depends on `@tabletop/18xx` and `@tabletop/common`; its companion Game Client
package is `@tabletop/shikoku-1889-ui`.

The public entry point is currently empty. There is no Game State, initializer,
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

Standard and Beginner Game rules are distinct in both sources; the scaffold does
not select or implement a rules variant yet. Shikoku 1889 owns its map, private
powers, setup, rule choices, and round composition. Shared stock, operating, and
financial mechanisms belong in the family library when their semantics match.
See the [family mechanism map](../../libs/18xx/README.md#initial-title-pair).

## Development

Run `pnpm --filter @tabletop/shikoku-1889 build` to emit JavaScript and
declarations into `esm`, or `pnpm --filter @tabletop/shikoku-1889 check` to
check types without emitting files.

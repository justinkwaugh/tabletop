# The Old Prince 1871

`@tabletop/the-old-prince` is the deterministic logic scaffold for TOP. It depends
on `@tabletop/18xx` and `@tabletop/common`; its companion Game Client package is
`@tabletop/the-old-prince-ui`.

The public entry point exports `TheOldPrinceTileSet` and `TheOldPrinceTiles`:
58 definitions and 164 physical pieces, including all sixteen PEI specials.
`TheOldPrincePreprintedTiles` supplies all 110 preprinted tiles.
`TheOldPrinceMap` exports the complete semantic map, including geography,
construction facts, reservations, and markers. See the [M1 map design](../../libs/18xx/maps.md). See the
[T3 inventory design and evidence](../../libs/18xx/inventory.md). The public `Definition` now loads a strict three-player finance example through
Common Game Runtime. It includes cash, certificates, and control inspection; it is
not full game setup or a playable game. There are no registered gameplay Actions,
and the title is not registered in the site catalog. See the
[shared economic model and title examples](../../libs/18xx/finance.md).

## Rule evidence

- Supplied prototype rulebook: `TOP71_RULES_PROTOTYPE.pdf`, 25 pages, available
  locally at `/workspace/research/18xx-2026-09-08/reference/TOP71_RULES_PROTOTYPE.pdf`.
  SHA-256: `d01911344da66f217bad7e7ca66dfe2acec658b0d17dacb54da67c10e2112f61`.
- [Pinned research implementation](https://github.com/tobymao/18xx/tree/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1871),
  identified there as alpha/prototype. Its directory name refers to TOP.
- Local comparison: `/workspace/research/18xx-2026-09-08/top-rulebook-comparison.md`.
  It records rulebook/source differences and internal rulebook contradictions.

The older rulebook and prototype source do not establish a reconciled current
rules edition. No disputed rule values are encoded in this scaffold.

TOP owns its opening auction, Mainline/Shortline setup roles, Union Bank rules,
PEIR shares and contraction, tranche availability, and branch-splitting procedure.
These procedures can consume shared financial, track, train, and decision modules.
See the [family mechanism map](../../libs/18xx/README.md#initial-title-pair).

## Development

Run `pnpm --filter @tabletop/the-old-prince build` to emit JavaScript and
declarations into `esm`, or `pnpm --filter @tabletop/the-old-prince check` to
check types without emitting files.

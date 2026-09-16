# The Old Prince 1871

`@tabletop/the-old-prince` is the deterministic logic package for TOP. It depends
on `@tabletop/18xx` and `@tabletop/common`; its companion Game Client package is
`@tabletop/the-old-prince-ui`.

The public entry point exports `TheOldPrinceTileSet` and `TheOldPrinceTiles`:
62 definitions, including all sixteen PEI specials and four yellow X/T city curves.
Yellow supplies are unlimited except the single straight (9) and two each of the double-dit tiles (1, 56, and 630–633); other supplies remain finite.
`TheOldPrincePreprintedTiles` supplies all 110 preprinted tiles.
`TheOldPrinceMap` exports the complete semantic map, including geography,
construction facts, reservations, and markers. See the [M1 map design](../../libs/18xx/maps.md). See the
[T3 inventory design and evidence](../../libs/18xx/inventory.md). The public `Definition` initializes the real opening auction for 3–4 players.
Its registered Actions and handlers cover setup, stock rounds, company operations,
private powers, trains, emergency funding and game endings. Scenario initialization
is also available through the development configurator; the shared runtime retains
its `FinanceExample` naming while the session and table UI remain provisional.
See [complete-game verification](../../research/18xx/complete-game-verification.md)
and the [client autorouter design](../../research/18xx/autorouter-design.md).
The title's Logic and UI packages participate in artifact staging; this is not a
claim that they have been published or accepted for production.


## Rule evidence

- Supplied prototype rulebook: `TOP71_RULES_PROTOTYPE.pdf`, 25 pages, available
  locally at `/workspace/research/18xx-2026-09-08/reference/TOP71_RULES_PROTOTYPE.pdf`.
  SHA-256: `d01911344da66f217bad7e7ca66dfe2acec658b0d17dacb54da67c10e2112f61`.
- [Pinned research implementation](https://github.com/tobymao/18xx/tree/715567bdc7e5cc68a68a286b21dc8edd1a125e50/lib/engine/game/g_1871),
  identified there as alpha/prototype. Its directory name refers to TOP.
- Local comparison: `/workspace/research/18xx-2026-09-08/top-rulebook-comparison.md`.
  It records rulebook/source differences and internal rulebook contradictions.

The implementation follows the recorded slice decisions and user-confirmed
corrections, including Union Bank at $120 and King’s Mail at $80. Remaining opening
auction interpretation limits are documented in the
[TOP opening design](../../research/18xx/top-opening-auction-slice-design.md).
Physical-board artwork and mobile presentation remain deferred.

TOP owns its opening auction, Mainline/Shortline setup roles, Union Bank rules,
PEIR shares and contraction, tranche availability, and branch-splitting procedure.
These procedures can consume shared financial, track, train, and decision modules.
See the [family mechanism map](../../libs/18xx/README.md#initial-title-pair).

## Development

Run `pnpm --filter @tabletop/the-old-prince build` to emit JavaScript and
declarations into `esm`, or `pnpm --filter @tabletop/the-old-prince check` to
check types without emitting files.

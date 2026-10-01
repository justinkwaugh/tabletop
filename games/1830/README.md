# 1830

`@tabletop/1830` is the deterministic logic package for 1830: Railways & Robber Barons.
It depends on `@tabletop/18xx` and `@tabletop/common`; its companion Game Client
package is `@tabletop/1830-ui`. The title is hosted only by the
[18xx Playground](../../apps/18xx-playground/README.md).

The public entry point exports `EighteenThirtyMap` (the complete pointy-hex map),
`EighteenThirtyTileSet` (46 shared definitions, 85 pieces), the companies, privates,
trains, phases and market, and the `Definition` whose opening is the reserved
waterfall auction for 2–6 players. The configurator offers the extra 6-train and
multiple brown shares from the IPO; the latter has no effect yet. Scenario
initialization is available from `@tabletop/1830/scenarios`.

## Rule evidence

The research site's implementation defines the rules (project decision,
2026-10-01). It follows the Lookout 1830-RE rulebook. See the
[title design note](../../research/18xx/1830-title-design.md) for sources, the
delivery slices, and the intentional limits of the current slice: Erie cannot yet
be started, stock turns are sell–buy or buy–sell with one purchase, privates have
no powers or awards, and offboard groups are not yet enforced.

## Development

Run `pnpm --filter @tabletop/1830 build` to emit JavaScript and declarations into
`esm`, `pnpm --filter @tabletop/1830 check` to check types, and
`pnpm --filter @tabletop/1830 test` for the specs.

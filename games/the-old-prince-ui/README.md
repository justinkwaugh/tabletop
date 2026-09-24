# The Old Prince 1871 UI

`@tabletop/the-old-prince-ui` is the Svelte Game Client for The Old Prince 1871.
It consumes the title logic from `@tabletop/the-old-prince`, shared family presentation
from `@tabletop/18xx-ui`, and the existing Game Client support.

The public `UiDefinition` uses the title's canonical runtime and shared `GameTable`:
player/company panels, action selection, map, market, tiles, spreadsheet and history.
The [18xx Playground](../../apps/18xx-playground/README.md) hosts it at `/table`, with local persistence and selectable game
positions, including real opening setup. TOP additionally has a finished-game
fixture for replay and history work.

The table and `EighteenXXSession` remain development scaffolding; shared tile
and map rendering are intended lasting components. The packages participate in
artifact staging, but staging alone does not establish production readiness.
See [complete-game verification](../../research/18xx/complete-game-verification.md),
the [shared UI contract](../../libs/18xx-ui/ui-interaction-visual-contract.md),
and the [title visual contract](docs/ui-interaction-visual-contract.md).

Run `pnpm --filter @tabletop/the-old-prince-ui build` to package into `dist`,
or `pnpm --filter @tabletop/the-old-prince-ui check` to check Svelte and TypeScript.

See the [title logic README](../the-old-prince/README.md) for rule sources and scope.

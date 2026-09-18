# Shikoku 1889 UI

`@tabletop/shikoku-1889-ui` is the Svelte Game Client for Shikoku 1889.
It consumes the title logic from `@tabletop/shikoku-1889`, shared family presentation
from `@tabletop/18xx-ui`, and the existing Game Client support.

The public `UiDefinition` uses the title's canonical runtime and shared `GameTable`:
player/company panels, action selection, map, market, tiles, spreadsheet and history.
The [18xx Playground](../../apps/18xx-playground/README.md) hosts it at `/table`, with local persistence and selectable game
positions, including real opening setup. TOP additionally has a finished-game
fixture for replay and history work.

The table and `FinanceExampleSession` remain development scaffolding; shared tile
and map rendering are intended lasting components. The packages participate in
artifact staging, but staging alone does not establish production readiness.
See [complete-game verification](../../research/18xx/complete-game-verification.md),
the [shared UI contract](../../libs/18xx-ui/ui-interaction-visual-contract.md),
and the [title visual contract](docs/ui-interaction-visual-contract.md).

Run `pnpm --filter @tabletop/shikoku-1889-ui build` to package into `dist`,
or `pnpm --filter @tabletop/shikoku-1889-ui check` to check Svelte and TypeScript.

See the [title logic README](../shikoku-1889/README.md) for rule sources and scope.

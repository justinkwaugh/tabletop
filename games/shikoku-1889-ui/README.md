# Shikoku 1889 UI

`@tabletop/shikoku-1889-ui` is the Svelte library scaffold for Shikoku 1889.
It consumes the title logic from `@tabletop/shikoku-1889`, shared family presentation
from `@tabletop/18xx-ui`, and the existing Game Client support.

The public `UiDefinition` composes the title's finance-example runtime with the
existing Game Session and shared portfolio/finance inspector. The development
app hosts it at `/economy`, with local persistence and three example players.
These screens are provisional; shared tile/map rendering remains lasting work.
The title is not registered in the site catalog. See the
[economic slice design](../../libs/18xx/finance.md) and the
[inspection visual contract](docs/ui-interaction-visual-contract.md).

Run `pnpm --filter @tabletop/shikoku-1889-ui build` to package into `dist`,
or `pnpm --filter @tabletop/shikoku-1889-ui check` to check Svelte and TypeScript.

See the [title logic README](../shikoku-1889/README.md) for rule sources and scope.

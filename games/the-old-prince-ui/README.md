# The Old Prince 1871 UI

`@tabletop/the-old-prince-ui` is the Svelte library scaffold for The Old Prince 1871.
It consumes the title logic from `@tabletop/the-old-prince`, shared family presentation
from `@tabletop/18xx-ui`, and the existing Game Client support.

The public `UiDefinition` composes the title's finance-example runtime with the
existing Game Session and shared portfolio/finance inspector. The development
app hosts it at `/economy`, with local persistence and three example players.
These screens are provisional; shared tile/map rendering remains lasting work.
The title is not registered in the site catalog. See the
[economic slice design](../../libs/18xx/finance.md) and the
[inspection visual contract](docs/ui-interaction-visual-contract.md).

Run `pnpm --filter @tabletop/the-old-prince-ui build` to package into `dist`,
or `pnpm --filter @tabletop/the-old-prince-ui check` to check Svelte and TypeScript.

See the [title logic README](../the-old-prince/README.md) for rule sources and scope.

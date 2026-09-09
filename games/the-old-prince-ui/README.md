# The Old Prince 1871 UI

`@tabletop/the-old-prince-ui` is the Svelte library scaffold for The Old Prince 1871.
It consumes the title logic from `@tabletop/the-old-prince`, shared family presentation
from `@tabletop/18xx-ui`, and the existing Game Client support.

The public entry point is currently empty. Game Session composition and
`GameUiDefinition` will support disposable prototype screens as mechanisms become
playable. Shared tile and map rendering are lasting library work; the full desktop/mobile
layout has a [separate design stage](../../research/18xx/development-slices.md#u1-design-the-desktop-and-mobile-game-experience).
The title is not registered in the site catalog yet.

Run `pnpm --filter @tabletop/the-old-prince-ui build` to package into `dist`,
or `pnpm --filter @tabletop/the-old-prince-ui check` to check Svelte and TypeScript.

See the [title logic README](../the-old-prince/README.md) for rule sources and scope.

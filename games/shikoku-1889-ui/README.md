# Shikoku 1889 UI

`@tabletop/shikoku-1889-ui` is the Svelte library scaffold for Shikoku 1889.
It consumes the title logic from `@tabletop/shikoku-1889`, shared family presentation
from `@tabletop/18xx-ui`, and the existing Game Client support.

The public entry point is currently empty. Game Session composition and
`GameUiDefinition` will support disposable prototype screens as mechanisms become
playable. Shared tile and map rendering are lasting library work; the full desktop/mobile
layout has a [separate design stage](../../research/18xx/development-slices.md#u1-design-the-desktop-and-mobile-game-experience).
The title is not registered in the site catalog yet.

Run `pnpm --filter @tabletop/shikoku-1889-ui build` to package into `dist`,
or `pnpm --filter @tabletop/shikoku-1889-ui check` to check Svelte and TypeScript.

See the [title logic README](../shikoku-1889/README.md) for rule sources and scope.

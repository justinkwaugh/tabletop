# 1832 UI

`@tabletop/1832-ui` is the Svelte Game Client for 1832: The South. It consumes the title
logic from `@tabletop/1832`, the shared table from `@tabletop/18xx-ui`, and the existing
Game Client support.

The map is the boardless presentation; no physical-board artwork is claimed. Railroad and
System heralds come from the research implementation's `public/logos/1832` directory, the
System logos set on a white token disc. The [18xx Playground](../../apps/18xx-playground/README.md)
hosts the title at `/table` and `/maps`; `pnpm --filter @tabletop/1832-ui dev` serves the
standalone harness on port 4194.

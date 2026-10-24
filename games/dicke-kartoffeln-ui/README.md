# Dicke Kartoffeln UI

`@tabletop/dicke-kartoffeln-ui` is the Svelte Game Client for Dicke Kartoffeln. It consumes the title logic from `@tabletop/dicke-kartoffeln`.

The table shows the original farm boards and counters (scanned from the 1991 Abacus edition), a redrawn potato market in the board's brown line style, fax-style message cards, and each farmer's yield sheet ("Ertragsformular"). Seed, fertilizer and offers are noted on the yield sheet as on paper; worms, furrows and poison are placed on the farm.

## Development

Run `pnpm dev` in this package for the single-game dev harness. The [UI interaction visual contract](docs/ui-interaction-visual-contract.md) records the table's interaction intents. Fonts are SIL OFL; their licences sit beside them in `src/lib/fonts/`.

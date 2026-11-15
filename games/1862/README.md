# 1862

`@tabletop/1862` is the deterministic logic package for _1862: Railway Mania in the Eastern
Counties_ (Mike Hutton, GMT Games), for two to eight players. It composes the 18xx family library
into `TitleRules1862` and builds its runtime with `createEighteenXXRuntime`; its companion Game
Client package is `@tabletop/1862-ui`.

The rules follow GMT's 2019 rulebook. See the [title design note](../../research/18xx/1862-title-design.md)
for sources, the family additions 1862 introduced (track stops, fleet routes with shared track,
limits by kind of train, lapsing presidencies, the George Hudson top-up, endings after a round)
and the rulings still to confirm.

`test/bot.ts` plays seeded whole games: `src/fullGame.spec.ts` runs three; `SWEEP=1` runs a wider
sweep of 2–8 players, and `SCENARIOS=1` rewrites the UI harness's scenarios from bot games.

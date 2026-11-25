# 18USA

`@tabletop/18usa` is the deterministic logic package for 18USA (Edward Reece, Mark Hendrickson and
Shawn Fox; 2022 edition), an 1817 derivative for 2–7 players. It depends on `@tabletop/18xx` and
`@tabletop/common`; its Game Client is `@tabletop/18usa-ui`.

The game is set up at random: the privates in play, three of six metropolises, the subsidy tiles
on the fourteen orange cities and the value tokens on the seven red areas. Companies of 2, 5 and
10 shares are started by auction and grow by conversion and merger; loans, shorts and the merger
and acquisition rounds are the 18xx family's sized-company modules, which 1817 shares. On top of
them come 18USA's own rules: subsidies, metropolis tiles, the phase-5 track rules, resource and
bridge tokens, Pullmans, obsolete 2+/3+/4+ trains, its export schedule, the Mexico limit and the
thirty private powers.

Options: the 1817 train roster, the $300 start price from phase 5, and no 60% president limit.

[`title-design.md`](title-design.md) records the sources, the data and rules decisions with their
rulebook sections and BoardGameGeek rulings, the disagreements with the reference
implementation, and the limits.

## Development

Run `pnpm --filter @tabletop/18usa build` to emit JavaScript and declarations into `esm`,
`pnpm --filter @tabletop/18usa check` to check types, and `pnpm --filter @tabletop/18usa test`
for the specs. Whole games played by the seeded bot in `test/bot.ts` run in `fullGame.spec.ts`:
one game each for 2, 4 and 7 players by default, `SWEEP=n` for `n` seeds.

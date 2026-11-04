# 1894

`@tabletop/1894` is the deterministic logic package for 1894 (Jan Kłos), railway companies in
north-eastern France and Belgium for three or four players. It composes the 18xx family library
into `EighteenNinetyFourTitleRules` and builds its runtime with `createEighteenXXRuntime`; its
companion Game Client package is `@tabletop/1894-ui`.

The rules follow the _1894 English Rules_ v1.0.3. See the
[title design note](../../research/18xx/1894-title-design.md) for sources, rulings, and the
family additions 1894 introduced: access rights (ferry markers), a private token power, the
optional share step, reconfiguring upgrades that set stations aside, start homes claimed at par,
and route-wide best-stop values.

Scenario initialization for tests and the playground is exported from `@tabletop/1894/scenarios`.

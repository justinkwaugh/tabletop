# 1846 first stock round

This records the second slice. The [construction slice](1846-track-design.md)
supersedes its stopping point and adds atomic sale blocks and explicit closure
System Actions.

This slice extends the 3–5 player GMT second-printing opening through the first
stock round. It stops at `ReadyForOperatingRound`; operating procedures, full map,
private powers, train purchases, and subsequent rounds remain future slices.

## Evidence and variation

Primary rules: [GMT 2021 rules](https://gmtwebsiteassets.s3.us-west-2.amazonaws.com/1846/1846-RULES-2021.pdf),
sections 5.1–5.5 and 8.1–8.2. Comparison source is the pinned research snapshot
715567bdc7e5cc68a68a286b21dc8edd1a125e50, `g_1846/game.rb`,
`g_1846/step/buy_sell_par_shares.rb`, and shared buy/sell rules.

Surveyed every recorded assignment in the full title-trait catalog for
capitalization (170), flotation (270), certificate counting (347), ownership
limits (184), presidency (271), sale eligibility (132), and price movement (515).
The catalog includes full, incremental, escrow, special, and no capitalization;
20–100% and phase/formation-dependent flotation; weighted and exempt certificates;
50–200% ownership limits; restricted and corporate presidencies; first-round,
first-operation, and president-only sale restrictions; per-share and per-block
price movement. Unrecorded profiles remain evidence gaps.

1830/1889 provide counterexamples to treasury capitalization and first-round
sales; 1817 auctions determine formation instead of an ordinary par selection;
TOP's Union Bank can own/control shares instead of a player. Titles without
ordinary corporations cannot inherit an ordinary stock round as a mandatory
family feature. These variations remain policies or separate procedures.

## Boundaries

Reuse family finance, market spaces/stacks, purchase and sale evaluation,
presidency exchange, flotation, stock-turn progression and all stock Actions.
1846 owns its market data, incremental payments, immediate flotation and IC
bonus, president-before-operation sales, president-only one-column block drop,
60% ownership, certificate-limit table, and round-end market/sold-out movement.
Independent railroad certificates count toward the certificate limit but their
100% ownership is valid; they are not tradable corporation shares.

The ordinary stock handler previously required auction formation's map state.
Extract `OrdinaryStockRoundHandler`; the existing handler wraps it with auction
coordination. This preserves the original title API and avoids fake map state
in 1846. Export the existing Action registry and stock/company factories so a
bounded title runtime can compose real family Actions without adopting every
operating feature. No existing title acquires state fields.

1846 adds its stock market, stock round, and initial phase to its own state.
Zero-price closure returns treasury cash, retires shares and removes tokens and
market markers. This is sufficient for assets obtainable in this slice; before
operating rounds are enabled, closure must also dispose of trains and acquired
private companies. Removed setup corporations retain their blocking stations.

The prototype UI lists legal launch prices, distinct treasury/market purchases,
and sale quantities derived from the same evaluators used by Actions. The Game
Session alone initiates Actions; there is no staged local selection. History is
read-only and committed stock transactions use ordinary Undo. The public stock
round does not weaken the private draft's projection or reveal boundaries.

## Verification

Runtime tests cover the draft-to-stock handoff, immediate capital/home placement,
IC bonus exactly once, treasury/market recipients, one purchase per turn,
pre-operation sales, block proceeds/movement, sell/rebuy prohibition, presidency
and ties, priority/consecutive passes, market drop, and zero-price closure.
Run family stock/company tests and existing 1817 auction and 1830 stock-turn
regressions for the handler extraction, as well as title, UI and playground checks.

Validation: 119 tests pass across the title (29), family stock/company, 1817/1830
regressions, 1889 bank sales/standing instructions, and TOP finance/branch splitting.
Logic, UI, playground checks and lint pass; both artifact bundles build with the
existing shared Common/Flowbite warnings. No publication or commit was made.

Desktop browser checks confirm draft handoff, IC launch ($80 payment plus $40
bonus), Undo restoring both formation and funding, clockwise turn progression,
a treasury share purchase increasing IC cash to $160, and consecutive passes
ending at the operating-round handoff with correct Priority Deal. Native preview
snapshot failed and viewport resize timed out, so visual screenshot and narrow
viewport verification remain incomplete; desktop DOM interaction succeeded.

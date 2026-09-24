# Title presentation

A title UI hands `@tabletop/18xx-ui` one `TitlePresentation` when it creates its session
class, beside its rules and map view. It holds what is fixed for the title and only about
how things look or are named: the phase chart, train and phase colours, which pools are
the market and the exchange, company names, how a company's price is presented, numbered
share names, which companies are listed or excluded from map focus and portfolios, pool
names, the private purchase label and heading, private tile prompts, how money is
written and a train's short label. Components read `session.presentation`.

What depends on the State stays where it was: the `actions` and `gameInformation`
snippets, `additionalStockActions`, `spreadsheetCompanyOrder`, `auctionLotDescription`,
`numberedShareLocation`, `historyDescription` and `privateOperationDescription` are
still `GameTable` props, and a title's session subclass still overrides behaviour
(`stockCompanies`, `privateCompanyTokens`, `requiresStationTokenChoice`).
`operatingRules` and `valuationRules` are no longer props; the session already has the
title's rules.

Before this, title data reached the shared UI through three channels — the session
factory, session subclass overrides, and about 26 `GameTable` props, three of them passed
again to `OperatingActions`. TOP sent its train colours down two channels; 1889 used only
one, so its private cards showed no phase colours. Every amount was written with `$` and
`en-US` grouping in about 65 places in 24 components, though 1889 is a yen game and its
own rule text says ¥, and three components special-cased the train name "Diesel".

## Evidence surveyed

Currency formats declared by the research source's titles; the presentation each of the
two title UIs passes today; `docs/agents/18xx-design.md` on shared presentation.

- **Money.** `$` prefix in 42 titles, `£` in 11, `¥` in 5, `L.` in 4; a suffix in others —
  `M` (4), `ℳ`, `F`, `kr`, `c` — some with a space before it; `₹`, `₧`, `₡`, `ƒ` once
  each. Prefix or suffix, optional space, grouping of thousands. None uses decimals.
- **Trains** are named on the card and abbreviated on badges; 1889 and TOP name the
  diesel "Diesel" and badge it "D".

## Shared behaviour and title-owned choices

Shared: the components, and that they ask the session's presentation rather than take
title facts as props. Title-owned: every value in the presentation.

## Support now and later

Now: the fields above; money as a symbol before or after the grouped amount; a train's
short label falling back to its name.

Considered, not built: a shared `createEighteenXXUiDefinition` for the near-identical
`index.ts`, `runtime.ts` and worker files of the title UIs; moving the State-dependent
props into session methods; removing the internal prop-drilling of train colours.

## Compatibility

UI Artifacts only. No State, Action, host bridge or `GameSession` contract changes; the
session constructor gains a parameter inside the UI Artifact that also supplies it.
1889's private cards gain phase colours, as TOP's had. After the money change 1889 shows
¥; TOP is unchanged.

## Examples that verify the decision

Both title UIs type-check with far fewer `GameTable` props (TOP from 23 to 7); the
playground's browser tests pass for both titles; 1889 shows ¥ in the places TOP shows $.

# Shared interface corrections

This addresses the five reuse findings from the architecture review of a18e04f0.
TOP and Shikoku 1889 retain their current procedures.

## Evidence and scope

The existing earnings/operating-round, stock-trading, company-formation, and
negotiated-transfer design notes record the full researched title survey. The
relevant counterexamples are 1846's payout-dependent market thresholds and
president-only leftward sale movement, titles with issuance/borrowing or reordered
operating steps, titles without tranches, and titles supplying their own hydrated
state instead of the finance example. Local 1846 dividend and sale rules were
rechecked. These motivate information-preserving interfaces, not implementation
of additional titles' rules.

## Interfaces

- Dividend market policy receives the chosen distribution, gross revenue,
  retained revenue, and calculated base dividend per share. Entitlements,
  settlement, rounding, and title-specific bonuses retain their existing owners.
- Sale terms receive the selling Owner, distinct from the directing player.
  Terms specify market direction and distance. Extended sale blocks preserve
  their initial price and account for movement already applied in that direction.
  The direction stays fixed within a block; titles allowing a different sale
  procedure can leave block extension disabled.
- FinishTrack and FinishStations finish only their own step. Distribution
  settles earnings without creating a purchase step. Station, run, and purchase
  handlers initialize their own state on first entry, retaining it on reentry
  through private decisions, funding, phase changes, or discards. The current
  runtime still chooses the sequence.
- TransferRules supplies operating-company identity and the permitted asset
  purchase window. The transfer evaluator retains owner, price, cash, train
  eligibility, and capacity checks. TOP and 1889 explicitly select the finance
  runtime's existing timing adapter; no machine-state names remain in transfers.
- StockCompanyFields contains financial stock-policy context. TrancheFields and
  StationFields remain separately composable. Basic StockState and share
  calculations require neither. FormationState composes the larger requirements
  for company starts/flotation and the current stock-round handler.
- MarketAnimationSource projects a title's state changes into market snapshots
  while forwarding Common's original action and AnimationContext. It owns no
  timeline or replay mechanism. StockMarketScene has no finance-example imports.
- Operating-income reconstruction accepts a caller-owned snapshot projection.
  The income table renders supplied rounds, players, and appearances. The
  finance-example-specific validation stays in its session adapter.

The finance example remains the composition used by the initial titles. Its
schema and table are not declared universal 18xx contracts. Loans, alternate train
counting, repeatable powers, and express routes remain separate future work.

## Data and verification

These artifacts have not been published. The new sale-block direction is required;
there is no legacy-data fallback. No host bridge, preference API, or shared
GameSession contract changes. Rebuild both titles' Logic and UI Artifacts together.

Regressions cover payout-threshold differences, seller-dependent directional
sales, cumulative movement and original price, stock state without stations or
tranches, destination entry, automatic empty-run/withhold cascades, exact canonical
undo/replay, a sequence that omits stations, custom transfer timing, and market
animation with a different hydrated state class. Existing harness expectations
were updated for the previously implemented repeat sales and automatic zero-income
distribution; the rusting fixture now consistently identifies its restored
operating company.

Verification passed: 154 shared-logic tests, 17 title tests, 33 shared-UI tests,
and 306 development-harness tests, including both complete games and exact
finished-game replay/Undo. Shared/title builds and UI/harness type checks pass.
No browser audit or publication was performed.

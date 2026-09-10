# Earnings and ordinary operating rounds

The full trait catalog was surveyed for dividend choices (345 assignments/130
profiles), entitlements (275/130), income restrictions (187/130), and round
sequence (208/129). Shared full/withhold/half choices do not establish universal
rounding, beneficiaries, or market effects. 1846 links market movement to revenue
thresholds; 21Moon restricts income by assigned base; subsidy/debt-service and
variable/cash-funded dividends require later extensions. Their local primary
procedures and the domain study's income and decision-order sections informed
these distinctions. No source implementation is copied.

TOP prototype §§7.1,7.5,7.7,10.2 specifies bank/treasury shares paying the company,
PEIR surviving player rights, rounded-up per-right payments, rounded-up retained
half, PEIR last, and $40 extra per share when a paying marker already at 400 would
move right. King's Mail uses the existing $60 rulebook baseline (§7.7 and its card),
not the differing research implementation value. 1889 §§8.1,8.6,8.7.5 specifies
private income at OR entry, no IPO payment, Market shares paying the company,
right/up and left/down arrows, and a train requirement only with station access
to another revenue center. TOP exempts PEIR from that requirement.

EarningsDistribution derives retained cash, per-share dividends, recipient
payments and a market move from OperatingResult and current certificates.
Choices, retention/rounding, entitlement denominator, recipients and market
bonus are title policies. Cash settlement reuses CashPayment; totals may differ
from nominal revenue due to IPO nonpayment, PEIR rounding or the ceiling bonus.
Private income remains a separate OR-entry payment, never distributable train
revenue. Bank exhaustion remains outside prepared scenarios until ending rules.

OperatingSet retains the fixed set length, per-round company order, completed
companies and whether entry income has been paid. StartOperatingRound pays
private income once and recomputes company order for the next round. Each
StartOperatingTurn resets the company's allowances and transient operating facts;
FinishOperatingTurn records completion. An exhausted set starts a fresh StockRound
using the player order preserved by stock-round completion. Existing System Action
processing owns cascades; no separate event engine or UI-driven progression.

RunTrains advances directly to DistributingEarnings. DistributeEarnings settles
payments, moves the stock marker, records has-operated, and enters BuyingTrains.
FinishOperatingTurn is available only when train obligations are met; trainless
station connectivity uses graph reachability, not auto-routing or optimization.
Phase-triggering purchases, emergency funding and special powers remain in later
slices. Auto-routing remains future client-only work. Prepared scenarios use
same-phase purchases/owned trains and no unsupported interruptions.

The prototype uses manual payout selection, preview and confirmation. Back clears
the selection; Undo clears it before undoing committed actions. History/visible
state updates invalidate drafts; only session methods create actions. A step
strip, recipients, market movement and round order expose the complete flow.

Verification: 138 shared logic tests and 132 harness unit/integration tests pass.
The added cases cover exact recipients, PEIR rounding, ceiling and edge movement,
un-floated companies, compulsory train connectivity, fixed set length, private
income, company order, replay and complete cascade Undo. Eight browser checks
pass for earnings, complete operating sets, routes and train purchases. All four
Svelte checks and all shared/title package builds pass. The TOP payment preview
was also inspected visually. Auto-routing remains entirely outside action processing.

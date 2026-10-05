# 1846 first major routes and earnings

This slice follows major construction through routes and earnings, stopping at
`ReadyForTrains`. Newly launched majors have no train, so normal first-OR play
automatically records a zero-revenue RunTrains and withholds zero, moving stock
one column left. It does not finish the company's operating turn or bypass its
future mandatory train purchase. A corporation reaching $0 closes through the
existing System action and ends its turn; that branch stops at CorporationClosed.

## Evidence and family survey

GMT 2021 second printing §§6.6–6.75: full, half or retained earnings; half retention
rounded down to $10; dividends to player and treasury shares; bank-held dividends
stay with the bank. Total payout, including treasury/market entitlements, determines
movement: left below half stock value or zero; hold below stock value; one right
at stock value; two at double; three at triple only from $165 upward. Cap at $550.
Research snapshot 715567bdc7e5cc68a68a286b21dc8edd1a125e50:
`g_1846/step/dividend.rb` and `step/half_pay.rb` agree. Closure reuses the previously
implemented §8 process; operating cleanup is performed with that closure action.

Surveyed all dividend-choices, dividend-entitlement and payout-rounding assignments
in the researched title profiles, together with the domain-model earnings traits.
The profiles include full and withheld payouts (128 each), half payouts (51),
automatic allocation (32), owner/treasury splits (25), treasury-share corporate
entitlements (19), market-share corporate entitlements (6), and multiple holder,
per-share and retention rounding policies. These overlap and unresolved evidence
is not proof of absence. Existing counterexamples: 1830 pays market shares to the
corporation, TOP excludes reserve shares and has PEIR rounding, 1817 charges short
holders and its half-pay depends on corporation size. 1846 cannot use those titles'
policy unchanged, but their shared evaluation and settlement procedure is suitable.

## Design

Reuse the shared route evaluator/editor, earnings evaluator, EarningsDetails,
DistributeEarnings action/handler, stock-space traversal and cash settlement.
Only the title's dividend and stock-movement policies are new. The first slice
already supports 2-train routes and the player-owned Steamboat bonus; corporate
private bonuses and East-West routes requiring later trains remain deferred.
Prepared nonzero-revenue states test the complete earnings policy without claiming
later-OR or train-acquisition support.

Only EarningsFields are composed into 1846 state. No debt, short, loan, emergency
funding or private feature fields are added. The shared earnings action's private
policy parameter is narrowed to the operationEffects callback it actually reads;
existing complete policies remain assignable. The 1846 callback has no effects
because this slice does not yet permit corporate private acquisition. The existing
action factory is exported rather than duplicating registration in the title.

UI keeps route results and adds a read-only earnings summary with cash recipients
and before/after stock prices. A nonzero run offers complete dividend decisions via
the Game Session; no new staged local state is introduced. System actions handle
zero-run consequences, so no redundant zero-revenue confirmation is required.
Undo and History use recorded actions and normal state publication. No host or
shared Game Client protocol changes are involved.

## Verification

Engine tests cover the full zero-run cascade, train-boundary state, no premature
operating-turn completion, duplicate/wrong-actor/System-action rejection,
$250 half-pay retaining $120 and paying $13 per share, treasury vs market holdings,
all stock thresholds including $165 and $550, unchanged stack order when holding,
zero-price closure, and replay/reversal. Existing independent earnings remain
unchanged. Train buying, private purchases/powers and later operating turns are
explicitly outside this slice.

Validation completed: 74 tests passed across all 1846 tests and the shared earnings
tests. Logic/UI type checks, lint, builds and bundles passed; all four earlier
18xx title packages also type-check. Existing dependency bundle warnings remain.
In the native desktop preview, IC's first run automatically showed $0 revenue,
$0 dividends and a $100 → $90 stock move with treasury unchanged at $300. Undo
removed the earnings result, restored $100 stock and reopened construction. No
positive-route browser scenario, mobile or physical-board presentation is claimed.


Review fix: completed earnings presentation reads DistributeEarnings metadata from
the visible user-action cascade, preserving the result through automatic closure.
A shared action-prefix selector is used by both route and earnings history readers;
this is a presentation/history mechanism independent of the surveyed titles’
dividend policies. It neither restores cleared state nor reads patches. Four
focused regressions cover closure, prefix visibility, the next user decision and
explicit dividend actions/missing metadata.

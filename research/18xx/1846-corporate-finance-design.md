# 1846 first corporate finance

This slice follows independent operations and implements step 6.2A only for the
first major corporation. It stops before construction and does not mark that
corporation operated. No-major games still stop before the next OR.

## Evidence and family survey

Rules: GMT 2021 second printing §§6.1–6.33. Cross-check: research snapshot
715567bdc7e5cc68a68a286b21dc8edd1a125e50, `g_1846/game.rb` methods
`issuable_shares` and `redeemable_shares`, and `step/issue_shares.rb`.
The rulebook's explicit $600 redemption at $550 is retained.

Survey: domain-model study, stock transactions/markets, treasury-share trait, and
all corresponding assignments in `data/title-traits.json`: 70 none, 53 redeem,
42 issue, 22 emergency-issue, 8 formation/conversion-issue assignments. These
are overlapping mechanisms, not mutually exclusive title counts. Unresolved
profiles are evidence gaps. Linked source counterexamples inspected: 1817
redemption during stock trading with acquisition/liquidation exclusions; 1822
issuance after two operations with market capacity and price movement; 1867
redemption at its own price basis. 1830/1889 lack ordinary corporate treasury
trading. TOP emergency financing is a separate decision sequence.

## Design

Use shared operating order, controller lookup, certificate ownership, market
spaces, cash balances and cash settlement. The emergency `IssueTreasuryShares`
action requires a funding obligation and forced quantities: ordinary corporate
finance must not manufacture an emergency to reuse that action. Stock-round
purchase/sale evaluators likewise carry player trading restrictions and price
movement inappropriate here.

A title-owned `CorporateFinance` action commits one complete issue/redeem block,
or a pass. Its legal choices are also the UI's source of truth. Price, count,
company and actor are revalidated when executed. Metadata records the operation,
certificate identities and payments. No new serialized feature state or changes
to other titles are needed. Machine state makes issuance and redemption mutually
exclusive and prevents repeat transactions.

Choice generation and execution share one title-specific certificate selector,
composing the family's `certificatesOwnedBy` and `certificatesInPool` helpers.
Outside the finance step, no choices are offered. Inside it, the operating
company must be an open, floated major; invalid state fails an assertion instead
of silently displaying an empty decision panel.

1846 majors have ordinary 10% treasury/market certificates; their president's 20%
is player-held. Counting available certificates is title-specific, not a family
invariant. Issuance is bounded by treasury stock and player shares minus market
shares. Redemption is bounded by market stock and corporate cash. Neither moves
the stock marker. Zero-price issuance at a $10 stock value still transfers shares
without a fictitious cash payment.

The prototype presents complete priced choices through the title Game Session.
There is no local staged selection: Undo reverses the committed transaction;
History is read-only. The step stays interactive only for the acting president.
Major construction, stations, private purchases/powers, routes, dividends,
train buying, receivership and later ORs remain outside this slice. A later
construction slice must preserve track/token interleaving and private purchase
opportunities rather than treating the current stopping boundary as a rule.

## Verification

Engine tests cover independent-to-major handoff, a two-share issue at $30,
market-share subtraction, redemption at $50, affordability, $600 ceiling price,
pass, stale/invalid requests, wrong actor/source/company, duplicate decisions,
and complete action replay/reversal. Existing independent tests cover no-major
flow. Browser verification covers the actual controls and Undo/History.

Validation completed: all 53 title tests pass; logic/UI type checks, lint, package
builds and bundles pass (existing dependency bundle warnings remain). In the
1280×800 native preview, drafted and launched IC at $40, completed independent
operations, issued two shares for $60, and observed treasury $120 → $180 with
stock still $40. Previous/Next history restored the respective balances with
Undo disabled in History. Returning live and Undo restored $120 and all finance
choices. No mobile or physical-board presentation claim is made.

# Compulsory train funding — slice 15

## Evidence and scope

This slice follows the full 130-title catalog, including every assignment for
emergency-funding order, borrowing parties, and failure consequences in
`/workspace/research/18xx-2026-09-08/data/title-traits.json`. The survey also uses
that package's domain study, finance mechanism notes, variation catalog, and TOP
rulebook comparison. These profiles index evidence; they are not an executable
policy format.

The funding-order assignments comprise 52 owner-sales/contribution, 21
issue/owner/failure, 26 owner-loan, eight loans/liquidation, five
corporate-loan/owner, four loans/nationalization, three corporate-only, three
corporate-solvency, two issue/refinance, one bank-loan/receivership, one conversion,
and four without a compulsory train guarantee. All 130 profiles have assignments.
Borrowing profiles distinguish 82 without standard loans, 22 corporate borrowing,
and 27 player borrowing; scopes overlap. Failure profiles include 75 game-ending,
33 player-elimination, 27 continued-debt, 16 reorganization, 11 receivership, eight
liquidation, seven player-bankruptcy, and one failure-prevention assignments.
Failure categories also overlap and must not be interpreted as mutually exclusive.

Relevant counterexamples include:

- 1817 and variants: loans and liquidation, rather than a personal guarantee.
- 1822 and variants: player debt can permit continued play.
- 1848: bank loan availability and receivership, with different failure parties.
- 1841: assistance and corporate ownership require title-specific liability rules.
- 1846: distinct emergency issuance prices and amounts.
- 1861/1867: debt followed by nationalization.
- 1862: refinancing; 18GB: conversion capital.
- 1860, 1873, and 18Uruguay: corporate funds rather than a universal president guarantee.
- 1825, 1829, 1862 USA/Canada, and 18India: no general compulsory train guarantee.

The relevant 1848, 1846, and 1841 train-buying procedures were inspected to challenge
issuance, liability, and failure assumptions. TOP's emergency purchase procedure
and the shared emergency sale restrictions were inspected as contextual evidence.
Implementation is original and uses this repository's financial model, ownership,
stock market, Actions, state handlers, train depot, and Game Session.

Paired primary rules:

- `/workspace/Shikoku 1889 Rulebook.pdf`, §§7.3.1, 8.7.5–8.7.6, 10.1.
- `/workspace/TOP71_RULES_PROTOTYPE.pdf`, §§7.6.3–7.6.4, 7.7, 8.1, 11.3.

The rulebook explicitly describes sale/contribution steps before bankruptcy. A
liquidity estimate must not skip their cash transfers, market movement, or player
choice of sale order. TOP's research comparison identifies double-counting in a
combined Union Bank buying-power calculation; that is a defect to avoid.

## Shared implementation

`EmergencyTrainFunding` evaluates the train obligation, cheapest eligible purchase,
remaining shortfall, and next legal source of funds. It returns choices from actual
current balances and sale settlements. It does not add the railway's treasury
again for each owner, value unsaleable assets as cash, or treat optional offers
from other companies as guaranteed liquidity.

A `TrainFunding` record preserves the selected train, price, responsible player,
ordered contributors, and committed sale blocks. Owners are distinct and exclude
the purchasing company itself. The existing treasury balance represents company
cash; actual contributions move money into it. Contributions are the lesser of
the remaining shortfall and the next owner's cash. Legal share-sale choices are
recomputed after each committed action. Excess sale proceeds remain with the seller.

`FundTrain` explicitly enters compulsory funding from train buying, retaining the
opportunity to negotiate a treasury-funded company train before committing. It is
unavailable when no train is required, a train is already owned, or the company can
afford the cheapest eligible bank train. `FundingTrain` permits only its next
funding action. Private powers, transfers, stock actions, and finishing the turn
cannot interrupt or escape that procedure.

`IssueTreasuryShares`, `ContributeTrainFunds`, and `SellFundingShares` validate
current authority and exact amounts before settlement. `BuyTrain` remains the
actual train purchase Action, restricted here to the funded train. Its existing
phase/rusting/discard cascade resumes ordinary train buying. A system
`DeclareBankruptcy` enters a terminal `Bankrupt` state when all legal sources are
exhausted. This includes any final contribution, so the remaining player cash is
already in the railway treasury. Final scoring and the platform result are slice
19; no winner or loser is fabricated from bankruptcy alone.

Stock sale evaluation now separates stock-round timing/actor eligibility from
certificate, market, price, and presidency settlement. Emergency sales reuse the
latter and do not modify the completed stock round's pass, purchase, or sale
records. Funding retains its own once-per-owner/company sale blocks.

This is deliberately a cash/issuance/share-sale funding procedure, not a universal
finance state machine. Loan, conversion, receivership, nationalization, and
refinancing procedures will compose these settlements and add their own states
when a title needs them. Their existence does not justify speculative loan data
or boolean switches in this slice.

## Title policies

1889 permits the cheapest available depot or Open Market train when the president
must contribute, never another company's train with personal funds. No emergency
sale may transfer a presidency. Ordinary Market capacity applies. The first-SR
sale prohibition does not prohibit sales in the subsequent OR. Excess ownership
outside the Orange Zone requires correction even if that raises more than the
train shortfall. Otherwise a sale may not include an unnecessary extra share.

TOP uses the next depot rank at printed price. It first issues all treasury shares
as one block at current price, moving the stock marker once, even above 30%.
Only then may the president contribute and sell. Personal/Union Bank sales retain
the 30% block limit, operated-company restriction, Market capacity, and presidency
protection for the railway buying the train. Other presidencies may transfer.
A Union Bank presidency uses Union Bank cash and legal sales before its owner's
cash or sales. PEIR never enters compulsory funding.

## Prototype and compatibility

The economy viewer includes Compulsory train funding and Bankruptcy positions for
both titles. It shows the actual shortfall, contribution order, issuance, and
legal sale blocks. Funding selection commits an Action; sale selection is a manual
Game Session draft with Back and draft-first Undo. History and state transitions
hide drafts; `beforeNewState` clears them. Pending funding and bankruptcy persist
across reload, and committed Actions use ordinary engine Undo/replay.

The disposable panel is included through shared TrainBuying and depends only on
caller-supplied family policies. No shared package imports either game. Title
Logic and UI Artifacts must be published together to expose the new state/actions;
the Game UI host bridge is unchanged. Prototype save identity advances to 22.

## Verification

Canonical paired tests cover funding and phase continuation, owner authority,
stale input, optional-action exclusion, serialization, replay, Undo, bankruptcy,
Union Bank ordering, full treasury issuance, unnecessary contributions, cheapest
market trains, PEIR/no-route exemption, and emergency sale restrictions.
Browser tests exercise both titles, persisted funding, sale draft Back/Undo,
completion, terminal bankruptcy, and Undo from bankruptcy.

### Shared Game Session correction

The terminal browser test reproduced a pre-existing Undo defect: local hotseat
has no `myPlayer` when Game State has no active players. The spectator check ran
before the existing local-hotseat authorization branch, making Undo unavailable.
The same local-hotseat predicate now applies to both checks. Networked players,
host execution, spectators, non-active-player views, history, and information
barriers retain their existing checks. Terminal Game State keeps no active players.

This changes the Game Session implementation bundled in UI Artifacts, not the host
bridge or any injected dependency. Both 18xx title UI Artifacts adopt the fix with
this slice. Other titles need a UI-only publication to adopt it; publishing the
Site Frontend alone does not update their bundled code. Older and newer host/UI
combinations use the same interface and require no coordinated host deployment.

Verification completed: 139 shared logic tests, six title tests, and 194 economy
harness tests (339 total); 21 economy browser cases and 15 shared Game Session
browser cases. The action-registration expectation was updated for the five new
Actions and its two tests passed on rerun. One browser crash and one timeout during
memory pressure passed when rerun separately. The 16 new logic cases and four new
browser cases all pass. All affected builds and four 18xx UI checks pass. Shared
frontend checking has no errors and seven existing warnings in unchanged files.
The funding sale panel was visually inspected at desktop size.

### Direct train purchase presentation

The depot choice includes eligible president-assisted purchases alongside ordinary
company-funded purchases. An immutable funding preview walks the existing title
policy through mandatory treasury issuance and ordered cash contributions, stopping
at a share-sale decision. TOP's Union Bank retains priority over its controlling
owner; 1889's presidency and cheapest-train restrictions remain unchanged. Titles
with negotiated train purchases retain that alternative before committing to depot
funding, using company cash only. The broader financing variations surveyed above
remain title policy, not UI inference.

The session's explicit train click initiates FundTrain and then performs canonical
issuance, contribution, and purchase actions until a sale choice or completion.
After a selected sale it resolves mandatory issuance and intermediate contributors only while another sale is needed; otherwise it waits for the train purchase click. It waits for the visible
transition and verifies forward progress after each action; no effect initiates
funding on reload or undo. Intermediate restored funding states remain actionable.
History continues to record each financial settlement.

The forced-purchase refinement exposes the first share-sale choice and net amount to raise in the immutable preview, preserving Union Bank-first liability and 1889 ownership-limit corrections. Funding begun by a sale performs mandatory issuance before validating that sale. After sales, funding pauses when remaining cash can cover the train; contributions and purchase wait for the explicit train button. The running sales ledger derives from canonical issuance/sale metadata since FundTrain, bounded by the visible action count.

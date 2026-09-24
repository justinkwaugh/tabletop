# Finance correctness review — final

Baseline: `fc14e5dcc7606a1992c9603e91130ca4cd69b578`; current working tree includes the uncommitted P1 bank-sale and station-Skip fixes. Read-only review. All 133 assigned financial files reviewed: 110 production/fixture modules and 23 test files. No pending assigned files. Architecture and presentation findings are separate in `finance-architecture-findings.md`.

## F1 — P2: dispose PEIR’s trains when the last PEIR share is exchanged

**Location:** `games/the-old-prince/src/companyRules.ts:167–175`, especially the terminal `else` branch at line 167. Related boundary: `libs/18xx/src/company/floatCompany.ts`.

**Concrete trigger:** A geographic company floats while its corresponding PEIR share is the last outstanding PEIR share and PEIR owns a train. `onFloat` closes PEIR, removes its president, zeroes its treasury and closes King’s Mail, but does not change `trainInventory`.

**Observed result:** A canonical BuyShares → FloatCompany → FinishStockTurn cascade leaves PEIR `closed: true` while its train remains `{ status: 'owned', owner: { kind: 'company', companyId: 'PEIR' } }`. The runtime accepts this state. Train roster queries still show that asset. Closed PEIR is excluded from operation/discard order and cannot sell it; a permanent train therefore remains owned by a closed company indefinitely. This is an asset-lifecycle/rule error, not a demonstrated trading exploit or deadlock.

**Requirement:** TOP prototype §§6.7.5 and 7.7, corroborated by local `top-rulebook-comparison.md:44`, specify loss of cash **and trains** on final closure. The formation slice explicitly deferred train disposal until train ownership existed (`research/18xx/company-formation-slice-design.md:77–80`; `libs/18xx/finance.md:244–245`); train ownership now exists and this integration was not completed.

**Reproduction:** `/tmp/18xx-finance-probe.mjs` builds the existing TOP flotation fixture, leaves PEIR share #2 as the last right, removes its other stations as in the existing closure test, gives PEIR one 3H train through `TheOldPrinceTrainDepot.purchase`, and submits Alex’s canonical `BuyShares` of `A:share:4` for $80. `finance-probe-output.txt` records PEIR closed while `the-old-prince/3H/5` remains owned by PEIR. The same omission applies to permanent 7/D trains; phase/discard code has no terminal-closure cleanup.

**Recommended fix:** Include title-correct disposal of every PEIR-owned train in the same canonical FloatCompany closure consequence, extending the policy’s state boundary if needed. Keep identities in the inventory with the appropriate disposed status; verify complete cascade replay and Undo with at least one owned train. Extend the existing final-exchange test, which currently covers only certificates/cash/stations.

## R1 — P2 readiness: update existing finance tests for the accepted automatic action flow

**Representative locations:** `apps/18xx-tile-viewer/src/demo/sharePurchase.spec.ts:95–97`, `apps/18xx-tile-viewer/src/demo/shareSale.spec.ts:128` and `:182`, `apps/18xx-tile-viewer/src/demo/companyFormation.spec.ts:75` and `:118`. This is a test-suite readiness finding, not a claim that the new automatic progression violates the rules.

The current finance regression command fails **14 of 205 tests in six files**. Their assertions or follow-up commands still assume one processed action, an unchanged active player/manual finish, or a multi-company sale action. The user explicitly requested automatic exhausted-step completion and one company per sale action. Core assertions reached before the failures generally validate the intended financial settlement, but the stale tests stop before exercising later replay/Undo/round-flow guarantees.

Command run:

```sh
pnpm --filter @tabletop/18xx-tile-viewer test:unit src/demo/finance.spec.ts src/demo/companyFormation.spec.ts src/demo/sharePurchase.spec.ts src/demo/shareSale.spec.ts src/demo/stockRound.spec.ts src/demo/earnings.spec.ts src/demo/privateCompanies.spec.ts src/demo/companyDecisions.spec.ts src/demo/openingAuction.spec.ts src/demo/branchSplit.spec.ts src/demo/splitCompany.spec.ts src/demo/gameEnding.spec.ts src/demo/trainFunding.spec.ts src/demo/bankShareSales.spec.ts
```

Full output: `finance-test-run.txt` (191 passed / 14 failed; six failed / eight passed files).

Exact failing cases:

| # | File / current failure line | Test | Stale assumption / observed result |
|---|---|---|---|
| 1 | `companyFormation.spec.ts:75` | `starts the-old-prince without prematurely funding or floating it` | Expected only StartCompany; got automatic FinishStockTurn too. |
| 2 | `companyFormation.spec.ts:118` | `floats the-old-prince through a recorded system action, with exact replay and Undo` | Expected BuyShares, FloatCompany only; got FinishStockTurn too. |
| 3 | `companyFormation.spec.ts:274` | `preserves a forced PEIR ownership excess without allowing further ordinary purchases` | Follow-up checks the former actor; now rejects “It is not this player’s turn.” before ownership-limit evaluation. |
| 4 | `earnings.spec.ts:238` | `completes every ordinary operating round for 'ML' and resumes the preserved stock order` | Counts explicit FinishOperatingTurn commands, not processed automatic completions; expects six and sees four. |
| 5 | `gameEnding.spec.ts:89` | `records the first TOP diesel once and preserves its final-set target through later actions` | Expects BuyingTrains and then manually finishes it; purchase already progressed to next company’s LayingTrack. |
| 6 | `openingAuction.spec.ts:238` | `starts and floats a company from the real first stock round, placing its home for free` | Manually finishes casey’s already auto-finished start turn; casey is no longer active. |
| 7 | `sharePurchase.spec.ts:95` | `settles 'the-old-prince' 'ML:share:5' for 'player' and round-trips history` | Expects Alex active / one action; Blair is active after auto-finish. |
| 8 | `sharePurchase.spec.ts:95` | `settles 'the-old-prince' 'ML:share:7' for 'player' and round-trips history` | Same. |
| 9 | `sharePurchase.spec.ts:95` | `settles 'the-old-prince' 'ML:share:5' for 'company' and round-trips history` | Same. |
| 10 | `sharePurchase.spec.ts:95` | `settles 'the-old-prince' 'ML:share:7' for 'company' and round-trips history` | Same. |
| 11 | `shareSale.spec.ts:128` | `supports a presidency change on purchase in 'the-old-prince'` | Undoes only BuyShares from the final cascade state, leaving auto-finish turn state. |
| 12 | `shareSale.spec.ts:182` | `preserves the chosen TOP arrival order ML then So beneath existing markers` | Supplies two companies in one SellShares action; current schema allows one. |
| 13 | `shareSale.spec.ts:182` | `preserves the chosen TOP arrival order So then ML beneath existing markers` | Same. |
| 14 | `shareSale.spec.ts:283` | `enforces each title’s sale/purchase sequence and one sale block per company` | After TOP buy, expects “after this purchase”; actor has auto-finished so receives not-your-turn. |

**Recommended fix:** Update existing scenarios to inspect and replay/undo the entire returned action batch; issue a manual finish only when still available; test converging sale order using separate legal company actions. Preserve financial assertions and verify the intended complete flow, rather than weakening tests to accept either result. Rerun the complete finance suite afterward.

## Verified boundaries and limitations

- The current bank-sale guard accepts full payment by banks configured to become unlimited on exhaustion and still rejects an unaffordable payment by a strictly finite bank. New bankShareSales regression tests pass; existing trainFunding suite passes. The prior bank-exhaustion P1 is not reported again.
- Financial production review checked ownership versus authority, ordinary and UB payments, current UB/$120 and King’s Mail/$80 code, presidency/exchange, stock limits/order, tranche/flotation/split funding, earnings/rounding, auctions, negotiated/private transfers, ordered funding, bankruptcy and endings. No additional concrete financial defect retained.
- Probes use existing built current title/core modules; history probes transpile current source directly. Canonical suite executes current source using the repository’s test configuration.
- No browser, full hosted backend, or visual audit was performed. Those are excluded or outside this delegated verification; no claim is made that every possible game sequence was executed.

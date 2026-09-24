# Finance architecture/integration review — final

Assigned: 104 files. Source/diff reviewed: 103. Explicitly excluded from logic audit: `libs/18xx-ui/src/lib/table/historyCard.css` (CSS only; read to confirm). Pending: zero. Baseline `fc14e5dcc7606a1992c9603e91130ca4cd69b578`; current working tree including uncommitted P1 fixes. No repository edits or browser/style audit.

## H1 — P2: retain sold-out stock-price movements in compact history

**Location:** `libs/18xx-ui/src/lib/table/historyRounds.ts:55–67`.

**Trigger:** Complete a stock round with a sold-out company whose marker can move upward. CompleteStockRound records the movement in `metadata.marketMoves`, but the history filter neither recognizes that action nor checks its market movements. `auctionHistory` retains ordinary user actions, while this is a System Action. It changes neither company cash nor the current `operatingSet.companyOrder`, so the two generic inclusion conditions do not save it.

**Consequence:** The marker moves canonically, yet the compact history contains no price-movement entry explaining it. The later operating-order row does not describe the price change. A description branch for CompleteStockRound is also absent, so admitting it alone would still lose the actual endpoints.

**Verified probe:** `/tmp/18xx-history-probe.mjs` uses the existing 1889 trading fixture, gives all remaining Bank shares to players, places AR at `0:2` and IR at `1:2`, then submits three passes. The resulting CompleteStockRound metadata contains IR `1:2 → 0:2`; `historyRounds` returns only StartOperatingRound and the three FinishStockTurn actions. Output: `history-probe-output.txt`.

**Requirement:** User correction in `the accepted user requirements summarized in README.md`: compact history must retain meaningful price/operating-order movement. `research/18xx/stock-round-slice-design.md` also requires round-end market adjustments in history.

**Fix:** Include CompleteStockRound when it has meaningful market movement and format the company and before/after price/position; keep empty bookkeeping suppressed. Add a pure history regression using the canonical final-pass cascade.

## H2 — P2: expose automatic ownership and private-lifecycle consequences in history

**Locations:** `libs/18xx-ui/src/lib/table/historyDescription.ts:242–254` (flotation); `:201–216` (phase effects). Related metadata boundary: `libs/18xx/src/company/floatCompany.ts` and `games/the-old-prince/src/companyRules.ts:150–166`.

**Trigger / verified result:** TOP company MS floats via its PEIR exchange. The existing scenario from companyFormation.spec.ts changes MS presidency Alex → Blair and PEIR presidency Blair → Casey. `/tmp/18xx-history-probe.mjs` executes that scenario and sends every processed action through the actual current history formatter. It produces only “Bought 1 MS for $80 / For UB”, “MS floated / $800 capital”, and the routine hidden turn finish. Neither presidency change nor the PEIR share exchange is displayed. The title’s custom formatter only handles SplitCompany, so it does not supply the missing information.

The same automatic-lifecycle omission exists at phase advancement: the formatter explicitly filters private effects to `kind === 'close'`, suppressing forced exchanges and private-income changes. Thus TOP’s 4+ forced reserved exchanges, and 1889 Uno-Takamatsu’s income change, are absent from that row despite being recorded in the event. Presidency effects of forced exchanges are also not summarized. These are substantive consequences, not routine finish actions.

**Requirement:** User explicitly requires presidency/flotation/financial history to remain meaningful (`the accepted user requirements summarized in README.md`). Both title visual contracts, under “Private exchanges and lifecycle,” require phase history to list closures, forced exchanges and income changes. The formation design requires both resulting presidencies to be resolved; the code resolves them but drops their explanation at the history boundary.

**Fix:** Carry or reconstruct the actual automatic exchange/presidency/lifecycle consequences and render them under the triggering flotation/phase entry. FloatCompany currently retains only capital payments, so repair the metadata/projection boundary rather than inferring historic owners from present-day company state. Test the two-presidency flotation and a phase event containing exchange/income effects. Keep this presentation logic read-only and replay/Undo-derived.

## Validation and reviewed boundaries

- Four assigned UI-derived model spec files executed: `companyOwnership`, `companyFocusLocations`, `marketTokenLayout`, `stockActionSelection`; **9/9 tests passed**.
- Two current-source history probes reproduced H1 and H2; probe output saved as above. Source was transpiled into `/tmp` without changing repository files.
- Backend/shared preference source and tests reviewed for authenticated account scoping, partial values/migrations, revision cache guards, ETags/conditional updates, queue conflict retry, late account responses and optional older-host API fallback. No additional concrete defect retained. These preference/hosted/browser suites were not all executed by this reviewer.
- Reviewed action/draft/derived-state ownership throughout the assigned session and financial UI, historical cash/order reconstruction, auction/private/stock controls, package staging and optional preference integration. The prior station-Skip fix is present. FinanceExampleSession size is accepted prototype scaffolding, not a finding.
- The bridge ADR and distribution context were read. Optional preference APIs preserve older host/UI combinations; adopting bundled client/session changes requires republishing affected UI Artifacts, while title rule/schema changes require corresponding Logic/UI publication. No new host-breaking boundary defect was found.
- Financial gameplay F1 and suite-readiness R1 are in `finance-findings.md`. Total delegated coverage: **236 logic/design source files reviewed + 1 CSS-only exclusion = 237 assigned files accounted for**, with no pending assigned file. No guarantee is made about all combinatorial game states or unexecuted hosted/browser behavior.

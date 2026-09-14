# 18xx correctness and architecture review — 2026-09-14

This review covers the branch since merge-base `fc14e5dcc7606a1992c9603e91130ca4cd69b578`, through HEAD `6317ab67dfd3a08784dda8e8009476403bbc13ec`, plus the uncommitted bank-exhaustion and station-Skip fixes. Two fresh agents independently reviewed financial and operating areas, each with an explicit architecture/integration assignment. They received scoped requirements and repository policies rather than the conversation history.

## Scope and coverage

All 575 changed/current files are accounted for: **519 reviewed for logic/design**, and **56 excluded** (browser/hosted audit files, static artwork, generated lockfile, and one CSS-only file). There are no pending assigned files. This is exhaustive file coverage of the defined change scope, not a proof of every possible game sequence or readiness for production deployment.

- [Financial logic coverage](finance-coverage.md): 133 files.
- [Financial architecture/integration coverage](finance-architecture-coverage.md): 103 reviewed, one CSS-only exclusion.
- [Operating logic coverage](operations-coverage.md): 111 files.
- [Operating architecture/integration coverage](operations-architecture-coverage.md): 172 files.
- [Excluded files](excluded.md): 56 files.

New implementation files were source-reviewed; existing shared infrastructure was reviewed through complete changed hunks and surrounding call paths. Generated game/benchmark fixtures were covered through canonical execution/replay rather than manual reading of every repeated JSON record. Svelte logic, domain derivations, event/session ownership and compatibility were included; browser appearance was not audited.

## Follow-up

The findings below describe the reviewed snapshot. All six findings have since been
addressed in the working tree; see [corrections and verification](../../review-fixes-2026-09-14.md).
The original evidence and coverage are retained unchanged for traceability.

## Findings

Correctness and architecture/integration findings remain separate. The two stale-test findings have independent file scopes and total **17 failing tests across seven files**; they do not represent 17 gameplay defects.

| Area | ID | Priority | Finding |
|---|---|---|---|
| Financial correctness | F1 | P2 | Final PEIR closure leaves its trains owned by the closed company. |
| Financial test readiness | R1 | P2 | Fourteen existing tests retain old manual-progression or multi-company-sale assumptions. |
| Operating test readiness | O1 | P2 | Three phase tests retain old train-step completion assumptions. |
| History integration | H1 | P2 | End-of-stock-round sold-out market movements are missing from history. |
| History integration | H2 | P2 | Automatic exchanges, presidency changes and private lifecycle effects are missing from history. |
| Architecture documentation | A1 | P3 | Public title/UI/harness READMEs describe obsolete inspection-only functionality. |

Detailed evidence, exact locations, reproduction conditions and recommended corrections:

- [Financial correctness findings](finance-findings.md)
- [Financial architecture/integration findings](finance-architecture-findings.md)
- [Operating correctness findings](operations-findings.md)
- [Operating architecture/integration findings](operations-architecture-findings.md)

No additional confirmed architectural defect was found. Shared dependencies point toward Common/family packages, with title policy/data injected. Client autorouting, canonical action initiation, transient selection ownership and additive host compatibility were checked. `FinanceExampleSession` remains prototype scaffolding currently used by both title UIs; its size alone is not treated as a blocking defect.

## Previous P1 fixes

Both previously reported P1s were fixed before this fresh review:

- Station Skip is blocked by a pending placement, rather than by automatic token selection. TOP and 1889 regressions verify Skip and Undo.
- Share sales may exhaust a bank configured to continue with unlimited funds. Stock-round and emergency-funding tests verify payment, bank break and Undo; strictly finite banks still reject unaffordable sales.

Targeted P1 checks passed: bank sales, emergency funding, stock rounds, station placement, and the two station-Skip browser regressions. Core build and shared UI build/check passed; shared UI check reported zero errors and warnings. Those two earlier browser regressions verified the fixes; no new browser audit was part of this review.

## Review verification

- Financial selected suites: **191 passed, 14 failed**, with the failures documented as R1.
- Financial UI-derived model suites: **9 passed**.
- Operating/architecture selected suites: **266 passed, 3 failed**, with the failures documented as O1. This includes 15 Rust tests.
- Both titles' complete-game checks passed, including exact replay and reverse Undo of the **1,071-action TOP fixture**.
- **7,350** additional construction comparisons passed against full TrackNetwork traversal, including changed faces, loops, borders, station blocking and city merges.
- No new P1 findings were confirmed. The findings above were unfixed in this review snapshot; see the follow-up for their resolution.

Test counts describe the selected runs, not a successful run of every repository test. Full hosted authorization/persistence and browser behavior are outside this audit. Broader-family mechanisms intentionally deferred by the design were treated as extension limits, not promised implemented features.

# Operating correctness findings

All 111 assigned files reviewed against `fc14e5dcc7606a1992c9603e91130ca4cd69b578`, including current pending fixes. One actionable test regression; no additional confirmed production-rule defect in this assignment. A PEIR closure defect crosses this boundary and is owned by the financial review, as noted below.

## O1 — P2: Update phase tests for automatic train-step completion without losing interruption coverage

- File: `apps/18xx-tile-viewer/src/demo/phaseChanges.spec.ts:121-124`; related stale expectations at lines 219 and 247.
- Reproduce: from `apps/18xx-tile-viewer`, run `pnpm exec vitest run src/demo/phaseChanges.spec.ts`. Three of ten cases fail. In the 1889 first-5 discard and first-diesel-at-capacity cases the settled state is correctly `LayingTrack`, not `BuyingTrains`; in the Market repurchase case processed actions are `BuyTrain`, `FinishOperatingTurn`, `StartOperatingTurn`, not only `BuyTrain`.
- Cause/consequence: the new outer composed handler automatically completes BuyingTrains when ending is the only remaining legal action. These fixtures reach exactly that condition. Their old assertions now fail the advertised unit-test command, and the first failing assertion prevents the later replay/Undo checks from running for the 1889 interruption case. Reverting the runtime behavior would violate the accepted automatic-completion requirement.
- Spec: latest user train-buying auto-completion request, reflected in `libs/18xx-ui/ui-interaction-visual-contract.md` under “BuyingTrains automatically completes with a System FinishOperatingTurn”; `docs/DESIGN.md` verification requires relevant tests to pass and all affected integrations updated.
- Correction: update expected final cascades and final state. Preserve a distinct test of interrupted operator/turn restoration by either inspecting the intermediate processed-action boundary before automatic FinishOperatingTurn or provisioning a legal remaining train/private decision, then retain exact replay/Undo checks for the entire new cascade.

## Cross-review finding (owned by finance reviewer; do not double count)

`games/the-old-prince/src/companyRules.ts` final PEIR closure clears cash/control/King's Mail but leaves owned trains. `/workspace/research/18xx-2026-09-08/top-rulebook-comparison.md:44` records loss of both cash and trains at removal of the last PEIR right (TOP §§6.7.5, 7.7); `research/18xx/development-slices.md` slice 4 expressly assigns train disposal to the train-model integration. Phase discard ordering excludes closed PEIR, and permanent ranks never rust, so this is not repaired downstream. The financial reviewer owns the concrete closure reproduction and full finding.

## Verification and rejected candidates

- 144/144 shared/title TypeScript tests; 15/15 Rust tests passed, including the native small-graph search oracle.
- 63/66 operating harness tests passed; all three failures are O1.
- 7,350 additional changed-face/station-migration differential construction checks passed against full TrackNetwork traversal.
- Existing construction directionality, border resources, blocked endpoint/transit distinction, upgraded station migration, remote/home permission delegation, route validation/search resource usage, phase discards/continuations and current title train rules were traced. No extra verified defect found.
- Initial track exhaustion auto-skip was withdrawn: accepted user scope requests automatic completion after a lay, not skipping an initially exhausted track step. Station initial exhaustion is implemented and was checked separately.
- Unsupported broader-family gauge/lane/network mechanisms and deferred titles were treated as model extension limits, not missing implemented-title features.

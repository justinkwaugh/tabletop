# Complete-game verification — slice 20

## Scope and reuse

Verification exercises the existing Game Engine, title runtimes, Game Sessions and
artifact host. The scripted player lives in the development harness. It is a test
strategy for TOP and 1889, not a family rules engine or a production route finder.
It submits ordinary Actions from initialized positions and never patches canonical
State to advance a game. Route sampling is bounded and test-only; slice 18 remains
deferred.

The full trait assignment catalog was surveyed for round sequence, interruptions,
power effects/lifecycle, ending triggers/timing and final valuation. The domain
study's decision-order and special-power sections supply the grouping. The indexed
profiles include stock/operating sets, recurring auctions, inserted stock rounds,
continuous operation, corporate finance and resource calendars. Interruptions
include mandatory trains, discards, another owner's response, pending formation,
multiple-action powers and suspended rounds. Ending timing and asset valuation
also vary independently. Unresolved profiles remain evidence gaps.

Relevant counterexamples include 1866's continuous schedule, 1880's inserted stock
rounds, 1870 price protection, 18Ardennes asset acceptance, and 18Cuba's resource
processes. These challenge a generic automated player built around one fixed
SR/OR sequence. The current test driver deliberately covers only the two implemented
titles; new titles should supply their own test decisions while reusing canonical
execution, persistence and replay. No shared production interface changes are needed.

Research entry points: the domain study, variation catalog and trait assignments
in the research package identified by `docs/agents/18xx-design.md`. Earlier slice
design notes retain the primary evidence for each implemented rule.

## Coverage matrix

| Area | Executable coverage | Limits |
| --- | --- | --- |
| Real initialization and auctions | `completeGame.spec.ts`: TOP 3–4 and 1889 2–6 players, opening completion, persisted processed replay and full Undo | One reproducible opening seed per player count; not exhaustive strategies |
| Normal endings | Complete 3-player runs from opening: TOP first diesel and final stock/operating set; 1889 bank break | Deterministic test decisions are intentionally simple |
| Bankruptcy and scoring | Both titles' bankruptcy scenarios execute funding, automatic bankruptcy and final scoring; persisted replay, terminal rejection and Undo | Curated emergency positions, not bankruptcy forced by the complete-game strategy |
| Share rules and companies | `sharePurchase`, `shareSale`, `stockRound`, `companyFormation` | Ownership/certificate limits, presidency and Union Bank are separately tested |
| Geography and construction | `maps`, `liveMap`, `trackConstruction`, `stationPlacement` | Physical artwork presentation remains deferred M2 |
| Trains, routes and dividends | `trainPurchase`, `runTrains`, `earnings`, `trainFunding` | Manual route submission remains authoritative; test sampling is not an optimizer |
| Private income, exchange and closure | `privateCompanies`: title-specific exchanges, corporate ownership, expiry and operating closure | The full-game strategy need not activate every optional power |
| Private decisions | `companyDecisions`: negotiated purchases, Ehime, Mitsubishi, Hunslet and track consent | Covered with curated positions as well as ordinary Action flow |
| Phase effects | `phaseChanges`: rust/removal, forced discards, private closure, construction and start-price changes | Phase timing is checked independently of the complete-game strategy |
| TOP structural changes | `branchSplit`, `splitCompany`, `branchSplitSelection`: allocations, certificate/asset conservation, tranche limits and Undo; PEIR lifecycle in phase tests | Splits are optional and exercised in dedicated positions |
| Prototype interaction | Browser suites for stock turns, construction, stations, routes, funding, auctions, private decisions and splits | Disposable desktop UI; production usability is U1–U2 |
| Distribution and hosted decisions | Title manifests and Logic/UI bundles; local multiplayer verification | Local publications only; no public release |

## Rule baselines and deliberate limits

TOP's ending follows the detailed rulebook §8.2 interpretation recorded in the
ending design note: complete the current operating set, one final stock round,
then three operating rounds. The conflicting phase-table shorthand is not a
second executable option.

The TOP opening design note records the rule-source ambiguity where compulsory
auction purchases become unaffordable and intervening private income cannot repair
them. The implementation preserves the position and Undo rather than inventing a
loan or forced ending. The verified opening seed does not exercise that ambiguity.
This remains a rule question before claiming unrestricted title completeness.

1889 uses its standard game, not an additional beginner configuration. Automatic
route finding, physical-board artwork and final desktop/mobile UI remain deferred.

## Local distribution

Both title packages expose the repository's existing Logic/UI bundle commands and
UI staging command. The site manifest selects matching `0.0.1` artifacts. Catalog
names now identify the titles and describe their prototype interfaces.

The local hosted runner stages the selected Logic Artifact as well as its UI
Artifact. Setting `GAME_LOGIC_ROOT` to the staged games directory verifies bundled
logic; the ordinary local source-loading default remains available. It supports
`LOCAL_HOSTED_FRONTEND_PORT` and `PORT` for isolated worktrees and aligns the site's
API, SSE and artifact proxy addresses. Defaults remain 5173 and 3000. No Game UI
Host Bridge member changes; existing UI Artifacts require no republishing for this
local runner change. Each 18xx title needs its own matching artifacts to adopt
future shared rule changes.

For this worktree, local verification uses ports 5174/3100, a separate emulator
project, and a local manifest containing only these two staged titles. Other
worktrees' servers and data are left running. Local minification is disabled with
`ROLLUP_TERSER=0` because concurrent work exhausted the available memory during the
initial minified build. No production deployment or publication was performed.

## Repeating the checks

Run `pnpm --filter @tabletop/18xx-tile-viewer test:unit` for canonical scenarios and
`test:browser -- --workers=1` for the prototype. The complete-game test additionally
regenerates System cascades from the recorded User Actions, comparing their IDs and
final State with the original execution. Processed-history JSON goes through Common's
Date conversion, as it does at the API boundary.

Hosted tests have a separate configuration so the ordinary browser suite does not
require accounts or a backend. In a local environment with email delivery disabled
(`RESEND_API_KEY` empty), provision the test users with:

```sh
GCLOUD_PROJECT=demo-18xx-s20 FIRESTORE_EMULATOR_HOST=firebase:8080 \
  node apps/18xx-tile-viewer/scripts/seed-hosted-users.mjs
```

The script requires an explicit emulator and a `demo-` project. Use the same project
for the backend. The account prefix and password can be overridden with
`HOSTED_TEST_USER_PREFIX` and `HOSTED_TEST_PASSWORD`; these are local fixture accounts
with `.invalid` email addresses. Start with a fresh emulator project or clear only
that project's prior fixture data to avoid stale test account caches.

Stage both titles with the hosted runner, stopping between runs, then start the
selected title with `GAME_LOGIC_ROOT` pointing to `.local-static/games`. For an
isolated manifest, copy the site manifest to a local file, retaining only the two
18xx entries, and supply its absolute path as `SITE_MANIFEST_PATH`. These entries
must retain the selected versions from the repository manifest.

```sh
GAME_LOGIC_ROOT="$PWD/.local-static/games" \
SITE_MANIFEST_PATH="$PWD/.local-static/config/18xx-verification-manifest.json" \
LOCAL_HOSTED_FRONTEND_PORT=5174 PORT=3100 ROLLUP_TERSER=0 \
  tools/scripts/local-hosted-game.mjs the-old-prince
```

With the site ready, run `pnpm --filter @tabletop/18xx-tile-viewer test:hosted`.
`HOSTED_SITE_URL` and `HOSTED_API_URL` support different ports. The suite logs into
four separate browser contexts, creates/joins/starts through the Site Frontend,
and selects a supported prepared-position configuration in the creation request.
It does not replace a running game's State. Purchases and private tile placement
use the actual Game Session controls and wait for authoritative responses before
inspecting persistence.

Both titles verify disabled buyer response controls, rejection of a forged seller
identity, recovery of the seller's obligation in a new page, acceptance propagated
to the buyer through SSE, and equal persisted client States after reload. The 1889
Ehime case reconnects the seller during the extra tile lay, completes it, returns
control to the company and preserves the ordinary construction allowance.

## Verification results

- 280 harness logic tests passed after the hex-edge traversal correction, including
  11 complete-game/auction-history checks; 146 shared family tests also passed.
- 68 prototype browser cases passed. One case was rerun after a concurrent
  `svelte-kit sync` reloaded the preview and cleared its uncommitted split draft.
- Three hosted browser cases passed through the staged Logic/UI Artifacts,
  backend, Firestore, Redis and SSE using separate accounts.
- Six construction, station and route browser cases were rerun after the hex-edge
  traversal correction and passed. The earlier hosted artifacts predate that fix.
- Svelte checking and explicit hosted-test TypeScript checking passed.
- Both title Logic/UI bundles built and loaded locally. The local runner's syntax
  and account-provisioning helper were checked; no production publication occurred.

Run builds and `check` before browser tests: `svelte-kit sync` reloads an active
preview, which legitimately discards uncommitted selections. Browser tests use
one worker to keep memory use predictable alongside other worktrees.

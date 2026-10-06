# 1846 shared table integration

1846 belongs in the playground's title registry and shared table alongside TOP,
1889, 1830 and 1817. The standalone prototype route and duplicate board, stock,
train and route controls are removed. The title session extends EighteenXXSession;
GameTable owns layout, Board/Map/Market views, spreadsheets, company sheets,
portfolios, tile supply, player aid, history, notices and Undo.

## Survey and boundaries

Surveyed the full assignment catalog in
`research/18xx-2026-09-08/data/title-traits.json`, especially allocation-information,
construction-allowance, station-placement, visit-pay-limits, running-permissions,
route-revenue-modifiers, fleet-route-constraints, round-sequence,
interrupting-decisions and emergency-funding-order. Cross-checked the domain study's
allocation, construction/operation, capacity/routes and failure sections and the
variation catalog. Unknown profiles remain evidence gaps.

- Public auctions are common; 1846 and 18India have private choices, 1841 private
  bids, and some titles have no allocation. Opening heading and title content are
  presentation policies; no shared auction schema is imposed on 1846's draft.
- 1830/1889's sequential track/station steps are not universal. 1846 interleaves
  both, and construction allowances vary from one lay through two-action budgets
  to points (1868WY, 18OE) and resource pricing (18RoyalGorge). Shared track and
  station selection accept title activation; the engine retains all legality and
  timing. Step presentation and completion policy are separate: 1846 supplies Finance/Build completion while the shared module owns forward navigation and interruption checks.
- Rolling Stock has neither railway construction nor route running. Nothing here
  adds those features to its state. 1846 similarly gains no auction, example or
  generic emergency-funding fields to satisfy its UI adapter.
- Express paying stops differ from visited stops (1846, 1825, 1858); 1862 has
  service groups. Fleet effects and route-wide revenue are not additive stop
  values. A shared revenue policy expresses paying-stop limits, a required paid
  company station and bonuses for connecting two sets of paid locations. Fleet
  policy supplies a per-visited-stop bonus for the longest route. Both the canonical
  evaluator and native autorouter consume those policies. Rust owns route generation,
  payment optimization and fleet selection for all implemented titles; there is no
  separate callback-driven search. This does not generalize to 1862 service groups,
  shared-track fleets or arbitrary cross-route scoring without additional modeling.
  Runnable-train policy still excludes newly acquired trains where required.

- Emergency procedure varies: owner sales (1830/1889), loans/liquidation (1817),
  issue/owner/failure (1846), corporate-only funding (1860/1873), and TOP's bank
  involvement. UI composition therefore makes the ordinary funding module optional;
  1846 retains its existing issue/sale/contribution and receivership actions.
- Company acquisition differs from a train purchase. Shared negotiated-purchase
  controls now present the already-modeled company asset for independent absorption.
  Title rules still determine price, sellers, transfer and closure effects.

Title-only panels cover hidden/public distribution, issuance/redemption, private
construction/markers, steamboat assignment, receiver share recovery and emergency
funding. They compose existing rule choices, shared tile visuals and theme tokens.
The title supplies labels, phase/train data, markers and custom action history.
Map preview state is an optional read-only presentation input, never canonical
state. Projected state schemas may reorder enum members, so the family type
constraint preserves their value domain without imposing enum tuple order.

## Verification and distribution

Scenario fixtures cover all advertised positions at 2, 3, 4 and 5 players with
schema validation, legal next actions and reset history checksums. Shared module
specs cover interleaved stations and disabled track selection. Autorouter specs
cover express scoring, route and fleet bonuses, barred trains and time limits.
Browser verification exercises the shared playground table and title decisions.
The visual interaction contract records lifecycle and privacy ownership.
Playground map and rule exports live under the UI package's `./playground`
entry point so production catalog loading does not eagerly import the browser runtime.

No Site Frontend/Game UI bridge or backend payload changed. Shared Game Client
behavior is bundled into UI artifacts; 1846 must be rebuilt/published to adopt
this migration. TOP, 1889, 1830 and 1817 need republishing only to adopt the shared
UI improvements; existing artifacts remain compatible. No deployment is included.

## Playground presentation corrections

The full-catalog treasury-share, train-variant, operating-step and market surveys
also apply here. Treasury shares are a share source (1846 and other incremental
capitalization titles), not necessarily a certificate pool. The shared stock
chooser includes a corporation's own treasury certificates and delegates
eligibility and pricing to the title's purchase evaluator.

Privates and independent railways use one staged company-purchase entry. Shared
cards dispatch on company kind; legal acquisition terms, consent and asset
transfer remain title rules. Custom operating steps participate in the shared
step-presence query so the action area does not duplicate the strip. Global Undo
owns local purchase stages; there are no additional Back controls.

1846 retains interleaved track and stations. Shared automatic track completion
accepts additional construction action types, preserving legal station placements
and private construction before completion. Exhaustion records system completion
actions. The station prompt uses shared inline skip with title-owned completion;
automatic station-mode selection consumes no manual Undo stage.

Market dimensions are presentation data, used consistently for static markers,
animated endpoints, hover expansion and board insets. 1846 uses 36×96 cells in its
unchanged single row, sized to the map bounds. Other titles retain 62×68 cells.
Depot rows show every certificate face and price with one shared remaining count.
Title-provided obsolescence phases identify the triggering trains and final-run
notes; absence of PhaseTable rust data alone cannot establish permanence.

Railroad herald SVGs come from the research implementation's public
[1846 logo directory](https://github.com/tobymao/18xx/tree/715567bdc7e5cc68a68a286b21dc8edd1a125e50/public/logos/1846),
as requested. Explicit company colors replace palette-index assignments.

The finished fixture converts research recording
[12666](https://github.com/tobymao/18xx/blob/715567bdc7e5cc68a68a286b21dc8edd1a125e50/public/fixtures/1846/12666.json).
It begins with the recorded sealed draft selections ready to reveal, then replays
479 canonical commands through the runtime, including corporate finance,
construction, private powers/acquisitions, intercompany train trades, emergencies
and all four phases. The source enables first-edition privates; its actual
selected private set is also valid under this implementation's edition. Ordinary
issuance/redemption is placed in this title's finance step; emergency issuance
stays with train buying. Final wealth matches all reference totals: 6180, 4950
and 1803. Conversion scripts and detailed snapshots stay in the research workspace;
the runtime fixture contains canonical game data. The sparse generated fixture
was replaced. 1846's scenario revision changes independently of other titles,
leaving existing games intact while generating corrected examples. Stock examples
begin on a fresh turn; the finished game uses its recorded player count.

## Review corrections

Live and historical maps apply the same pure title projection for revenue,
Steamboat and blocking-station markers. Construction previews overlay canonical
state before projection; presentation markers do not enter saved state.
Custom operating steps reuse named shared summaries and define their own grouping.
Navigation completion is a session policy, independent of labels and numeric
assumptions about Track/Station ordering. It stops on a changed company, round,
required decision or unchanged stage. The default sequential behavior remains.
Private construction owns its automatic track activation; only explicit mode
choices create manual Undo stages. All serialized actions use one ActionRegistry
for both API schemas and hydration, including opening and receivership actions.

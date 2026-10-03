# Six correctness fixes after the family review

This slice resolves findings 1–6: 1830 emergency sale blocks; mandatory stock sales
in 1830/1889; 1817 hex reentry, mine/ranch orientation, post-conversion sales, and
acquisition buying power. The reference is the local research snapshot at
`715567bdc7e5cc68a68a286b21dc8edd1a125e50`.

## Catalog survey and boundaries

The full `data/title-traits.json` catalog was surveyed for certificate counting,
share-sale eligibility, emergency funding, borrowing, upgrade preservation, route
track reuse, fleet constraints, reorganization operations and settlement, alongside
those chapters in `18xx-domain-model-study.md` and the variation catalog. Counts
below describe sourced assignments; missing profiles remain evidence gaps.

- 130 titles have funding profiles: 52 use owner sales/contributions, 21 issuance
  before owner funding, and others use loans, receivership, liquidation, or no
  compulsory train guarantee. Single-block sales are not universal, even within
  related families: 1822 permits separate blocks while 1822CA requires one block;
  1830 permits separate blocks while 1889/TOP require one. Funding owns its own
  required `sellInBlocks` policy, independent of ordinary stock-turn sequencing.
  No new serialized state is needed: the existing sale records identify earlier
  blocks. 1817 continues not to use this train-funding procedure.
- Of 130 certificate-counting profiles, 43 include market exemptions and three
  weighted certificates; 18MEX's denominations and 1817's shorts further distinguish
  pieces from economic interest. Sale eligibility ranges from any-time to prior-round
  holding or completed-operation requirements. Exceeding a limit and being able to
  obey a mandatory sale are separate questions. Shared stock actions and handlers
  use the same legal-sale evaluator for mandatory divestment and availability;
  purchase-specific certificate and ownership checks still apply.
- Route profiles distinguish stop limits, track reuse and fleet constraints. The
  review's proposed blanket hex-reentry ban was incorrect: reference `Route#hexes`
  counts stop hexes, not every traversed track hex. Replaying game 15528 through
  action 1630 directly in the reference yields $470 for NYOW while revisiting E16
  on two different stop-to-stop connections. Its counted hexes are F13, G18, C14,
  B13, B17, E22 and C26. The original E8 probe is nevertheless invalid: it crosses
  the same junction twice _within one connection_. A direct reference graph probe
  finds no chain D9–E8–F7–E6–E8–D7 but does find D9–E8–D7. The correction belongs
  in shared route tracing and connection compilation: visit a junction once until
  the next revenue center; clear that record at the center. Stops, fleet-wide track
  resources, distinct junctions and later connections remain separate. No new
  title flag or blanket hex restriction is introduced. 1866's named double-hex
  exceptions apply to its stop-hex rule, not this graph constraint.
- Upgrade profiles include 46 ordinary path/stop-preserving and 80 specified
  transformations, with extended color sequences and gauge conversions as other
  variations. Future upgrade feasibility reuses the title's color progression,
  labels, stop preservation, available pieces and topology mappings, independently
  of current phase, cost, or a company's lay allowance. It does not assume every
  non-gray city has an upgrade. 1817's mine/ranch rule composes this with stop type
  and reciprocal-edge checks; 1817NA's preprinted gray town is a counterexample to
  requiring a city or an upgrade when an existing exit already connects.
- Reorganization profiles include 30 conversions, 41 mergers, 44 acquisitions and
  45 titles without corporate reorganization. 1817/1867's inter-OR rounds differ
  from 1835/1856 national formations and 1866 stock-round conversions. The 1817
  trade sequence, action, panel, and history remain title-owned, composing shared
  share disposal/settlement. Non-presidents may sell a positive block and finish;
  the president may buy repeatedly but cannot sell. Automatic passes require
  neither buying nor selling to be possible. Market shorts still close after sales.
- 82 borrowing profiles have no ordinary loans, 22 corporate loans and 27 player
  loans. Acquisition borrowing capacity, inherited debt, cash and treasury
  compensation are distinct quantities. Only 1817's bid calculation changes:
  include inherited loans in hypothetical supply before capping by buyer capacity
  and subtracting inherited principal. Liquidation loans remain with the seller.

## Reference evidence

Paths below are relative to `research/18xx-2026-09-08/source/lib/engine/`:

- `game/base.rb`, `game/g_1889/game.rb`, `game/g_1871/game.rb`,
  `step/emergency_money.rb`: title-specific sale-block restrictions.
- `step/buy_sell_par_shares.rb#must_sell?` and `step/share_buying.rb#can_gain?`:
  actionable mandatory sales and independent purchase limits.
- `route.rb#hexes`, `route.rb#get_node_chains`, `part/path.rb#walk`,
  `game/g_1817/game.rb#revenue_for`, and fixture `1817/15528.json` action 1630:
  stop-hex checks versus junction traversal within a connection.
- `game/g_1817/step/special_track.rb#legal_tile_rotation?` and
  `#potential_future_tiles`: reciprocal exits or an available future upgrade.
- `game/g_1817/step/post_conversion.rb`: sell/pass decisions, president restrictions,
  and one action for other shareholders.
- `game/g_1817/step/acquire.rb#max_bid_for_corporation`, `game/g_1817/game.rb#available_loans`:
  inherited loans in acquisition capacity.

## Verification and compatibility

Regression scenarios cover two 1830 sales funding a train, 1889's block restriction,
over-limit full-market passes and resumed mandatory sales, 1817 repeated junctions within one connection,
terminal-city mine orientation, cashless and empty-treasury conversion trading,
sale rejection/settlement/undo/replay/history, and an acquisition with all 70 loans
outstanding. Rust tests reject junction reuse within a compiled connection and allow it across
connections and trains. The two completed 1817 fixtures now retain a recorded
post-conversion pass previously skipped by the converter; all other actions,
opening states and expected final values remain unchanged.

State schemas are unchanged. Rebuild all four titles' Logic and UI Artifacts to
adopt the shared fixes. 1817 additionally adds `SellConvertedShares`, which its
Logic and UI Artifacts must adopt together. The internal autorouter wire
format advances to version 3 with junction identities and a junction count, so its encoder and bundled
Wasm must be built together. This is not a Site Frontend/Game UI bridge change.
No new save compatibility reader is introduced. TOP's disputed emergency-funding
policy and the review's separate rule-authority questions are outside this slice.

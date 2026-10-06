# Corrections after the four-title rereview

## Scope and survey

The three corrections cover certificate acquisition, 1817 station consolidation,
and private exchanges during compulsory train funding. They add no title state
properties or save compatibility readers.

Survey: the full `18xx-2026-09-08/data/title-traits.json` assignment set, grouped by
`certificate-counting`, `reorganization-operations`, `reorganization-settlement`,
`emergency-funding-order`, `power-effect-families`, and `power-lifecycle`; the
corresponding finance, reorganization, stations, and special-powers discussions in
`18xx-domain-model-study.md`. Counts overlap: profiles describe mechanisms, not
exclusive title classes, and unresolved profiles remain evidence gaps.

- Certificate profiles include market exemptions (43 titles), weighted certificates
  (3), title-specific counting (29), excluded privates (24), and no certificate
  limit (1862 Solo). An acquisition's burden is its rule-supplied weight, not its
  share percentage or physical piece count. A zero-weight acquisition does not
  increase an already excessive count. Mandatory divestment, percentage ownership,
  affordability, and turn eligibility remain independent checks. Positive weights
  retain the existing total-after-purchase test. This supports 1830/1889 without
  putting market colors into the generic acquisition procedure.
- Reorganization profiles include token migration (71), mergers (41), acquisitions
  (44), and no corporate reorganization (45). The generic transfer retains city
  identities and removes exact-city duplicates. It must not impose 1817's one-token
  per hex rule on every title. The 1817 merger/acquisition procedure first offers
  choices within duplicate hexes, then reduces pieces above eight. Removed
  placements return to the charter; unused pieces above eight leave the game.
  Contrast 1862's pending-removal procedure, which destroys chosen tokens and has
  its own permitted hexes/count. No shared configurable token-resolution framework
  is needed for these fixes.
- Emergency profiles include president sales/contribution (52), corporate issuance
  then owner funding (21), loans then liquidation (8), corporate funds only (3),
  and no compulsory train guarantee (4). Powers separately have activation windows
  (102), phase expiry (80), and exchange consumption (38). These are not grounds
  for making every private power legal during funding. Existing exchange terms
  remain authoritative: 1830 M&H and 1889 Dôgo permit any-turn exchange; TOP's
  exchanges require the owner's stock turn; 1817 supplies no such exchange.

Primary-source checks used the local reference snapshot
`715567bdc7e5cc68a68a286b21dc8edd1a125e50`: `step/share_buying.rb` (`can_gain?`),
`step/buy_sell_par_shares.rb` (`must_sell?`), `step/token_merger.rb`,
`step/reduce_tokens.rb`, `game/g_1862/step/remove_tokens.rb`,
`game/g_1830/entities.rb`, `game/g_1889/entities.rb`, `step/exchange.rb`,
`step/buy_train.rb`, and `step/bankrupt.rb`. Exchange is nonblocking during train
buying; train buying and emergency sales use the corporation's current owner.
Bankruptcy does not require consuming an optional private exchange.

## Composition and presentation

`FundingTrain` composes the existing private-exchange handler around its ordinary
funding handler. It keeps the committed purchase and sale history. On reentry the
funding handler refreshes the responsible player and ordered contributors from
current ownership, including an exchange that changes the operating presidency.
Other funding actions remain constrained to the pending purchase.

Before automatically declaring bankruptcy, the handler checks for exchanges that
the runtime actually permits, including its out-of-turn policy. An optional
exchange leaves a decision window in which the responsible player can exchange or
explicitly declare bankruptcy. Without an available exchange, existing automatic
bankruptcy continues. Terminal bankruptcy has no exchange window. The session's
funding controls require a funding action, so an out-of-turn exchange permission
does not authorize someone to sell or contribute for the current president.
This extends the existing funding procedure; loan, nationalization, and forced
exchange procedures retain their title-owned sequencing.

1817's `RemoveStation` records its location and final destination in action
metadata. History distinguishes a returned piece from one removed from play.
The choice panel uses the canonical map's existing tile drawing, marks the
selected city, and names its relative position so New York's two buttons are
distinguishable visually and by accessible text. No map geometry or rule meaning
is inferred from artwork. Choices commit through the existing session method;
there is no additional staged selection to persist or clear.

## Verification examples

- Four-player 1830/1889 holdings exceed the certificate limit while all relevant
  markets are full: passing and buying an exempt share succeed, an ordinary share
  fails, and freeing a market slot restores mandatory divestment.
- Both 1817 merger and acquisition resolve New York under eight pieces. Either
  city may be retained; an unrelated station and a different player are rejected.
  With ten placed pieces, New York resolves before the remaining numerical excess.
- M&H exchanges by the president or another player preserve compulsory funding;
  the acquired share may be sold. An otherwise bankrupt player may use the share
  to finish buying a train or decline the optional exchange and declare bankruptcy.
  A presidency-changing exchange transfers responsibility without replacing the
  purchase. Processed-action replay and undo restore the exchange/station/stock
  positions.

Validation: shared/four-title logic (706 tests), shared UI modules and stock/funding
integration (223), Common recorded/exploration history (14), and all recorded
full-game fixtures (11) pass: 954 distinct tests. Shared and title builds pass;
shared UI, 1817 UI, and playground checks report no errors or warnings. The two new
title test files also pass a strict TypeScript check.

Collaborative-browser interaction checks used isolated local fixtures: either
New York city is identified by its own label and cross; desktop removal and Undo
restore the decision; the controls wrap within a 390px viewport. M&H can be exchanged
during the bankruptcy decision, its NYC share sold, and its proceeds contributed
to buy the required train. Explicit bankruptcy and Undo also work. Browser snapshot
capture failed in the preview tool, so these checks used DOM geometry/attributes
and real controls rather than a screenshot-based visual review.

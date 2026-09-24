# Company formation and flotation: slice 4

## Family review

The full local trait catalog was reviewed for company availability (158 scoped
assignments), formation method (161), home establishment (172), capitalization
method and amount (170 each), share-proceeds destination (300), capital release
(206), flotation conditions (270), and flotation counting basis (240), alongside the
study's ownership, capitalization, formation, and station-right sections. Coverage
ranges from 128 to 130 assigned titles per trait; unknown profiles remain gaps.

The meaningful variations include full, incremental, escrow, auction-derived and
split funding; phased, ordered and concession-dependent release; initial share
subscriptions, auctions and exchanges; fixed, chosen, inherited and multiple homes;
and thresholds that include or exclude Market, treasury or reserved shares.
1856 changes funding terms and flotation thresholds with timing; 1846 receives
funds through transactions; 1824 can require a predecessor exchange; 1825 uses
ordered release; 1862 distinguishes chartered and unchartered formation; and 1858
separates a home reservation from an immediately available station slot. These
counterexamples inform each shared model, action, handler and visual described
below. They are not all implemented in this slice.

## Design

- Company facts distinguish `started`, `funded`, `floated`, `operated`, and `closed`.
  Funded records settlement of the initial funding obligation used by these examples;
  it is not a treasury balance or a promise of full capitalization in every title.
  Future incremental receipts and restricted funds retain their own procedures.
- `StartCompany` records the buyer and selected market space. The title determines
  available prices, eligibility, funding source and initial purchase terms. It
  establishes the presidency and marker and uses the same acquisition/payment
  settlement as ordinary purchases. An unstarted company cannot sell ordinary shares;
  a started company can sell them before flotation. Buyer and acting player remain
  separate, including Union Bank's mandatory contribution order.
- `CompanyRules` supplies formation eligibility, flotation payments and title-owned
  consequences. The shared `FloatCompany` System Action reevaluates eligibility,
  settles initial capital once and records flotation. The stock handler schedules
  it after the triggering trade. TOP's inseparable share/station exchange and PEIR
  closure resolve inside that system action. Decisions such as a chosen home or
  accepting predecessor assets would require their own future state/action flow.
- `CompanyTranche` records capacity and occupancy. Completion is a supplied predicate,
  not an assumption that flotation opens the next tranche. The current title uses
  ordered capacity-limited tranches; a roster-based release scheme may instead
  compose the availability rules without using this model.
- Stations have identity, company ownership, and available/placed/removed states.
  Placed stations identify a map location, city node and slot. Reservations identify
  a company and city independently of a station's availability or physical placement.
  The preprinted-map reservation schema is shared with the new persistent reservation
  model. Title fixtures derive home locations from their existing semantic maps.
  TOP replaces and removes the PEIR station; 1889 keeps a reservation and available
  home station after flotation, awaiting its operating round. Full station supply,
  prices, placement legality, and board integration remain in their station slice.
- The shared certificate exchange transfers a replacement instrument to the owner
  of the surrendered instrument and retires the latter. TOP resolves both PEIR and
  successor-company presidency from the resulting interests. A forced ownership-limit
  exemption permits retaining a PEIR exchange above 60%; ordinary purchases continue
  to use the normal limit. No permission to buy beyond that ceiling is inferred.
- The example UI stages company selection and starting price using Common's staged
  selection helpers. Back unwinds those manual choices, Undo clears selection or
  reverses committed history, and state publication clears drafts. Purchase previews
  identify upcoming flotation and capital; company details show lifecycle facts,
  home reservations and placed stations. No UI effect performs gameplay.

## Paired rules and scope

Shikoku 1889's supplied rulebook §§7.2.1–7.2.4 and 7.4 establish the presidency at
twice a selected par of 65–100, permit subsequent IPO purchases before flotation,
and float at 50% outside the IPO. Market shares count. The Bank grants ten times
par; the home station is placed at the start of the next operating round.

TOP's prototype §§6.7.1–6.7.5, 6.8 and 7.7 distinguish starting from flotation.
Starting needs an available tranche and a player-owned associated PEIR share,
which need not belong to the founder. Prices are 80/74/65/58 initially, with 80
removed on 5H, 74 on 3+, and 65 on 7. Ordinary companies float at 60% outside the
Bank and receive ten times their starting price. Branches already receive their
special capital during splitting and must not receive it again at flotation.

TOP's PEIR exchange removes the numbered share and PEIR station, transfers an
ordinary Bank share, and installs the successor's station. It can exceed 60%
without a forced sale and can change presidency. The last exchange closes PEIR
and the King's Mail; PEIR cash is discarded. The examples currently contain cash
and private certificates, with no trains. Train ownership and discarding must join
that closure when the train model is implemented; this slice does not claim train
asset handling. Split decisions and transfers remain slice 17.

The current TOP examples fix Charlottetown as Mainline and Souris as Shortline;
association data for the remaining five railways belongs to the title. Randomized
setup will author those associations when its slice arrives. Reserved-share
inclusion in TOP flotation and King's Mail closure are clarified by the pinned
production configuration at `715567bdc7e5cc68a68a286b21dc8edd1a125e50`,
`g_1871/corporations.rb` and `g_1871/game.rb`. Prototype rules remain authoritative
for TOP. External material supplies facts and context only; all implementation is
authored for this repository and contains no research-source references.

## Examples and verification

Three independently saved positions per title exercise share trading, starting
companies, and the purchase that triggers flotation. The example still stops after
one stock turn; a complete round is slice 5. Fixture version 6 preserves earlier
local examples and separates positions by name and configuration.

Engine checks cover both titles' start payment, unstarted/started/funded/floated
separation, Union Bank contribution, eligibility, tranche release, phase prices,
counting bases, exact system-action replay and Undo, reservation timing, PEIR
exchange/closure and its forced ownership excess, and an already-funded branch.
Browser checks exercise staged choices, confirmation, saved results, title/position
switching and Undo through the purchase plus flotation cascade on desktop/mobile.

Validation completed: 109 family logic tests and 53 paired finance/trading/formation
tests pass. All 13 desktop/mobile finance and formation browser checks pass, as do
package builds, Svelte checks, and the viewer production build. Screens were inspected
at 1280px and 390px for starting-price confirmation, flotation preview and resulting
company status. Full round progression and train handling remain as scoped above.

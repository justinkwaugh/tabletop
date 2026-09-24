# Stock trading: slice 3 design and evidence

## Family survey

The review covers the full local `data/title-traits.json` catalog, including its
131 profiles with assignments, and the study's ownership/control, certificates/
presidency, stock transactions/markets, capitalization, and decision-interruption
sections. Unknown profiles and unresolved traits remain evidence gaps.

The surveyed assignments include 347 certificate-counting entries, 184 ownership
limits, 271 presidency-transfer entries, 131 transaction-order entries, 132 sale
eligibility entries, 195 treasury-transaction entries, and 142 market-topology
entries. Multiple scoped assignments per title are expected. The variation includes
one-dimensional, two-dimensional, hex, and zigzag markets; sell–buy, sell–buy–sell,
and sell–buy or buy–sell procedures; corporate presidents; unequal denominations;
weighted certificates; market exemptions; and several sale-timing restrictions.
Price-movement, investor, and control profiles were also reviewed.

These profiles challenge the interfaces; they are not executable configuration.
The implementation was authored for this repository's TypeBox models, Common
runtime, Game Session, action history, and Svelte UI. No external implementation
or external schema was copied or mechanically translated.

## Models and procedures

- **Stock market:** spaces have distinct identities, prices, display coordinates,
  colors, and explicit movement connections. Mutable stacks record ordered company
  identities separately. Price is derived from a company's marker, eliminating the
  former duplicate `Company.marketPrice`. The rectangular authoring helper uses
  Common's `RectilinearGrid` to derive cardinal adjacency for these two printed
  markets, including missing cells. The grid exists only during construction;
  saved state retains the market spaces and connections. Movement follows connections rather
  than calculating from display coordinates. The current renderer is rectangular;
  other layouts require their own authoring/rendering, not new stock-price identities.
- **Movement and order:** title rules select movement magnitude. Both consumers
  use downward sale movement with a stationary bottom edge. A marker that stays
  in place retains its stack position; arrivals go below existing markers. Sale
  blocks are ordered inputs, preserving TOP's choice when several companies arrive
  at one space. The shared market-order query implements the price/rightmost/stack
  order these titles choose. Other ordering rules can use the same market data.
- **Financial settlement:** named cash payments are independent of stock purchases.
  Sale evaluation uses the price before movement and keeps the seller, certificate
  destination, and payer explicit. The current sale actor is a player; title rules
  determine permitted sellers, so company ownership is not treated as personal
  ownership. The example rejects insufficient Bank cash; bank-break handling remains
  in the end-game slice.
- **Presidency:** eligible owners and their successor order come from title rules.
  The shared procedure retains a tied incumbent and finds an exact ordinary-share
  exchange for the president's certificate. It uses share units rather than assuming
  a ten-share company or two ordinary certificates. Tests exercise mixed denominations
  and a four-unit presidency. Titles requiring a player choice among economically
  different exchanges will need an explicit decision; deterministic certificate
  selection is sufficient for the two current ordinary-share structures.
- **Transactions:** presidency exchange and delivery of ordinary shares form one
  atomic stock-trade settlement, including when selling units previously represented
  by the president's certificate. The president certificate never enters the Market.
  Result metadata identifies exchanged certificates, proceeds, and market movement;
  the engine's existing patches preserve exact Undo and processed replay.
- **Stock turn:** named `StockTurn` records the purchase and companies sold during
  the current turn; `StockRound` retains earlier sales and company purchase use.
  This supports the paired sale-order restrictions without implementing full round
  progression. `FinishStockTurn` ends the prepared turn and leaves an inspection
  state with hotseat identity retained for Undo. The next slice for round progression
  will supply the next actor, passes, and round-end consequences.
- **Limits and UI:** ownership limits are per company; certificate weights are
  evaluated under current title rules and market position. The inspector uses those
  same effective weights. Manual purchase or sale selection drives a preview only;
  the Game Session owns action creation. Back clears selection, and Undo clears a
  manual selection before undoing committed history. The market and portfolio UI
  consume committed state. No reactive UI effect performs a trade.

1870 price protection requires a pending decision before sale completion; it must
not be represented merely as a modified sale price. 1817 short positions require
liabilities beyond positive certificates. 1841 corporate control may need a different
eligibility policy. Preferred interests, escrow, exceptional exchanges, and price
movement after other events are considered but not claimed as implemented here.

## Paired evidence

**Shikoku 1889:** supplied 2022 rulebook §§3.1–3.4, 7.1–7.6. Yellow removes
certificate-limit counting; orange also removes the 60% ownership ceiling. Prices
move down per share sold, stop at the bottom, and arrivals go below occupied stacks.
No first-stock-round sales; Market capacity is 50%; successors follow clockwise order
from the incumbent. Buying cannot evade the certificate limit by relying on a
subsequent presidency exchange. The pinned production configuration confirms sales
of a company must form one block per turn. See
[1889 evidence](1889-slice-evidence.md).

**TOP:** supplied prototype §§6.3–6.6, 6.8, 7.1, and 10. Shares require prior operation
to sell; the sale block is at most 30%; market value drops once for the block. The
seller chooses the relative arrival order of converging company markers. Union Bank
may own a presidency, keeps incumbent ties, and loses successor ties to players;
it never voluntarily sells in the stock round. The prototype's player-order wording
is interpreted clockwise from the incumbent, clarified by the pinned title's
presidency-distance rule; when Union Bank was president the current player order
supplies player tie priority. The 80% Market maximum is also supplied by that title
configuration and is consistent with retaining the president's certificate outside
the Bank. TOP prices and par-space colors come from its market definition; unlike
1889's colors, these do not imply certificate/ownership exemptions.

Definitions inspected for factual clarification: the pinned research snapshot
`715567bdc7e5cc68a68a286b21dc8edd1a125e50`, `g_1889/game.rb`, `g_1871/game.rb`, and
`g_1871/market.rb`. The broader counterexamples are linked in the local study's
stock-market and presidency sections. Research references stay in documentation.

## Verification and limits

Engine tests cover pre-movement proceeds, multi-share movement versus block movement,
ordered arrivals beneath existing markers, tied incumbents, clockwise successors,
Union Bank presidency, exact certificate exchanges, purchase-driven presidency,
unauthorized actors, malformed or repeated blocks, first-round and operation gates,
Market capacity, 30% limits, sell–buy restrictions, effective certificate/ownership
limits, and exact hydration, replay, and Undo.

Desktop/mobile browser checks exercise sale preview and cancellation, presidency
updates, stack order, saved sales, a purchase after selling, finishing the turn,
Undo through that entire sequence, and an 1889 purchase followed by a sale. They
check cash and portfolio results, title switching, and overflow. The initial 1889
position intentionally ties Alex and Blair in Iyo so one purchase demonstrates a
presidency change. Earlier saved examples are preserved under fixture version 5.

Company formation/flotation, full round progression, price-protection decisions,
emergency finance, bank-break timing, dividend movement, and operating-order
execution remain in their planned slices.

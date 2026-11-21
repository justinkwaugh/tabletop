# 1860 table interaction and visual contract

1860 renders the shared 18xx table through `Session1860`, a specialization of the shared 18xx
session. Shared modules own stock trading, tile and station staging, routes, payouts, train
purchases, history and the single contextual Undo; their behaviour is recorded in the
[18xx-ui contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md). This contract
covers what 1860 adds. The map is the generic presentation.

## Visual intents

- **Initial auction.** While `choiceAuction` stands, the action area shows the auction's number,
  the high bid and its bidder, who has passed, and a card for each certificate still on offer:
  the four ferry privates as private cards (face value, income, the company whose reserved share
  each is exchanged for) and the C&N and IOW director's shares. The player to bid sees the shared
  bid control, from the minimum raise to the most they may bid, with Pass. The winner's
  affordable certificates become pressable cards: a private is one ChooseCertificate Action; a
  director's share is a manual local selection (`chosenLot`) that opens one button per par, each
  one ChooseCertificate Action. Other players see who the auction waits on.
- **Bank privates.** In a stock turn with a private to sell to the bank or to buy from it, the
  stock menu offers a Privates panel beside Buy and Sell. Each offer is one SellPrivateToBank or
  BuyPrivateFromBank Action, named with its price; the Fishbourne Ferry's purchase states that it
  closes the other privates.
- **Home tile.** While a floating company's director lays its home tile (`LayingHomeTile`), the
  action area names the company and its home, and the map offers that hex alone through the
  shared track selection: tiles arc round the hex, rotate and confirm as any lay does, and the
  confirmed lay is one LayHomeTile Action. Other players see who lays the tile.
- **Train limit.** While a company is over its limit as its turn begins, its director sees one
  button per train it may return, each one ReturnTrain Action.
- **Halts.** A halt prints as a grey stop outlined in ink, with a £ in a value badge in place of
  a value. A run's halt subsidies show under its income as "Halt subsidy".
- **Leased train.** An insolvent company's leased train is listed in the run panel with a
  "leased" tag.
- **Company states.** Company cards carry Insolvent, Receivership, Bankrupt or Nationalised
  marks. A bankrupt company's bases print on the map as grey face-down discs with its initials;
  its token elsewhere keeps its own look.
- **Southern Railway and British Rail.** Once the first 9+5 is bought, a notice under the phase
  strip states the Southern's restrictions; once British Rail forms, it lists the companies
  closed and the nationalisation rules.

## Shared state and lifetime

The auction's bid amount (`bidAmount`) and chosen director's share (`chosenLot`) are manual
local selections registered with `localSelections`; Undo backs out the chosen share first, then
a changed bid, and every presented transition clears both. The home tile's staging is the
shared track selection, fed by the session's `titleTrackLay`, which exists only while this
player may lay the tile. The bank-private offers, train returns and company marks are derived
from Game State. Buttons are disabled while `canChooseAction` is false (busy, updating visible
state, or viewing history).

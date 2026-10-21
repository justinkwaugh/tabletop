# Player wealth history

The 18xx table's optional Stats tab charts every player's starting cash and their wealth at the
end of each finished round. History describes Actions from their input and `metadata`, so the round
ends are recorded where the rounds end rather than recovered from earlier states.

## Evidence

- Research: `18xx-trait-catalog.md` and `data/title-traits.json` (player-count setup trait:
  starting money changes with the player count), `18xx-game-variation-catalog.md` (18NewEngland
  North and the 18ZOO maps adjust starting cash with their setup).
- Implemented consumers: TOP (offer-pile auction), 1830, 1832 and 1889 (waterfall auctions),
  1817 (selection auction; merger and acquisition rounds after each operating round), 1846
  (hidden draft, and a two-player opening whose purchases resume between operating rounds), 1832
  (merger phase after a stock round).

## Design

- **Valuation.** Wealth is the title's final-wealth valuation (`ValuationRules`) at that moment,
  the same as the operating-round snapshot's `playerNetWorth`. `playerNetWorth` is now the one
  shared helper for both.
- **Round ends.** `RoundEnd` (`round: opening | stock | operating | title`, `playerNetWorth`) is recorded in
  the `metadata.roundEnd` of the Action that ends the round:
  - family: `ResolveAuction` and `ResolveSelectionAuction` when the opening auction completes,
    and `CompleteStockRound` after its market moves;
  - an operating round's last turn: `FinishOperatingTurn` keeps its existing snapshot
    (`complete`); every other Action that ends a turn records `operatingRoundEnd` when the turn
    was the round's last: `GoBankrupt` and `DeclareBankruptcy` when they abandon a turn, 1832's
    `CloseCompany` on the company's own turn, 1846's `SettleIndependent`, and 1846's
    `CloseCorporation` on its own turn, which now ends that turn itself;
  - 1846: `RevealDraft`, and `BuyOpeningCompany` or `PassOpeningPurchase` when the last opening
    company is bought;
  - 1817: `EndMergerRound` and `EndAcquisitionRound`; 1832: `CompleteMergerPhase`.

  `recordedRoundEnd` reads the record from any Action, so a new title's round needs only to
  record it. The UI names a title round as History does: by the presentation round whose `ends`
  matches the Action, numbered by the stock round when it follows one and by the operating round
  it is held in otherwise (1832's last merger phase follows a 6-train purchase mid-round).
- **Opening operating rounds.** Operating rounds before the first stock round ends, as in 1846's
  two-player opening, belong to the opening and are not charted on their own.
- **Start.** `EighteenXXTitleRules.startingCash({ playerCount, config })` is each player's cash
  from the title's opening. Each title's opening uses the same function, and the family
  initializer asserts that every player starts with it, so the chart and the setup cannot
  disagree.
- **Current round.** A round still being played has no point. Once the game is over, the final
  wealth ends the round it ended in.

## Limits

- Every player starts with the same cash. No surveyed title differs by player; a title that does
  would need `startingCash` to answer per player.
- Games stored before the release have no opening or title-round records, and operating rounds
  whose last turn ended other than by `FinishOperatingTurn` have no end. Their stock rounds take
  the next operating round's start snapshot, which already includes that round's private income.

# 18MEX table interaction and visual contract

18MEX renders the shared 18xx table through `SessionMex`, a specialization of the shared 18xx
session. Shared modules own the waterfall auction, stock trading, tile and station staging,
routes, payouts, train purchases, history and the single contextual Undo; their behaviour is
recorded in the [18xx-ui contract](../../../libs/18xx-ui/ui-interaction-visual-contract.md).
This contract covers what 18MEX adds. The map is the generic presentation.

## Visual intents

- **NdM merger offer.** While the first 5-train's phase change waits on the merger, the player
  offered it sees, in the action area, the NdM's token with a one-line question, a Decline
  button, and a card for each of their floated eligible companies: its token, its name and what
  they receive (the NdM trade-in 10% and the payout for their other shares). Each card or button
  is one Action (MergeIntoNdM or DeclineNdMMerger). Other players see the NdM's token and who
  the merger waits on.
- **Unfloated choice.** Once every player has declined, the NdM's president sees a card per
  unfloated eligible company, token and name, each one MergeIntoNdM Action.
- **Exchange station.** Where the merged company had several other stations in hexes without the
  NdM, the NdM's president sees the merged company's token, the question and one button per hex,
  named by place, each one ChooseExchangeStation Action.
- **Copper Canyon.** Hex F5's name is set large on two lines; the tile draws as a straight and a
  gentle curve meeting at the town, joined at their far ends by a tight curve.
- **Mexico City double hex.** Mexico City and Puebla draw as one area: the side between them is
  joined on the printed hexes and on every Mexico City tile, and choosing either hex for a lay
  chooses and previews the double tile as one piece.

## Shared state and lifetime

The merger decision is derived from Game State (`mergerDecision`, `mergerWaitingOn`); it holds
no local selection and needs no Undo registration. Buttons are disabled while
`actionsLocked` (busy, updating visible state, or viewing history).

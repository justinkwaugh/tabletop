# Promontory Point known deviations

Where this implementation still differs from the rules or a component's published text. `rulings.md` holds readings, which are not deviations. Each line names the rule or component, what the engine or UI does instead, and what governs.

## Rules

None yet.

## Component text

None yet.

## Not covered by specs

What is transcribed from the printed components without a spec that checks it against them.

- **Board spaces (R-1.1, R-1.1-H3).** The kind and coordinates of every space and home hex come from the supplied map. They were checked by an overlay of every measured centre on the map; `src/components/components.spec.ts` checks the data against the transcription in `components.md`, not against the image.
- **Town tile counts per kind (R-1.1-H1, provisional).** The rulebook prints eight counts but not which kind each belongs to; the pairing is inferred, and `components.spec.ts` checks the data against that inference.

## Platform limits

Behaviour that belongs to the shared platform rather than this title, such as the bounds of Undo or what a spectator can explore.

- **Called and conceded games.** The platform can end a game outside the rules (`docs/player-votes.md`): a call names one winner or none, a seat concedes a two-seat game to the other, and a game nobody has moved in 30 days ends with no winner. The result is the call's, with no final totals (R-6.2 is not read), and the machine state stays where the call found it. The logic needs nothing for it: its state check never ties a result to `EndOfGame`. Governs: the shared `callGame` (`libs/common`); the UI's `src/lib/utils/endSummary.ts`.
- **The first turn's reveal (R-2.2 step 1).** The engine runs no System Action as a game starts, so there is no `RevealHand` for the first turn: setup deals the starting player's pieces face up into `turn.pieces` and the game opens in `TradingBeforePlacing`. Every later turn opens with `RevealHand`. Governs: `src/definition/initializer.ts`.
- **The first turn's pieces in history (R-2.2 step 1, R-5).** With no `RevealHand` for the first turn, history has no line naming the starting player's first pieces; the first turn's entry opens with its first trade or placement. The pieces are public on the table throughout that turn. Governs: the UI's `src/lib/utils/actionAggregator.ts`, which builds history from Actions alone.

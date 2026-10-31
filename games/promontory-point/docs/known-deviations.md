# Promontory Point known deviations

Where this implementation still differs from the rules or a component's published text. `rulings.md` holds readings, which are not deviations. Each line names the rule or component, what the engine or UI does instead, and what governs.

## Rules

None yet.

## Component text

None yet.

## Not covered by specs

What is transcribed from the printed components without a spec that checks it against them.

None yet.

## Platform limits

Behaviour that belongs to the shared platform rather than this title, such as the bounds of Undo or what a spectator can explore.

- **The first turn's reveal (R-2.2 step 1).** The engine runs no System Action as a game starts, so there is no `RevealHand` for the first turn: setup deals the starting player's pieces face up into `turn.pieces` and the game opens in `TradingBeforePlacing`. Every later turn opens with `RevealHand`. Governs: `src/definition/initializer.ts`.
- **The first turn's pieces in history (R-2.2 step 1, R-5).** With no `RevealHand` for the first turn, history has no line naming the starting player's first pieces; the first turn's entry opens with its first trade or placement. The pieces are public on the table throughout that turn. Governs: the UI's `src/lib/utils/actionAggregator.ts`, which builds history from Actions alone.

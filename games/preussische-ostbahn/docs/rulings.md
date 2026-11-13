# Preußische Ostbahn rulings

The owner's decisions where the printed rules are silent or leave a gap, as implemented. This file records decisions only; it does not restate the rules. Each ruling names the tests that hold it.

## Share auctions

- **An offered share nobody bids on goes to the player who offered it, for nothing.** This follows the designer's ruling for the later Rio Grande edition, and applies to the opening auctions and to Capitalization alike. When nobody can afford to bid at all, the share is awarded by the `AwardShare` system action so the sale is recorded. Tests: `rules.spec.ts` "gives an unbid share to the player who opened its auction", "goes to its opener for nothing through a recorded system action".

## Expansion

- **Each track is its own Action.** A player chooses a railroad and builds one track per press with no confirmation. The Expansion stays open (`Expanding`) until the player ends it with `EndExpansion`, or ends by itself (`CompleteExpansion`) at the railroad's track limit or when nothing more is affordable. New connections, and the dividends they trigger, are judged only when the Expansion ends. Tests: `rules.spec.ts` "building track one space at a time", "pays no dividends until the Expansion ends".
- **The Badische's free rural track is its dearest rural track of the Expansion, whatever order it was built in.** Each track is charged so the running total never includes that one. Tests: "frees the Badische's dearest rural track whatever order it is built in".
- **A Berlin Approach is not rural.** The Badische's free track can only be a rural space. Tests: "never gives the Badische a Berlin Approach for free".

## Turn order

- **The cup draw may give a player several turns, or none, in a round.** The round's drawn slots are kept as the turn manager's order and walked by slot; seat order, which bidding follows, is the order of `players`. Tests: "draws as many cubes as players, so a player may take several turns".
- **The player ending the round draws the turn order, as their own Action that nobody can undo across.** That is the last turn slot's player, or after the opening auctions the last opening share's buyer. The draw is marked as revealing information, so the server makes it and Undo stops there. When the game is over at that point, it ends by itself with no draw. Tests: `rules.spec.ts` "waits after the opening auctions for the last share’s buyer to draw", "waits at the end of a round for the last slot’s player to draw", "must be declared as revealing the draw", "cannot be undone by anyone", "is skipped when the game ends at the end of the round".

## Ending the game

- **The game ends by itself at Determine Player Order** when every railroad is directly connected to two others, or when a sound check proves that impossible. The check over-estimates what each railroad could still reach, so it never ends a game that could still finish. Tests: the "the end of the game" suite in `rules.spec.ts`.

There is no in-game vote to end early: the site's own call-the-game feature covers players agreeing to stop.

# Game Progress

Game Progress tells someone looking at a game card, a Tournament table or a League group how far an In Progress Game has come, without opening it. Its terms are in the [Game Lifecycle context](contexts/game-lifecycle/CONTEXT.md).

## Shape

`GameProgress` (`libs/common/src/game/model/gameProgress.ts`):

- `fraction`: a rough share of the game played, 0–1. It drives bars and sums across tables, so it only has to be roughly right and should not go backwards in ordinary play.
- `label`: at most 64 characters in the title's own terms, such as `Round 4 of 6`, `18 tiles left` or `Phase 5 · Bank $2,140`.
- `final`: set once the game's end has begun (the last round, Fresh Fish's final stalls, a broken bank). Displays mark it in amber.

## Where it comes from

A title opts in with `runtime.progression` (`GameProgression`). `reportGameProgress` calls it, keeps the fraction within 0–1 and rounds it to three places. The result goes on `Game.progress`:

- `GameEngine.startGame`, which covers hosted, tournament, continued and local starts.
- `createGameFork`, at the fork position.
- The backend's Action and Undo writes in `gameService`. Calling a game adds only a result, and the Game State it ends on is unchanged, so its progress stays.
- `saveGameLocally` for Local Games.

The hook reads host state, so it must report only what every viewer can see. If it throws or returns something invalid (such as a NaN fraction or an empty label), the error is logged and progress is left unset, so a faulty hook never blocks a move. Game Progress stays on a Finished Game, but displays show the result there instead.

## Where it shows

- Game cards: a label and bar between the name and the Active Player row, for Started games.
- Tournament schedule: a Progress column for tables whose game is still running. `TournamentGameLink.progress` is carried only while the game has no result.
- League groups and the season header: the in-progress share is drawn after the finished games in a lighter colour. `LeagueGroupDetail.activeProgress` sums the active tables' fractions.

Tournament game links are cached per Tournament. A write that changes a Tournament Game's progress clears that cache (`protectChangedLists` in the game store), and nothing pushes a competition update. An open Tournament or League page shows new progress at its next refresh, which a competition notification or a reload triggers.

## Titles

- Magna Grecia: `Round n of m`, with turns within the round counted towards the fraction. `Last round` is final.
- Fresh Fish: `n tiles left`. The bag's total isn't stored, so it is rebuilt from what was drawn: markets on the board, stalls placed (less final stalls) and a drawn tile still waiting. While the last tile drawn is still being auctioned or placed, the label is `Last tile`. Placing the final stalls counts as the last steps, labelled `Final stalls` and final from the moment that placement begins.
- 18xx family (every title through `createEighteenXXRuntime`): the fraction is the current phase's place in the phase table. The label is `Phase X · Bank $N`, or just `Phase X` when the bank is unlimited (TOP, 1817). Once a game end is scheduled, the label is `Final OR set`, prefixed `Bank broken · ` when the broken bank is what scheduled it, and it is final. The hook checks and reads only `phaseId`, `cash` and `gameEnding` from the stored state. It does not hydrate, which takes milliseconds on every move. Titles declare `currencySymbol` in their rules as a printed fact of the game. `moneyFormat` in `@tabletop/18xx` turns it into text for both the progress label and the title's UI presentation.

### 18xx survey

The research trait profiles (`/workspace/research/18xx-2026-09-08/data/title-traits.json`, traits `end-triggers` and `end-timing`; `18xx-domain-model-study.md`, "Ending play and valuing the result") cover 127 title configurations:

- 87 can end on bank exhaustion and 34 on a technology or train-supply event. Only 18 have neither.
- 13 end on a fixed round limit: 1840, 18CZ, 18MS, the 18ZOO maps, 21Moon, 22Mars and Steam Over Holland. Five end on nationalization or offer and cost limits instead: 1822 Africa, the Stockholm Tramways, 18Uruguay and the two Rolling Stock titles.
- Market thresholds (55), bankruptcy (73) and company closure (9) also occur. They are unpredictable, so they are no use as a clock.
- 78 can end immediately. 80 finish the operating set and 30 play an additional set, which is why the scheduled ending is labelled `Final OR set` rather than with its reason.

Implemented titles:

| Title      | End trigger                                                        | Fraction at trigger       |
| ---------- | ------------------------------------------------------------------ | ------------------------- |
| TOP        | first D (bank unlimited)                                           | 1 (D is the last phase)   |
| 1817       | first 8-train (bank unlimited), bankruptcy                         | 1                         |
| 1830, 1889 | bank broken, bankruptcy                                            | usually 0.8–1 (phase 6/D) |
| 1832       | bank broken, $400 share price, bankruptcy                          | depends on phase          |
| 1833NE     | bank broken, all corporations closed, one player left              | depends on phase          |
| 1846       | bank broken, last phase IV train (2p), all closed, one player left | usually 0.67–1            |

Phase position is the one measure every title has, and it never goes backwards. It fits the 109 configurations whose clock is the bank or the trains. A share of the bank spent was considered for bank-break titles. It needs the bank's size after the opening, which isn't in State: players' starting cash comes from `startingCash(config)`, which the progression hook can't call. So the bank appears in the label only. A game that ends well before its last phase undershoots, and `final` covers the last stretch.

Intentional limit: the 13 fixed-round titles and the progressive nationalization endings would be better served by rounds played or companies remaining. When one of them is implemented, its `EndingRules` should supply the fraction and the family default stays phase position. 1894, implemented on an unmerged branch, gets the family default when it adopts this.

## Rollout

1. Backend: it writes `Game.progress` from titles that report it. Old Site Frontends ignore the field, since `Game`, game notifications, `TournamentGameLink` and `LeagueGroupDetail` allow unknown properties. Games played from here on have progress by the time the displays ship.
2. Site Frontend: the displays. The new fields are optional, so it also works against an older backend.
3. Titles: a logic release (minor) turns progress on. 18xx titles release their UI with it, since it reads `currencySymbol` from the title rules. In-progress games show progress after their next Action.

# Tournament results and standings

Slice 7 of [the tournament roadmap](https://github.com/justinkwaugh/tabletop/issues/57) scores normal Mini Tournament results and finalizes standings. Dropout resolution remains deferred.

## Normal completion

The authoritative Game State's existing `result` and `winningPlayerIds` remain the source of sporting results. Game metadata already mirrors those fields in the final-action transaction. There is no separate result ledger, result collection, settlement task, or second GameResult model.

The existing final-action transaction now updates the Stage's standings alongside its reserved/active/finished Table IDs. `standings` contains wins, score, and completed games in locked roster order. User IDs are not duplicated in those rows. The saved schedule initializes zero totals; the immutable roster provides their identities. A shared win or draw counts as one win for each declared winner and splits one score point equally. Win and Draw results must declare winners; an empty winner list is invalid. Arithmetic uses whole fractions based on the table size before returning numeric scores, so equal fractions produce equal totals regardless of completion order.

A Game Title may expose a `GameRuntime.scoring` capability whose `finalScores(state)` returns each Game Player's final in-game score. When a game of such a title reaches a Win or Draw, the game service records those scores as `Game.finalScores` in the same update that mirrors `result` and `winningPlayerIds`; an Undo that reopens an ordinary game clears them with the result. This applies to every hosted game, not only tournament games. The tournament finish transaction then adds `Game.finalScores` to each entrant's `tiebreak` total in the standings row. Titles without the capability record no scores and leave `tiebreak` absent; nothing is inferred from state fields. Fresh Fish declares the capability with its terminal money-based score, which may be negative. Corrections change credited winners only; they do not alter tiebreak totals.

Already-finished Table IDs prevent counting a completion twice. The Game State, Game metadata, capacity release and standings commit or roll back together. Concurrent finishes serialize on the existing Tournament document. Finishing every scheduled Table with a normal result marks the Mini Tournament `finished` and sets `finishedAt` in that same transaction. There is no additional finalization write. Abandoned or missing results do not finalize the Tournament or produce forfeits. Player Undo cannot reopen a finished Game.

The existing completion task sends the Tournament notification and starts further eligible games as needed. A paused Tournament is notified without another write; a finished Tournament claims its one-time results email (see below) and is then notified. Normal notification delivery retains the site's existing behavior; it is not the source of scoring correctness.

## Reads and presentation

The existing tournament detail API returns standings with tied ranks and completed, active and remaining games. Rank uses score, then the `tiebreak` total when the title records one; entrants equal on both share a rank. The detail page shows a Tiebreak column only when some row carries a total. `remaining` includes active games. The UI separates finished, active and waiting counts. Completed tournaments appear in the red Completed tab and remain accessible in Mine and through their existing links.

Tournament, Schedule and game-link reads use the existing Redis cache. Completed game metadata supplies public winner IDs; the detail response applies any tournament credit correction. The schedule marks credited winners, and completed tables link to View. Finished events retain their games and show the winning entrants. Each completion invalidates the Tournament, game links and affected list caches, including the old In progress list when an event finishes.

## Administrator corrections

The user confirmed that corrections change tournament credit only. They do not modify the played Game, Game State, action history or game lifecycle.

`POST /tournaments/:id/results/correct` accepts the Tournament revision, a finished Table ID, the credited winner User IDs and a reason. The existing signed-in active administrator is checked using normal API and store authorization. The transaction reads the Tournament and the original Game/State, checks the current revision and finished result, subtracts the prior contribution and adds the corrected contribution. It appends an audit entry to the Stage containing Table ID, credited winner IDs, administrator ID, reason, timestamp and the source Game action count. Corrections must name at least one credited winner. Repeated corrections retain their audit entries; stale requests cannot overwrite newer changes. The finished timestamp is preserved and tied ranks/winners are derived from corrected totals.

The detail page exposes these controls under Manage and shows the correction history. It uses the existing TabletopApi and Tournament notification path.

`POST /tournaments/:id/standings/rebuild` is an explicit administrator operation, not a scheduled repair process. It reads the canonical games for the Stage and reconstructs totals using their normal results and the latest audited corrections. It rebuilds tiebreak totals from each game's recorded `finalScores`. For a game finished before its title recorded scores, it falls back to reading that Game State inside the transaction and deriving the scores through the current title runtime, so it is the adoption path for Fresh Fish tournaments scored before the capability existed. It writes the same Tournament document. This is also the one-time adoption path for development tournaments with results recorded before this slice. It is not run on ordinary page reads or game completions.

## Results email

Every entrant with an active account and an email address receives one final results email when the tournament finishes. The completion task that follows the final Game finds the finished Tournament and claims `resultsEmailedAt` in a Tournament transaction before enqueueing one `/tasks/tournaments/resultsEmail` task per recipient on the existing `tournaments` queue. Duplicate or overlapping task deliveries see the claim and do not enqueue again. A rebuild that finalizes a Tournament sends the same emails; rebuilding or correcting an already finished Tournament does not. Tournaments that finished before this behavior existed never receive it because no completion task runs for them.

Each email task loads the tournament detail as the recipient, so it uses the same ranked standings, usernames and credited winners as the page, and renders the `TournamentResults` template with the champion or shared champions, the recipient's placement, the full standings table including any tiebreak column, and a link to the tournament page. A missing recipient or unavailable title is logged and skipped; other failures return an error so the queue retries that recipient's task. Without a configured `RESEND_API_KEY` the null email service logs instead of sending.

## Validation

Firestore/Redis integration checks cover simultaneous finishes, shared wins and draws, rejection of empty winner lists, unchanged repeated task delivery, atomic finalization, rollback, missing/abandoned results, correction authorization and stale revisions, corrections without Game changes, rebuild equivalence, old-list invalidation, capacity limits and the maximum supported roster/schedule size. A fraction test verifies that three thirds equal a solo point and reverse exactly. API checks cover the administrator endpoints. Hosted checks use separate local browser sessions for standings, corrections, real-time updates and narrow layouts.

Unit tests cover tiebreak accumulation and reversal, coverage of every player, and ordering by score before tiebreak. The provisioning integration suite finishes a seven-table tournament of a scored title with all-way draws, checks that tiebreak totals order every rank, that one results email task is enqueued per recipient with an email exactly once across duplicate deliveries, and that rebuilding reproduces the totals without re-sending, including for a game whose recorded scores were removed and must be derived from its state. Route tests cover the results email task payload, recipient lookup and queue retry behavior. Fresh Fish's competition tests check its final scores match the recorded player scores and its declared winners.

These additions use Site Frontend tournament APIs. They do not change the Game Session host bridge or require a Game UI Artifact publication to score completed games. Fresh Fish needs a republished Logic Artifact containing its scoring capability before hosted tournaments record tiebreak totals; its UI Artifact does not need to change.

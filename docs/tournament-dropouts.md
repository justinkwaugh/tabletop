# Tournament dropouts

Slice 8 of [the tournament roadmap](https://github.com/justinkwaugh/tabletop/issues/57), tracked in [#65](https://github.com/justinkwaugh/tabletop/issues/65). A player who stops playing must not leave a Tournament or League Group stuck. Terms follow `docs/contexts/competitions/CONTEXT.md`.

## Settled with the user

- Only an administrator withdraws or replaces a player. Nothing is automatic.
- Players already get turn reminders (after 1 minute, 1, 4 and 8 hours, then every 12 hours for about a week). There are no new player reminders.
- **Stall alert.** When a Tournament Game goes 2 days without a move, the bot sends every administrator a Discord DM, once for that stall. A later move and a new stall send one new alert. Administrators without a linked Discord account get nothing.
- **Substitute.** An administrator can put any active account into an Entrant's place, as long as that account is not already in the event. The Substitute plays the place's current and remaining Tables, and the place keeps its results so far. The replaced player is dropped.
    - For each Table the place is playing when the Substitute arrives, the administrator chooses to take over the Game in progress or restart that Table.
    - The place still gets a final place, so everyone else's standings and movement are unchanged.
    - In a one-off Tournament a Substitute's place cannot win: if it finishes first, the next place down wins.
    - In a League the place's own movement goes to nobody; its next-Season place becomes a Vacancy filled from below. The Substitute gets a Held Place at the Bottom Level for the next Season, whatever the place's result.
- **Withdrawal.** An administrator can withdraw an Entrant with no Substitute. Their Tables that are not finished are Void, their finished results stay, and they are not ranked. The others are ranked by points as they stand: a Void Table counts for nobody. A withdrawn League Entrant gets no movement and no Held Place.

## Implementation choices

1. **Places keep their first account.** An Entrant's `userId` stays the key of its place in the Schedule, the standings and League placements. A Substitute is recorded on the Entrant with the administrator and time; the place's current account is the last Substitute, or the Entrant's own account. Scoring finds a place by any of its accounts, so Games finished before a substitution still credit it.
2. **Void Tables.** A Table that will never count is recorded as void in the Stage's dispatch, beside reserved, active and finished. Its Game, if any, ends with an `Abandoned` result and no winners, which stops further moves and keeps its history. A Game that ends `Abandoned` through play is voided the same way, instead of holding its Table forever. A Tournament finishes when every Table is finished or void.
3. **Restarts.** Restarting a Table voids its Game and returns the Table to dispatch with a new attempt number, so the next Game for that Table has its own ID. Game links use the latest attempt.
4. **Taking over a Game.** The Substitute's account replaces the replaced player's on that seat. Seats have their own IDs in game state, so the Game itself does not change; the site updates its game lists, caches and turn reminders.
5. **Withdrawal order.** Withdrawal marks the Entrant and voids their unstarted Tables in one Tournament transaction, then voids each Game in progress in its own transaction. Repeating a withdrawal finishes any Games an interrupted one missed; the panel keeps listing a withdrawn player while a Game of theirs is still in progress. A Game that a withdrawn player finishes anyway is void, never credited. Voided Games clear their active players, and turn reminders stop for any Game no longer in play.
6. **Stall checks.** A Tournament Game has at most one pending check. Saving a move starts one unless one is pending; it fires 2 days later, reschedules itself from a newer move, and otherwise sends the alert. Before alerting it rereads the Game, so a move made as the check runs starts a fresh check instead. Each administrator is sent the alert at most once per Game and last move; a failed DM is retried for that administrator only.
7. **Substitutes in Leagues.** "Already in the event" means the Group's Tournament, so an Entrant from another Group can substitute. If they earned a Held Place of their own, they keep it instead of a second one at the Bottom Level. A Substitution hands each seat over from whichever earlier account of the place still holds it. The Season records each Group's current accounts, which the League list uses for "my place"; a substitution or withdrawal wakes the League to refresh them.
8. **Results email.** Withdrawn Entrants get no Tournament results email.

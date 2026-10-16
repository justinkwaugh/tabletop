# Leagues

Slice 12 of [the tournament roadmap](https://github.com/justinkwaugh/tabletop/issues/57), tracked in [#69](https://github.com/justinkwaugh/tabletop/issues/69). A League runs each Season as a set of Group Mini Tournaments, then moves Entrants between Levels for the next Season. Terms follow `docs/contexts/competitions/CONTEXT.md`.

## Settled with the user

- A League plays one Game Title with one frozen game configuration. The title and configuration are recorded per Season, so a League could change title between Seasons later; mixed-title Seasons are not planned.
- The reference format is 4-player Tables, Groups of 7 and 4 games per Entrant: the existing Mini Tournament preset, in which every Entrant sits in each Starting Position once and every pair meets twice.
- The League Shape is chosen per League. Pyramid is the expected default.
  - Ladder: one Group per Level; the top two are promoted and the bottom two relegated.
  - Pyramid: each Level has twice the Groups of the Level above; each Group's winner is promoted and its bottom two relegated. Two winners from B replace the two relegated from A, four winners from C replace the four relegated from B, and so on.
  - An unfilled Bottom Level promotes the top two of each Group, never more than the Level above relegates; the Level above relegates the same number, chosen by the cross-Group order. With one C under two Bs, C promotes two. With three Cs under two Bs, the Cs promote their three winners and the best runner-up.
- A Group's standard size is the Mini Tournament roster for the League's table size: 5 for 2-player games, 7 for 3- and 4-player games, 11 for 5-player games. Groups above the Bottom Level have exactly that many Entrants. Bottom Level Groups range from 2 below the standard size to that number plus the standard size minus 1 (3–7, 5–11 and 9–19), the narrowest range that places every field without leftovers. Every Entrant plays the League's games per Entrant whatever the Group's size; a larger Group only has more Tables.
- A League starts with a Seeding Season, Season 0. All Entrants play at one Level in randomly drawn Groups of about the standard size, within the Bottom Level range so nobody is left over. When it finishes, Entrants are ranked across all Groups by finishing place, then points, then Tiebreak Total, then a seeded draw, and that order fills Level A, then B, and so on, for the next Season.
- Before every Season after the Seeding Season there is a Sign-up Window. Each Entrant from the last finished Season has a Held Place at the Level their movement earned and must confirm it during the window.
- An unconfirmed Held Place becomes a Vacancy, filled by promoting the next eligible Entrant from the Level below, cascading down to the Bottom Level.
- New Entrants join during the Sign-up Window and start in the Bottom Level. When too few returning Entrants confirm to fill the Levels above, new Entrants fill those places.
- When the field grows enough to add a Level, the old Bottom Level shrinks to the standard Group size and its lowest-ranked confirmed Entrants move down into the new Level. The season start email tells them why.
- A Cutoff Tie is resolved by points, then Tiebreak Total, then head-to-head results, then a seeded draw. When comparing Entrants from different Groups, order by finishing place within the Group, then points, then Tiebreak Total, then a seeded draw.
- When a Season finishes, its movement is visible as the Projected Allocation for the next Season. The Final Allocation is fixed when the next Season starts, after confirmations, Vacancies and new Entrants.
- Groups are not fixed between Seasons. The Entrants at each Level are drawn into its Groups at random, from a recorded seed, every Season.
- Whether the next Sign-up Window opens automatically and how long it lasts are configured per League. Groups always start automatically when the Sign-up Window closes.
- A Season needs at least two full Levels of standard Groups to start: three Groups in a Pyramid (A and two Bs; 21 Entrants for Groups of 7) and two in a Ladder (14 for Groups of 7). Below that, its Sign-up Window stays open until an administrator moves the close or cancels the Season.
- An administrator can cancel a Season only during its Sign-up Window. A cancelled Season starts no Groups and moves nobody. The administrator then opens the next Season: Held Places carry over from the last finished Season, and a cancelled Seeding Season is followed by another Seeding Season.
- Each Group is a Tournament tagged with its League, Season and Group, with a roster fixed when it is created.
- Emails:
  - **Sign-up open**: when a Season with Held Places opens, to every Entrant holding a place. A Seeding Season sends none.
  - **Reminder**: two days before the Season's actual sign-up close, to Entrants who have not confirmed their Held Place. A window of two days or less has no reminder; moving the close schedules a new one.
  - **Season start**: when the Groups start, to every Entrant placed, with their Group and opponents. It says when an Entrant moved above their Held Place (or a new Entrant above the Bottom Level) to fill a Vacancy, or moved down because a Level was added.
  - **Season results**: when a Season finishes, to every Entrant placed, with their place, movement and Level for the next Season, and their Group's final table. Seasons after the Seeding Season name the League champion, the winner of Level A.
  - Season results and the next Season's sign-up open are separate emails.
  - There is no unsubscribe link yet.
- Dropouts, deadlines and stalled Tables are #65. Leagues are built first; #65 must land before any League launches, because a Season cannot finish while one Group has an abandoned Table.

## Implementation choices

These were proposed and built without objection.

1. **Head-to-head.** Among the tied Entrants only, count wins in Tables they shared.
2. **Level count.** At Final Allocation, fill Levels from the top with standard Groups. Use the fewest Levels whose remainder splits into Bottom Level Groups within its range, no more than the Shape allows at that Level. The Bottom Level gets the number of Groups closest to the remainder divided by the standard size. A growing field adds a Level; a shrinking one drops the Bottom Level.
3. **Season lifecycle defaults.** Publishing a League opens its Seeding Season with an administrator's closing date. The next Sign-up Window opens automatically when a Season finishes and lasts 7 days. An administrator can preview the Groups or move the closing date.
4. **Group registration.** Groups use an assigned Registration Policy: nobody joins or leaves, and the Group locks and schedules as soon as it is created. Concurrency defaults to games per Entrant, as for Minis.
5. **Naming.** A Ladder's Groups are A, B, C. A Pyramid's are A, then B1 and B2, then C1 to C4. Seeding Season Groups are numbered 1, 2, 3.
6. **Storage.** One League document; one Season document per Season holding sign-ups, Held Places (and the Season they came from), the Final Allocation, Group Tournament IDs and, once finished, each Entrant's place, movement and final points. Groups use the existing Tournament documents. Retried rollover is idempotent on the Season document. A finished Season's standings are frozen, so a later correction to a Group's Tournament changes neither its places, its movement nor its displayed points.
7. **Leagues for 2 to 5 players only.** Group sizes come from the Mini presets, which exist for 2 to 5 players; games for 6 or more players cannot have a League for now.
8. **Season start email for Seeding Seasons.** Entrants who signed up for a Seeding Season get the start email too.
9. **Email delivery.** Each email is one task per recipient, sent at most once: a Redis claim per League, Season, email and recipient stops repeats, and is released when a send fails so the retry can send. A batch is queued before the Season records it as sent, so an interrupted batch is retried whole. Delayed tasks are scheduled at most 28 days ahead, inside Cloud Tasks' 30-day limit; a task that fires early reschedules itself. The League's advance task resends a missed results batch for the last finished Season.
10. **Reads.** League pages read the League, Season and every Group's Tournament, schedule and game links, plus usernames, in batched cache reads: about seven Redis calls for a League page and none from Firestore when warm.

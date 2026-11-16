# Knockout tournaments

A Knockout is a Tournament Format for two-player titles. Entrants are drawn into a Bracket and play Matches; losing a Match knocks an Entrant out, until one is champion. Terms follow `docs/contexts/competitions/CONTEXT.md`.

## Settled with the user (2026-11-16)

- **Match.** Two Entrants play two Games at the same time, one from each Starting Position. Whoever wins both Games wins the Match.
- **Decider.** If the Match is split, a third Game decides it. The Decider is played with the event's **decider options** and without assigned seats, so the title's own setup decides who plays which side. For Napoleon's Triumph that is the morale auction (`sideSelection: Auction`).
- **Draws.** A shared Game counts half to each Entrant. Level after two Games means a Decider; a drawn Decider is played again.
- **Draw and Byes.** The Bracket is the next power of two at or above the field. The draw is random for now: Entrants are shuffled into seed order and placed by the standard seeding pattern, so Byes go to the first seeds and never meet. Seeding by past results can later supply that order instead of the shuffle.
- **No third-place Match.** Below the champion, Entrants rank by the round they reached. The runner-up is second, and each round's losers share the next place.
- **Concede.** Players of a Knockout Game may Concede (the Call Request of a two-player Game). Tournament Games still refuse Undo Votes.
- **Dropouts.** Withdrawing an Entrant forfeits their current Match: their unfinished Games are Void, and the opponent advances by Walkover. If both Entrants of a Match are withdrawn, nobody advances and the next opponent gets a Walkover. Knockout places take no Substitutes.

## How it is built

- `TournamentFormat` gains `{ kind: 'knockout', stages: [plan], deciderGameConfig }`. The single Stage Plan's `gamesPerEntrant` is fixed at 2, the Games of a Match before a Decider. Table size is 2, concurrency is 2 and scoring is win points (`splitWinsV1`).
- The Bracket lives in the Stage's Schedule. `TournamentSchedule.bracket.slots` holds the drawn Entrant (or `null` for a Bye) in each first-round position. Each Table carries its `match` (round, index and game number); games above 2 are Deciders.
- The Schedule grows as Matches resolve. At the roster lock it holds the first round's Tables. The dispatcher task, which every finished Game already wakes, computes the Bracket from the finished Tables (`knockoutBracket` in `libs/common/src/site/tournamentKnockout.ts`), appends the Tables that are now due and reserves them as before. A later Match starts as soon as both Matches feeding it are decided, without waiting for the rest of its round. Appending is idempotent: Tables are keyed by their match and game, and the write checks the Schedule's length.
- The dispatcher also finishes the Tournament once the final is decided. Standings rank by the Bracket, not by points. The stored points still count Games won.
- A Decider Table's Game takes `deciderGameConfig` and is started without starting positions. Every Knockout Game is created with `Game.concedable`, which lets its players Concede.
- Result correction and Rebuild standings stay Mini-only: a corrected result could change who should have played a later Match.
- A Table voided without a withdrawal (an abandoned Game) is played again under the same Match and Game. A player withdrawn after dispatch read the Bracket gets no new Table: `extendSchedule` leaves out Tables for withdrawn Entrants.
- A finished Table whose result dispatch cannot read yet fails the task with `TournamentResultsPendingError`, which is retried without recording a scheduling error.

## Showing large fields

Above 16 Entrants the tournament page shows the Bracket a round at a time: tabs open on the current round, each Match is one row, and the whole Bracket (with slimmer cards) is the last tab. The viewer's own Match is pinned above, with links to its Games. The Players list shows each Entrant's status (In the semi-finals, Out in round 2, Runner-up, Champion) and folds away the Entrants knocked out, keeping the top four.

## Options the seat decides

A game option can declare `seatedValue`, the text shown in its place at a Table with assigned seats, where the seat decides it. Napoleon's Triumph's Sides declares "By seat": its initializer gives the first seat the Allies whenever starting positions are assigned. The tournament and league forms show such an option as fixed, and the tournament page shows `seatedValue` for the main game options. A Knockout's Decider options keep the real choice, since a Decider's seats are not assigned. This applies to every Tournament and League, not only Knockouts.

## Compatibility

- `TournamentFormat`, `TournamentSchedule` and `TournamentTable` gain optional members. A backend or Site Frontend built before this change rejects a Knockout Tournament, so release the Site Frontend first, then the backend, and create Knockout events only after both are out.
- `Game.concedable` is a top-level Game field. The Game schema accepts unknown top-level fields, so UI Artifacts already published load Knockout Games unchanged. No title needs republishing. The Concede entry is host chrome in the Site Frontend.
- Knockouts need no Napoleon's Triumph change: started without starting positions, its initializer already opens with the side selection in the Game's options.
- "By seat" does need a Napoleon's Triumph Publication. `seatedValue` is an optional field on the title's config options, which the Site Frontend reads from the title's published definition, so the site shows the old option until Napoleon's Triumph is republished. An older Site Frontend ignores the field. Game cards still show the configured Sides, since a Game does not record whether its seats were assigned.

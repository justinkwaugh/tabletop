# Competitions

Competitions governs site-organized asynchronous Tournaments and Leagues. It owns participation across Game Instances, scheduled Tables, standings, and progression between Stages or Seasons.

## Tournaments

**Tournament**:
A site-organized competition in one Game Title whose Entrants accumulate results across scheduled Tables. A Tournament contains one or more Stages.

**Mini Tournament**:
A Tournament with one Stage in which Entrants accumulate points across several Tables to determine final standings.

**Tournament Format**:
The structure of one Tournament, such as Mini or Multi-stage. A League contains Tournaments through its Seasons and Groups rather than being a Tournament Format.

**Stage Plan**:
The declared sequence of Stages and participation commitment for a Tournament. A planned Stage exists before its play begins; the number of planned Stages is determined by this plan.

**Stage**:
A portion of a Tournament with a defined field of Entrants and a set of Tables whose results determine standings and any advancement. Tables within a Stage may start and finish at different times.
_Avoid_: Round when referring to a synchronized batch of Game Instances

**Entrant**:
A User Account registered in a Tournament. An Entrant occupies distinct Player positions in the Game Instances assigned to them.
_Avoid_: Player when referring to participation in the Tournament as a whole

**Roster Lock**:
The point after which an event's registration closes and its Entrants are fixed for scheduling. Joining an open event does not permit entering one whose roster has already locked.

**Registration Policy**:
The published conditions for closing registration. A fill-based Tournament starts a one-minute withdrawal window when its fixed roster fills, with no required registration deadline. Entrants may leave during that window; a vacancy cancels the pending start, and filling it starts a fresh window. If the roster remains full, it locks and proceeds automatically to scheduling and play. A dated Tournament closes at its deadline with its actual roster, subject to a minimum and an optional maximum; falling below its minimum cancels the event before play.

## Tables and participation

**Schedule**:
The fixed set of Tables and Starting Position assignments for a Stage's locked roster. It defines who plays together; actual start times depend on each Entrant's available concurrency.

**Table**:
One scheduled contest among assigned Entrants, with a Game Instance created when the Table starts. A Table exists as an assignment before its Game Instance exists.

**Starting Position**:
A Game Title-defined position occupied by an Entrant at Game Initialization. It is distinct from turn order changes produced by play.

**Concurrency Limit**:
The maximum number of active Tables an Entrant may occupy within an event at once. It is separate from the total number of Tables assigned to the Entrant.

**Tiebreak Total**:
The sum of an Entrant's final in-game scores across their completed Tables, supplied by the Game Title's scoring capability. It orders Entrants whose tournament scores are equal; it never outranks tournament score.
_Avoid_: Game Score when referring to the tournament tiebreak rather than one Game's result

**Final Table Result**:
The accepted outcome of a completed Table, final immediately when its Hosted Game finishes. Players cannot reopen that Game Instance through Undo; an Administrator may make an explicitly attributed correction.

## Leagues

**League**:
A recurring competition in one Game Title in which Entrants compete in Groups over successive Seasons, with promotion and relegation between Levels.

**Season**:
One cycle of League competition ending in Group standings and the determination of promotion and relegation for the next cycle.

**Level**:
A rank within a League, labelled A, B, C and so on, with A the highest. Every Group belongs to one Level.
_Avoid_: Division, Tier

**Group**:
A field of Entrants at one Level competing together in a Mini Tournament within a League Season. The Group associates that Tournament with its League and Season. Groups are drawn afresh at random within each Level every Season.

**League Shape**:
How a League's Groups are arranged across Levels: a Ladder or a Pyramid, chosen per League.

**Ladder**:
A League Shape with one Group per Level. The top two of each Group are promoted and the bottom two relegated.

**Pyramid**:
A League Shape in which each Level holds twice as many Groups as the Level above. The winner of each Group is promoted and the bottom two are relegated; a Bottom Level with fewer Groups than that promotes the top two of each Group, never more than the Level above relegates.

**Bottom Level**:
The lowest Level of a League, where new Entrants start unless Vacancies above are left with no returning Entrant to fill them. Its Groups are the only ones whose size may differ from the standard Group size.

**Seeding Season**:
A Season in which all Entrants play at one Level in randomly drawn Groups; its results, ranked across Groups, set each Entrant's Level for the next Season. A League's first Season is a Seeding Season, and so is the Season that replaces a cancelled Seeding Season.
_Avoid_: Initial Seeding, random placement

**Sign-up Window**:
The period before a Season starts in which returning Entrants confirm their Held Places and new Entrants join.

**Held Place**:
A place in the next Season reserved for an Entrant from the last finished Season at the Level their movement earned. It is kept only if the Entrant confirms it during the Sign-up Window.
_Avoid_: Automatic entry

**Vacancy**:
A Held Place left unconfirmed when the Sign-up Window closes. It is filled by promoting the next eligible Entrant from the Level below, and so on down to the Bottom Level.

**Cutoff Tie**:
Equal standing between Entrants on either side of a promotion or relegation line. It is resolved by points, then Tiebreak Total, then head-to-head results, then a seeded draw.

**Projected Allocation**:
The Levels for the next Season implied by a finished Season's movement, before Held Places are confirmed. Groups are drawn only at the Final Allocation.

**Final Allocation**:
The Levels and Groups fixed when a Season starts, after Vacancies are filled and new Entrants are placed.
_Avoid_: Projected Allocation once the Season has started

**Cancelled Season**:
A Season an administrator ended during its Sign-up Window. It starts no Groups and moves nobody; the next Season holds the same places it would have.

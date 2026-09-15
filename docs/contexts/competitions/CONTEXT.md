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

**Final Table Result**:
The accepted outcome of a completed Table, final immediately when its Hosted Game finishes. Players cannot reopen that Game Instance through Undo; an Administrator may make an explicitly attributed correction.

## Leagues

**League**:
A recurring competition in which Entrants compete in Groups over successive Seasons, with promotion and relegation between levels.

**Season**:
One cycle of League competition ending in Group standings and the determination of promotion and relegation for the next cycle.

**Group**:
A field of Entrants at a division level competing together in a Mini Tournament within a League Season. The Group associates that Tournament with its League and Season.

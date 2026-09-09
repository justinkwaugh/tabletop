# Competitions

Competitions governs site-organized asynchronous Tournaments and Leagues. It owns participation across Game Instances, scheduled Tables, standings, and progression between Stages or Seasons.

## Tournaments

**Tournament**:
A site-organized competition in one Game Title whose Entrants accumulate results across scheduled Tables. A Tournament contains one or more Stages.

**Mini Tournament**:
A Tournament with one Stage in which Entrants accumulate points across several Tables to determine final standings.

**Stage**:
A portion of a Tournament with a defined field of Entrants and a set of Tables whose results determine standings and any advancement. Tables within a Stage may start and finish at different times.
_Avoid_: Round when referring to a synchronized batch of Game Instances

**Entrant**:
A User Account registered in a Tournament. An Entrant occupies distinct Player positions in the Game Instances assigned to them.
_Avoid_: Player when referring to participation in the Tournament as a whole

**Roster Lock**:
The point after which an event's registration closes and its Entrants are fixed for scheduling. Joining an open event does not permit entering one whose roster has already locked.

## Tables and participation

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
A field of Entrants competing together in a Mini Tournament within a League Season.

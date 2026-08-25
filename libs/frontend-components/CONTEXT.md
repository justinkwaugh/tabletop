# Game Client

The Game Client maintains a responsive client-side interaction with one Game Instance. It uses Game Runtime to manage Game Contexts, present Game State, construct and apply Actions, navigate history, explore alternatives, and reconcile Hosted Games.

## Session and contexts

**Game Session**:
One Game Client interaction with one Game Instance. Moving between Primary and Exploration contexts or between Live and History views does not create a new Game Session.
_Avoid_: Session

**Game Context**:
A coherent client-side representation of a Game Instance containing its current Game State and ordered Processed Actions.
_Avoid_: Game Timeline, Game Projection

**Primary Game Context**:
The Game Context representing the actual Local or Hosted Game Instance.

**Exploration Game Context**:
A mutable private branch derived from another Game Context for trying alternate Actions without changing its source.

**Active Game Context**:
The Primary or Exploration Game Context on which the Game Session is currently focused.

**Modifiable Game Context**:
The Active Game Context when it is eligible to receive new Actions. No Game Context is modifiable during History View.

**Displayed Game State**:
The Game State currently published to game UI components. During transition presentation, it remains at the prior state until the resulting state is ready to be displayed.

## Views and history

**Live View**:
The view that presents the Active Game Context’s latest published Game State and permits Actions when that context is modifiable.

**History View**:
A stable, read-only view of the Active Game Context at another point in its Processed Action history. Entering History View does not replace the Active Game Context.

**History Navigation**:
Moving History View backward through Action Reversal or forward through Action replay without changing the underlying Game Context.

**History Step**:
One backward or forward movement across a User Action and its generated System Action cascade. The underlying history continues to record every Processed Action individually.

## Play arrangements

**Hotseat Play**:
Play in which one Game Client permits a person to act for multiple Players. Hotseat Play is currently supported for Local Games.

**Networked Play**:
Play in which participating Users act through separate Game Clients for their associated Players. Networked Play is currently supported for Hosted Games.

**Acting Player**:
The Player whose identity the Game Client uses when constructing the next User Action. When multiple Players are active in Hotseat Play or Exploration, the person using the client chooses the Acting Player.
_Avoid_: My Player

## Client action handling

**Optimistic Application**:
Advancing a Primary Game Context with a locally processed User Action before host acceptance. Information-Revealing Actions are not applied optimistically.

**Reconciliation**:
Aligning a Primary Game Context with a host’s canonical accepted Action history after optimistic application or realtime updates.

**Undo Candidate**:
The User Action currently offered by the Game Client for Undo under its local understanding of identity, Action origin, simultaneous grouping, and information barriers. For a Hosted Game, the candidate remains subject to host authorization.

## Action drafting

**Action Draft**:
Temporary Game Client state used to construct an Unprocessed Action. An Action Draft is not itself an Action.

**Draft Stage**:
One ordered part of an Action Draft.

**Draft Entry**:
The current value of one Draft Stage.

**Manual Draft Entry**:
A Draft Entry created through explicit user input.

**Auto Draft Entry**:
A transient Draft Entry supplied by the Game Client without explicit user input. It does not consume Back or Undo.

**Back**:
Removal of the latest Manual Draft Entry and any downstream Draft Entries that depend on it. Back changes an Action Draft; Undo changes Processed Action history.

## Exploration

**Exploration**:
A private, Local, Hotseat branch opened within a Game Session for trying alternate Actions. It may begin from Live or History View and starts as a Transient Game Instance.
_Avoid_: Fork

**Saved Exploration**:
An Exploration persisted as a separate Local Game Instance linked to its source. Saving it does not change the source Game Context.

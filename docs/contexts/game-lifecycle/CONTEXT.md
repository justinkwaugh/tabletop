# Game Lifecycle

Game Lifecycle governs a Game Instance from creation through participation, play, completion, Fork, and deletion. It owns canonical Action history and distinguishes Local authority from Hosted authority.

## Game instances

**Game Instance**:
One configured play of exactly one Game Title. Its association with that Game Title never changes.
_Avoid_: Game

**Local Game**:
A Game Instance for which the Game Client owns the Canonical Action History.
_Avoid_: Offline Game

**Hosted Game**:
A Game Instance for which a host owns the Canonical Action History and authorizes lifecycle operations.
_Avoid_: Remote Game

**Transient Game Instance**:
A Game Instance that exists only for the current Game Session unless saved.

**Saved Game Instance**:
A Game Instance that persists beyond the current Game Session.

**Game Owner**:
The User responsible for managing a Game Instance. A Game Owner need not be a Player and receives no special authority over play history.

**Game Configuration**:
The pre-play choices that determine how a Game Instance is set up. Configuration is validated against its Game Title, may change while Recruiting or Ready, and is frozen once play begins.

## Participation

**Player**:
A participant position within one Game Instance. A Player may be associated with a User, but Player and User are distinct concepts.

**Open Player**:
A Player not associated with a User and available to claim.

**Reserved Player**:
A Player offered to a specific User who has not accepted.

**Joined Player**:
A Player accepted by its associated User.

**Declined Player**:
A Reserved Player whose associated User declined. In a Public Game the position returns to Open; in an Invite-Only Game the declined association remains until the Owner changes it.

**Public Game**:
A discoverable Game Instance with Open Players that eligible Users may claim.

**Invite-Only Game**:
A Game Instance absent from public discovery, with Players offered to specific Users. Invite-only governs discovery and participation, not confidentiality.
_Avoid_: Private Game

**Game Invitation**:
An offer to a User to occupy a Reserved Player position.

**Invitation Credential**:
A temporary credential proving that its recipient may inspect and accept a Game Invitation. Its expiration does not release the Reserved Player.

## Lifecycle

**Recruiting**:
The pre-play state in which at least one configured Player is not Joined.

**Ready**:
The pre-play state in which every configured Player is Joined. Readiness is derived from Player participation.

**In Progress**:
The lifecycle state of a Game Instance after it starts and before its Game State contains a result.

**Finished**:
The lifecycle state derived from a Game State containing a result. Authorized Undo may return a Finished Game to In Progress.

**Delete Game**:
Permanently remove a Game Instance, its Game State, and its Canonical Action History.
_Avoid_: Archive, soft delete

## Action history and synchronization

**Canonical Action History**:
The authoritative ordered Processed Actions for a Game Instance. The Game Client owns it for a Local Game; the host owns it for a Hosted Game.

**Action History Checksum**:
A synchronization fingerprint calculated from the identities and positions of ordered Processed Actions. It verifies Canonical Action History alignment rather than directly verifying Game State.
_Avoid_: Timeline Checksum, State Checksum

**Synchronized Game Context**:
A Primary Game Context whose Canonical Action History agrees with the host.

**Out-of-Sync Game Context**:
A Primary Game Context whose Action history requires repair before it agrees with the host.

## Undo and derivation

**Undo Request**:
A request to remove an eligible User Action and its resulting Action-history suffix from a Game Instance.

**Authorized Undo**:
An approved Undo that reverses the affected Processed Actions, reapplies eligible Actions from the same Simultaneous Action Group, and establishes a new Canonical Action History.

A Game Owner has no elevated Undo authority. An administrator may bypass Player ownership and information-revelation restrictions, but still targets a User Action.

**Fork**:
A new Game Instance derived from a selected position in another Game Instance’s Canonical Action History. It has its own identity, Owner, history, and lifecycle while retaining the source Game Title and Game Configuration.
_Avoid_: Exploration

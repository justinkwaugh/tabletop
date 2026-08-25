# Game Conversations

Game Conversations owns the public Message history and per-Account Read Positions associated with Hosted, networked Game Instances. Notification Delivery transports updates, while Game Client owns composition and presentation.

## Conversation

**Game Conversation**:
The Conversation associated one-to-one with a Hosted Game Instance. Local Hotseat Games have no Game Conversation.
_Avoid_: Chat, generic Conversation

**Conversation Audience**:
Every Active User Account permitted to access the associated Game, including direct-link viewers of Invite-Only Games. Audience membership does not make the Conversation anonymously readable or independently discoverable.

**Conversation Message**:
An immutable, nonempty content item appended to a Game Conversation. It has a client-assigned unique ID, a server-assigned accepted timestamp, and at most 500 user-perceived Unicode characters.
_Avoid_: Chat message

**Player Message**:
A Conversation Message sent by a Joined Player while the Game is In Progress or Finished. The Player is its visible author, while the submitting User Account is retained as private audit attribution.

**Administrative Message**:
A Conversation Message sent by an Administrator in Admin Mode for explicit moderation. The Administrator is visibly attributed and cannot impersonate a Player or owner.

**Conversation History**:
The canonical Message collection ordered by accepted timestamp, with persisted append order breaking ties. It remains readable after the Game finishes, is removed with permanent Game deletion, and is not copied into a Fork.

**Conversation Full**:
The condition in which Conversation History contains 2,000 Messages and accepts no further Messages. Existing history remains readable.

**Message Redaction**:
An auditable administrative replacement of visible Message content that preserves Message identity, author, timestamp, and position. Authors cannot edit or delete sent Messages.

## Reading

**Read Position**:
The furthest canonical Message read by one User Account in one Game Conversation, anchored by that Message’s ID. It advances only forward through existing Conversation History and is shared across the Account’s devices.
_Avoid_: Bookmark, read timestamp

**Unread Message**:
A Conversation Message occurring after a User Account’s Read Position. Game Client may derive counts and indicators without storing a separate unread counter.

## Consistency

**Conversation Revision**:
An opaque value identifying the canonical content of a Game Conversation. It changes after append or redaction and allows clients to detect when reconciliation is required.
_Avoid_: Checksum

**Conversation Reconciliation**:
Replacement or completion of client Conversation state from canonical Conversation History after initial load, reconnect, delivery discontinuity, or Conversation Revision mismatch.

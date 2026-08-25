# Context Map

Implementation contradictions, defects, deferred decisions, and disproved concerns are tracked separately in the [Domain Reconciliation Record](./docs/domain-reconciliation.md).

## Confirmed contexts

- [Game Runtime](./libs/common/CONTEXT.md): initializes and deterministically executes the finite state machine representing a Game Title’s rules
- [Game Client](./libs/frontend-components/CONTEXT.md): maintains responsive client interaction, Game Contexts, Action drafting, history, exploration, presentation, and reconciliation
- [Game Lifecycle](./docs/contexts/game-lifecycle/CONTEXT.md): governs Game Instances, participation, lifecycle, canonical Action history, synchronization, Fork, Undo, and deletion
- [Identity and Access](./docs/contexts/identity-and-access/CONTEXT.md): governs User Accounts, authentication methods, sessions, Account status, and administrative role assignment
- [Game Conversations](./docs/contexts/game-conversations/CONTEXT.md): governs public per-Game Message history, authorship, Read Positions, moderation, and reconciliation
- [Notification Delivery](./docs/contexts/notification-delivery/CONTEXT.md): governs ephemeral Realtime Updates, Attention Notices, Audiences, Topics, authorization, and best-effort transport
- [Game Distribution](./docs/contexts/game-distribution/CONTEXT.md): governs Game Title discovery, versioned Logic and UI Artifacts, Publication, configuration capability, and compatibility

## Deferred contexts

- **Individual Game Titles**: title-specific contexts are deferred

## Relationships

- **Game Distribution → Game Lifecycle**: supplies the Game Title and runtime associated with a Game Instance
- **Game Distribution → Game Runtime**: supplies the versioned Game Runtime for a Game Title
- **Game Distribution → Game Client**: supplies the title-specific client module
- **Game Distribution → Notification Delivery**: supplies Game Title presentation metadata used to render Attention Notices
- **Game Lifecycle → Game Runtime**: initializes Game State, executes accepted Actions, and performs Action Reversal
- **Game Client → Game Runtime**: executes Actions, reproduces System Action cascades, and performs Action Reversal
- **Game Lifecycle → Game Client**: supplies canonical Hosted Game Actions, synchronization, and authoritative Undo decisions
- **Identity and Access → Game Lifecycle**: supplies Users and administrative authority for ownership and participation
- **Identity and Access → Game Client**: associates the current User with an Acting Player
- **Identity and Access → Game Distribution**: assigns Beta Catalog Visibility Grants used for catalog discovery
- **Identity and Access → Notification Delivery**: supplies Active Account identity and status for User and Global Audience authorization
- **Game Lifecycle → Notification Delivery**: supplies Game Instance Audience eligibility and requests Realtime Updates and Attention Notices
- **Game Conversations → Game Client**: supplies public Game Conversation history, Read Positions, and revisions that the Game Client presents
- **Game Lifecycle → Game Conversations**: supplies Hosted Game lifecycle, visibility, ownership, and Player facts
- **Game Conversations → Notification Delivery**: requests best-effort transport of Conversation Message Realtime Updates
- **Notification Delivery → Game Client**: delivers Realtime Updates, Attention Notices, and Discontinuities consumed for presentation and reconciliation

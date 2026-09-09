# Tournament game provisioning

Slice 5 of [the tournament roadmap](https://github.com/justinkwaugh/tabletop/issues/57) creates one started Hosted Game from a saved Table assignment. The trusted backend operation is `TournamentService.provisionTable({ tournamentId, stageId, tableId })`. It reads the cached Tournament and Schedule and calls the existing Game Service. There is no public provisioning endpoint or manual Start prerequisite. Slice 6 supplies scheduled execution, concurrency reservations, the one-minute withdrawal window, automatic schedule publication and queue-owned retries.

## Identity and initialization

An optional `Game.tournament` records `tournamentId`, `stageId`, `tableId` and `scheduleId`. The Game ID is derived from the Tournament/Stage/Table identities. Its ordinary `players` array maps assigned Entrant User IDs to Game Player IDs in Starting Position order; there is no additional identity map or association document. Saved schedules remain immutable and retain their packed assignment representation.

The Tournament organizer remains the Game Owner for attribution. Execution authority comes from the trusted backend call, not impersonation of an organizer or a synthetic User Account. The organizer need not play or remain active. Each assigned account must still be active at creation. Tournament enrollment supplies participation consent, so assigned Players are Joined immediately and receive normal game notifications without invitations.

Provisioning uses the current title definition, its existing Game Initializer, frozen game configuration and `GameEngine.startGame` with the assigned Player IDs. The initializer must declare support for assigned positions. Titles that are unavailable or lack that capability fail before persistence; the same Table can be retried when support returns. Games continue to follow the current Publication; no runtime version is pinned.

For runtimes using private randomness, the existing master seed generates the public seed and initializes canonical state. The master seed stays in the existing private initialization document. The Game receives the same protected-information marker and player/spectator projections as ordinary initialization. Notifications omit canonical State.

## Atomic creation and retry

The existing `FirestoreGameStore.createGame` transaction checks the canonical Tournament, committed Schedule, assignments and active entrant accounts. It creates Game metadata, the initial State and optional private seed together. Creating the first Game also changes the Tournament from `locked` to `inProgress` in that transaction. A cancellation racing creation can win only before that transition.

There is no separately persisted unstarted lobby to recover. A failure at any write commits nothing. If the transaction commits but acknowledgement is lost, the deterministic Game ID recovers the existing Game without reinitializing it. Concurrent calls cannot create another instance or replace the winning State. Recovery checks the association before returning an existing Game and does not require the title to remain available merely to find it.

Game creation protects the existing Game cache keys and the Tournament object/list keys through the shared Redis write guard. TournamentStore and GameStore share the same key builder. Warm unchanged Tournament, Schedule and Game lookups do not read Firestore. Canonical transaction reads remain necessary to prevent stale cached data authorizing creation.

For a new Table with `p` Players, creation uses `p + 3` transactional reads: Game existence, Tournament, Schedule and the `p` accounts. It writes two Game documents, an optional private-seed document, and the Tournament to activate each reserved Table. This excludes transaction retries, initial service cache misses, the end-of-task Tournament cache refill, and ordinary notification storage. The last reserved Table also clears pending dispatch and its error in the same transaction. Automatic startup uses one schedule transaction plus one transaction per Game, with no final cleanup write. No per-Table document or schedule rewrite is added. An acknowledged retry served from cache does no Game writes or reinitialization. The dispatcher sends one Tournament revision notification per task. [Slice 6](tournament-dispatch.md) persists dispatch work intent and capacity alongside Games; notification delivery retains the site's existing best-effort behavior.

## Managed lifecycle

Public Game creation/update cannot supply tournament membership. Managed Games reject ordinary seat changes, invitations, joining, declining, editing, deletion, manual start and administrator State replacement. Store-level guards recheck canonical membership for mutating transactions. Ownership or an Admin role does not bypass these restrictions.

Normal actions and Undo during play use existing game behavior. Once a tournament Game is Finished, ordinary Undo is rejected both by Game Service and by the persistence transaction, including administrator Undo. Audited tournament correction remains later recovery work under ADR-0005. This slice does not settle results or create a second result model.

An ordinary fork clears tournament membership before persistence. Forks do not become scheduled Tables or contribute event results. Existing authorization and protected-information restrictions on forking still apply.

The ordinary Game Card displays a Tournament link and hides managed lifecycle controls while retaining Play, Watch and Revisit. In-progress Tournament details show the schedule first, with its summary in a compact footer and a divider before the roster and configuration. The schedule marks the current entrant’s assignments with a darker neutral background, an orange edge and their name in orange. Started Game rows link to Play for participants or View for spectators, with an action overlaid on the right on hover. The Table column stays pinned during horizontal scrolling. Tournament details include optional `games` links containing only Game, Stage and Table IDs. These come from one tournament-wide Firestore query on a cache miss; the shared Redis cache serves unchanged reads, including empty results, and provisioning invalidates the list. No per-Table lookups or new documents are introduced. Realtime Tournament updates reload the links. Unstarted assignments have no link. The roster uses a Name/Wins/Score table; Wins and Score remain unavailable until the standings slice supplies authoritative totals. Table progress and standings remain later slices.

## Artifact compatibility

`Game.tournament` is additive metadata. Existing Game State, Action, API result envelopes and host-bridge members are unchanged. Previously published Game UIs can continue processing the same assigned states and actions; backend guards enforce tournament restrictions even when older controls remain visible.

The common fork helper now removes tournament membership. Every title needs a new UI Artifact to adopt that behavior for locally created exploration forks; publishing only the Site Frontend does not update the helper bundled into an older Game UI. Server-side forks already clear the association regardless of client version. No Logic Artifact republication is required solely for this metadata/fork change. Titles adopting the assigned-position initializer changes still need the matching Logic/UI Publications described in [game capabilities](tournament-game-capabilities.md). No production artifacts were published during verification.

## Verification

From `libs/backend-services`, using local Firestore and Redis:

```sh
CACHE_TEST_REDIS_HOST=cache FIRESTORE_EMULATOR_HOST=firebase:8080 pnpm exec vitest run src/competitions/tournamentProvisioning.integration.spec.ts src/competitions/tournamentService.integration.spec.ts src/persistence/firestore/tournamentCache.spec.ts src/persistence/firestore/gameCache.spec.ts
```

Nine provisioning integration cases cover assigned startup, private initialization/projection, duplicate task executions, atomic rollback, lost acknowledgement, stale configuration, cancellation, inactive entrants, an inactive organizer, unavailable titles, cancellation/create races, lifecycle guards, fork isolation and final Undo. The combined provisioning/registration/cache run passes 64 tests. Existing ordinary membership, fork and seeding suites also pass. Common, backend-services, backend and frontend-components builds pass; frontend checking reports zero errors and two pre-existing game-page warnings.

The local hosted runner rebuilt/staged Sol Logic 5.8.0 and UI 6.3.0 against the local manifest. A seven-entrant tournament was created and joined through authenticated APIs, its schedule saved, and one assigned Table provisioned through the trusted internal operation. Separate player and spectator browsers render the hosted Game; retry recovers its ID, the Tournament changes through realtime notification, the spectator response excludes the private seed, and public metadata-forgery/roster/edit/delete attempts are rejected. The local development server needed a clean restart after a shared-library rebuild: stale HMR imports had created two session-context identities. No context code was changed. A real ChooseMove action and Undo were then accepted through the hosted UI, persisted, and verified again after refresh.

Follow-up verification covers spectator game links, cached empty/nonempty link lists and creation invalidation. The provisioning suite now has 10 passing tests; the 20 registration tests also pass. Site checking reports zero errors and the same two existing game-page warnings.

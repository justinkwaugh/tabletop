# Tournament registration

Slice 2 of [the tournament roadmap](https://github.com/justinkwaugh/tabletop/issues/57) supports administrator-created Mini Tournaments and registration. Locked events contain one Stage awaiting scheduling. No Game Instances are created by registration.

## Model and behavior

`libs/common/src/site/tournament.ts` owns the shared schemas. A Tournament contains its format and planned stages, immutable published game configuration, registration policy, concurrency limit, lifecycle revision, and roster count. The number of planned stages comes from the plan. Mini Tournaments have one stage; multi-stage creation is rejected until progression exists. League Seasons and Groups will associate Tournaments in the later league slice.

Registration has two modes:

- `whenFull`: a required capacity, without a deadline. The final join locks the roster in the same transaction.
- `deadline`: a required closing timestamp and minimum entrants, with optional capacity. Reaching capacity prevents additional joins but does not close early. At the deadline the actual roster locks if the minimum is met; otherwise the event cancels. Uncapped events currently share the implementation limit of 256 entrants.

Active Users may join and leave before lock. There is no separate rules-acceptance step. The event detail displays game options, including explicit default values, before and after enrollment. Publishing freezes configuration and format; material changes require a replacement event. Draft edits use optimistic revisions. Repeated joins, leaves, publication, and closure are idempotent. A retried creation ID may only refer to the same organizer and settings.

A Firestore transaction serializes membership, count, lifecycle and initial Stage creation. It checks the current stored Account status and Admin role for writes. Documents live at `tournaments/{id}`, with `entrants` and `stages` subcollections and per-User `tournamentEntries` references containing `tournamentId` and `titleId` for game-filtered personal lists. Leaving removes the entrant and membership reference. Cancellation retains the event and its roster for history; it does not delete Accounts or Game Instances. Inactivity after lock remains deferred to slice 9.

## API and UI

All event API paths are beneath `/api/v1/tournaments`; reads require an Active User and return `Cache-Control: no-store`.

| Method | Path           | Operation                                                                                                                                |
| ------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/`            | Page 25 events with `scope=mine`, `open`, `inProgress`, or administrator-only `draft`; optional `titleId` game filter and `after` cursor |
| POST   | `/`            | Create an administrator draft using `{id, draft}`                                                                                        |
| GET    | `/:id`         | Event, public entrant names and first Stage; unpublished drafts are administrator-only                                                   |
| PUT    | `/:id`         | Update an administrator draft using `{draft, revision}`                                                                                  |
| POST   | `/:id/publish` | Open registration                                                                                                                        |
| POST   | `/:id/cancel`  | Cancel the event                                                                                                                         |
| POST   | `/:id/lock`    | Reconcile closure only when its published condition is satisfied                                                                         |
| POST   | `/:id/join`    | Enroll the authenticated User; empty object body                                                                                         |
| POST   | `/:id/leave`   | Leave before lock                                                                                                                        |

Administrative writes use the existing signed-in Active Administrator account. There is no separate administrator login, mode activation or recent-authentication requirement for tournaments. The tournament API is site-owned and does not extend the Game UI host bridge or `TabletopApi` contract. The shared default-configuration helper preserves the existing Game editor behavior; no UI Artifact republication is required to adopt tournament registration.

The website provides `/tournaments`, `/tournaments/new`, and `/tournaments/:id`. The list uses Mine, Open, In progress, and administrator-only Drafts tabs, with cursor pagination. Its compact header sits immediately below site navigation. There is no Refresh button or polling timer.

Committed mutations dispatch Tournament Realtime Updates through the existing Notification Service, using Global delivery for published events and User delivery to Active Administrators for unpublished drafts. No draft payload is broadcast globally. Both list and detail screens reconcile their canonical reads when relevant updates arrive and when their realtime connection reports a discontinuity. Concurrent notifications are coalesced; listeners are removed when the screen closes. Notifications remain best-effort under the existing delivery contract.

The In progress tab includes `locked` events awaiting scheduling and the explicit `inProgress` lifecycle state. Their status labels distinguish locked rosters from running events. Registration closure still produces `locked`, awaiting scheduling. The dispatcher slice will transition events into play; this registration slice does not launch games or provide game-spectating controls. Running events cannot use the pre-play cancellation operation.

## Deadline reconciliation and deployment

Local development reconciles expired events on startup and every thirty seconds. Event detail reads, list reads, joins and leaves also reconcile relevant deadlines; production must have a periodic job so closure does not depend on visits. Full-roster closure is immediate in every environment.

Before deploying this slice:

1. Deploy `firebase/firestore.indexes.json` to the target project and wait for its closure (`status` / `rules.registration.closesAt`) and game-filter (`status` / `rules.titleId`) composite indexes to become ready.
2. Configure `TOURNAMENT_SCHEDULER_EMAIL` as the dedicated scheduler service account email and `TOURNAMENT_SCHEDULER_AUDIENCE` as the exact OIDC audience chosen for the task service.
3. Configure Cloud Scheduler to POST `/tasks/tournaments/reconcile` on the task service every minute, using an OIDC token for that service account and the matching audience. Grant only the invocation permission required by that deployment. The task service hosts this endpoint; the public backend deployment does not host task routes.
4. Verify an expired open event locks or cancels without a page visit. Verify missing or incorrect OIDC identities cannot invoke the endpoint.

The endpoint processes up to 100 due events per invocation, is safe to retry, and leaves remaining events for subsequent invocations. Monitor errors and overdue open events. Production scheduler configuration and deployment are separate from local verification; neither is performed by this slice's development checks.

## Verification

Run persistence tests against an explicitly configured Firestore emulator:

```sh
FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm exec vitest run --project @tabletop/backend-services libs/backend-services/src/competitions/tournamentService.integration.spec.ts
```

Backend tests cover administrator-role authorization through the existing session and HTTP status preservation. Frontend tests cover readable configured options, retained defaults, realtime updates, reconnect reconciliation, event filtering and listener cleanup. Hosted checks verify publication, enrollment and cancellation across separate sessions, plus draft privacy, tab keyboard navigation and mobile layout. Use `tools/scripts/local-hosted-game.mjs sol` for hosted verification with separate administrator and player browsers: create, publish, inspect options, join, leave, fill the roster, refresh, then restart the backend and verify the persisted roster and Stage.

## Mini tournament defaults

Selecting a game or changing Players per game applies these editable defaults:

| Players per game | Roster size | Games per player | Meetings per opponent | Games in each starting position |
| ---------------- | ----------- | ---------------- | --------------------- | ------------------------------- |
| 2                | 5           | 4                | 1                     | 2                               |
| 3                | 7           | 3                | 1                     | 1                               |
| 4                | 7           | 4                | 2                     | 1                               |
| 5                | 11          | 5                | 2                     | 1                               |

The roster size also supplies the initial minimum for deadline registration. Opening an existing draft preserves its saved settings. Administrators can override the defaults; these presets do not restrict valid roster sizes or implement scheduling, which remains a later slice.

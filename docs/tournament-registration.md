# Tournament registration

Slice 2 of [the tournament roadmap](https://github.com/justinkwaugh/tabletop/issues/57) supports administrator-created Mini Tournaments and registration. Locked events contain one Stage awaiting scheduling. No Game Instances are created by registration.

## Model and behavior

`libs/common/src/site/tournament.ts` owns the shared schemas. A Tournament contains its format and planned stages, immutable published game configuration, registration policy, concurrency limit, lifecycle revision, embedded entrants, and embedded stage state. The number of planned stages comes from the plan. Mini Tournaments have one stage; multi-stage creation is rejected until progression exists. League Seasons and Groups will associate Tournaments in the later league slice.

Registration has two modes:

- `whenFull`: a required capacity, without a deadline. The final join starts a one-minute withdrawal window, followed by automatic scheduling and Game creation.
- `deadline`: a required closing timestamp and minimum entrants, with optional capacity. Reaching capacity prevents additional joins but does not close early. At the deadline the actual roster locks if the minimum is met; otherwise the event cancels. Uncapped events currently share the implementation limit of 256 entrants.

Active Users may join and leave before lock. There is no separate rules-acceptance step. The event detail displays game options, including explicit default values, before and after enrollment. Publishing freezes configuration and format; material changes require a replacement event. Draft edits use optimistic revisions. Repeated joins, leaves, publication, and closure are idempotent. A retried creation ID may only refer to the same organizer and settings.

A Firestore transaction updates the Tournament’s embedded roster, lifecycle and Stage state together. Entrant count is derived from the roster. It checks the current stored Account status and Admin role for writes. Each event lives in one document at `tournaments/{id}`. Its `entrants` and `stages` arrays are embedded. An automatically derived `entrantIds` field supports an `array-contains` query for Mine; it is a storage index field, omitted from API responses. Joining or leaving writes only the Tournament document. There are no per-entrant documents or per-User membership copies. Cancellation retains the event and its roster for history; it does not delete Accounts or Game Instances. Inactivity after lock remains deferred to slice 9.

## API and UI

All event API paths are beneath `/api/v1/tournaments`; reads require an Active User and return `Cache-Control: no-store`.

| Method | Path           | Operation                                                                                                                                |
| ------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/`            | Page 25 events with `scope=mine`, `open`, `inProgress`, or administrator-only `draft`; optional `titleId` game filter and `after` cursor |
| POST   | `/`            | Create an administrator draft using `{id, draft}`                                                                                        |
| GET    | `/:id`         | Event including roster/stages, plus a map of current public usernames; unpublished drafts are administrator-only                         |
| PUT    | `/:id`         | Update an administrator draft using `{draft, revision}`                                                                                  |
| POST   | `/:id/publish` | Open registration                                                                                                                        |
| POST   | `/:id/cancel`  | Cancel the event                                                                                                                         |
| POST   | `/:id/lock`    | Reconcile closure only when its published condition is satisfied                                                                         |
| POST   | `/:id/join`    | Enroll the authenticated User; empty object body                                                                                         |
| POST   | `/:id/leave`   | Leave before lock                                                                                                                        |

Administrative writes use the existing signed-in Active Administrator account. There is no separate administrator login, mode activation or recent-authentication requirement for tournaments. The tournament API is site-owned and does not alter existing Game UI host bridge calls or results. The shared default-configuration helper preserves the existing Game editor behavior; no UI Artifact republication is required to adopt tournament registration.

Tournament screens use the existing `getAppContext().api` (`TabletopApi`) for requests, including its session-expiry handling, version checks and API errors. These additive site methods do not change existing Game UI calls or results; existing UI Artifacts remain compatible and need no republication.

The website provides `/tournaments` and `/tournaments/:id`. The administrator’s plus button opens tournament creation in a modal over the list, using the same Flowbite controls and Cancel/Create footer as game creation. Saving opens the new draft’s detail; cancelling discards the form. The former `/tournaments/new` route redirects to the list. The list uses Mine, Open, In progress, Completed, and administrator-only Drafts tabs, with cursor pagination. Its compact header sits immediately below site navigation. There is no Refresh button or polling timer.

Committed mutations dispatch small Tournament Realtime Updates containing only the event ID and revision through the existing Notification Service, using Global delivery for published events and User delivery to Active Administrators for unpublished drafts. No draft payload is broadcast globally. Both list and detail screens reconcile their canonical reads when relevant updates arrive and when their realtime connection reports a discontinuity. Concurrent notifications are coalesced; listeners are removed when the screen closes. Notifications remain best-effort under the existing delivery contract.

The In progress tab includes `locked` events awaiting scheduling and the explicit `inProgress` lifecycle state. Their status labels distinguish locked rosters from running events. Registration closure still produces `locked`, awaiting scheduling. The dispatcher slice will transition events into play; this registration slice does not launch games or provide game-spectating controls. Running events cannot use the pre-play cancellation operation.

## Automatic start after filling the roster

Confirmed for the provisioning/dispatch work in [slice 5](https://github.com/justinkwaugh/tabletop/issues/62) and [slice 6](https://github.com/justinkwaugh/tabletop/issues/63): filling a `whenFull` roster begins a one-minute withdrawal window. Cards and detail show “Starts in 1 minute” with the start time/countdown, and the roster row keeps Leave available until that deadline. A departure invalidates the pending start identity without deleting its task; filling the vacancy starts a new full minute. Repeated joins and reads do not extend it.

After the minute, the task generates the schedule in memory, then atomically rechecks the roster and deadline, locks registration, saves the schedule and selects the first games. It then creates those games. There is no administrator approval/start step in normal operation. New Mini defaults allow all assigned games to launch together; a deliberately lower concurrency limit is still honored. The current schedule preview/save controls are administrator tools, not a prerequisite for normal automatic starts.

Persist `startsAt` and schedule a backend task through the existing TaskService/Cloud Tasks for that time. The UI only displays remaining time; it never triggers the start. The start deadline and work intent must survive restarts. Delayed tasks recheck the current deadline and roster, so tasks from cancelled countdowns cannot start an event early. The task queue retries failed executions. Failed enqueueing is reported by the Tournament operation; no periodic sweep replaces missing tasks. Leave/start races at the deadline serialize in the transaction; at or after the deadline, registration is closed. Deadline-based registration retains its published closure behavior; the extra minute is specified here for fill-based events.

This behavior is implemented by the provisioning and dispatch slice.

## Scheduled tasks and deployment

The shared Redis cache serves unchanged Tournament objects and list pages without Firestore reads. Writes invalidate affected entries. See [scheduling persistence](tournament-scheduling.md#api-and-persistence) for cache behavior and read costs.

Registration changes enqueue the dated closure or one-minute start task. The queue owns delayed delivery and execution retries. There is no reconciliation endpoint, periodic timer, startup scan or overdue-tournament query. Tournament-operation enqueue failures propagate to callers; retrying the operation keeps the existing countdown. See [dispatch](tournament-dispatch.md) for reservations and partial-execution retries.

Before deploying this slice:

1. Deploy `firebase/firestore.indexes.json` to the target project and wait for its game-filter (`status` / `rules.titleId`) and Mine game-filter (`entrantIds` / `rules.titleId`) composite indexes to become ready.
2. Use the existing internal tasks service and `TASKS_HOST`. In production, the public backend does not host task routes. Calls within the existing VPC deployment require no additional request credentials.
3. Verify a scheduled task locks or cancels an expired event without a page visit, and failed task executions are retried by the queue.

No production deployment or scheduler changes are performed by local development checks. The combined local development server is unchanged. Local queued tasks use in-process delayed delivery and do not survive a process restart; they are not reconstructed by a sweep.

## Verification

Run persistence tests against an explicitly configured Firestore emulator and Redis:

```sh
CACHE_TEST_REDIS_HOST=localhost FIRESTORE_EMULATOR_HOST=localhost:8080 pnpm exec vitest run --project @tabletop/backend-services libs/backend-services/src/competitions/tournamentService.integration.spec.ts
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

Concurrent games per player defaults to total games per player, allowing every scheduled game to start together. The limit remains editable. Changing the game or table size reapplies that default; changing total games keeps it in step unless a lower limit was chosen. Existing tournaments retain their saved limit.

The roster size also supplies the initial minimum for deadline registration. Opening an existing draft preserves its saved settings. Administrators can override the defaults; these presets do not restrict valid roster sizes. [Slice 4 scheduling](tournament-scheduling.md) now implements their exact balanced schedules after roster lock.

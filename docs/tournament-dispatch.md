# Tournament dispatch

Slice 6 of [the tournament roadmap](https://github.com/justinkwaugh/tabletop/issues/57) starts Mini Tournaments automatically and dispatches their saved Tables as player capacity permits. Normal scoring and final results are supplied by [slice 7](tournament-scoring.md); dropout resolution remains slice 8.

## Automatic start

The final join in a `whenFull` event persists `startsAt = now + 60 seconds`, a unique `startId`, and `nextTaskAt` in the Tournament transaction. TaskService enqueues an internal `/tasks/tournaments/dispatch` request with that identity and delay. Registration stays open during the minute. Leave removes the pending identity; it does not delete a Cloud Task. Refilling the roster starts a fresh minute with a different identity. Duplicate joins never extend it.

The task reads the Tournament and generates the Schedule in memory from its roster. A single transaction verifies the Tournament revision and current deadline, locks registration, saves the immutable Schedule, marks the Stage scheduled and selects its first Tables under the configured concurrency limit. No Account lookup is needed to select those Tables. A failed schedule write leaves registration open without a partially saved Stage. A stale countdown identity or early delivery does nothing while registration is open. Once the schedule is saved, a retry continues its existing reservations. At the deadline, Leave can no longer remove an entrant, even if task execution is delayed. Dated events retain their published minimum-roster rule.

Cards and detail display `Starting in Ns`, then `Starting…`, then `In progress`. The client clock only renders text and the withdrawal affordance; it does not call the backend to start anything.

## Reservations and recovery

Dispatch state is embedded in the Stage: reserved, active and finished Table IDs and an optional error. There is no new collection or document per Table. Every reservation counts against every assigned entrant's concurrency limit. The initial schedule transaction reserves every Table allowed by player concurrency. Each task creates all eligible Tables without a batch limit or immediate continuation task. Later tasks select further Tables as Games finish, using active Games and existing reservations. Selection uses the saved roster and concurrency limit; Account checks occur when each Game is created. The default concurrency permits all a player's Games to start together; lower limits dispatch more as Games finish.

Queued task executions can overlap or retry the same reservations. Game creation rechecks the reservation, schedule and pause/cancellation state against the canonical Tournament. The same transaction creates Game/State/private initialization and moves the reservation to active. Starting the last reserved Table also clears `nextTaskAt` and any dispatch error in that transaction; successful startup has no final cleanup transaction. A later task that finds no eligible Tables clears its pending task in the table-selection transaction. Deterministic Game IDs make duplicate creation return the existing initialized Game. Reservations remain available to a retry after an interrupted execution; they have no owner token or expiry. Game persistence also records an already-created Game as active or finished when recovering an older reservation. The dispatcher does not repeat those transitions.

A valid final Game State releases its active Table and records it as finished in the same transaction as the final action. That transaction persists a new `nextTaskAt`; enqueueing a task wakes dispatch. The existing game-action path logs an enqueue failure without rolling back the committed result. Abandoned Games retain capacity pending the later recovery workflow. These IDs track scheduling completion, not a second result or scoring model.

Task execution failures record `Tournament.schedulingError`, including failures before the first Stage is saved, and return a failure response so the queue retries the original task with its configured backoff. They do not enqueue replacement tasks or set an application retry delay. The existing `nextTaskAt` lets the original queued task resume unfinished dispatch. Idle tournaments and stale tasks return successfully.

A task sends one Tournament update after success or partial failure, including any registration and schedule changes. Creating each Game still sends the normal per-game player notifications. Tournament clients receive the final task revision instead of reloading after every Table.

Pause clears the pending wakeup while retaining reservations and active Games. Resume and Retry enqueue another task. Existing Games remain playable while dispatch is paused. Administrator controls use the existing authenticated tournament API. Retry also works for an open Tournament whose published start deadline has passed, using its current start identity and the same task handler. It cannot bypass the deadline or revive a cancelled event. Participants see “Start delayed” and the automatic-retry explanation; administrators can inspect the saved error and retry under Manage.

`nextTaskAt` records pending dispatch for countdowns and queued task execution. There is no periodic sweep, startup scan, overdue-work query or reconciliation endpoint. Enqueue failures from Tournament operations propagate to their callers; retrying a join preserves the existing countdown, and an administrator can explicitly retry dispatch. Tournament and Schedule reads retain the shared Redis cache. Duplicate deliveries to an idle Tournament return from its cached object without transaction writes. Completing a Game triggers dispatch when player capacity becomes available.

## Runtime and deployment

LocalTaskService delays requests, retries failed delivery, and cancels timers on shutdown. The combined local development server is unchanged.

Production task endpoints are hosted by the existing internal tasks service, which shares a VPC with the backend. Requests are inherently authorized by that deployment; no additional request credentials are required. The public backend does not register task routes. Use the existing `TASKS_HOST` as described in [registration](tournament-registration.md#scheduled-tasks-and-deployment).

Create the `tournaments` Cloud Tasks queue in `us-central1`, the location used by CloudTasksTaskService. A conservative starting configuration is:

```sh
gcloud tasks queues create tournaments --location=us-central1 \
  --max-concurrent-dispatches=10 --max-dispatches-per-second=5 \
  --min-backoff=10s --max-backoff=300s
```

These are deployment throughput settings, independent of per-player concurrency. Use `queues update` for an existing queue. See Google's [queue configuration reference](https://docs.cloud.google.com/sdk/gcloud/reference/tasks/queues/create).

Use the backend's queue-enqueue permissions and the internal tasks service. No production resources are changed by local development checks.

The existing `stages` index exemption also covers dispatch arrays. `nextTaskAt` uses its automatic single-field index. When adopting the tournament-level error field, move any existing `Stage.dispatch.error` to `Tournament.schedulingError` and remove the old field. Before adopting this change with pre-slice-6 data, migrate open dated events' `nextTaskAt` to their published closure timestamp; initialize full open events with a fresh one-minute start identity. Existing locked or manually provisioned fixtures can be explicitly resumed through Manage. Do not reset in-progress Game data.

## Verification

Integration tests use the Firestore emulator and Redis for countdown invalidation/refill, deadline withdrawal races, concurrent deliveries, atomic capacity accounting under uneven completion, a stalled execution overlapping a successful retry, pause/resume, creation and final-state transaction rollback, lost acknowledgements, queue-owned retries of the original countdown task, all fourteen eligible Games in one task without a continuation, one Tournament notification per task, recovery of existing Games and explicit retries after enqueue failures. The maximum supported roster and 32,768 completed Table IDs are checked against Firestore's document limit. Route tests verify administrator authorization, internal task payload validation and failure responses; local task tests exercise delayed delivery and retry.

The additive tournament fields and administrative TabletopApi operations are used by Site Frontend. Game Session and the host bridge are unchanged; this slice requires no Game UI Artifact republication to adopt its tournament behavior.

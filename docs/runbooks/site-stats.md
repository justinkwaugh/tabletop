# Site stats

The admin **Stats** tab reads one document per UTC month, `siteStatsMonths/{YYYY-MM}`. Each document holds each rolled-up day's figures under `days.{YYYY-MM-DD}` and a distinct-count sketch of that day's active users under `activeUsers.{YYYY-MM-DD}`. `SiteStatsService.rollupDay` computes a day from existing game, action-chunk and user records and replaces that day's two fields, so retries and rebuilds are always safe. A 28-day view with its comparison period reads two to four month documents.

The sketch stores no user ids: up to 512 users a day it is a sorted list of 32-bit hashes, which counts exactly; above that it switches to 4,096 HyperLogLog registers, within about 2%. Range-wide active users merge the sketches of the days in the range. A month document is about 20 KB at today's volume; a title passing a few hundred players a day would make its sketches dense, so move the sketches to their own documents well before a month nears Firestore's 1 MiB limit.

## What runs

- `POST /tasks/stats/daily` (tasks service) starts a chain that rolls up every day from the first one not yet rolled up, or from three days ago if that is earlier, through yesterday. The two extra days pick up late undos and finishes.
- `POST /tasks/stats/rollup` rolls up one day and enqueues the next on the `maintenance` queue until the chain's last day. Each step is a named task (`site-stats-<run>-<day>`), so a retried step cannot start a second chain.
- `POST /api/v1/admin/stats/rollup` (admin, the tab's **Rebuild…** button) starts a chain from the first game's creation day through yesterday.

Each day logs `Site stats rollup {...}` with its counts, the games it read and its duration; read them with `tools/investigate logs --grep "Site stats rollup"`. The Health panel shows the same for the latest day rolled up.

A day reads the games in play that day and, for each, the action chunks updated since the day began. For yesterday that is the current chunk; during a rebuild it is every later chunk of each game, so a rebuild reads more than the daily run. Hotseat, forked and exploration games are dropped before their chunks are read.

## First deployment

1. Deploy the Firestore indexes and field exemptions in `firebase/firestore.indexes.json` (`games`: `lastActionAt`+`startedAt` and `status`+`lastActionAt`; `siteStatsMonths.days` and `.activeUsers` exempt), and wait until they are ready.
2. Release the backend, then the frontend.
3. Press **Rebuild…** on the Stats tab once and watch the log until `"event":"complete"`.
4. Create the daily Cloud Scheduler job (below).

## After a release that changes the day shape

Days saved in an older shape read as not rolled up: the tab shows them as gaps and "History from" moves to the first current day. Press **Rebuild…** after such a release.

## Daily Cloud Scheduler job

The tasks service accepts internal traffic only, and Cloud Scheduler in the same project counts as internal, so the job needs no token. Confirm the tasks service URL with `gcloud run services describe tasks --region us-central1 --format 'value(status.url)'`.

```sh
gcloud scheduler jobs create http site-stats-daily \
  --project tabletop-426201 \
  --location us-central1 \
  --schedule '10 0 * * *' \
  --time-zone Etc/UTC \
  --uri '<tasks service url>/tasks/stats/daily' \
  --http-method POST \
  --headers Content-Type=application/json \
  --message-body '{}' \
  --attempt-deadline 60s
```

Run it once by hand with `gcloud scheduler jobs run site-stats-daily --location us-central1` and check the log.

If the tab says **Behind by N days**, the job has not run; check its last attempt in the Cloud Scheduler console, or press **Rebuild…**.

## What the numbers mean

- Range figures leave out hotseat, forked and exploration games. History only covers games that still exist; deleted games and undone actions are gone.
- **Active users** took at least one action. Range totals are distinct users across the range, not sums of days.
- **User actions** are moves by human players. Automatic actions and bot moves are counted apart.
- **"vs previous N days"** is shown only when the previous period lies wholly inside the rolled-up history.
- **Turn time** is estimated: the time from the previous player's action to this player's next action, or from the game's start for the first move. Simultaneous phases make it look faster than it is.
- **Right now** figures are `count()` queries over every game, user and notification subscription, cached in Redis for 10 minutes.
- **Notifications and reminders** show "Not collected yet" until the reminder log exists.

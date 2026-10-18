# Site stats

The admin **Stats** tab reads one rolled-up document per UTC day (`siteStatsDays/{YYYY-MM-DD}`) and its admin-only active-user list (`siteStatsActiveUsers/{YYYY-MM-DD}`). A day is computed from existing game, action-chunk and user records by `SiteStatsService.rollupDay`. Re-running a day overwrites it, so retries and rebuilds are always safe.

## What runs

- `POST /tasks/stats/daily` (tasks service) starts a chain that rolls up every day from the first one not yet rolled up, or from three days ago if that is earlier, through yesterday. The two extra days pick up late undos and finishes.
- `POST /tasks/stats/rollup` rolls up one day and enqueues the next on the `maintenance` queue until the chain's last day.
- `POST /api/v1/admin/stats/rollup` (admin, the tab's **Rebuild…** button) starts a chain from the first game's creation day through yesterday.

Each day logs `Site stats rollup {...}` with its counts and duration; read them with `tools/investigate logs --grep "Site stats rollup"`.

## First deployment

1. Deploy the Firestore indexes and field exemptions in `firebase/firestore.indexes.json` (`games`: `lastActionAt`+`startedAt` and `status`+`lastActionAt`), and wait until they are ready.
2. Release the backend, then the frontend.
3. Press **Rebuild…** on the Stats tab once and watch the log until `"event":"complete"`.
4. Create the daily Cloud Scheduler job (below).

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
- **Turn time** is estimated: the time from the previous player's action to this player's next action, or from the game's start for the first move. Simultaneous phases make it look faster than it is.
- **Right now** figures are live `count()` queries over every game and user.

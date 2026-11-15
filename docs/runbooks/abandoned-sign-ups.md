# Abandoned Sign-ups

The host deletes an Account that is still Incomplete, and was never Active, 3 days after it was created (see Abandoned Sign-up in `docs/contexts/identity-and-access/CONTEXT.md`). `AbandonedSignUps` (`libs/backend-services/src/users/abandonedSignUps.ts`) runs it: a daily Cloud Scheduler job posts `/tasks/users/sweepAbandonedSignUps`, which reads every Incomplete Account and queues `/tasks/users/deleteAbandonedSignUp` for each one due on the `maintenance` queue. That task skips an Account seated in any Game, rechecks the rule inside the transaction, deletes the record and its Username, Email and External Identity reservations, then revokes its sessions and deletes its challenges, preferences and notification subscriptions.

## Rollout

1. Release the backend.
2. Create the daily Cloud Scheduler job (below) and run it once by hand. The first run deletes every Abandoned Sign-up since the site opened.

## Daily Cloud Scheduler job

The tasks service accepts internal traffic only, and Cloud Scheduler in the same project counts as internal, so the job needs no token. Confirm the tasks service URL with `gcloud run services describe tasks --region us-central1 --format 'value(status.url)'`.

```sh
gcloud scheduler jobs create http abandoned-sign-ups-daily \
  --project tabletop-426201 \
  --location us-central1 \
  --schedule '45 0 * * *' \
  --time-zone Etc/UTC \
  --uri '<tasks service url>/tasks/users/sweepAbandonedSignUps' \
  --http-method POST \
  --headers Content-Type=application/json \
  --message-body '{}' \
  --attempt-deadline 120s
```

Run it once by hand with `gcloud scheduler jobs run abandoned-sign-ups-daily --location us-central1`.

## Reading the logs

- `"event":"abandoned_sign_up_sweep"` lists the Accounts queued (`queuedUserIds`).
- `"event":"abandoned_sign_up_delete"` reports each task: `deleted`, `kept` (it finished signing up first), or `missing` (a retry after the record was already deleted, which finishes the clean-up).
- `"event":"abandoned_sign_up_kept_seated"` is an Incomplete Account seated in a Game. It is kept; look at how it got there.

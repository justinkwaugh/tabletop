# Pay it forward tally

The /pay-it-forward page shows what Board Together players have raised through the two Board Together team campaigns on Tiltify. Design and copy decisions are in [pay-it-forward.md](../pay-it-forward.md).

## What runs

- Cloud Scheduler calls `POST /tasks/pay-it-forward/refresh` on the tasks service every 15 minutes. `CharityTallyRefresher` reads both team campaigns from Tiltify's v5 public API, converts pounds to dollars at the day's ECB rate from api.frankfurter.dev, writes `payItForward/tally` in Firestore (the tally, the rates used and `refreshedAt`), and puts the tally in Redis under `pay-it-forward-tally` with no expiry. Each success logs `Charity tally refresh {...}`.
- If Tiltify or the rate feed fails, the refresh writes nothing and answers 500, so the scheduler records the failure and players keep seeing the last good tally.
- `GET /api/v1/pay-it-forward/tally` (backend, public) reads Redis, falling back to the Firestore document, and never calls Tiltify. It answers 404 until the first refresh. Browsers cache it for 10 minutes.

Read recent refreshes with `tools/investigate logs --service tasks --grep "Charity tally refresh"`.

## Credentials

A Tiltify application on the BoardTogether Tiltify account, client-credentials flow, `public` scope. Its client ID and secret are the Secret Manager secrets `TILTIFY_CLIENT_ID` and `TILTIFY_CLIENT_SECRET`; the `backend` and `tabletop-investigate` service accounts can read them. Only a service with `TILTIFY_CLIENT_ID` set builds the refresher, so the route answers 404 elsewhere.

## First deployment

1. Attach the secrets to the tasks service (it runs as the `backend` service account, which can read them):

    ```sh
    gcloud run services update tasks \
      --project tabletop-426201 --region us-central1 \
      --update-secrets=TILTIFY_CLIENT_ID=TILTIFY_CLIENT_ID:1,TILTIFY_CLIENT_SECRET=TILTIFY_CLIENT_SECRET:1
    ```

2. Release the backend, then the frontend.
3. Create the scheduler job (below) and run it once by hand. Check the log line and `curl https://boardtogether.games/api/v1/pay-it-forward/tally`.

## Cloud Scheduler job

The tasks service accepts internal traffic only, and Cloud Scheduler in the same project counts as internal, so the job needs no token. The URL below was current on 2026-10-26; confirm it with `gcloud run services describe tasks --region us-central1 --format 'value(status.url)'`.

```sh
gcloud scheduler jobs create http pay-it-forward-refresh \
  --project tabletop-426201 \
  --location us-central1 \
  --schedule '*/15 * * * *' \
  --time-zone Etc/UTC \
  --uri 'https://tasks-dugtcypyya-uc.a.run.app/tasks/pay-it-forward/refresh' \
  --http-method POST \
  --headers Content-Type=application/json \
  --message-body '{}' \
  --attempt-deadline 60s
```

Run it by hand with `gcloud scheduler jobs run pay-it-forward-refresh --location us-central1`.

## Changing campaigns

The team campaign IDs are in `libs/backend-services/src/payItForward/charityTallyRefresher.ts` and the links in `apps/frontend/src/routes/(app)/(public)/pay-it-forward/+page.svelte`. A team campaign's ID is the `fact` id its Tiltify page requests, and it reads from `/api/public/team_campaigns/{id}`. Tiltify retires a campaign after six months without a donation; a retired or unpublished campaign's card links to the charity's own donation page until the ID is replaced.

To rotate the Tiltify credentials, add a new version of each secret and rerun step 1 with `:2`.

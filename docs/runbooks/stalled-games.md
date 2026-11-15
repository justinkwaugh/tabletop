# Stalled Games

The host ends a Game nobody has moved in for 30 days as abandoned (see Stalled Game in `docs/contexts/game-lifecycle/CONTEXT.md` and the Stalled Games section of `docs/player-votes.md`).

## Rollout

1. Release the Site Frontend: older builds reject a Game carrying a stalled call.
2. Republish Napoleon's Triumph's UI. Its 5.0.0 offers calls but was built before the stalled kind, so the sweep would otherwise end Games it cannot open.
3. Release the backend.
4. Create the daily Cloud Scheduler job (below) and run it once by hand. Stalled Games of titles that do not offer calls yet are logged as waiting.
5. Each title's Stalled Games end on the first daily run after it offers calls (PR #208). Build it from code that includes the stalled kind.

## Daily Cloud Scheduler job

The tasks service accepts internal traffic only, and Cloud Scheduler in the same project counts as internal, so the job needs no token. Confirm the tasks service URL with `gcloud run services describe tasks --region us-central1 --format 'value(status.url)'`.

```sh
gcloud scheduler jobs create http stalled-games-daily \
  --project tabletop-426201 \
  --location us-central1 \
  --schedule '30 0 * * *' \
  --time-zone Etc/UTC \
  --uri '<tasks service url>/tasks/games/sweepStalled' \
  --http-method POST \
  --headers Content-Type=application/json \
  --message-body '{}' \
  --attempt-deadline 120s
```

Run it once by hand with `gcloud scheduler jobs run stalled-games-daily --location us-central1`.

## Reading the logs

- `"event":"stalled_game_sweep"` lists the Games queued to end (`queuedGameIds`) and those whose title does not offer calls yet, or whose catalog could not be read (`awaitingTitleGameIds`).
- `"event":"stalled_game_end"` reports each Game's task; `"ended":false` means somebody moved first, it had already ended, or its title does not offer calls.

An administrator can undo the ending like any Called Game, which clears `Game.call`. The undo counts as the last action, so the Game has another 30 days.

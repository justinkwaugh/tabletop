# Game Storage Encoding

Each action rewrites the Game's State document and its current action chunk (up to 200 actions). The game store keeps each payload as JSON text (`states.data`, `actionChunks.actionsData`) or zstd-compressed in a bytes field beside it (`states.dataZstd`, `actionChunks.actionsZstd`). Backends from the step 2 release on read both, and a document holds one of the two. The `GAME_STORAGE_ENCODING` environment variable picks the encoding for writes: `json` (the default) or `zstd`. A document changes encoding the next time it is written, so turning compression on or off needs no migration (#115).

zstd stores chunks about 10 times smaller and States 5 to 10 times smaller. Locally it costs 0.4 ms per write and 0.3 ms per read for the largest chunk, and up to 0.13 ms per State.

## Rollout

1. Deploy the field exemptions in `firebase/firestore.indexes.json` (`actionChunks.actionsData`, `actionChunks.actionsZstd`, `states.*`) and wait until they are ready. Without the `actionsZstd` exemption, Firestore indexes the bytes field on every chunk write.
2. Release the backend with `GAME_STORAGE_ENCODING` unset. That release reads both encodings and still writes JSON.
3. Once it is serving, set the variable on both services. Both write States and chunks, `tasks` for automatic actions. The deploy tool pins traffic to its named revision, so route traffic to the new revision as well. Revision names take the deploy tool's dashed form of the version, so backend 1.46.0 is `v1-46-0`:

    ```sh
    for service in tasks backend; do
      gcloud run services update "$service" \
        --project tabletop-426201 --region us-central1 \
        --update-env-vars=GAME_STORAGE_ENCODING=zstd \
        --revision-suffix="v1-46-0-zstd"
      gcloud run services update-traffic "$service" \
        --project tabletop-426201 --region us-central1 \
        --to-revisions="$service-v1-46-0-zstd=100"
    done
    ```

    Later backend deploys keep the variable, because the deploy tool only adds its own variables.

4. Check the `request_timing` log lines of the action, Undo and Game GET routes. The counters `store.state.jsonBytes`, `store.state.zstdBytes`, `store.actionChunk.jsonBytes` and `store.actionChunk.zstdBytes` give the sizes. The spans `store.state.stringify`, `store.state.compress` and `store.actionChunk.decompress` (and the matching spans for the other payload) give the time. Task requests do not log timings.

## Rolling back

To stop compressing, set `GAME_STORAGE_ENCODING=json` the same way, or route traffic back to the revision from step 2. Games written compressed keep loading and return to JSON on their next write.

After step 3, never route traffic to a backend older than the step 2 release. Older backends cannot read compressed documents, and every Game that has been written since is compressed.

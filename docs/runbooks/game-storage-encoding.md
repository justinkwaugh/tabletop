# Game Storage Encoding

Each action rewrites the Game's State document and its current action chunk (up to 200 actions). The game store keeps each payload as JSON text (`states.data`, `actionChunks.actionsData`) or zstd-compressed in a bytes field beside it (`states.dataZstd`, `actionChunks.actionsZstd`). Backends from the reading release below on read both, and a document holds one of the two. `GAME_STORAGE_ENCODING` in `libs/backend-services/src/persistence/firestore/storedJson.ts` picks the encoding for writes. A document changes encoding the next time it is written, so switching either way needs no migration (#115).

zstd stores chunks about 10 times smaller and States 5 to 10 times smaller. Locally it costs 0.4 ms per write and 0.3 ms per read for the largest chunk, and up to 0.13 ms per State.

## Rollout

1. Exempt `actionChunks.actionsZstd` from indexing (done 2026-10-27). `actionChunks.actionsData` and every `states` field were already exempt. Without the exemption, Firestore indexes the bytes field on every chunk write.
2. Release the backend with `GAME_STORAGE_ENCODING = 'json'`. This is the reading release: it reads both encodings and still writes JSON.
3. Once the reading release serves both `tasks` and `backend`, set `GAME_STORAGE_ENCODING = 'zstd'` and release again. Releasing both together would let a new `tasks` revision compress a Game while the old `backend` still serves it.
4. Check the `request_timing` log lines of the action, Undo and Game GET routes. The counters `store.state.jsonBytes`, `store.state.zstdBytes`, `store.actionChunk.jsonBytes` and `store.actionChunk.zstdBytes` give the sizes. The spans `store.state.stringify`, `store.state.compress` and `store.actionChunk.decompress` (and the matching spans for the other payload) give the time. Task requests do not log timings.

## Rolling back

Route traffic back to the reading release, or release with `GAME_STORAGE_ENCODING = 'json'`. Games written compressed keep loading and return to JSON on their next write.

Once a release writes zstd, never route traffic to a backend older than the reading release. Older backends cannot read compressed documents, and every Game written since is compressed.

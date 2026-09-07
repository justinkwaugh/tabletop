# Saved-game rehearsals

A rehearsal checks a completed canonical State and its complete Action history against today's Game Runtime. It can also submit those inputs through real hosted Game Sessions in separate Chromium player accounts. It bypasses mouse-based selection controls; it does not replace UI interaction tests.

## Run a Game's fixtures

From the repository root:

```sh
pnpm rehearse fresh-fish
pnpm rehearse sol
pnpm rehearse fresh-fish --variant recorded
pnpm rehearse fresh-fish --fixture games/fresh-fish/rehearsals/legacy-2025/fixture.mjs
```

The command builds the selected Game and its dependencies before loading the Runtime. Use `--no-build` only when those artifacts are already current. It runs the recorded case and every explicitly configured variant by default.

Reports go to `.local-rehearsals/<timestamp>/<game>/report.json`, with final States in a fixture subdirectory. The command exits nonzero on an incomplete export, execution error, unexpected cascade length, or unexpected State difference. Reports identify the stage, recorded action index/type, comparison differences, and documented fixture exceptions.

Engine checks cover:

- Complete, contiguous, unique Actions with matching Game IDs and checksum.
- Reconstructing the initial position from canonical undo patches and validating every recovered State.
- Executing each User Action from its original pre-action State independently.
- Checking that each current transition produces the same State after JSON serialization, catching dependence on shared object references that persistence or projection removes.
- Replaying all User Actions from the reconstructed initial State, regenerating System Actions.
- Comparing cascade lengths, the resulting State and final checksum against the export.

Independent historical resume checks continue after a full-replay failure, so one incompatible early move does not hide later forward-play results.

Historical schema incompatibilities are reported as failures of these particular checks. A rehearsal failure is diagnostic evidence; it is not automatically a deployment blocker. The product's compatibility rule remains that old Games must be playable forward from their current State, while old History need not remain replayable.

## Hosted rehearsal

Start the existing hosted runner with local realtime transport enabled:

```sh
ABLY_API_KEY='' PUBLIC_ENABLE_ABLY_REALTIME='' PUBLIC_SSE_HOST='http://localhost:3000' \
  node tools/scripts/local-hosted-game.mjs fresh-fish
```

Wait for `Local hosted game ready`. The local manifest must select the current Game Logic and UI package versions, as required by the runner. Restart the runner after implementation changes to rebuild both artifacts. Do not leave its watch processes running during implementation.

In another terminal:

```sh
pnpm rehearse fresh-fish --hosted
```

Inside the repository devcontainer, infrastructure commonly uses service hostnames:

```sh
pnpm rehearse fresh-fish --hosted --firestore-host firebase:8080 --redis-host cache:6379
```

Hosted mode uses the artifacts prepared by the runner and verifies their manifest versions. It does not rebuild underneath the running site. Chromium must be installed for `@playwright/test`; if needed, run `pnpm --filter @tabletop/tools exec playwright install chromium`.

Run hosted rehearsals one at a time; each opens a full browser session for every player.

The harness permits loopback frontend/backend URLs, local emulator hostnames, and `demo-*` Firestore projects only. It blocks browser application requests to other origins and rejects Ably use. Hosted fixtures are imported into the emulator with new Game IDs and isolated synthetic accounts using the real Game Store and cache write protection. This import is necessary to load historical canonical State and History; gameplay then uses each owning player's actual `GameSession.applyAction`.

For each input it waits for all clients, compares every displayed State against the corresponding canonical projection, and checks the final host API response against the independent engine replay. It also checks persisted State, Action chunks, denormalized Game metadata, and refresh. The recorded case loads the original completed export and traverses its normal History stops.

The local backend disables its blanket rate limiter so bulk replays can run without artificial delays. Explicit endpoint-specific limits still apply; deployed services retain the global limiter. `--pace-ms 1200` is available when rehearsing against an older local backend.

Failure reports include the current input, per-player State captures and screenshots. Synthetic account credentials are saved with owner-only file permissions. Imported emulator fixtures remain available for inspection; their IDs appear in the report. No production data is written. Stop the hosted runner with Ctrl-C when done.

## Add an export

Keep each fixture under `games/<package>/rehearsals/<case>/`:

- `state.json`: complete canonical current/final State.
- `actions.json`: complete canonical Actions, including undo patches. Either chronological ordering is accepted; the loader sorts by index and validates continuity.
- `fixture.mjs`: metadata and any explicit comparison or setup adaptations.

These are repository-only fixtures. Game TypeScript builds include `src`, and Logic/UI Rollup builds follow their `src` entry points. Deployment uploads only `games/<package>/bundle` and `games/<package>-ui/bundle`; it does not upload the package directory. Keep rehearsal imports out of production entry points. Logic packages are private workspace packages, not npm publications.

Use the Fresh Fish `legacy-2025` fixture as an example. A basic fixture requires no adaptation:

```js
export default {
    name: 'Sol completed game, 2026-09',
    packageId: 'sol',
    state: './state.json',
    actions: './actions.json',
    config: {
        /* original Game configuration */
    }
}
```

If the Game document is available, provide its metadata in `game`. Otherwise the loader infers player IDs, the seed and minimal hosted metadata from the State. Put any inferred configuration and uncertainty in `comparisonNotes`. Set `game.protectedInformation` explicitly when the export belongs to a protected Game; having a v3 State or a registered visibility definition alone does not establish that the original Game was protected.

Fixtures are trusted repository code. They should not perform application startup or network work on import. Never use a projected player export as a canonical fixture: hidden values and undo patches may be missing.

## Comparisons and variants

Comparisons are exact by default. An optional `normalizeState(state, phase)` operates on an isolated copy. It must be accompanied by `comparisonNotes` explaining each accepted difference. Phases are `resume`, `final`, and `variant`. Reports retain the raw final difference paths even when the normalized comparison passes. Hosted projection/persistence checks are exact and never apply the fixture normalizer. Protected views also independently check that private PRNG state is redacted. A fixture may add `assertProtectedView(state, playerId, canonical)` for title-specific privacy invariants; Fresh Fish asserts that unrevealed bag contents stay empty. These assertions catch leakage even if the current projector and frontend agree.

For example, the Fresh Fish legacy export retains consumed bag entries, while current logic removes them. Its normalizer compares only remaining entries. It accepts the one verified alternative blue ice-cream route while continuing to check all other final paths, distances, scores and money. Intermediate resume comparisons explicitly account for recalculated scores/distances and the newer auction submission flag.

A fixture can define named `variants` whose preparation function receives the reconstructed initial State, current engine and Game, and returns `{ state, game }`. The Fresh Fish protected-v3 variant preserves the historical setup and supplies fresh private randomness. Variants replay the original User Actions and compare the final outcome; independent resume checks apply to the recorded case only.

Such a variant is a controlled reconstruction. It does not prove that an old numeric seed reproduces the original setup with today's initializer. A Game may need a specific transformation for changed private fields, generated identifiers or randomness. Keep that transformation with its fixture, explain it, and let incompatible recorded choices fail. Do not automatically convert existing v2 Games to protected Games.

Sol's `legacy-2026` fixture contains 494 User Actions and 18 System Actions. Both variants preserve its deck order; Sol does not reshuffle during this game. The recorded final comparison is exact, including the public PRNG and checksum. Historical resume positions accept only the known difference between absent effect tracking and its exact empty defaults. Older read helpers materialized these defaults, causing the acting client's UI to diverge from the backend; `getEffectTracking()` now reads without mutation and action code uses `ensureEffectTracking()` before writes. Its protected variant also checks that the future deck is absent from every player view.

Sol also used to append the same player activation again for successive stations. Shared references made clearing fields behave differently after serialization. Current actions insert each activation once; historical comparisons retain the first entry per player, matching the runtime's lookup. Old saves still execute forward, and their recorded final outcome is compared exactly. The general serialization check detects this class of defect during the engine rehearsal.

## Harness verification

After building Fresh Fish and Sol with `pnpm rehearse fresh-fish` and `pnpm rehearse sol`, run:

```sh
pnpm exec vitest run --project @tabletop/tools libs/tools/src/rehearsal
```

These checks use the real recorded game to verify successful replay, rejection of incomplete/illegal input, protected reconstruction, and rejection of nonlocal hosted configuration. Hosted smoke tests use the command above and require the local infrastructure.

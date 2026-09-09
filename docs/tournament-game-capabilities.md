# Tournament game capabilities

Slice 03 (#60) extends the existing `GameInitializer.initializeGameState` method with an optional starting-position assignment. This is general game setup, usable without a tournament. Results remain the existing `GameState.result` and `winningPlayerIds`; no parallel result model or outcome capability is introduced. Sol and Urbino adopt assigned setup; other titles require setup adoption and verification in #67. Registration still does not launch games. Balanced scheduling, managed provisioning and result settlement remain #61–#64.

## Setup contract

Player counts and game options use the existing title definition. GameService validates player counts against `info.metadata.minPlayers`/`maxPlayers` during game creation and editing; BaseGameInitializer validates supplied options through the existing configurator. Tournament registration validates the table size and materialized configuration against those same fields. The later managed provisioning service must use these existing validation boundaries when creating games. The existing initializer applies the assignment; there is no additional setup object, description field or player-count interface.

`StartingPositionAssignment.playerIds` is ordered by the title's starting positions, beginning at position zero. These are Game Player IDs, not User IDs, colors or roster indexes. Every Game Player must occur exactly once. The scheduler will persist the assignment on its Table; this slice does not add tournament data to ordinary Game or Game State schemas.

Call `GameEngine.startGame(game, { startingPositions: assignment, masterSeed })` through the current Publication's runtime. Given an already validated Game, it rejects an initializer that does not support assigned positions or an invalid identity permutation before initialization. It invokes the same title initializer used for ordinary games, enters the initial machine state, validates canonical state and applies the same protected-information marker as ordinary initialization. This is a runtime operation, not an authenticated provisioning API; the managed-game service in #62 must authorize its use.

`GameEngine.startGame(game)` keeps ordinary randomized behavior. Existing `startGame(game, masterSeed)` calls remain supported for independently published callers; new calls can use the options object for a seed, starting positions, or both. The host-facing `GameCreationOptions` schema is unchanged, so this does not add user-controlled ordering to a hosted API yet. An initializer declares `supportsStartingPositions: true` only when it honors the optional assignment; this prevents older two-argument implementations from silently ignoring it. Adopted initializers pass the assignment to `HydratedTurnManager.generate` before creating any order-dependent board or player state. That helper still consumes the normal shuffle's random draws before replacing the order, keeping later random draws and player colors independent of the assignment. Do not reorder or patch completed states to simulate assigned positions.

Sol uses the assigned order for clockwise mothership seating and the initial turn. Urbino uses it for architect placement; the first position retains the normal decision about who takes the first building turn. Starting-position assignments do not override subsequent choices, auctions, turn-order changes or title-specific tiebreaks.

Initialization is deterministic for the same configuration, player identities, assignment and initial PRNG states. Sol also accepts its existing reproduction master seed. Urbino retains its existing public-seed behavior; it does not gain reproduction-seed support. Generated state IDs and start timestamps are instance metadata, not deterministic game-rule values.

## Existing game results

Tournament scoring will consume the authoritative Game State's existing `result` and `winningPlayerIds` directly:

- `GameResult.Win` or `GameResult.Draw` with winner IDs identifies a single or shared victory.
- `GameResult.Draw` with no winner IDs represents a no-winner draw.
- `GameResult.Abandoned` represents abandonment, not a sporting victory. Dropout resolution remains #65.

`validateGameResult(state)` checks those existing fields without returning another result object or modifying the state. It rejects a missing result, a Win without winners, duplicate or foreign winner IDs, and abandoned results with winners. The later settlement service must load authoritative canonical state and validate it before scoring; this helper does not establish provenance or finality. No new result endpoint is introduced, and titles do not need a capability to expose results they already record.

Sol records shared victories as Draw with winner IDs; Urbino can use Win with multiple winner IDs. Both declare the winners directly. Indonesia contains a defensive Draw branch with no winner IDs; that must not be interpreted as all players winning. Its normal ties already resolve through its title-owned turn-order tiebreak. If a title records an incorrect result, fix its terminal handler rather than introducing another interpretation layer.

The frozen tournament scoring policy remains `splitWinsV1`. Game results are sporting facts; points, settlement and standings belong to the tournament service. Complete finishing positions are not required, and the existing tournament schema rejects placement policies. A future optional placement capability must be validated before opening registration and must not be inferred from scores.

## Catalog adoption audit

This is a source-code audit, not certification of the unadopted titles or a new interpretation of their rules. All currently listed initializers randomize order through `HydratedTurnManager.generate`; merely ordering `game.players` is insufficient. Counts below are current title metadata. Slice #67 must verify every allowed configuration and actual setup/terminal transitions.

| Title | Players | Position and result considerations | Adoption |
| --- | --- | --- | --- |
| Sol | 2–5 | Mothership seating, first turn, protected deck; momentum ties retain all winners. | Implemented and tested |
| Urbino | 2 | Architect placement and first-position choice of first building player; terminal handler declares one or multiple winners. | Implemented and tested |
| Bridges of Shangri-La | 3–4 | Initial turn order; score then occupied-village tiebreak, possibly shared winners. | #67 |
| Bus | 3–5 | Ordered players and initial `scoreOrder`; time-stone penalties and final order-dependent tiebreak. | #67 |
| Container | 3–5 | Ordered setup distributes machines/value cards and optional broker state; final factory-store tiebreak can leave shared winners. | #67 |
| The Estates | 2–5 | Initial auction actor, protected roofs and optional hidden money; money tiebreak can leave shared winners. | #67 |
| Fresh Fish | 2–5 | Initial actor, independent board seed and protected tile bag; terminal scoring declares tied winners. | #67 |
| Indonesia | 3–5 | Ordered players and setup cards; terminal ties resolve in current turn order. Empty-winner Draw branch requires explicit handling. | #67 |
| Kaivai | 3–4 | Initial bidding order, ruleset-dependent setup and later auction ordering; terminal handler chooses one winner from wealth ordering. | #67 |
| Lowenherz | 2–4 | Initial `firstPlayerId` and separate fixed seating order; protected cards, final power/wealth scoring and shared ties. | #67 |
| Santiago | 3–5 | Initial overseer is randomized separately; fixed seating, first bidder and optional manual spring placement must be assigned consistently. Terminal ties retain all winners. | #67 |

The sample game is a development template, not a catalog adoption target. Future title adoption should include requested position permutations, actual first actor/setup decisions, unchanged ordinary setup, deterministic PRNG behavior, hidden-information projections where applicable, and actual terminal results.

## Publication compatibility

Hosted games continue to follow the current Publication (ADR-0003). No runtime version is pinned to a tournament. Existing Game/State/Action schemas and Game UI Host Bridge members are unchanged.

| Artifact combination | Behavior |
| --- | --- |
| New engine, older initializer without `supportsStartingPositions` | Ordinary games continue; assigned initialization rejects explicitly. Existing result fields remain usable. |
| Existing engine, updated Sol/Urbino runtime | Ordinary initializer calls remain valid because the assignment is optional. The options-object form requires the new engine. |
| New engine, updated Sol/Urbino runtime | Supports assigned setup and retains existing result fields. |
| Existing Site Frontend, new Sol/Urbino UI Artifact | No new injected host capability is required. |
| New Site Frontend, older UI Artifact | Existing host contract remains compatible; updating the site does not add setup options to the old bundled engine. |

Sol and Urbino require matching Logic and UI Publications to adopt the initializer/runtime changes. Rebuild and publish both artifacts for each title; publishing only the Site Frontend is insufficient. Other titles need no republishing solely because the optional initializer argument exists, but each needs its own matching publication when it adopts assigned initialization. An already-loaded old client can continue playing an assigned game because the resulting state and action contracts are unchanged; it need not initialize or score the tournament itself.

Tests cover absent-capability rejection and ordinary initialization without the new capability, canonical initialization, existing replay/visibility behavior, and unchanged title actions. The mixed-artifact matrix above follows the unchanged interfaces; production artifact rollout and full hosted tournament execution remain later work. No production Publication is changed by this slice.

## Verification

- Common: 215 tests pass, including 10 result-validation tests and 1 setup-contract test and existing canonical validation, replay, projection and randomness checks.
- Registration: 13 Firestore integration tests pass, including an explicit check that existing title metadata rejects out-of-range table sizes and the existing configurator rejects invalid options.
- Sol: all 44 tests pass, including 10 setup/outcome tests covering every supported player count, seat rotation, first actor, physical seating, deterministic setup, unchanged colors/deck entropy, projections and actual terminal wins/shared wins. Assigned order uses the normal startGame method, and seed-only string/options calls are equivalent.
- Urbino: 5 competition tests pass, including both position permutations through architect placement and first-player choice, deterministic setup and actual terminal results.
- Common, Sol, Urbino, backend-services and backend builds pass. Sol and Urbino UI checking report zero errors (40 and 2 existing warnings respectively). Targeted logic/common lint passes.
- The previously staged Sol UI 6.3.0 runtime, which lacks assigned-position support, produces the same ordinary setup under the new engine, rejects tournament setup, and hydrates and processes a normal Pass from a newly assigned state with the same result as the new runtime. This checks the older embedded title runtime directly, not a full browser/host bridge session.
- Build verification also corrected an implicit undefined return in the slice-02 preset helper and renamed two Urbino UI state bindings that collided with the Svelte `$state` rune.

Full hosted tournament setup remains dependent on managed provisioning; this slice introduces no route that bypasses registration or normal game authorization.

# Tournament game capabilities

Slice 03 (#60) extends the existing `GameInitializer.initializeGameState` method with an optional starting-position assignment. This is general game setup, usable without a tournament. Results remain the existing `GameState.result` and `winningPlayerIds`; no parallel result model or outcome capability is introduced. Every published title except Container now adopts assigned setup; Container remains for #67. Registration still does not launch games. Balanced scheduling, managed provisioning and result settlement remain #61–#64.

## Setup contract

Player counts and game options use the existing title definition. GameService validates player counts against `info.metadata.minPlayers`/`maxPlayers` during game creation and editing; BaseGameInitializer validates supplied options through the existing configurator. Tournament registration validates the table size and materialized configuration against those same fields. The later managed provisioning service must use these existing validation boundaries when creating games. The existing initializer applies the assignment; there is no additional setup object, description field or player-count interface.

`StartingPositionAssignment.playerIds` is ordered by the title's starting positions, beginning at position zero. These are Game Player IDs, not User IDs, colors or roster indexes. Every Game Player must occur exactly once. The scheduler will persist the assignment on its Table; this slice does not add tournament data to ordinary Game or Game State schemas.

Call `GameEngine.startGame(game, { startingPositions: assignment, masterSeed })` through the current Publication's runtime. Given an already validated Game, it rejects an initializer that does not support assigned positions or an invalid identity permutation before initialization. It invokes the same title initializer used for ordinary games, enters the initial machine state, validates canonical state and applies the same protected-information marker as ordinary initialization. This is a runtime operation, not an authenticated provisioning API; the managed-game service in #62 must authorize its use.

`GameEngine.startGame(game)` keeps ordinary randomized behavior. Existing `startGame(game, masterSeed)` calls remain supported for independently published callers; new calls can use the options object for a seed, starting positions, or both. The host-facing `GameCreationOptions` schema is unchanged, so this does not add user-controlled ordering to a hosted API yet. An initializer declares `supportsStartingPositions: true` only when it honors the optional assignment; this prevents older two-argument implementations from silently ignoring it. Adopted initializers pass the assignment to `HydratedTurnManager.generate` before creating any order-dependent board or player state. That helper still consumes the normal shuffle's random draws before replacing the order, keeping later random draws and player colors independent of the assignment. Do not reorder or patch completed states to simulate assigned positions.

Tournament creation and editing reject a title whose initializer does not declare `supportsStartingPositions`, and the tournament form lists only the titles returned by the administrator-only `GET /tournaments/titles`, which reads the served Logic runtimes. An existing draft keeps its title visible so it can still be edited; saving it reports that the game is unavailable for tournaments.

Sol uses the assigned order for clockwise mothership seating and the initial turn. Urbino uses it for architect placement; the first position retains the normal decision about who takes the first building turn. Starting-position assignments do not override subsequent choices, auctions, turn-order changes or title-specific tiebreaks.

Fresh Fish uses the assigned order for its first turn and subsequent turn sequence. Board generation, player colors, final stalls and the protected tile bag retain their ordinary seeded behavior. The existing end-of-game handler records all tied winners, which split tournament credit. Optional blank game options are omitted before validation and persistence, matching ordinary game creation; leaving Board Seed blank uses the normal generated board.

Initialization is deterministic for the same configuration, player identities, assignment and initial PRNG states. Sol also accepts its existing reproduction master seed. Urbino retains its existing public-seed behavior; it does not gain reproduction-seed support. Generated state IDs and start timestamps are instance metadata, not deterministic game-rule values.

## Existing game results

Tournament scoring will consume the authoritative Game State's existing `result` and `winningPlayerIds` directly:

- `GameResult.Win` or `GameResult.Draw` with winner IDs identifies a single or shared victory.
- Shared winners split one tournament point, including when the result is `GameResult.Draw`. Both Win and Draw require declared winner IDs.
- `GameResult.Abandoned` represents abandonment, not a sporting victory. Dropout resolution remains #65.

`validateGameResult(state)` checks those existing fields without returning another result object or modifying the state. It rejects a missing result, a Win or Draw without winners, duplicate or foreign winner IDs, and abandoned results with winners. The later settlement service must load authoritative canonical state and validate it before scoring; this helper does not establish provenance or finality. No new result endpoint is introduced, and titles do not need a capability to expose results they already record.

Sol records shared victories as Draw with winner IDs; Urbino can use Win with multiple winner IDs. Both declare the winners directly. Indonesia contains a defensive Draw branch with no winner IDs; tournament validation rejects it as an invalid result, and its terminal handler requires review during catalog adoption. Its normal ties already resolve through its title-owned turn-order tiebreak. If a title records an incorrect result, fix its terminal handler rather than introducing another interpretation layer.

A title may additionally declare `GameRuntime.scoring` with `finalScores(state)` returning each Game Player ID's final in-game score from a finished canonical state. Tournament scoring uses it only as a tiebreak total between entrants with equal tournament score; see [results and standings](tournament-scoring.md). Each title that declares it reports the primary value its terminal handler ranks by, never a tiebreak value, so a player who loses only on a title's own tiebreak still carries the top score. Container does not declare it yet. Titles opt in by adding the capability; nothing is inferred from player state fields.

The frozen tournament scoring policy remains `splitWinsV1`. Game results are sporting facts; points, settlement and standings belong to the tournament service. Complete finishing positions are not required, and the existing tournament schema rejects placement policies. A future optional placement capability must be validated before opening registration and must not be inferred from scores.

## Catalog adoption audit

This is a source-code audit, not certification of the unadopted titles or a new interpretation of their rules. All currently listed initializers randomize order through `HydratedTurnManager.generate`; merely ordering `game.players` is insufficient. Counts below are current title metadata. Slice #67 must verify every allowed configuration and actual setup/terminal transitions.

| Title | Players | Position and result considerations | Adoption |
| --- | --- | --- | --- |
| Sol | 2–5 | Mothership seating, first turn, protected deck; momentum ties retain all winners. | Implemented and tested |
| Urbino | 2 | Architect placement and first-position choice of first building player; terminal handler declares one or multiple winners. | Implemented and tested |
| Bridges of Shangri-La | 3–4 | Position zero acts first and play continues in the assigned order. Final score is masters on the board; occupied villages break ties and remaining ties share the win. No reproduction seed. | Implemented and tested |
| Bus | 3–5 | Position zero places initial buildings and the first line segment, takes the first worker choice and leads the initial `scoreOrder`. Final score is score minus time stones; ties go to more stones, then earlier `scoreOrder`, so one player always wins. No reproduction seed. | Implemented and tested |
| Container | 3–5 | Ordered setup distributes machines/value cards and optional broker state; final factory-store tiebreak can leave shared winners. | #67 |
| The Estates | 2–5 | Position zero runs the first auction; the cube shuffle and protected roof bag are unchanged. Final score is the terminal score; money breaks ties and remaining ties share the win. | Implemented and tested |
| Fresh Fish | 2–5 | Assigned initial actor and turn order; independent board seed and protected tile bag; terminal scoring declares tied winners. | Implemented and tested |
| Indonesia | 3–5 | Position zero places the first city and acts first; city cards stay dealt by player, as in ordinary setup. Final score is cash plus bank; ties go to the earlier player in current turn order. The empty-winner branch is now an invariant. No reproduction seed. | Implemented and tested |
| Kaivai | 3–4 | Position zero leads the initial bidding order. Final score is `score`; money, fish, boats and tiles break ties in that order, and the handler always declares one winner. | Implemented and tested |
| Lowenherz | 2–4 | Position zero is the first player and the assigned order is the fixed seating. Final score is power points after the end-of-game Parchment award; wealth breaks ties and remaining ties share the win. | Implemented and tested |
| The Old Prince (18xx) | 3–4 | Seating and first auctioneer; random Mainline, Shortline and lot piles keep their seeded draws. `EndGame` declares the highest final wealth, shared on ties. | Implemented and tested |
| Shikoku 1889 (18xx) | 2–6 | Seating and first waterfall bidder; `EndGame` declares the highest final wealth, shared on ties. | Implemented and tested |
| Santiago | 3–5 | Position zero is the initial overseer, with seating clockwise from it; the ordinary overseer draw is still consumed. Final score is plantation points plus remaining money; ties share the win. | Implemented and tested |

The sample game is a development template, not a catalog adoption target. Future title adoption should include requested position permutations, actual first actor/setup decisions, unchanged ordinary setup, deterministic PRNG behavior, hidden-information projections where applicable, and actual terminal results.

## 18xx adoption

The shared 18xx initializer supports assigned positions for every 18xx title. The assignment becomes the seat order, and the title's opening decides what position zero means. TOP and 1889 both draw their first actor, so position zero takes that role through `drawFirstPlayer`, which still consumes the ordinary draw. Colors, the position and every later draw match an unassigned Game with the same master seed. Prepared playground scenarios reject an assignment. The family runtime also declares `randomnessVersion: 1`, and it declares `scoring` from the final wealth recorded by `EndGame`. See the [18xx design note](../research/18xx/starting-positions-design.md).

`games/*/src/competition.spec.ts` covers every supported player count through the shared `libs/18xx/test/startingPositions.ts` suite. The existing opening digests, runtime-contract snapshots and deployed TOP replay are unchanged; seeded fixtures initialize through `startFromPublicSeed` so a numeric seed still pins the same setup. The existing TOP Game keeps its numeric cursors. Every published TOP artifact already bundles ChaCha20 support. Publish matching Logic and UI artifacts for each 18xx title to adopt this change.

## Publication compatibility

Hosted games continue to follow the current Publication (ADR-0003). No runtime version is pinned to a tournament. Existing Game/State/Action schemas and Game UI Host Bridge members are unchanged.

| Artifact combination | Behavior |
| --- | --- |
| New engine, older initializer without `supportsStartingPositions` | Ordinary games continue; assigned initialization rejects explicitly. Existing result fields remain usable. |
| Existing engine, updated Sol/Urbino runtime | Ordinary initializer calls remain valid because the assignment is optional. The options-object form requires the new engine. |
| New engine, updated Sol/Urbino runtime | Supports assigned setup and retains existing result fields. |
| Existing Site Frontend, new Sol/Urbino UI Artifact | No new injected host capability is required. |
| New Site Frontend, older UI Artifact | Existing host contract remains compatible; updating the site does not add setup options to the old bundled engine. |

Sol, Urbino and Fresh Fish require matching Logic and UI Publications to adopt the initializer/runtime changes. Rebuild and publish both artifacts for each title; publishing only the Site Frontend is insufficient. Other titles need no republishing solely because the optional initializer argument exists, but each needs its own matching publication when it adopts assigned initialization. An already-loaded old client can continue playing an assigned game because the resulting state and action contracts are unchanged; it need not initialize or score the tournament itself.

Tests cover absent-capability rejection and ordinary initialization without the new capability, canonical initialization, existing replay/visibility behavior, and unchanged title actions. The mixed-artifact matrix above follows the unchanged interfaces; production artifact rollout and full hosted tournament execution remain later work. No production Publication is changed by this slice.

## Verification

- Common: 215 tests pass, including 10 result-validation tests and 1 setup-contract test and existing canonical validation, replay, projection and randomness checks.
- Registration: 13 Firestore integration tests pass, including an explicit check that existing title metadata rejects out-of-range table sizes and the existing configurator rejects invalid options.
- Sol: all 44 tests pass, including 10 setup/outcome tests covering every supported player count, seat rotation, first actor, physical seating, deterministic setup, unchanged colors/deck entropy, projections and actual terminal wins/shared wins. Assigned order uses the normal startGame method, and seed-only string/options calls are equivalent.
- Urbino: 5 competition tests pass, including both position permutations through architect placement and first-player choice, deterministic setup and actual terminal results.
- Common, Sol, Urbino, backend-services and backend builds pass. Sol and Urbino UI checking report zero errors (40 and 2 existing warnings respectively). Targeted logic/common lint passes.
- The previously staged Sol UI 6.3.0 runtime, which lacks assigned-position support, produces the same ordinary setup under the new engine, rejects tournament setup, and hydrates and processes a normal Pass from a newly assigned state with the same result as the new runtime. This checks the older embedded title runtime directly, not a full browser/host bridge session.
- Build verification also corrected an implicit undefined return in the slice-02 preset helper and renamed two Urbino UI state bindings that collided with the Svelte `$state` rune.

Slice 5 now supplies [managed provisioning and hosted verification](tournament-provisioning.md). Assigned initialization remains an internal operation; automatic scheduling and dispatch follow in slice 6.

## Fresh Fish adoption verification

`games/fresh-fish/src/definition/competition.spec.ts` checks all player counts from two through five, rotating each player through every seat and executing a full first round of disk placements. It checks ordinary seeded equivalence, reversed assignments, both Boolean option settings, an explicit zero Board Seed, participant/spectator tile-bag projections and the existing terminal handler's sole/shared winners. Existing visibility tests also cover legacy seeded setup and auction secrecy. Tournament registration tests cover omitted defaults, blank inputs, explicit zero and clearing a seed before publication. Creation/editing routes validate without coercion so the HTTP validator cannot convert blank or zero numeric options into Boolean values; route tests preserve null, numbers, strings and Booleans unchanged.

The shared game form now uses the same blank-option normalization helper without changing its behavior. No Game Session or host bridge interface changes; older and newer UI Artifacts remain compatible. Fresh Fish needs matching Logic/UI Artifacts containing its updated initializer. Other titles do not need republishing for this normalization refactor.

Local hosted verification used the matching Fresh Fish Logic/UI builds through the running site's manifest: a tournament created in the modal with a cleared Board Seed accepted seven joins and started all seven four-player Games through the scheduled one-minute task. Every persisted Game's turn order matched its saved Table seats, configuration remained frozen, tile-bag delivery was redacted, and participant/spectator game pages rendered. This is local verification; production publication remains separate.

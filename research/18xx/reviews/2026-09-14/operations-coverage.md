# Operating/map/routing coverage

Current-tree review against fc14e5dcc7606a1992c9603e91130ca4cd69b578. 111/111 assigned files read in full. No repository changes. Verification: 144/144 shared/title TypeScript tests and 15/15 Rust tests passed; 63/66 operating harness tests passed, with the three stale phase-completion assertions detailed in the findings file. All 111 assigned files reviewed.

| File | Status | Evidence inspected |
|---|---|---|
| `apps/18xx-tile-viewer/src/demo/automaticTrainCompletion.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `apps/18xx-tile-viewer/src/demo/constructionPerformance.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `apps/18xx-tile-viewer/src/demo/constructionReachability.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `apps/18xx-tile-viewer/src/demo/liveMap.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `apps/18xx-tile-viewer/src/demo/maps.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `apps/18xx-tile-viewer/src/demo/phaseChanges.spec.ts` | Reviewed; 3 stale expectations fail | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `apps/18xx-tile-viewer/src/demo/runTrains.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `apps/18xx-tile-viewer/src/demo/stationPlacement.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `apps/18xx-tile-viewer/src/demo/tileDrawing.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `apps/18xx-tile-viewer/src/demo/trackConstruction.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `apps/18xx-tile-viewer/src/demo/trainPurchase.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `games/shikoku-1889/src/autorouter.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `games/shikoku-1889/src/map.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/shikoku-1889/src/phaseRules.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/shikoku-1889/src/preprintedTiles.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/shikoku-1889/src/roundRules.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/shikoku-1889/src/routeRules.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/shikoku-1889/src/stationRules.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/shikoku-1889/src/tiles.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `games/shikoku-1889/src/tiles.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/shikoku-1889/src/trackRules.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/shikoku-1889/src/trains.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/the-old-prince/src/autorouter.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `games/the-old-prince/src/map.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/the-old-prince/src/phaseRules.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/the-old-prince/src/preprintedTiles.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/the-old-prince/src/roundRules.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/the-old-prince/src/routeRules.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/the-old-prince/src/stationRules.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/the-old-prince/src/tiles.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `games/the-old-prince/src/tiles.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/the-old-prince/src/trackRules.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `games/the-old-prince/src/trains.ts` | Reviewed | Title-owned map/tile/train/phase/round policy compared with recorded slice evidence; current TOP/1889 executable support versus deferred family mechanisms. |
| `libs/18xx-autorouter/.gitignore` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/README.md` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/build.mjs` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/package.json` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/rust/Cargo.lock` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/rust/Cargo.toml` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/rust/rust-toolchain.toml` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/rust/src/lib.rs` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/rust/src/main.rs` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/rust/src/wasm.rs` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/rust/tests/correctness.rs` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `libs/18xx-autorouter/src/autorouter.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `libs/18xx-autorouter/src/autorouter.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/src/encodedRoutes.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/src/index.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/src/solverProtocol.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/src/worker.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/test/exhaustiveRevenue.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/tsconfig.json` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx-autorouter/vitest.config.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx/src/construction/automaticTrackCompletionHandler.ts` | Reviewed | Directional traversal, candidate exclusion/external reentry, affordability/supply/station migration, title usefulness, action authorization and automatic continuation. |
| `libs/18xx/src/construction/constructionReachability.ts` | Reviewed | Directional traversal, candidate exclusion/external reentry, affordability/supply/station migration, title usefulness, action authorization and automatic continuation. |
| `libs/18xx/src/construction/finishTrack.ts` | Reviewed | Directional traversal, candidate exclusion/external reentry, affordability/supply/station migration, title usefulness, action authorization and automatic continuation. |
| `libs/18xx/src/construction/layTile.ts` | Reviewed | Directional traversal, candidate exclusion/external reentry, affordability/supply/station migration, title usefulness, action authorization and automatic continuation. |
| `libs/18xx/src/construction/layingTrackHandler.ts` | Reviewed | Directional traversal, candidate exclusion/external reentry, affordability/supply/station migration, title usefulness, action authorization and automatic continuation. |
| `libs/18xx/src/construction/trackConsent.ts` | Reviewed | Directional traversal, candidate exclusion/external reentry, affordability/supply/station migration, title usefulness, action authorization and automatic continuation. |
| `libs/18xx/src/construction/trackConstruction.ts` | Reviewed | Directional traversal, candidate exclusion/external reentry, affordability/supply/station migration, title usefulness, action authorization and automatic continuation. |
| `libs/18xx/src/construction/trackNetwork.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `libs/18xx/src/construction/trackNetwork.ts` | Reviewed | Directional traversal, candidate exclusion/external reentry, affordability/supply/station migration, title usefulness, action authorization and automatic continuation. |
| `libs/18xx/src/construction/trackUpgrade.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `libs/18xx/src/construction/trackUpgrade.ts` | Reviewed | Directional traversal, candidate exclusion/external reentry, affordability/supply/station migration, title usefulness, action authorization and automatic continuation. |
| `libs/18xx/src/map/map.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `libs/18xx/src/map/map.ts` | Reviewed | Semantic topology, coordinate/direction identity, rotation, immutable definitions and conserved inventory/slot validation. |
| `libs/18xx/src/map/mapState.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `libs/18xx/src/map/mapState.ts` | Reviewed | Semantic topology, coordinate/direction identity, rotation, immutable definitions and conserved inventory/slot validation. |
| `libs/18xx/src/map/station.ts` | Reviewed | Semantic topology, coordinate/direction identity, rotation, immutable definitions and conserved inventory/slot validation. |
| `libs/18xx/src/operating/finishOperatingTurn.ts` | Reviewed | Operating set/turn ordering, income timing, home timing, machine transitions and player authorization. |
| `libs/18xx/src/operating/operatingSet.ts` | Reviewed | Operating set/turn ordering, income timing, home timing, machine transitions and player authorization. |
| `libs/18xx/src/operating/startOperatingRound.ts` | Reviewed | Operating set/turn ordering, income timing, home timing, machine transitions and player authorization. |
| `libs/18xx/src/operating/startOperatingSet.ts` | Reviewed | Operating set/turn ordering, income timing, home timing, machine transitions and player authorization. |
| `libs/18xx/src/operating/startOperatingSetHandler.ts` | Reviewed | Operating set/turn ordering, income timing, home timing, machine transitions and player authorization. |
| `libs/18xx/src/operating/startOperatingTurn.ts` | Reviewed | Operating set/turn ordering, income timing, home timing, machine transitions and player authorization. |
| `libs/18xx/src/phases/advancePhase.ts` | Reviewed | Persistent train identity, availability/capacity, purchase settlement, rust/discard ordering, saved operating continuation. |
| `libs/18xx/src/phases/phaseChange.ts` | Reviewed | Persistent train identity, availability/capacity, purchase settlement, rust/discard ordering, saved operating continuation. |
| `libs/18xx/src/routes/route.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx/src/routes/routeEvaluation.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `libs/18xx/src/routes/routeEvaluation.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx/src/routes/routeNetwork.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx/src/routes/routeResources.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx/src/routes/routeRevenue.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx/src/routes/runTrains.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx/src/routes/runningTrainsHandler.ts` | Reviewed | Semantic encoding/decoding, path and border resources, blocked endpoints, distances/revenues, search bounds/exhaustiveness, WASM lifecycle and build/package interface. |
| `libs/18xx/src/stations/finishStations.ts` | Reviewed | Connection, free/reserved capacity, identity/allowance/cost, home batch and system completion. |
| `libs/18xx/src/stations/placeHomeStations.ts` | Reviewed | Connection, free/reserved capacity, identity/allowance/cost, home batch and system completion. |
| `libs/18xx/src/stations/placeStation.ts` | Reviewed | Connection, free/reserved capacity, identity/allowance/cost, home batch and system completion. |
| `libs/18xx/src/stations/placingStationHandler.ts` | Reviewed | Connection, free/reserved capacity, identity/allowance/cost, home batch and system completion. |
| `libs/18xx/src/stations/stationPlacement.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `libs/18xx/src/stations/stationPlacement.ts` | Reviewed | Connection, free/reserved capacity, identity/allowance/cost, home batch and system completion. |
| `libs/18xx/src/tiles/catalog.ts` | Reviewed | Semantic topology, coordinate/direction identity, rotation, immutable definitions and conserved inventory/slot validation. |
| `libs/18xx/src/tiles/faces.ts` | Reviewed | Semantic topology, coordinate/direction identity, rotation, immutable definitions and conserved inventory/slot validation. |
| `libs/18xx/src/tiles/inventory.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `libs/18xx/src/tiles/inventory.ts` | Reviewed | Semantic topology, coordinate/direction identity, rotation, immutable definitions and conserved inventory/slot validation. |
| `libs/18xx/src/tiles/standardCatalog.ts` | Reviewed | Semantic topology, coordinate/direction identity, rotation, immutable definitions and conserved inventory/slot validation. |
| `libs/18xx/src/tiles/tile.ts` | Reviewed | Semantic topology, coordinate/direction identity, rotation, immutable definitions and conserved inventory/slot validation. |
| `libs/18xx/src/tiles/tiles.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `libs/18xx/src/tiles/topology.ts` | Reviewed | Semantic topology, coordinate/direction identity, rotation, immutable definitions and conserved inventory/slot validation. |
| `libs/18xx/src/tiles/validation.ts` | Reviewed | Semantic topology, coordinate/direction identity, rotation, immutable definitions and conserved inventory/slot validation. |
| `libs/18xx/src/trains/automaticTrainCompletionHandler.ts` | Reviewed | Persistent train identity, availability/capacity, purchase settlement, rust/discard ordering, saved operating continuation. |
| `libs/18xx/src/trains/buyTrain.ts` | Reviewed | Persistent train identity, availability/capacity, purchase settlement, rust/discard ordering, saved operating continuation. |
| `libs/18xx/src/trains/buyingTrainsHandler.ts` | Reviewed | Persistent train identity, availability/capacity, purchase settlement, rust/discard ordering, saved operating continuation. |
| `libs/18xx/src/trains/discardTrain.ts` | Reviewed | Persistent train identity, availability/capacity, purchase settlement, rust/discard ordering, saved operating continuation. |
| `libs/18xx/src/trains/rustTrains.ts` | Reviewed | Persistent train identity, availability/capacity, purchase settlement, rust/discard ordering, saved operating continuation. |
| `libs/18xx/src/trains/train.ts` | Reviewed | Persistent train identity, availability/capacity, purchase settlement, rust/discard ordering, saved operating continuation. |
| `libs/18xx/src/trains/trainDepot.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `libs/18xx/src/trains/trainDepot.ts` | Reviewed | Persistent train identity, availability/capacity, purchase settlement, rust/discard ordering, saved operating continuation. |
| `libs/18xx/src/trains/trainPurchase.ts` | Reviewed | Persistent train identity, availability/capacity, purchase settlement, rust/discard ordering, saved operating continuation. |
| `libs/18xx/src/trains/trainRequirement.spec.ts` | Reviewed | Read assertions, fixture setup, invalid-input cases, replay/Undo or independent oracle where provided; checked against production behavior. |
| `libs/18xx/src/trains/trainRequirement.ts` | Reviewed | Persistent train identity, availability/capacity, purchase settlement, rust/discard ordering, saved operating continuation. |

Additional construction equivalence probe: **7,350 comparisons passed** over 350 seeded seven-hex maps. Candidate faces differ from their originals, with both orientations, random crossing/loop track, impassable borders, own/rival station occupancy and two-city-to-one-city station migrations. Compared exact reachable candidate path/node sets to full TrackNetwork replacement traversal; reused each optimized cache across candidate changes. Probe ran from `/tmp` against current built modules matching the reviewed code and was removed afterward. This is randomized differential coverage, not a mathematical proof or an exhaustive topology enumeration.

Cross-boundary PEIR closure: verified TOP rulebook comparison §6.7.5/§7.7 requires loss of trains. No train/phase path disposes trains on final PEIR closure; closed PEIR is omitted from phase discard order. Finance reviewer owns the closure finding and reproduction, so not duplicated here. Initial exhausted-track auto-skip is not an accepted requirement; rejected as a finding.

# Bus UI Animation Cleanup Backlog

1. Make animator timeline scheduling explicit (`position: 0` + explicit offsets) in all animators to avoid cross-animator drift.
2. Fix score-disc animation transform conflict (`animate:flip` mixed with inline SVG `transform`) in `BoardMetaMarkers`.
3. Remove imperative hover-reset side effects from `$effect` in `BusLineLayer`; keep state derivation pure.
4. Deduplicate worker-cylinder placement derivation shared by `BoardActionRows` and `workerCylinderAnimator`.
5. Deduplicate bus-color-to-table-column mapping shared by `BoardMetaMarkers` and `busPiecePlacementAnimator`.
6. Tighten animator attachment teardown by clearing element refs in `attachAnimator` destroy path.

## Northeast Island Mapping Notes (2026-02-18)

- File touched: `games/indonesia-ui/src/lib/definitions/boardGeometry.ts`.
- `E06/E07/E08` and `E10/E11/E12` remain merged as previously requested.
- `E04` split now uses SVG-derived borders only:
  - Primary split trace is from SVG path `#7` (`M181.71...`) at its east/west start segment (`t≈0..0.01345` in transformed board space).
  - West split anchor is the same path `#7` self-near segment (`t≈0.2847`) instead of the previous synthetic diagonal anchor.
  - Path `#15` start (`M191.74,105.11...`) remains the east-side tie-in.
- New shared boundary between `E04` and `E17` is mirrored (same vertices, reversed order) and now follows the traced short east/west cut near `~y=429` (board coords), not the old `1892.05,420.85 -> 1911.6,428.67` chord.
- Added missed northeast polygon as `E18` (north of `E15/E16`, west of `E13`) from polygonized `northeast.svg` linework.
- `E13` was regenerated from the same polygonization pass so `E13`/`E18` share the exact eastern/western border segment.
- Validation snapshot for current geometry:
  - `E13`/`E18` overlap area = `0.0`.
  - Shared boundary length now follows the exact 5-segment `E13` edge chain listed below.
- Follow-up correction (user review):
  - Restored `E13` exactly to its previous path (from `HEAD`) with no edits.
  - Rebuilt `E18` from the exact SVG path provided by user (`M264.5,362.87c...`) transformed into board space.
  - Closed `E18` only with the exact shared `E13` border vertices (`1990.87,668.99 -> 1988.95,671.40 -> 1987.79,674.46 -> 1986.90,678.55 -> 1985.64,681.45 -> 1983.86,684.10`).
- Follow-up correction (user review):
  - Split `E13` by SVG path `M350.42,352.21c-10.53,6.05-16.97,16.08-24.46,25.08-.38.45-.83.84-1.25,1.26`.
  - Kept larger half as `E13` and added smaller half as `E19`; split border is shared and derived from that svg curve.
  - Merged `E15`, `E16`, and `E18` into one multi-subpath area under `E15` (`E15_MERGED_PATH`).
  - Replaced `E10` merged outline (`E10+E11+E12`) with the refined transformed snippet version (`M 1746.41 592.35 ...`) to improve visual alignment.
- Follow-up correction (user review):
  - Nudged `E10` only by measured verification offset (`dx=-0.75`, `dy=-3.45`) to better match printed coastline in close-up without changing topology.

## East Island Mapping Notes (2026-02-18)

- Files touched:
  - `games/indonesia-ui/src/lib/definitions/boardGeometry.ts`
  - `games/indonesia-ui/src/lib/components/Board.svelte`
- Added new group: `EAST_ISLAND_AREAS` with `F01..F08`.
- Source assets:
  - `games/indonesia-ui/src/lib/images/east.png`
  - `games/indonesia-ui/src/lib/images/east.svg`
- Crop alignment:
  - `east.png` matched on `indo_map_sm.jpg` at board offset `(2022, 435)`.
- SVG-to-board transform used:
  - `x' = 2064.85019 + 1.00051299*x`
  - `y' = 507.42964 + 1.00288529*y`
  - `theta ~= -2.582e-05` (effectively 0 rotation).
- Topology strategy:
  - Polygonization from SVG linework only.
  - Endpoint-only snapping (`<=1.6 px`) to resolve sub-pixel tracing gaps.
  - No raster-derived border generation; raster used only for alignment verification.
- 10-point alignment spot-checks (`path index @ t` => edge distance px):
  - `0@0.02=0.00`, `0@0.37=0.00`, `0@0.73=1.00`
  - `1@0.10=0.00`, `1@0.85=0.00`
  - `2@0.18=0.00`, `2@0.72=0.00`
  - `5@0.52=0.00`
  - `6@0.12=0.00`, `6@0.91=0.00`
- Board wiring:
  - `Board.svelte` now imports `EAST_ISLAND_AREAS` and includes it in `DEBUG_MAP_AREAS`.
- Follow-up correction (user review):
  - Missed bridge face from `east.svg` path `M195.24,120.18c...` was added as `F08`.
  - `F01`..`F06` were regenerated from the same polygonization pass to keep shared boundaries exact with `F08`; `F07` unchanged.
  - Verified no overlaps among `F02/F03/F04/F08` and exact shared boundary lengths:
    - `F08-F02 = 21.272651`
    - `F08-F03 = 14.776791`
    - `F08-F04 = 25.795588`
- Follow-up correction (user review):
  - Merged `F03`, `F05`, and `F06` into `F03` by concatenating their exact SVG-derived paths.
  - Merged `F07` and `F08` into `F07` by concatenating their exact SVG-derived paths.
  - East area set now exports 5 ids: `F01`, `F02`, `F03`, `F04`, `F07`.
- Follow-up correction (user review, 2026-02-19):
  - Re-extracted `F01..F06` from `east.svg` using curved segment face extraction (segment intersections + endpoint/near snapping; no raster borders).
  - Updated only `F01..F06` paths in `EAST_ISLAND_AREAS` in `boardGeometry.ts`; retained other east ids unchanged.
  - Validation outputs written:
    - `games/indonesia-ui/src/lib/images/east_faces_f01_f06_overlay.svg`
    - `games/indonesia-ui/src/lib/images/east_faces_f01_f06_report.txt`
  - `F01..F06` are single closed paths (`... Z`) after rewrite.

## East Group Boundary Notes (2026-02-18)

- File touched: `games/indonesia-ui/src/lib/definitions/boardGeometry.ts`.
- Source asset: `games/indonesia-ui/src/lib/images/eastgroups.svg`.
- `eastgroups.svg` contains 5 closed path regions (`<path class="d" ... Z/>`).
- Used the same east transform already documented for `east.svg`:
  - `x' = 2064.85019 + 1.00051299*x`
  - `y' = 507.42964 + 1.00288529*y`
- Added these ids to `EAST_ISLAND_AREAS`:
  - Upper group paths: `F08`, `F09`
  - Lower group paths: `C37`, `C38`, `C39`
- Path assignment used vertical grouping because the source has 5 total regions:
  - top-left -> `F08`
  - top-right -> `F09`
  - bottom-left -> `C37`
  - bottom-middle -> `C38`
  - bottom-right -> `C39`
- Follow-up correction (user review):
  - Initial eastgroups placement was too far east.
  - Reprojected eastgroups with moderated horizontal transform while preserving SVG path geometry:
    - `x' = 1820.0 + 1.1*x`
    - `y' = 507.42964 + 1.00288529*y`
  - Updated only `F08`, `F09`, `C37`, `C38`, `C39` paths in `EAST_ISLAND_AREAS`.
  - Added tuning utility: `games/indonesia-ui/scripts/tune-eastgroups.mjs`
    (`npm run tune:eastgroups -- ...`) for non-compounding `dx/dy/sx/sy` iteration.

## West Group Boundary Notes (2026-02-18)

- File touched: `games/indonesia-ui/src/lib/definitions/boardGeometry.ts`.
- Source asset: `games/indonesia-ui/src/lib/images/westgroup.svg`.
- `westgroup.svg` has 4 closed paths; mapped as:
  - west-top -> `A05` (replace)
  - west-bottom -> `A09` (replace)
  - third-west -> `A27` (replace)
  - lower-right Sulawesi group -> `D13` (new)
- Alignment method:
  - Solved affine from source path bbox centers to existing area centers (`A05`, `A09`, `A27`):
    - `x' = 1.1303837221*x + 0.1027917365*y + 134.33880688`
    - `y' = -0.0317215147*x + 1.2717379443*y + 327.48466469`
  - Applied transform directly to SVG vector commands (`M/C/S/Z`) with no raster-derived borders.
- Added tuning utility: `games/indonesia-ui/scripts/tune-westgroup.mjs`
  (`npm run tune:westgroup -- ...`) for non-compounding `dx/dy/sx/sy` iteration.
- Follow-up correction (user review):
  - Replaced westgroup geometry using an axis-aligned transform only (no rotation/shear) from `westgroup.svg`:
    - `x' = 183.71714688 + 0.99108695*x`
    - `y' = 389.98676940 + 0.91202500*y`
  - Updated `A05`, `A09`, `A27`, `D13` from those transformed SVG paths.
  - Synced `games/indonesia-ui/scripts/tune-westgroup.mjs` `BASE_PATHS` to those same transformed paths so identity transform is a no-op.

## Geometry Cleanup Notes (2026-02-18)

- Removed temporary tuning/smoothed artifacts:
  - deleted `games/indonesia-ui/src/lib/definitions/boardGeometrySmoothed.ts`
  - deleted `games/indonesia-ui/scripts/tune-eastgroups.mjs`
  - deleted `games/indonesia-ui/scripts/tune-westgroup.mjs`
  - `Board.svelte` now uses `TOP_CENTER_ISLAND_AREAS` directly from `boardGeometry.ts`.
- Reduced Borneo stair-step density with topology-preserving coverage simplification:
  - target set: `TOP_CENTER_ISLAND_AREAS` (`B01..B20`) in `boardGeometry.ts`
  - method: Shapely `coverage_simplify(tolerance=1.6)` on polygonized `M/L/Z` paths
  - shared borders remain exact (simplified as a coverage, not per-area independently)
  - spot metric: `B07` point count `269 -> 79`
  - full B set point total `4020 -> 1416`

## Borneo Face-Derivation Notes (2026-02-18)

- Preferred strategy (keeps original curved SVG geometry; no rasterization, no polygonize-from-pixels):
  - Start from `games/indonesia-ui/src/lib/images/borneo.svg` path segments (`Line/CubicBezier/QuadraticBezier`).
  - Split each segment at **exact vector intersections** (`segment.intersect`), then add path-endpoint-to-segment snaps only for near-miss joins (`<=1.2px`) to close trace gaps.
  - Build a half-edge planar graph from split curve pieces and extract faces by left-turn face-walk.
  - Transform extracted faces into board-space using fitted affine from svg->board.
  - Dedupe duplicate extracted faces by polygon IoU threshold (`~0.985`) before area matching.
  - Match extracted faces to legacy B-area IDs using labeled polygonized geometry bounding boxes (bbox IoU + centroid distance cost), then apply explicit merge overrides (e.g. offshore face merges).
- Debug artifacts for iterative visual validation:
  - `games/indonesia-ui/src/lib/images/borneo_split_network_on_map.svg`
  - `games/indonesia-ui/src/lib/images/borneo_faces_dedup_candidates_on_map.svg`
  - `games/indonesia-ui/src/lib/images/borneo_faces_bboxmatch_assignment_on_map.svg`
- Re-extraction after user improved SVG intersections:
  - source: updated `games/indonesia-ui/src/lib/images/borneo.svg` (`segments=382`).
  - fast near-intersection pass (in addition to exact intersects + endpoint snaps):
    - endpoint snaps: `33`
    - near segment intersections added: `3`
    - extracted: `raw_faces=27`, `valid_faces=27`, `reps=23`.
  - Raw mapping (no manual merge overrides) now assigns all `B01..B20` with high IoU:
    - output overlay: `games/indonesia-ui/src/lib/images/borneo_faces_raw20_Blabels_on_map.svg`
    - report: `games/indonesia-ui/src/lib/images/borneo_faces_raw20_report.txt`
    - mapped B count: `20`, extra offshore reps: `3` (`Z01..Z03`).
  - Applied final merge request and wrote into `boardGeometry.ts`:
    - `Z01 -> B14`
    - `Z02 -> B18`
    - `Z03 -> B19`
  - `TOP_CENTER_ISLAND_AREAS` now has canonical ids `B01..B20` (removed prior drift to `B21`).

## Leftmost A-Island Rebuild Notes (2026-02-18)

- File touched: `games/indonesia-ui/src/lib/definitions/boardGeometry.ts`.
- Source asset: `games/indonesia-ui/src/lib/images/leftmost.svg`.
- User constraint applied: preserve these ids exactly (no remap):
  - `A05`, `A09`, `A26`.
- Rebuild strategy reused from Borneo curved-face pipeline:
  - exact segment intersections + endpoint-to-segment snaps (`<=1.2px`) + near-intersection splits (`<=1.0px`);
  - half-edge left-turn face extraction from split `Line/CubicBezier/QuadraticBezier` pieces;
  - assign extracted faces to existing A ids via centroid+bbox Hungarian matching;
  - write assigned curved paths directly to `LEFTMOST_ISLAND_AREAS` (no raster polygonization).
- Fitted `leftmost.svg -> board` transform from current non-excluded A geometry:
  - `sx=0.6213481953818331`
  - `sy=0.6184308572123266`
  - `theta=0.0019375411642092001`
  - `tx=624.6990214285714`
  - `ty=819.7210642857142`
- Extraction stats:
  - `segments=409`
  - `raw_faces=46`
  - `kept_faces=36`
  - `required_ids=31`
  - `assigned_ids=31`
  - `extra_faces=5` (left unassigned)
- Validation checks after write:
  - `LEFTMOST_ISLAND_AREAS` still contains `34` ids (`A01..A34`);
  - all A paths contain closed `M...Z` subpaths;
  - `A05`, `A09`, `A26` text paths unchanged byte-for-byte.
- Debug artifacts:
  - `games/indonesia-ui/src/lib/images/leftmost_faces_overlay.svg`
  - `games/indonesia-ui/src/lib/images/leftmost_faces_report.txt`

## Southleft C-Island Rebuild Notes (2026-02-18)

- File touched: `games/indonesia-ui/src/lib/definitions/boardGeometry.ts`.
- Source asset: `games/indonesia-ui/src/lib/images/southleft.svg`.
- Scope mapped: `SOUTHLEFT_ISLAND_AREAS` (`C01..C17`) only.
  - `C18..C20` remain in `EASTCENTRAL_ISLAND_AREAS`.
  - `C21..C30` remain in `SOUTHCHAIN_ISLAND_AREAS`.
- Rebuild strategy reused from curved-face pipeline:
  - exact segment intersections + endpoint-to-segment snaps (`<=1.2px`) + near-intersection splits (`<=1.0px`);
  - half-edge left-turn face extraction from split `Line/CubicBezier` pieces;
  - id matching via centroid+bbox assignment.
- Fitted `southleft.svg -> board` transform:
  - `sx=0.6220171465483866`
  - `sy=0.6193728426065913`
  - `theta=0.00017424542064194132`
  - `tx=641.5100030742444`
  - `ty=840.2366926131396`
- Extraction stats:
  - `segments=183`
  - `raw_faces=17`
  - `kept_faces=16`
  - required ids in block: `17`
- Mapping outcome:
  - Since traced linework yields `16` faces for `17` ids, one id was reused without synthetic borders:
    - `C14` reuses the same extracted face as `C13`.
  - No extra small faces were attached.
- 10-point transformed-edge spot check (source->nearest rebuilt edge):
  - mean distance `~0.241px`, max `~1.368px`.
- Debug artifacts:
  - `games/indonesia-ui/src/lib/images/southleft_faces_overlay.svg`
  - `games/indonesia-ui/src/lib/images/southleft_faces_report.txt`

- Follow-up correction after user updated `southleft.svg`:
  - Updated source hash: `3756c18fa89189c135d792f47efdb6564bfd1e2f4ea7ebea38c99fa66e431ba1`.
  - New extraction stats:
    - `raw_faces=18`
    - `kept_faces=17`
    - `required_ids=17`
  - Mapping now has **no reused ids**:
    - `mode=faces>=ids`
    - `reused_ids=none`
  - `C13` and `C14` are now distinct faces from svg-derived borders.

## Southchain C-Island Rebuild Notes (2026-02-19)

- File touched: `games/indonesia-ui/src/lib/definitions/boardGeometry.ts`.
- Source asset: `games/indonesia-ui/src/lib/images/southchain.svg`.
- Scope mapped: `SOUTHCHAIN_ISLAND_AREAS` (`C21..C30`).
- Rebuild strategy reused from curved-face pipeline:
  - exact segment intersections + endpoint-to-segment snaps (`<=1.2px`) + near-intersection splits (`<=1.0px`);
  - half-edge left-turn face extraction from split `Line/CubicBezier` pieces;
  - id matching via centroid+bbox Hungarian assignment to existing `C21..C30`.
- Fitted `southchain.svg -> board` transform:
  - `sx=0.6240090841190586`
  - `sy=0.6177109230037416`
  - `theta=-0.0003893034194068072`
  - `tx=1172.9789753676425`
  - `ty=947.6164872710327`
- Extraction stats:
  - `segments=290`
  - `raw_faces=33`
  - `kept_faces=20`
  - `required_ids=10`
  - `reused_ids=none`
  - `extra_attached=8` (small closed offshore faces attached to nearest matching ids, no synthetic edges).
- Output now uses curved SVG-derived paths (`C/Q/L` commands) instead of quantized stair-step-only paths.
- Debug artifacts:
  - `games/indonesia-ui/src/lib/images/southchain_faces_overlay.svg`
  - `games/indonesia-ui/src/lib/images/southchain_faces_report.txt`

## Eastcentral D-Island Rebuild Notes (2026-02-19)

- File touched: `games/indonesia-ui/src/lib/definitions/boardGeometry.ts`.
- Source asset: `games/indonesia-ui/src/lib/images/eastcentral.svg`.
- Fitted transform used for this pass:
  - `sx=0.6271517614144182`
  - `sy=0.6248094853512414`
  - `theta=-0.00282582638234442`
  - `tx=1406.073564569347`
  - `ty=380.0671752979634`
- Initial extraction produced only `11` unique valid faces in-region for `D01..D12` and incorrectly overwrote `D13`.
- User clarification:
  - `D13` is a separate ellipsoid-group area and should be preserved/restored.
- Follow-up re-extraction (after user request for `D04`, `D07`, `D08`) using improved node clustering:
  - `raw_faces=14`
  - `kept_faces=13`
  - `required_ids=13`
  - `reused_ids=none`
- Current state:
  - `D01..D12` are svg-derived curved paths from `eastcentral.svg` (including `D04`, `D07`, `D08`).
  - `D13` is restored/preserved from `HEAD` (ellipsoid-group area, not replaced by extracted face).
  - All `D01..D13` paths are closed (`... Z`).

## Northeast E/Z Face Labeling Notes (2026-02-19)

- Source asset used: `games/indonesia-ui/src/lib/images/northeast.svg`.
- Goal of this pass: label extracted vector faces as existing `E01..E11` (bbox-matched), and label remaining unmatched/offshore faces as `Z01+` for manual merge decisions.
- Output artifacts:
  - `games/indonesia-ui/src/lib/images/northeast_faces_bboxmatch_overlay.svg`
  - `games/indonesia-ui/src/lib/images/northeast_faces_bboxmatch_report.txt`
- Extraction/matching approach:
  - exact segment intersections + endpoint-to-segment snapping + near-intersection splitting;
  - half-edge left-turn face extraction from split segments;
  - base svg->board transform from prior NE recovery plus fitted affine correction from candidate-face centers to current E-area centers;
  - bbox/centroid Hungarian assignment for `E01..E11`, with remaining faces labeled `Z01+`.
- Follow-up user-directed labeling corrections applied in report/overlay generation:
  - merge relabels:
    - `Z01`, `Z03` -> `E06`
    - `Z02`, `Z05` -> `E09`
    - `Z04`, `Z07` -> `E04`
  - ambiguity set (`E10`,`E02`,`E03`,`Z06`,`Z08`) resolved with size heuristic:
    - keep two smallest faces as `Z06` and `Z08`
    - assign remaining three to `E02`,`E03`,`E10` by nearest target centroids.
  - current unresolved offshore labels after merge relabels: `Z06`, `Z08`.
- Follow-up extraction correction (same session):
  - Raised northeast face node-cluster tolerance to `1.2` and removed one composite container face (`F16`) that was covering child offshores.
  - Top ambiguous cluster now resolves as 3 large faces (`E02`,`E03`,`E10`) + 3 tiny offshores (`Z07`,`Z08`,`Z09`).
  - Applied merge into production geometry: `Z07`, `Z08`, `Z09` merged into `E03` by adding those three closed SVG-derived subpaths to `E03` (`E04_MERGED_PATH`) in `boardGeometry.ts`.
- Finalization pass:
  - Replaced the entire `NORTHEAST_ISLAND_AREAS` block with face-extracted curved paths from `northeast_faces_bboxmatch_overlay.svg`.
  - Final merged mapping written to `boardGeometry.ts`:
    - `E01=F09`, `E02=F05`, `E03=F00+F17+F18+F19`, `E04=F10+F14+F16`,
    - `E05=F08`, `E06=F07+F11+F13`, `E07=F02`, `E08=F01`,
    - `E09=F04+F12+F15`, `E10=F03`, `E11=F06`.
- Alignment correction after user review:
  - Removed the extra fitted affine from northeast face placement; kept only the base northeast svg->board transform.
  - Rewrote `NORTHEAST_ISLAND_AREAS` again from the base-transform extraction output.
  - Debug overlay for this pass: `games/indonesia-ui/src/lib/images/northeast_faces_base_overlay.svg`.
- Added tuning utility for iterative manual alignment:
  - `games/indonesia-ui/scripts/tune-northeast.mjs`
  - Usage: `npm run tune:northeast -- --sx <...> --sy <...> --dx <...> --dy <...> [--ox <...> --oy <...>] [--apply]`
  - Output preview (no apply): `games/indonesia-ui/src/lib/images/northeast_tuned_preview.svg`
  - Output snippet (no apply): `games/indonesia-ui/src/lib/images/northeast_tuned_paths.txt`

## Sea Area Extraction Plan (2026-02-19)

- User objective:
  - define sea regions as closed vector faces bounded by:
    - board inner frame edge,
    - thick light-blue sea-divider lines,
    - coastal edges from existing land areas.
  - no stair-step raster-style boundaries in final output; use smooth line/curve paths.
- Inputs confirmed:
  - board image: `games/indonesia-ui/src/lib/images/indo_map_sm.jpg` (`2646x1280`).
  - blue-line appearance reference: `games/indonesia-ui/src/lib/images/sealines.png` (`232x124`).
- Current status:
  - repository has no existing sea-area geometry block yet.
  - first extraction pass started; `cv2` is currently missing in the temp python env (`/tmp/east-extract-env`), so next run must install/use OpenCV in a temp env before edge/line fitting.
- Planned implementation steps:
  1. sample color/width from `sealines.png` to derive robust sea-line mask thresholds for `indo_map_sm.jpg`.
  2. detect the board inner frame rectangle (the single inner black border) and fit it as one rectangular vector path.
  3. detect sea-divider strokes and vectorize as smooth centerline paths:
     - skeletonize mask,
     - preserve junction graph,
     - fit each branch with cubic Bezier/poly-B-spline simplification (not quantized stair-steps).
  4. derive coastline edge network from `boardGeometry.ts` land polygons (outer coastal edges only; exclude internal land borders).
  5. combine networks (frame + sea dividers + coastline edges), split at intersections, and run half-edge face extraction to produce closed sea faces.
  6. export debug overlays:
     - extracted frame + sea-lines overlay on map,
     - numbered sea-face overlay for review/merge instructions.
  7. after review, write final `Sxx` sea areas to geometry definitions and render in board debug layer.
- Validation checklist for acceptance:
  - each sea area path is closed (`... Z`) and non-self-intersecting.
  - neighboring sea areas share the exact same border segment references (no gaps/overlaps).
  - board-edge-connected sea areas use exact frame segments.
  - boundaries visually align to printed blue dividers and coastlines at multiple spot checks.

### Sea Line Progress (2026-02-19, continued)

- Added extraction utility:
  - `games/indonesia-ui/scripts/extract-sea-lines.py`
  - purpose: detect inner board frame + light-blue sea divider centerlines and export smooth vector candidates.
- Runtime dependencies used in temp env:
  - `opencv-python-headless`, `scikit-image`, `scipy` (already present), `numpy`.
- Detection details:
  - board inner frame currently detected at:
    - `x_left=30.0`, `y_top=30.0`, `x_right=2616.0`, `y_bottom=1250.0`
  - blue divider mask threshold in HSV (from `sealines.png` profile, widened for board variance):
    - `H:[82..106], S:[22..100], V:[118..224]`
  - mask cleanup:
    - open 3x3, close 3x3
    - connected components filtered by min area.
- Outputs generated:
  - granular branch extraction (default):
    - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved.svg`
    - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_paths.txt`
    - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_debug.png`
    - includes `BOARD_EDGE` + `27` `SEA_LINE_xx` curve paths (cubic-smoothed centerline branches).
  - major-only variant (longer branches):
    - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_major.svg`
    - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_major_paths.txt`
    - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_major_debug.png`
    - includes `BOARD_EDGE` + `19` `SEA_LINE_xx` paths.
- Notes for next step:
  - Use these as candidate sea-divider path networks.
  - Proceed to combine with coastlines from land geometry and perform face extraction for sea areas (`Sxx`) with labeled overlay for user-driven merge/cleanup.

### Sea Line Progress (2026-02-19, v3 corrections)

- User review identified:
  - board edge should be the innermost thin rectangular frame with right-angle corners.
  - missing/under-extended segments in the v2 network.
- Applied corrected v3 network outputs (vector paths only, no rasterized final geometry):
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v3_paths.txt`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v3_labeled.svg`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v3_labeled.png`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v3_labeled_dark.png`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v3_labeled_report.txt`
- v3 adjustments made:
  - board edge forced to strict inner rectangle:
    - `M 63 68 L 2581 68 L 2581 1213 L 63 1213 Z`
  - `SEA_LINE_04` extended to top board edge (beyond `SEA_LINE_02` junction).
  - `SEA_LINE_30` extended through the `P31`/`P28` region to the `D09/D10` coastal junction.
  - `SEA_LINE_34` extended beyond `SEA_LINE_35` junction to `F05` coastline.
  - added missing connectors:
    - `SEA_LINE_37` between `A34` and `C01`
    - `SEA_LINE_38` between `C17` and `C21`
- v3 labeled set currently contains `38` sea paths (`P01..P38` in report order).

### Sea Line Progress (2026-02-19, pure re-extraction after v3 rejection)

- User explicitly rejected synthetic/manual segment augmentation.
- Reworked `games/indonesia-ui/scripts/extract-sea-lines.py` to stay extraction-only:
  - replaced branch walker with full skeleton-graph edge tracing:
    - traces all maximal chains between key nodes (`deg != 2`) and residual loops/components;
    - keeps short detected segments (no synthetic extension).
  - added stable path-length helper and reduced over-smoothing to avoid path bloat artifacts.
  - added labeled export outputs directly from one run:
    - `--out-labeled-svg`, `--out-labeled-png`, `--out-labeled-dark-png`, `--out-report`, `--out-mask`.
  - added tunable morphology params:
    - `--morph-kernel`, `--open-iters`, `--close-iters`.
- Local runtime env used for this pass:
  - `/tmp/seaenv` venv with `opencv-python-headless`, `scipy`, `scikit-image`.
- New pure outputs generated:
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v4_*`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v4b_*`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v4c_*`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v5_*`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v5b_*`
- Current best pure-labeled set for review:
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v5_labeled.png`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v5_labeled_dark.png`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v5_labeled_report.txt`
  - board frame remains `M 63 68 L 2581 68 L 2581 1213 L 63 1213 Z`.
- Key extraction result notes (pure, no hand-drawn extensions):
  - recovered short top continuation near prior `P04/P02` junction (`P03` in v5).
  - recovered short connector near `C17/C21` vicinity (`P22` in v5).
  - recovered extension toward `F05` coastline (`P43` in v5).
  - still no confidently connected extracted segment at the user-mentioned `A34/C01` location from current blue-mask evidence.

### Sea Line Merge Set (2026-02-19, v6)

- Built merged set as requested: baseline pre-last-6 (`v2`) + six appended segments from latest (`v5`), with no synthetic geometry.
- Outputs:
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v6_paths.txt`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v6_labeled.svg`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v6_labeled.png`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v6_labeled_dark.png`
  - `games/indonesia-ui/src/lib/images/sea_lines_boardedge_curved_v6_labeled_report.txt`
- Appended source mapping:
  - `v5 P03 -> v6 P37`
  - `v5 P07 -> v6 P38`
  - `v5 P22 -> v6 P39`
  - `v5 P32 -> v6 P40`
  - `v5 P34 -> v6 P41`
  - `v5 P43 -> v6 P42`

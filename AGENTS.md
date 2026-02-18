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

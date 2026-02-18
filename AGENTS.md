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

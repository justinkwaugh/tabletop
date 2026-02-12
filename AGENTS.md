# Bus UI Animation Cleanup Backlog

1. Make animator timeline scheduling explicit (`position: 0` + explicit offsets) in all animators to avoid cross-animator drift.
2. Fix score-disc animation transform conflict (`animate:flip` mixed with inline SVG `transform`) in `BoardMetaMarkers`.
3. Remove imperative hover-reset side effects from `$effect` in `BusLineLayer`; keep state derivation pure.
4. Deduplicate worker-cylinder placement derivation shared by `BoardActionRows` and `workerCylinderAnimator`.
5. Deduplicate bus-color-to-table-column mapping shared by `BoardMetaMarkers` and `busPiecePlacementAnimator`.
6. Tighten animator attachment teardown by clearing element refs in `attachAnimator` destroy path.

# Map rendering (M1)

`createMapDrawing` combines a `RailwayMap`, optional tile set/inventory, and optional
presentation layouts. It uses Common hex geometry and the shared tile renderer.
It preserves original location facts while resolving the current tile and rotation.
The result provides map bounds, current drawings, and stable location identities.

`MapScene` renders that drawing with optional appearance, selection, station tokens,
and route segments. `MapInspector` displays the selected location, track or stop,
revenues, construction facts, home reservations, and persistent annotations.
`onselect` emits a `MapSelection`: hex ID, path ID, node ID, or node ID plus slot.
These components do not create Actions or depend on a Game Session.

Tokens identify a location, node, and slot. Routes identify explicit local paths.
The renderer rejects unknown targets and multiply occupied slots. Callers resolve
legal station placement, route continuity, active home reservations, and upgrade
migration before supplying a live position. M1's example position is prepared data.

## Viewport composition

The development app wraps `MapScene` in the existing frontend `ScalingWrapper`.
The wrapper owns fit, wheel/touch navigation, zoom controls, full screen, and
`focusRect`. Map artwork, tokens, routes, and transparent SVG hit targets occupy
one transformed content element. Native SVG hit testing preserves model identity
through the wrapper transform; there is no second pan/zoom implementation.

Drawing coordinates use a hex diameter of 100. `MapScene.hexDiameter` sets the
natural rendered size; the app uses 180 so zoom can expose readable detail within
the scaling helper's existing fit-to-natural-size range. For `focusRect`, obtain
`mapSelectionPoint(scene, selection)`, subtract the drawing bounds origin, and
multiply by `hexDiameter / 100` to get wrapper-content coordinates. Scale the
focus rectangle dimensions by the same factor. Viewport changes never modify
hex coordinates, tile rotation, inventory, or game history.

The app supplies Tailwind generation for the wrapper's existing utility classes.
A consuming Game Client should use its normal frontend style pipeline.

## Annotation layout

Map names, construction costs, and persistent markings are drawn separately from
the tile. Only named locations receive a name label; coordinates remain in
inspection and accessible names. Long names are abbreviated on the map and remain
complete in inspection.
Zero revenue is suppressed on the map; nonzero and staged revenues remain visible,
and inspection always exposes the full values. Ordinary tile viewers retain zero
revenue by default through `TileArtwork.showZeroRevenue`.

`TileLayout.annotationExclusions` reserves points for surrounding map annotations
when placing tile revenues and labels. These points use rendered local coordinates
and stay upright as track rotates. Explicit layout hints can still provide exact
placements. Unknown terrain-kind IDs render as text rather than receiving an
unrelated terrain symbol. Covered initial terrain disappears from the drawing but
remains inspectable; face-owned upgrade costs belong to the current tile.

See the [family model/design review](../18xx/maps.md) for supported variation,
intentional limits, and rule evidence, and the
[visual contract](ui-interaction-visual-contract.md#map-inspection-and-navigation)
for input precedence and state lifetime. The title composition is available at
`/maps` in the [standalone viewer app](../../apps/18xx-tile-viewer/README.md).

# Published board alignment preview

The table can display the supplied MAP-AUGUST-01 artwork beneath its semantic map.
The packaged JPEG is 2048 × 1322 pixels. The updated island artwork is the viewport's natural size. Fit and zoom
scale that viewport; no raster enlargement or second image is generated.

The shared presentation seam accepts an image, native dimensions, a map-origin
position in image pixels, and a uniform scale from Common's map geometry. Tile
placements, hit targets, routes, selections and focus rectangles retain canonical
location identities. The title owns the asset and alignment. The existing
MapDrawing, TileArtwork, map-selection geometry, MapViewDefinition and
ScalingWrapper supply the reusable mechanisms; no game rules change.

Research consulted: the full-catalog variation index and the domain study's
rules-configuration and map/track variations in
`research/18xx-2026-09-08`. Relevant counterexamples include 1825's combined map
units, 1888's alternate maps/editions, 1822 regional subsets, and 18FL's destructive
map events. A title name alone cannot select matching artwork, and an immutable
background cannot represent every changing printed feature. This slice supports
one fixed TOP board only. 1889 retains its generic presentation. Multiple boards,
alternate editions and mutable printed features require
explicit title presentation data before those cases are supported.

Initial alignment uses a map origin at (55.5, 105.5) pixels and scale 1.173. The
diagnostic grid is hidden in artwork mode. Island hexes align closely. The user
confirmed that the physical board intentionally rearranges offboards: no tiles
are laid on them and their game meaning is unchanged, so those differences do not
require tile alignment. Some printed city centers differ from the generic node
layout and remain calibration gaps. The file's rules-edition equivalence has not
been established by its filename; this is an alignment preview, not a claim of
complete published-edition fidelity. The existing market and phase panels display current game facts; the updated
image omits the old printed reference tables.

Verification covers natural image dimensions, unbuilt hex transparency, placed
tiles, pointer selection, draft retention when toggling, History View and Undo,
and desktop/mobile overflow. Generic map fit, focus, pan, zoom, slot/path selection
and the existing tile-picker scaling checks remain regression coverage. Native-size
browser inspection checks the grid against the supplied image.

The host bridge and game runtime are unchanged. TOP needs a UI-only publication
to distribute this asset and presentation. Existing host and UI artifacts remain
compatible; other titles need no publication to retain their current behavior.

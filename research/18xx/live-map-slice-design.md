# Live map and inventory integration

## Family evidence

This slice reviews the full 131-title research corpus, including the domain study's
map/construction, station/access, and route/revenue sections. Relevant indexed
assignments cover upgrade preservation (135 across 128 profiles), tile supply
(179/128), destructive map changes (135/128), station placement (331/128), station
blocking (277/128), network types (151/128), and route revenue modifiers (416/128).
Missing profile coverage remains an evidence gap, not an absent mechanism.

The review includes finite, unlimited, conditional, and paired-face supplies;
ordinary and replacement stations; city, whole-tile and future-capacity
reservations; untokenable revenue cities; track destruction; gauge and lane
variation; and phase/train-dependent revenue. Named counterexamples include
1858's multiple future reservations on a one-slot city, 1849's gauge distinctions,
1822/1846 unlimited standard track, TOP's shipyard, and 1889's Diesel offboards.
The family study and existing tile/map evidence notes retain primary provenance.
No research implementation is copied into this codebase.

For TOP, the supplied prototype §§7.7, 9, and 12–13 establish station exchanges,
map restrictions, and routing distinctions. For 1889, the supplied rulebook §§4,
7.4, 8.5.3, and 16 establishes map geography, home timing, and offboard/port values.
Existing title definitions remain the map and tile sources in this repository.
The tests compare geographic edges, named special locations, topology and capacity
against the existing title evidence, including the map work already verified in M1.

## Models and runtime

`TileInventory` now belongs to the serialized example state. Its placement records
retain physical piece ID, definition ID, location and rotation; printed tiles remain
in the immutable map. `TileSet.createInventory` optionally seeds actual placed
pieces by taking available inventory in manifest order. It rejects exhaustion and
duplicate locations. Paired faces continue to refer to one physical piece, and
changing a face cannot manufacture supply.

The title-owned prepared positions contain one ordinary yellow city tile: TOP K19,
rotation 0, and 1889 I2, rotation 2. These are prepared inspection positions, not a
claim that these are the complete initial maps or that construction has been
validated. Other financial/station facts remain as in the preceding slices.

`MapStateData` names the serialized tile inventory and station data.
`RailwayMapState` combines a map, tile set and inventory into the current tile
faces/rotations. Both runtime validation and rendering use that resolution. It
checks mapped placement locations and station slots. Reservations require a city
but do not consume or require a currently free slot: TOP reservations coexist with
PEIR stations, and future-capacity reservations must remain representable.
Company ownership/duplicate-station validation remains in the existing models.

The map state's edge connections require tracks meeting on both sides of an
adjacent hex boundary after rotation. An impassable border prevents that edge
connection. This is physical track adjacency, not route or company construction
legality. Independent crossing paths retain their identities; adjacency does not
merge them. Gauge/lane compatibility, token blocking, paths through cities,
construction allowances, and company access follow in their operating slices.

The example runtime now receives a named options object containing its title-owned
map, tile set, and existing rule policies. Neither shared package imports a game.
Hydration verifies that live stations and reservations address the current map,
not just that their strings and numbers match a schema.

Supply counts describe the manifested physical stock used by these prepared
positions. TOP's existing prototype manifest retains 12 #7 and 25 #8 pieces;
the user's possible unlimited-supply distinction remains an edition/rules question
for construction availability. These counts do not declare that exhaustion is a
legal restriction in every title. Implementing unlimited construction requires
explicit supply policy and deterministic extra-piece identity; it is not simulated
by duplicating a finite physical piece.

## Rendering and inspection

MapScene and MapInspector accept explicit current reservations. Omitted reservation
inputs still show printed home annotations in the standalone catalog map; passing
an empty array suppresses them. Live sessions always pass their authoritative
reservation list. Stations come from placed Station records, with title-owned
label/color presentation; available and removed stations do not become overlays.
A reservation can be inspected while a PEIR station occupies that city.

`MapViewer` composes the existing scene and inspector with Common ScalingWrapper,
fit and focus. Both the standalone map viewer and game sessions use that module.
Track, station positions, outlines and hit targets share the same geometry.
Coordinates stay in inspection/accessibility labels; only names appear on hexes.
Appearance changes do not alter track topology or game state.

The Game Session derives the drawing, overlays and supply counts from its exposed
visible state, including history. Inspection is presentation state; it is hidden
during visible-state publication and checked against the displayed drawing.
Viewport changes and appearance changes preserve inspection. Each hotseat player's
map style is held separately in the session; it is not a game Action or serialized
rule state. Reload starts presentation preferences afresh.

The surrounding FinanceMap panel is a disposable desktop prototype. It adds Common
history navigation and the existing TileLibraryViewer, without introducing a
separate gameplay history, animation system, pan/zoom helper, or tile-placement
Action. History and Undo exercise actual TOP flotation: the PEIR station becomes
the successor station and its reservation disappears, then reverses correctly.
1889 flotation keeps its home reservation until the later operating step.

Physical-board presentation remains deferred because artwork is unavailable. This
slice adds no pretend physical mode and no mobile-specific prototype requirements.
The semantic position and overlay inputs remain independent of presentation.

## Verification

Tests exercise both title inventories/maps, serialized placements, valid city
slots, invalid/missing locations, one-sided track ends, rotation, and physical
piece conservation. Engine tests verify station replacement, reservation removal,
replay and Undo in the same live map model. Desktop browser checks inspect the
placed tiles and counts, stage and commit flotation, traverse history, restore live
view, undo, and reload. Presentation changes must leave action history unchanged.

Validation completed: 191 focused logic/integration tests and 11 desktop browser
checks passed. Shared/title package builds and shared UI/harness Svelte checks
passed. Visual inspection covered enlarged Alberton with PEIR and A reservation,
and Marugame's placed tile with its SR reservation. The surrounding finance UI
remains disposable; no mobile refinement was required for this slice.

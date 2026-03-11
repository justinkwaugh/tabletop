# Indonesia UI Hover Rendering Notes

Companion document:
- `docs/ui-interaction-visual-contract.md` is now the canonical cross-interaction contract for highlight, dimming, overlay, and emphasis behavior.
- This file remains useful for route-preview-specific notes and board layer ordering.

This note documents the intended ownership and precedence of hover/highlight/dim behavior on the Indonesia board.

It exists because multiple visual mechanisms look similar but are not interchangeable:
- full-board spotlight dim
- action-area masking
- route preview emphasis
- city bead highlight
- city demand darkening
- production-zone marker masking
- ship spotlighting

Using the wrong mechanism can easily make the board unreadable.

## Board Layer Order

`src/lib/components/Board.svelte` renders layers in this order:

1. `BoardDeedsLayer`
2. `BoardShippingRouteOverlayLayer`
3. `BoardCultivatedAreasLayer`
4. `BoardShipsLayer`
5. `BoardProductionZoneMarkersLayer`
6. `BoardActionAreasLayer`
7. `BoardCitiesLayer`
8. `BoardTurnOrderLayer`
9. `BoardResearchLayer`

Implications:
- route paths are drawn below cultivated areas, ships, markers, and city beads
- area masks and outlines sit above ships and cultivated areas
- city bead/highlight rendering can visually recover emphasis even if earlier layers stay dimmed

## Mechanism Ownership

### `BoardActionAreasLayer.svelte`

Owns:
- interactive area hit targets
- action outlines
- invalid-area masking during explicit action states
- company/deed hover spotlight mask

Must not own:
- route-preview-only dimming of the whole board

Rule:
- the full-board spotlight mask is for company/deed hover only
- route preview may add carve-out exemptions if a company/deed spotlight is already active
- route preview must not turn on the global spotlight mask by itself

### `BoardShippingRouteOverlayLayer.svelte`

Owns:
- hovered route path geometry
- route waypoint selection

Must not own:
- board dimming
- city bead highlighting

### `BoardShipsLayer.svelte`

Owns:
- ship visibility and ship spotlighting

Rule:
- when a hovered delivery route exists, show only the ships relevant to that route
- this ship filter takes precedence over normal company-hover ship spotlighting

### `BoardCitiesLayer.svelte`

Owns:
- city bead highlight rings
- city demand tag darkening/highlighting

Rule:
- route preview may highlight the destination city bead and destination city demand tag
- route preview must not undarken every city demand tag

### `BoardCultivatedAreasLayer.svelte`

Owns:
- cultivated area fill/hatch rendering

Rule:
- if route preview needs source-area emphasis without full-board dimming, that should be handled by cultivated-area-specific opacity/highlight logic, not by the global board spotlight mask

### `BoardProductionZoneMarkersLayer.svelte`

Owns:
- company zone tag masking/highlighting

Rule:
- route preview may dim unrelated production-zone tags while keeping the source zone bright
- this is separate from company-hover zone masking

## Route Preview States

The same route-preview emphasis rules apply while hovering a delivery route in any of these states:

1. choosing a production zone
2. choosing a destination city
3. choosing shipping
4. choosing an expansion area

Intended visual result while hovering a route:
- keep the route source area bright
- keep the route destination city area bright
- highlight the destination city bead
- allow the destination city demand tag to remain visible
- dim unrelated ships
- optionally dim unrelated cultivated areas / zone tags
- do not apply a full-board dim

When hover ends:
- revert to the normal visuals for the current interaction state
- do not leave route-preview-specific masking/highlighting behind

## Precedence Rules

From strongest to weakest:

1. Explicit action-state validity masks
   - examples: valid expansion areas, valid delivery city targets
2. Route preview emphasis
   - source area, destination city, route ships, route path
3. Company/deed spotlight
   - broad hover spotlight behavior
4. Baseline board rendering

Important constraint:
- route preview is narrower than company/deed spotlight
- route preview should refine local emphasis, not replace the whole board with a spotlight mask

## Anti-Pattern

Do not reuse the company/deed full-board spotlight mask for delivery-route preview.

Why:
- it dims the entire board
- it makes route paths harder to read
- it couples city/source exemptions to the wrong render system
- it breaks independently-owned behaviors like city demand darkening

## Implementation Guideline

When adding or changing hover behavior:

1. Decide which layer owns the visual change.
2. Prefer local dim/highlight in that layer over global board masking.
3. If multiple layers react to the same hover state, document the intended precedence in this file.
4. If a new hover state needs both local emphasis and broad spotlight behavior, treat them as separate mechanisms and wire them independently.

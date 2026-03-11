# Indonesia UI Interaction Visual Contract

This document records the current highlight, dimming, overlay, and emphasis system for the Indonesia UI.

Purpose:
- make the current behavior explicit before refactoring it
- separate visual intent from the components that currently implement it
- identify the couplings that have been causing regressions
- give future work a regression checklist before touching shared visual state

Status:
- Interactive visual system status: `Established`
- Refactor status: `Document-first; current implementation still has known shared-state coupling`
- Last updated for interaction change: `2026-03-11`

## 1. Visual Intents

| Intent | Trigger | What should be emphasized | What should be dimmed | What must remain unaffected |
| --- | --- | --- | --- | --- |
| `company_card_hover_spotlight` | hover a company card in player state | owned production areas or shipping seas, ships, production zone markers, demand/city context as applicable | most non-relevant board visuals | the hovered card itself |
| `shipping_deed_hover_preview` | hover an available shipping deed | seas in that deed's region, hovered deed card | rest of board via spotlight mask | the hovered deed card |
| `production_deed_hover_preview` | hover an available production deed | valid cultivatable land in that deed's region, hovered deed card | rest of board via spotlight mask | the hovered deed card |
| `start_company_selection` | click a deed in acquisitions, then choose an area | selected deed region, valid start areas, selected deed card | board via spotlight-style treatment, but not generic invalid-area masking for shipping | the selected deed card |
| `shipping_expand_selection` | operate shipping company and choose expansion sea | valid sea areas, operating company ships | board via expansion spotlight mask | non-operating ships should not become spotlight drivers |
| `production_expand_selection` | operate production company and choose expansion land | valid land areas | invalid land areas and/or board via expansion spotlight | seas and unrelated ship styling |
| `place_city_selection` | place a new city in new era | valid coastal empty land areas | rest of board via city placement spotlight | unrelated hover previews when they are suppressed by rule |
| `grow_city_selection` | grow a city in city growth | valid cities | invalid land areas | unrelated seas |
| `delivery_zone_selection` | choose a cultivated source zone during delivery | valid source zones and matching marker hit targets | invalid land areas, non-selectable zone tags | unrelated ships unless route preview is active |
| `delivery_city_selection` | choose a destination city during delivery | valid city beads and hovered city bead | generally no full-board dim; city-specific emphasis only | unrelated deed/card spotlight state |
| `delivery_route_preview` | hover a delivery route or shipping choice | route path, route ships, source area, destination city bead/tag | unrelated ships, unrelated land areas, unrelated zone tags | full-board spotlight mask must not be introduced by route preview alone |
| `city_reference_card_preview` | hover future city card `B` or `C` on board | valid future city regions, hovered city reference card | rest of board via spotlight mask | the hovered city reference card; competing hover spotlights should yield |
| `operated_company_unavailable` | company has already operated during operations phase | muted company card, masked production zone marker | only that company's card/marker representation | hover spotlight capability, ships |

Notes:
- shipping interactions and production interactions are visually different on purpose
- sea highlighting uses a blue overlay fill; land highlighting usually uses dual outline
- route preview is intentionally narrower than company/deed spotlight

## 2. Visual Primitives

### Primitive: board spotlight mask
- Visual: full-board darkening with carve-outs for exempt areas and exempt card rectangles
- Current owner: `BoardActionAreasLayer.svelte`
- Reads: spotlight exempt area ids, deed-card mask rect, city-reference-card mask rect
- Must not decide: ship emphasis, marker masking, card hover state

### Primitive: expansion spotlight mask
- Visual: dark board with valid expansion areas punched out
- Current owner: `BoardActionAreasLayer.svelte`
- Reads: `interactiveValidAreaIds` during expand interactions
- Must not decide: ship emphasis or deed/card chrome

### Primitive: invalid-area dimming
- Visual: fill-based darkening of invalid land areas
- Current owner: `BoardActionAreasLayer.svelte`
- Reads: `maskedAreaIds` from `activeAreaInteraction`
- Must not decide: sea overlays, ship emphasis, company spotlight

### Primitive: sea overlay fill
- Visual: translucent blue fill on active sea regions
- Current owner: `BoardActionAreasLayer.svelte` and `BoardDeedsLayer.svelte`
- Reads: hovered shipping deed sea ids or shipping expansion valid sea ids
- Must not decide: which ships are emphasized

### Primitive: dual outline
- Visual: pale outer stroke plus dark inner stroke
- Current owner: `BoardActionAreasLayer.svelte`, `BoardCitiesLayer.svelte`
- Reads: highlighted land area ids, selectable/hovered city beads
- Must not decide: board dimming or ship emphasis

### Primitive: piece emphasis
- Visual: larger outlined ship markers, highlighted production zone markers, hovered city bead ring
- Current owner: piece-specific layers
- Reads: dedicated spotlight inputs for ships/markers/cities
- Must not decide: board masks

### Primitive: marker masking
- Visual: dark translucent mask over production zone marker tag
- Current owner: `BoardProductionZoneMarkersLayer.svelte`
- Reads: company hover state, route preview state, delivery selection state, operated company ids
- Must not decide: cultivated area fills, deed spotlight

### Primitive: card exemption cutout
- Visual: card stays bright while board spotlight dims around it
- Current owner: `BoardActionAreasLayer.svelte`
- Reads: deed card rect or city reference card rect
- Must not decide: whether the card is selected

### Primitive: card unavailable muting
- Visual: reduced saturation/brightness on compact company card
- Current owner: `PlayerCompanyCompactCard.svelte`
- Reads: `unavailable`
- Must not decide: board spotlight or hover ownership

### Primitive: route-local dimming
- Visual: dim unrelated land/cities/ships during route preview without enabling full-board spotlight
- Current owner: split between `BoardCitiesLayer.svelte`, `BoardShipsLayer.svelte`, `BoardProductionZoneMarkersLayer.svelte`, and `BoardActionAreasLayer.svelte`
- Reads: `hoveredRoutePreview`
- Must not decide: company spotlight

### Primitive: city-layer mirror dimming
- Visual: dim city beads and demand markers in spotlight modes that darken the rest of the board, because `BoardCitiesLayer` renders above the board spotlight mask
- Current owner: `BoardCitiesLayer.svelte`
- Reads: city-card-preview precedence and other city-layer highlight states
- Must not decide: which board areas are spotlighted

## 3. Layer Responsibilities

Current board layer stack from `Board.svelte`:
1. `BoardCityReferenceCardLayer`
2. `BoardDeedsLayer`
3. `BoardShippingRouteOverlayLayer`
4. `BoardCultivatedAreasLayer`
5. `BoardShipsLayer`
6. `BoardProductionZoneMarkersLayer`
7. `BoardActionAreasLayer`
8. `BoardCitiesLayer`
9. `BoardTurnOrderLayer`
10. `BoardResearchLayer`

| Layer | Owns | Allowed Inputs | Must Not Own |
| --- | --- | --- | --- |
| `BoardActionAreasLayer` | board masks, area overlays, area outlines, area hit targets, deed/city-card cutout masks | active area interaction, hovered deed/card ids, route preview area ids, spotlight area ids | ship emphasis logic, marker muting logic, card component styling |
| `BoardShipsLayer` | ship rendering and ship emphasis | `highlightedShipCompanyIds`, route preview ship filter | board masks, sea overlay ownership |
| `BoardProductionZoneMarkersLayer` | production zone marker rendering, marker highlight, marker masking | company spotlight ids, route preview source areas, delivery selection state, operated company ids | board masks, deed overlays, ship emphasis |
| `BoardDeedsLayer` | deed cards and deed-region preview overlays | available deeds, hovered available deed id, company spotlight ids for deed dimming | board-wide spotlight ownership |
| `BoardCultivatedAreasLayer` | cultivated area fill and hatch rendering | board company occupancy, render style, hatch assignment | any hover/selection dimming policy |
| `BoardCitiesLayer` | city beads, city demand tags, city-specific highlight/darken rules, mirror dimming for spotlight modes above the board mask | delivery city selection, route preview city, company spotlight presence, city-card-preview precedence | board spotlight mask ownership, route path rendering |
| `BoardCityReferenceCardLayer` | future city reference card rendering and hover target | player city cards, current era, hovered board city card setter | board dimming, area outlines |
| `PlayerState` | player-panel company hover targets | owned companies, operated company ids | board spotlight rendering |
| `PlayerCompanyCompactCard` | compact card visuals and unavailable mute | card data, `unavailable` | hover ownership, hatch-on-card policy |

## 4. Shared State Contracts

### `activeCompanySpotlightCompanyIds`
- Meaning: companies that should drive board-wide company spotlight behavior
- Producer: `IndonesiaGameSession`
- Consumers: `BoardActionAreasLayer`, `BoardProductionZoneMarkersLayer`, `BoardCitiesLayer`, `BoardDeedsLayer`
- Permitted uses:
  - production/shipping area spotlight exemptions
  - ship emphasis for hovered shipping companies
  - production zone marker filtering/masking
  - demand tag darkening during company hover
- Forbidden uses:
  - local-only ship emphasis for a temporary operation state that should not trigger board spotlight
  - generic "anything highlighted" behavior
- Risk note: this is currently the most overloaded shared state in the system

### `highlightedShipCompanyIds`
- Meaning: shipping companies whose ship pieces should render emphasized
- Producer: `IndonesiaGameSession`
- Consumers: `BoardShipsLayer`
- Permitted uses:
  - shipping company hover ship emphasis
  - operating shipping company emphasis during sea expansion
- Forbidden uses:
  - board dimming
  - sea overlay ownership
  - production marker masking
- Refactor note: this was split out so ship emphasis no longer has to be inferred from `activeCompanySpotlightCompanyIds`

### `hoveredAvailableDeedId`
- Meaning: currently hovered available deed, or selected deed while start-company is staged
- Producer: `IndonesiaGameSession` plus `BoardActionAreasLayer` start-company staging
- Consumers: `BoardDeedsLayer`, `BoardActionAreasLayer`
- Permitted uses:
  - deed-region preview overlays
  - deed card cutout mask
  - start-company selected deed spotlight source
- Forbidden uses:
  - unrelated company hover behavior

### `hoveredPlayerCityReferenceCard`
- Meaning: currently hovered on-board future city card
- Producer: `IndonesiaGameSession`
- Consumers: `BoardCityReferenceCardLayer`, `BoardActionAreasLayer`
- Permitted uses:
  - city-reference-card spotlight areas
  - city-reference-card cutout mask
- Forbidden uses:
  - suppression of live action interactions except where explicitly documented in coexistence rules

### `cityReferenceCardPreviewWins`
- Meaning: semantic precedence flag for whether city-card preview should suppress competing highlight systems
- Producer: `IndonesiaGameSession`
- Consumers: `BoardActionAreasLayer`, `BoardShipsLayer`, `BoardProductionZoneMarkersLayer`, `BoardCitiesLayer`, `BoardDeedsLayer`
- Permitted uses:
  - disabling competing hover spotlight systems while city-card preview is active
  - documenting interaction precedence in code with one named contract
- Forbidden uses:
  - deciding the city-card preview regions themselves
  - replacing the hovered-card payload

### `activeAreaInteraction`
- Meaning: current explicit board-area action mode
- Producer: `BoardActionAreasLayer`
- Consumers: `BoardActionAreasLayer`
- Permitted uses:
  - valid area hit targets
  - invalid-area masking
  - expansion and city placement masks
- Forbidden uses:
  - ship emphasis in other layers
  - marker/card styling decisions outside action layer
- Risk note: local ownership is good, but the downstream visual consequences still interact with global spotlight state

### `hoveredRoutePreview`
- Meaning: currently hovered delivery route preview context
- Producer: `IndonesiaGameSession`
- Consumers: `BoardShipsLayer`, `BoardCitiesLayer`, `BoardProductionZoneMarkersLayer`, `BoardActionAreasLayer`, route layer
- Permitted uses:
  - route-local ship filtering
  - destination city emphasis
  - source area / destination area exemptions
  - route-local dimming
- Forbidden uses:
  - turning on full-board spotlight by itself

### `operatedCompanyIds`
- Meaning: companies already operated in the current operations phase
- Producer: game state
- Consumers: `PlayerState`, `PlayerCompanyCompactCard`, `BoardProductionZoneMarkersLayer`
- Permitted uses:
  - compact card mute
  - production zone marker unavailable mask
- Forbidden uses:
  - ship masking
  - disabling hover spotlight

### `productionZoneRenderStyle`
- Meaning: whether cultivated areas are colored by goods or by player
- Producer: `IndonesiaGameSession`
- Consumers: `BoardCultivatedAreasLayer`
- Permitted uses:
  - cultivated area fill and base-pattern styling
- Forbidden uses:
  - hatch conflict assignment ownership
  - company card styling

## 5. Forbidden Couplings

- Do not reuse `activeCompanySpotlightCompanyIds` to drive local ship emphasis for shipping expansion.
- Do not reuse ship emphasis state to turn on board dimming.
- Do not let `BoardShipsLayer` become a producer of board spotlight state.
- Do not let city-reference-card preview suppress a real in-progress action interaction unless the conflict rule explicitly says it wins.
- Do not treat sea overlay visibility as interchangeable with sea exemption from the mask.
- Do not treat "selected deed" as merely "hovered deed that persists"; selected-state visuals and hover preview are separate concepts.
- Do not let operated/unavailable state disable hover spotlight unless product behavior explicitly requires it.
- Do not use goods/player cultivated render style to decide per-player conflict hatch assignment.
- Do not add a second dimming system on top of an existing spotlight unless the visual contract explicitly calls for stacked dimming.

## 6. Interaction Matrix

| Intent A | Intent B | Can coexist? | Winner / combination rule |
| --- | --- | --- | --- |
| `company_card_hover_spotlight` | `shipping_expand_selection` | no | shipping expansion keeps ship emphasis local; company spotlight must not suppress sea expansion overlays |
| `company_card_hover_spotlight` | `production_expand_selection` | no | explicit expansion selection wins |
| `shipping_deed_hover_preview` | `start_company_selection` | yes | selected deed becomes spotlight source; unrelated deed hover must not clear selection spotlight |
| `city_reference_card_preview` | `shipping_expand_selection` | yes | city-card preview wins visually while hovered |
| `city_reference_card_preview` | `start_company_selection` | yes | city-card preview wins visually while hovered |
| `city_reference_card_preview` | `company_card_hover_spotlight` | no | city-card preview wins |
| `city_reference_card_preview` | `shipping_deed_hover_preview` | no | city-card preview wins |
| `city_reference_card_preview` | `production_deed_hover_preview` | no | city-card preview wins |
| `city_reference_card_preview` | `delivery_route_preview` | yes | city-card preview wins visually while hovered |
| `delivery_route_preview` | `company_card_hover_spotlight` | yes | route preview narrows local emphasis; it must not create or remove full-board spotlight on its own |
| `delivery_route_preview` | `delivery_city_selection` | yes | route preview may emphasize the destination city while city selection remains active |
| `operated_company_unavailable` | `company_card_hover_spotlight` | yes | unavailable visuals stay, but hover spotlight still works |
| `operated_company_unavailable` | `shipping_expand_selection` | yes | operated state affects cards/production markers only; ships remain visible and unmasked |

## 7. Regression Checklist

Before finalizing any highlight/dimming change, verify:
- hovering a production company card still spotlights cultivated areas and production zone markers
- hovering a shipping company card still spotlights ships and shipping seas
- the hovered company card itself stays undimmed
- hovering a production deed still uses dual outline on valid land areas and dims the board
- hovering a shipping deed still uses blue sea overlay fill and dims the board
- clicking a deed for start-company keeps the selected deed region spotlight active while choosing an area
- hovering another deed while a start-company deed is selected does not clear the selected deed spotlight
- shipping expansion still shows blue sea overlays, not land-style outlines
- shipping expansion still highlights the operating company's ships without turning on company spotlight dimming
- production expansion still uses land-style highlighting only
- city placement spotlight still works independently of city reference card preview
- hovering a city reference card still dims the board, highlights valid future city regions, and leaves the hovered card bright
- while a city reference card is hovered, competing company/deed/route/selection highlights do not visually override it
- while a city reference card is hovered, city demand markers and beads dim through `BoardCitiesLayer` instead of staying full-bright above the board mask
- route preview still highlights route ships/source/destination without turning on full-board spotlight
- operated company cards remain muted during operations
- operated production zone markers remain masked during operations
- ship markers are never masked just because a company already operated
- hover on muted company cards still works

## 8. Change Rules

When touching Indonesia UI interactive visuals:
1. identify the intent row being changed in this document
2. identify the primitive or primitives involved
3. check whether the change widens `activeCompanySpotlightCompanyIds`, `highlightedShipCompanyIds`, `cityReferenceCardPreviewWins`, `hoveredAvailableDeedId`, or `hoveredRoutePreview`
4. decide whether the change belongs in `BoardActionAreasLayer` or a narrower piece-specific layer
5. update this document in the same change if the interaction behavior or precedence changes

## 9. Minimal Naming Guidance

Prefer:
- `boardSpotlightAreaIds`
- `shippingExpansionHighlightedShipCompanyIds`
- `hoveredShippingDeedSeaAreaIds`
- `selectedStartCompanyDeedId`
- `hoveredCityReferenceCardMaskRect`

Avoid:
- `activeHighlightIds`
- `spotlightCompanyIds` for local-only behavior
- `hoveredThing`
- `temporarySelection`

Naming note:
- if a piece-specific behavior does not intend to drive board dimming, its name should not include `spotlight`

## 10. Known Refactor Targets

These are the highest-risk couplings to separate in later work:

1. Narrow ship route-preview filtering separately from company spotlight.
   Current smell: ship emphasis is now split, but route-preview ship filtering still lives partly in `BoardShipsLayer`.

2. Split sea overlay visibility from mask exemption.
   Current smell: sea areas can be exempted from dimming without getting the intended blue overlay.

3. Split route-preview-local dimming from board spotlight assumptions.
   Current smell: several layers react to `hoveredRoutePreview`, but the coordination is only partially documented in code.

4. Narrow start-company selected deed state.
   Current smell: selected deed and hovered deed currently share part of the same spotlight source path.

5. Move toward explicit interaction-mode naming.
   Current smell: broad shared state names hide whether the effect is board-wide or piece-local.

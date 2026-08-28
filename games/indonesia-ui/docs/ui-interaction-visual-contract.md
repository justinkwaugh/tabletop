# Indonesia UI Interaction Visual Contract

This contract records Indonesia’s cross-layer interaction behavior, precedence, transient-state lifecycle, and non-obvious rendering boundaries. Use the repository [visual-contract authoring guide](../../../docs/ui-interaction-visual-contract.md) when changing it.

## Visual intents

| Intent | Trigger | Observable result | Remains unaffected |
| --- | --- | --- | --- |
| `company_card_preview` | Hover an owned company card | Production areas and zone markers, or shipping seas and ships, are emphasized while unrelated board content dims | The hovered card remains bright |
| `shipping_deed_preview` | Hover an available shipping deed | The deed’s seas receive blue overlay fill and the rest of the board dims | The hovered deed remains bright |
| `production_deed_preview` | Hover an available production deed | Valid land receives the land-outline treatment and the rest of the board dims | The hovered deed remains bright |
| `start_company_selection` | Select a deed during acquisitions | The selected deed and its legal starting areas remain emphasized while the staged selection is active | Hovering another deed does not clear the selection |
| `shipping_expansion_selection` | Expand the operating shipping company | Legal seas receive blue overlay fill and the operating ships are emphasized | Other ships do not become spotlight drivers |
| `production_expansion_selection` | Expand the operating production company | Legal land receives the land-selection treatment | Seas and ship styling remain unchanged |
| `city_placement_selection` | Place a city in a new era | Legal coastal empty land is emphasized and the rest of the board dims | Unrelated hover state does not change legality |
| `city_growth_selection` | Grow a city | Legal city beads are emphasized and invalid land is de-emphasized | Unrelated seas remain unchanged |
| `delivery_source_selection` | Choose a cultivated source zone | Legal source zones and their marker hit targets are emphasized | Ships remain unchanged until route preview is active |
| `delivery_city_selection` | Choose a delivery destination | Legal city beads and the hovered city are emphasized without a full-board spotlight | Deed and company preview state remains independent |
| `delivery_route_preview` | Hover a route or shipping choice | Route path, route ships, source, and destination are emphasized; unrelated route-local pieces dim | Route preview alone does not enable full-board spotlight |
| `city_reference_card_preview` | Hover the currently relevant city reference card | Legal future-city regions are emphasized, the board dims, and the card remains bright | Competing previews remain staged but do not render over it |
| `operated_company_unavailable` | A company has operated this phase | Its compact card and production-zone marker are muted | Hover preview remains available; ships are not muted by operated status |
| `research_player_preview` | Hover a turn-order player outside active research selection | That player’s current research cells are emphasized | No research choice is staged |
| `research_player_selection` | Select the research recipient during Research and Development | That player’s legal next research cells are emphasized | The selection changes only the staged research choice |

Hover previews are transient enhancements. Start-company, delivery, research, expansion, and city choices use explicit selection hit targets and remain usable without a hover preview.

## Coexistence and precedence

| Intents | Contract |
| --- | --- |
| City-reference-card preview with any company, deed, route, or area-selection visual | The city-reference-card preview wins visually while hovered; staged selections remain intact and resume afterward |
| Delivery-route preview with company preview | Route-local emphasis wins and suppresses company spotlight until hover ends; route preview does not create a full-board spotlight |
| Delivery-route preview with delivery-city selection | Both coexist; the route destination receives route emphasis while city selection remains active |
| Hovered deed with selected start-company deed | The hovered deed previews temporarily; when hover ends, the selected deed resumes without changing staged selection |
| Company preview with shipping or production expansion | The explicit expansion visual wins and company hover must not change legal targets |
| Operated-company unavailable with company preview | Both coexist; unavailable chrome remains while hover preview still works |
| Research-player preview with research-player selection | They are mutually exclusive by phase behavior; active research selection uses next-cell highlights instead of hover preview |

Acquisitions, shipping operations, production operations, city placement/growth, and research selections are mutually exclusive by machine state. Deed previews can overlap only with the acquisitions selection they accompany.

The session owns precedence and exposes normalized semantic results. Render layers consume those results rather than resolving conflicts from raw hover and selection values.

## Shared visual state

### Board preview intent

`activeBoardPreviewIntent` is the single board-preview precedence result. City-reference-card preview precedes deed preview, which precedes company preview. History View suppresses every source. Delivery-route preview suppresses company-derived board spotlight and is itself suppressed by city-reference-card preview; its route-local precedence remains a separate semantic result.

It is derived by the session, remains valid only while its referenced card, deed, or company exists in the visible state, and returns to `none` when its source becomes invalid or the interaction is cleared.

### Deed preview and start-company selection

Hover and staged selection remain distinct. `activeDeedPreviewId` chooses the hovered available deed first and otherwise the selected start-company deed. The selected deed persists until `Back`, action completion, or state reset; hover exit only removes the temporary override. Selection is valid only during the acquisitions flow while the deed remains available.

### Ship visual state

`activeShipVisualState` is the only source of ship emphasis precedence. It represents route-local emphasis, company emphasis, or none. Shipping expansion may emphasize the operating company without turning that company into a board-wide spotlight source.

### Route preview state

`activeRoutePreviewVisualState` normalizes the route, shipping company, sea areas, source areas, destination, exemptions, and route-local dimming sets once in the session. The route layers and piece layers consume the relevant slices without rebuilding route precedence.

Route preview lasts only while the route or shipping choice remains hovered and valid for the current delivery state. City-reference-card preview and History View suppress it.

### Staged selections

Start-company deed, delivery, and research selections are Action Draft state. `Back` removes the latest manual selection; `Undo` reaches committed action history once no manual draft entry remains. Auto delivery selections do not consume Undo. State publication resets action-local visual overrides through the session lifecycle.

### History behavior

History View is read-only and suppresses board previews, selection affordances, route previews, and research highlights through `suppressBoardEffectsForHistory`. Backward/forward navigation and silent restoration render the displayed historical state without carrying live hover or draft visuals across the state boundary.

## Render ownership

| Effect | Owner and boundary |
| --- | --- |
| Board masks, area outlines, area hit targets, and card cutouts | `BoardActionAreasLayer`; it consumes normalized preview and action-area inputs and does not own ship, marker, or card styling |
| Shipping-expansion sea fill | `BoardShippingExpansionSeaHighlightLayer`; it renders legal expansion seas without becoming a general sea-preview owner |
| Deed cards and deed-region visuals | `BoardDeedsLayer`; board-wide mask response and cutouts remain with `BoardActionAreasLayer` |
| Ship emphasis | `BoardShipsLayer`; it consumes `activeShipVisualState` and does not produce board spotlight state |
| Production-zone marker emphasis and muting | `BoardProductionZoneMarkersLayer`; marker styling remains independent from board masks and ship emphasis |
| Delivery route path | `BoardShippingRouteOverlayLayer`; route-local piece and area responses remain with their owning layers |
| City beads and demand markers | `BoardCitiesLayer`; it mirrors required dimming because it renders above the board mask, but it does not choose board-preview precedence |
| Research cross-highlight | `BoardTurnOrderLayer` supplies the hovered/selected player interaction and `BoardResearchLayer` owns research-cell rendering |

Mask exemption and visible highlighting are separate decisions. Sea exemption does not imply blue fill, and piece emphasis does not imply board dimming.

## Verification scenarios

The current verification method is manual visual exercise unless a focused automated test is added. For a change, exercise every affected row and its relevant precedence rows.

| Scenario | Expected while active | Expected on exit or replacement |
| --- | --- | --- |
| Hover production and shipping company cards | Each company type emphasizes only its corresponding board areas and pieces; the card stays bright | Board and pieces return to their prior action-selection state |
| Hover production and shipping deeds | Land uses outlines; sea uses blue fill; hovered deed stays bright | A selected start-company deed resumes, otherwise preview clears |
| Select a start-company deed, then hover another deed | Hover temporarily previews the other deed without changing the selection | Selected deed preview returns when hover ends; `Back` clears it |
| Enter shipping expansion | Legal seas and operating ships are emphasized without company-hover dimming | Overlay clears when the action stage exits or another higher-priority preview applies |
| Enter production expansion, city placement, and city growth | Each mode shows only its legal target treatment | Targets clear when the mode exits or visible state changes |
| Select delivery source and destination | Source zones, marker targets, and eligible cities follow the current stage | `Back` removes the latest manual stage; auto-only stages do not intercept Undo |
| Hover a delivery route | Route path, ships, source, and destination emphasize without full-board spotlight | Route-local dimming and emphasis clear on hover exit |
| Hover the city reference card during another interaction | City-card regions and card win visually; city beads and demand markers dim consistently above the mask | The underlying staged interaction resumes unchanged |
| Inspect an operated company | Card and production marker remain muted; hover preview still works; ships remain unmuted | Unavailable styling follows operated state, not hover lifetime |
| Hover and select a research player | Hover shows current cells outside selection; selection shows legal next cells during research | Hover clears on exit; `Back` clears a manual recipient selection |
| Enter History View and navigate backward/forward | Live previews, hit targets, and draft visuals are suppressed; displayed historical state remains stable | Returning to Live View exposes only visual state valid for the live context |

## Maintenance

Update this contract when an intent, precedence rule, shared-state lifecycle, history behavior, or ownership boundary changes. Read current code for the layer stack and symbol inventory. Remove obsolete behavior rather than preserving dated status notes, and track future refactors in issues rather than here.

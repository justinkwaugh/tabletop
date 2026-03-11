# UI Interaction Visual Contract

Use this document as a required starting point for any new game UI that has board highlights, dimming, overlays, hover previews, selection styling, or piece emphasis.

Purpose:
- separate visual intent from implementation details
- keep layer responsibilities narrow
- prevent one highlight/dimming change from breaking another interaction
- give future work a regression checklist before editing shared visual state

This file is a template. Copy its structure into the new game's docs and fill it in before adding complex interactive board visuals.

## 1. Visual Intents

List each user-visible interaction mode as a distinct intent. Do not define these in terms of component names or booleans.

Example table:

| Intent | Trigger | What should be emphasized | What should be dimmed | What must remain unaffected |
| --- | --- | --- | --- | --- |
| company_spotlight | hover company card | owned regions, company pieces | rest of board | hovered card itself |
| shipping_expand_selection | choose sea expansion area | valid sea areas, operating ships | invalid or non-relevant board areas | non-operating ships style rules |
| deed_region_preview | hover deed | deed region | rest of board | hovered deed card |
| city_card_preview | hover future city card | valid future city regions | rest of board | hovered future city card |

Rules:
- each intent should describe product behavior, not implementation
- if two intents differ in visible result, they must be separate rows
- if one intent has different land vs sea behavior, write that explicitly

## 2. Visual Primitives

Define the primitive effects that can be combined to create the interaction modes.

Suggested primitives:
- board spotlight mask
- invalid-area dimming
- land overlay fill
- sea overlay fill
- dual outline
- piece emphasis
- card exemption cutout
- card selected chrome
- disabled/muted state

For each primitive, answer:
- what it is visually
- which layer owns it
- which inputs it reads
- which things it must never decide

Example:

### Primitive: piece emphasis
- Owner: piece-specific layer such as `BoardShipsLayer`
- Reads: `highlightedShipCompanyIds`
- Must not decide: board dimming, area overlays, card exemption

## 3. Layer Responsibilities

Every interactive render layer should have a narrow contract.

Recommended table:

| Layer | Owns | Allowed Inputs | Must Not Own |
| --- | --- | --- | --- |
| `BoardActionAreasLayer` | board masks, area overlays, area outlines | spotlight area ids, valid area ids, exempt card rects | ship emphasis, marker styling |
| `BoardShipsLayer` | ship marker rendering, ship emphasis | highlighted ship company ids, route-specific ship filters | board masks, area dimming |
| `BoardDeedsLayer` | deed card visuals | hovered deed id, selected deed id | board area overlays |

Rules:
- if a layer “must not own” something, do not infer it indirectly through shared state
- if two layers need the same input, define a dedicated shared semantic input for it

## 4. Shared State Contracts

List every shared derived state used by more than one visual layer.

For each shared state, document:
- semantic meaning
- producer
- consumers
- permitted uses
- forbidden uses

Example:

### `boardSpotlightAreaIds`
- Meaning: areas exempted from board-level dimming
- Producer: interaction view-model / session derivation
- Consumers: `BoardActionAreasLayer`
- Permitted uses: spotlight mask, exempted outline rendering
- Forbidden uses: ship emphasis, card hover chrome, marker sizing

### `highlightedShipCompanyIds`
- Meaning: ship companies whose pieces should render emphasized
- Producer: interaction view-model / session derivation
- Consumers: `BoardShipsLayer`
- Permitted uses: ship emphasis only
- Forbidden uses: board mask, deed dimming, area overlays

Rule:
- if a shared state name sounds too broad, rename it until misuse is obvious

## 5. Forbidden Couplings

Write the bad shortcuts explicitly so future changes do not repeat them.

Default list:
- Do not reuse board spotlight state to drive piece emphasis.
- Do not reuse piece emphasis state to drive board dimming.
- Do not let one layer infer another layer's visual responsibilities.
- Do not couple mask exemption and visible overlay styling unless the contract says they are the same feature.
- Do not let a generic “hovered thing” state drive unrelated interaction systems.
- Do not add fallback highlighting behavior “just in case” without a product requirement.

Add game-specific forbidden couplings here as they are discovered.

## 6. Interaction Matrix

Document which intents may coexist and which one wins if there is a conflict.

Recommended table:

| Intent A | Intent B | Can coexist? | Winner / combination rule |
| --- | --- | --- | --- |
| company_spotlight | shipping_expand_selection | no | shipping_expand_selection |
| city_card_preview | shipping_expand_selection | no | shipping_expand_selection |
| deed_region_preview | start_company_selection | yes | selected deed takes precedence over non-selected preview |

Rule:
- do not leave coexistence implicit
- if one interaction suppresses another, write it down

## 7. Regression Checklist

Before finalizing any change that touches shared highlight/dimming state, verify every relevant row below.

Baseline checklist:
- company hover still dims the board correctly
- hovered card/piece that should stay undimmed still stays undimmed
- shipping deed hover still shows sea overlay fill correctly
- shipping expansion still shows valid sea areas correctly
- shipping expansion still emphasizes operating ships correctly
- production expansion still uses land-style highlighting only
- deed hover does not remove active selection spotlight
- city-card preview does not suppress live action overlays
- muted/unavailable pieces are still only muted where intended
- board spotlight and piece emphasis are still independently controlled

Add game-specific rows whenever a regression is found.

## 8. Change Rules

When touching interactive visuals:
1. identify which intent row is being changed
2. identify which primitives are involved
3. verify whether any shared state contract is being widened
4. update this document if a new interaction or coupling is introduced
5. run the regression checklist mentally or in tests before claiming the change is isolated

## 9. Minimal Naming Guidance

Prefer names that encode scope and responsibility.

Good:
- `boardSpotlightAreaIds`
- `highlightedShipCompanyIds`
- `cityPreviewCardMaskRect`
- `shippingExpansionValidSeaAreaIds`

Bad:
- `activeHighlightIds`
- `hoveredThing`
- `spotlightCompanyIds`
- `selectedState`

## 10. Completion Requirement

For a new game UI, this document is not complete until:
- all intended interaction modes are listed
- each interactive layer has explicit ownership boundaries
- all shared visual state has a contract
- at least one regression checklist exists

If the game does not yet have interactive visual states, keep the file with a short note saying that no such states exist yet. Do not omit the file.

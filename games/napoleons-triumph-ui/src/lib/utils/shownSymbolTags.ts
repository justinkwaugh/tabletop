import { plateOutlines, type ApproachPlate } from './approachPlates.js'
import {
    SYMBOL_TAGS,
    placeSymbolTags,
    printedMarksCovered,
    type PlacedSymbolTag
} from './approachSymbols.js'
import type { ConvexOutline } from './convexOutline.js'

export function shownSymbolTags({
    switchedOn,
    scale,
    arrows,
    plates
}: {
    switchedOn: boolean
    scale: number
    arrows: readonly ConvexOutline[]
    plates: readonly ApproachPlate[]
}): PlacedSymbolTag[] {
    const onPlates = plates.map((plate) => plate.side)
    const drawnOver = [...arrows, ...plateOutlines(plates)]
    const shown = SYMBOL_TAGS.filter(
        (tag) => !onPlates.includes(tag.key) && (switchedOn || printedMarksCovered(tag, drawnOver))
    )
    return placeSymbolTags(shown, scale, drawnOver)
}

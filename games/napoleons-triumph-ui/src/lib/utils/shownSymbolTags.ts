import { plateOutlines, type ApproachPlate } from './approachPlates.js'
import {
    SYMBOL_TAGS,
    placeSymbolTags,
    printedMarksCovered,
    type PlacedSymbolTag
} from './approachSymbols.js'
import type { ConvexOutline } from './convexOutline.js'

export interface SymbolTagsShown {
    /** The map menu's Approach symbols switch. */
    allShown: boolean
    scale: number
    arrows: readonly ConvexOutline[]
    plates: readonly ApproachPlate[]
}

/** Every side's tag while the symbols are switched on, else those whose marks an arrow covers; none for a side whose marks are on a plate. Each keeps off the arrows and the plates. */
export function shownSymbolTags({
    allShown,
    scale,
    arrows,
    plates
}: SymbolTagsShown): PlacedSymbolTag[] {
    const onPlates = plates.map((plate) => plate.side)
    const shown = SYMBOL_TAGS.filter(
        (tag) => !onPlates.includes(tag.key) && (allShown || printedMarksCovered(tag, arrows))
    )
    return placeSymbolTags(shown, scale, [...arrows, ...plateOutlines(plates)])
}

import type { BoundingBox, RectangleDimensions } from '@tabletop/common'
import { BOARD_EXTENTS, BOARD_HEIGHT, HEX_WIDTH, MAP_EXTENTS } from './boardGeometry.js'

/** The board's largest zoom. */
export const BOARD_MAX_SCALE = 2

/** A view whose whole-map fit is smaller than this rests at a cover fit instead (Phone layout). */
export const BOARD_COVER_BELOW_SCALE = 0.3

/** Contract, Phone layout: a lit hex is at least this wide on screen where the board rests. */
export const MIN_RESTING_HEX_PX = 33

/** Contract, Phone layout (U-8): the focus chooser shows while a hex is narrower than this. */
export const FOCUS_CHOOSER_BELOW_HEX_PX = 28

/** Screen pixels at the top of the view the focus chooser takes, kept clear when the board is fitted. */
export const FOCUS_CHOOSER_INSET = 40

export type BoardFocus = 'whole-map' | 'west' | 'middle' | 'east'

export const BOARD_FOCUSES: readonly { focus: BoardFocus; label: string }[] = [
    { focus: 'whole-map', label: 'Whole map' },
    { focus: 'west', label: 'West' },
    { focus: 'middle', label: 'Middle' },
    { focus: 'east', label: 'East' }
]

type Region = Exclude<BoardFocus, 'whole-map'>

const REGION_INDEX: Readonly<Record<Region, number>> = { west: 0, middle: 1, east: 2 }

/** A third of the map's width, at the board's full height. */
export function regionRect(region: Region): BoundingBox {
    const width = MAP_EXTENTS.width / 3
    return {
        x: MAP_EXTENTS.x + REGION_INDEX[region] * width,
        y: 0,
        width,
        height: BOARD_HEIGHT
    }
}

export function hexWidthOnScreen(viewScale: number): number {
    return HEX_WIDTH * viewScale
}

export function showsFocusChooser(viewScale: number): boolean {
    return hexWidthOnScreen(viewScale) < FOCUS_CHOOSER_BELOW_HEX_PX
}

function containScale(rect: RectangleDimensions, view: RectangleDimensions): number {
    return Math.min(view.width / rect.width, view.height / rect.height)
}

/** Whether the wrapper rests this view at a cover fit rather than the whole map. */
export function restsAtCover(view: RectangleDimensions): boolean {
    return containScale(BOARD_EXTENTS, view) < BOARD_COVER_BELOW_SCALE
}

/** The scale a region is shown at: the third fitted, but never smaller than a resting hex nor short of the view's height. */
export function regionScale(region: Region, view: RectangleDimensions): number {
    return Math.min(
        BOARD_MAX_SCALE,
        Math.max(
            containScale(regionRect(region), view),
            MIN_RESTING_HEX_PX / HEX_WIDTH,
            view.height / BOARD_HEIGHT
        )
    )
}

/** What the wrapper's focusRect is given for a focus: a rect, and the scale it may reach. */
export type FocusRequest = { rect: BoundingBox; maxScale: number }

export function focusRequest(focus: BoardFocus, view: RectangleDimensions): FocusRequest {
    if (focus === 'whole-map') {
        return { rect: BOARD_EXTENTS, maxScale: BOARD_MAX_SCALE }
    }
    // A one-unit rect at the region's centre, so the scale is exactly maxScale whatever the view.
    const rect = regionRect(focus)
    return {
        rect: {
            x: rect.x + rect.width / 2 - 0.5,
            y: rect.y + rect.height / 2 - 0.5,
            width: 1,
            height: 1
        },
        maxScale: regionScale(focus, view)
    }
}

/** Contract, Phone layout: where a cover-fit view rests (the middle third, hexes at least 33 px); a whole-map view keeps its fit. */
export function restingFocus(view: RectangleDimensions): BoardFocus | undefined {
    return restsAtCover(view) ? 'middle' : undefined
}

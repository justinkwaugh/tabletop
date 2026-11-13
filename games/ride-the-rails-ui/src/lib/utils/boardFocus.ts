import type { BoundingBox, Point, RectangleDimensions } from '@tabletop/common'
import type { HexId } from '@tabletop/ride-the-rails'
import {
    BOARD_EXTENTS,
    BOARD_HEIGHT,
    BOARD_WIDTH,
    HEX_WIDTH,
    MAP_EXTENTS,
    hexBox
} from './boardGeometry.js'

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

/** A box on screen, as `getBoundingClientRect` reports it. */
export type ScreenBox = { left: number; top: number; width: number; height: number }

/**
 * The part of the board a view shows, in board units: the view's box on screen below its top
 * inset, read through where the board is drawn on screen.
 */
export function shownBoardRect(board: ScreenBox, view: ScreenBox, insetTop: number): BoundingBox {
    const scale = board.width / BOARD_WIDTH
    return {
        x: (view.left - board.left) / scale,
        y: (view.top + insetTop - board.top) / scale,
        width: view.width / scale,
        height: Math.max(0, view.height - insetTop) / scale
    }
}

function containsBox(outer: BoundingBox, inner: BoundingBox): boolean {
    return (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.width <= outer.x + outer.width &&
        inner.y + inner.height <= outer.y + outer.height
    )
}

function unionBox(a: BoundingBox, b: BoundingBox): BoundingBox {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    return {
        x,
        y,
        width: Math.max(a.x + a.width, b.x + b.width) - x,
        height: Math.max(a.y + a.height, b.y + b.height) - y
    }
}

/** Board units within which two hexes count as the same distance from the view's centre. */
const SAME_DISTANCE = 1e-6

function centreOf(box: BoundingBox): Point {
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * Contract, Phone layout: where a view that shows none of the lit hexes pans to, keeping its scale.
 * The lit hexes join nearest the view's centre first (map order breaks a tie) for as long as their
 * bounding box still fits the view; the result is a box the view's size centred on theirs. None
 * when nothing is lit or a lit hex already lies whole inside the view.
 */
export function litRevealRect(
    hexIds: readonly HexId[],
    shown: BoundingBox
): BoundingBox | undefined {
    const boxes = hexIds.map(hexBox)
    if (boxes.length === 0 || boxes.some((box) => containsBox(shown, box))) return undefined
    const centre = centreOf(shown)
    const distance = (box: BoundingBox) => {
        const point = centreOf(box)
        return Math.hypot(point.x - centre.x, point.y - centre.y)
    }
    // The sort is stable, so hexes as near as each other keep their map order.
    const nearer = (a: BoundingBox, b: BoundingBox) => {
        const difference = distance(a) - distance(b)
        return Math.abs(difference) < SAME_DISTANCE ? 0 : difference
    }
    const [nearest, ...rest] = [...boxes].sort(nearer)
    let joined = nearest
    for (const box of rest) {
        const next = unionBox(joined, box)
        if (next.width <= shown.width && next.height <= shown.height) joined = next
    }
    const middle = centreOf(joined)
    return {
        x: middle.x - shown.width / 2,
        y: middle.y - shown.height / 2,
        width: shown.width,
        height: shown.height
    }
}

/**
 * Contract, Phone layout: the hexes the board last lit, and whether they are still owed a look. A
 * new, non-empty set is owed one; moving the view by hand, or taking the look, settles it.
 */
export class LitOffer {
    private key = ''
    private owed: readonly HexId[] | undefined

    /** Notes the hexes lit now; the same set again changes nothing. */
    light(hexIds: readonly HexId[]) {
        const key = hexIds.join(' ')
        if (key === this.key) return
        this.key = key
        this.owed = hexIds.length > 0 ? hexIds : undefined
    }

    /** The player moved the view: the hexes lit now stay where the player put them. */
    moveByHand() {
        this.owed = undefined
    }

    /** The lit hexes owed a look, once per set; none when nothing is owed. */
    take(): readonly HexId[] | undefined {
        const owed = this.owed
        this.owed = undefined
        return owed
    }
}

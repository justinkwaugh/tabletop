import type { BoundingBox, Point, RectangleDimensions } from '@tabletop/common'
import type { HexId, RailroadId } from '@tabletop/ride-the-rails'
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

/** The largest scale the board rests at with its whole map fitted (the wrapper's `maxFitScale`). */
export const BOARD_MAX_FIT_SCALE = 1

/** Contract, Build: the building zoom never draws a hex wider than this on screen. */
export const BUILD_ZOOM_MAX_HEX_PX = 64

/** A view whose whole-map fit is smaller than this rests at a cover fit instead (Phone layout). */
export const BOARD_COVER_BELOW_SCALE = 0.3

/**
 * Contract, Phone layout: a lit hex is at least this wide on screen where the board rests. A
 * phone's board is then taller than its view, so it pans north–south as well as east–west.
 */
export const MIN_RESTING_HEX_PX = 37

/** A third of the map's width at the board's full height, about the map's middle. */
const MIDDLE_THIRD: BoundingBox = {
    x: MAP_EXTENTS.x + MAP_EXTENTS.width / 3,
    y: 0,
    width: MAP_EXTENTS.width / 3,
    height: BOARD_HEIGHT
}

function containScale(rect: RectangleDimensions, view: RectangleDimensions): number {
    return Math.min(view.width / rect.width, view.height / rect.height)
}

/** Whether the wrapper rests this view at a cover fit rather than the whole map. */
export function restsAtCover(view: RectangleDimensions): boolean {
    return containScale(BOARD_EXTENTS, view) < BOARD_COVER_BELOW_SCALE
}

/**
 * The scale a phone rests at: the middle third fitted, but never smaller than a resting hex nor
 * short of the view's height.
 */
export function middleThirdScale(view: RectangleDimensions): number {
    return Math.min(
        BOARD_MAX_SCALE,
        Math.max(
            containScale(MIDDLE_THIRD, view),
            MIN_RESTING_HEX_PX / HEX_WIDTH,
            view.height / BOARD_HEIGHT
        )
    )
}

/** What the wrapper's focusRect is given for a focus: a rect, and the scale it may reach. */
export type FocusRequest = { rect: BoundingBox; maxScale: number }

/** A one-unit rect at a point: focused, it is shown at exactly its maxScale whatever the view. */
function unitRectAt(point: Point): BoundingBox {
    return { x: point.x - 0.5, y: point.y - 0.5, width: 1, height: 1 }
}

/** Contract, Phone layout: where a cover-fit view rests, the middle third with hexes at least 37 px. */
export function restingRequest(view: RectangleDimensions): FocusRequest {
    return { rect: unitRectAt(centreOf(MIDDLE_THIRD)), maxScale: middleThirdScale(view) }
}

/** A box on screen, as `getBoundingClientRect` reports it. */
export type ScreenBox = { left: number; top: number; width: number; height: number }

/** The part of the board a view shows, in board units, read through where the board is drawn. */
export function shownBoardRect(board: ScreenBox, view: ScreenBox): BoundingBox {
    const scale = board.width / BOARD_WIDTH
    return {
        x: (view.left - board.left) / scale,
        y: (view.top - board.top) / scale,
        width: view.width / scale,
        height: view.height / scale
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
    const middle = centreOf(joinNearest(boxes, centreOf(shown), shown))
    return {
        x: middle.x - shown.width / 2,
        y: middle.y - shown.height / 2,
        width: shown.width,
        height: shown.height
    }
}

/**
 * The box of the hexes nearest a point that fit a view's size together: they join nearest first
 * (map order breaks a tie), each only while their bounding box still fits.
 */
function joinNearest(
    boxes: readonly BoundingBox[],
    centre: Point,
    size: RectangleDimensions
): BoundingBox {
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
        if (next.width <= size.width && next.height <= size.height) joined = next
    }
    return joined
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

/** Contract, Build: the largest scale the building zoom reaches. */
export const BUILD_ZOOM_MAX_SCALE = Math.min(BOARD_MAX_SCALE, BUILD_ZOOM_MAX_HEX_PX / HEX_WIDTH)

/**
 * Contract, Build: on a view that rests on the whole map, the building zoom moves only when it
 * draws the lit hexes at least this much larger than the rest does. A smaller gain would cut the
 * board's edges for a hex a pixel or two wider, so the whole map stays instead.
 */
export const MIN_BUILD_ZOOM_GAIN = 1.1

/**
 * Contract, Build: the scale a view rests at, below which the building zoom never goes: the whole
 * map where the view fits it, and the middle third's scale where it rests at a cover fit.
 */
export function restingScale(view: RectangleDimensions): number {
    return restsAtCover(view)
        ? middleThirdScale(view)
        : Math.min(BOARD_MAX_FIT_SCALE, containScale(BOARD_EXTENTS, view))
}

function withinBoard(box: BoundingBox): BoundingBox {
    const x = Math.max(BOARD_EXTENTS.x, box.x)
    const y = Math.max(BOARD_EXTENTS.y, box.y)
    return {
        x,
        y,
        width: Math.min(BOARD_EXTENTS.x + BOARD_EXTENTS.width, box.x + box.width) - x,
        height: Math.min(BOARD_EXTENTS.y + BOARD_EXTENTS.height, box.y + box.height) - y
    }
}

/** Contract, Build: the lit hexes' box, a hex width wider on every side, kept inside the board. */
function buildZoomRect(hexIds: readonly HexId[]): BoundingBox | undefined {
    const boxes = hexIds.map(hexBox)
    if (boxes.length === 0) return undefined
    const lit = boxes.reduce(unionBox)
    return withinBoard({
        x: lit.x - HEX_WIDTH,
        y: lit.y - HEX_WIDTH,
        width: lit.width + 2 * HEX_WIDTH,
        height: lit.height + 2 * HEX_WIDTH
    })
}

/**
 * Contract, Build: how the building zoom shows a set of lit hexes in a view. `fit`: their padded
 * box, zoomed in. `whole-map`: the view rests on the whole map and the fit would gain too little
 * (MIN_BUILD_ZOOM_GAIN), so it stays there. `spread`: they lie too far apart to fit at the
 * resting scale of a cover-fit view, which keeps that scale.
 */
type BuildZoomFit = 'fit' | 'whole-map' | 'spread'

function buildZoomFit(rect: BoundingBox, view: RectangleDimensions): BuildZoomFit {
    const floor = restingScale(view)
    const scale = containScale(rect, view)
    if (restsAtCover(view)) return scale >= floor ? 'fit' : 'spread'
    return scale >= floor * MIN_BUILD_ZOOM_GAIN ? 'fit' : 'whole-map'
}

/**
 * Contract, Build: the focus that fits the lit hexes into a view, at most 64 px a hex and never
 * below the view's resting scale. A view that rests on the whole map stays on it unless the fit
 * draws a hex at least MIN_BUILD_ZOOM_GAIN times as wide. On a cover-fit view, lit hexes too far
 * apart to fit at the resting scale keep it, centred on those nearest the centre of what the view
 * shows now, as many as fit. None with nothing lit.
 */
export function buildZoomRequest(
    hexIds: readonly HexId[],
    view: RectangleDimensions,
    shown: BoundingBox
): FocusRequest | undefined {
    const rect = buildZoomRect(hexIds)
    if (!rect) return undefined
    const floor = restingScale(view)
    switch (buildZoomFit(rect, view)) {
        case 'fit':
            return { rect, maxScale: Math.max(floor, BUILD_ZOOM_MAX_SCALE) }
        case 'whole-map':
            return { rect: BOARD_EXTENTS, maxScale: floor }
        case 'spread': {
            const size = { width: view.width / floor, height: view.height / floor }
            const joined = joinNearest(hexIds.map(hexBox), centreOf(shown), size)
            return { rect: unitRectAt(centreOf(joined)), maxScale: floor }
        }
    }
}

/**
 * Contract, Build: whether a view the building zoom moved may stay for the lit hexes now: while
 * every one of them is whole inside what it shows (on the whole map, every lit hex is), or, for
 * lit hexes too far apart to fit a cover-fit view at its resting scale, every one of those nearest
 * its centre that fit it together.
 */
export function buildZoomKeepsView(
    hexIds: readonly HexId[],
    view: RectangleDimensions,
    shown: BoundingBox
): boolean {
    const rect = buildZoomRect(hexIds)
    if (!rect) return true
    const boxes = hexIds.map(hexBox)
    if (buildZoomFit(rect, view) === 'spread') {
        return containsBox(shown, joinNearest(boxes, centreOf(shown), shown))
    }
    return boxes.every((box) => containsBox(shown, box))
}

/** A lit hex of a building offer, with the railroads that may be placed there. */
export type BuildLitHex = {
    hexId: HexId
    placements: readonly { railroadId: RailroadId }[]
}

/** What the building zoom follows: the deciding seat's turn, its lit hexes and a held spotlight. */
export type BuildOffer = {
    /** Names the deciding seat's building turn, so a new turn tells from the same one; none outside one. */
    turn: string | undefined
    lit: readonly BuildLitHex[]
    /** The railroad a held spotlight names; a hover holds none. */
    held: RailroadId | undefined
}

/**
 * How the view moves: fit these hexes (first remembering the view, to return to when the building
 * turns on this screen end), fit them again only if one has left the view, or return to the
 * remembered view.
 */
export type BuildZoomMove =
    | { kind: 'fit'; hexIds: readonly HexId[]; remember: boolean }
    | { kind: 'keep-in-view'; hexIds: readonly HexId[] }
    | { kind: 'restore' }

/**
 * Contract, Build: when the deciding seat's view zooms to its building offer. A turn's first lit
 * hexes are fitted, narrowed to a held spotlight's railroad when it has lit hexes; each change of
 * held spotlight fits again; a placement's next lit hexes refit only once one has left the view.
 * Moving the view by hand lets it go until the next turn or held spotlight change. The view from
 * before the first zoom is kept across turns that follow on the same screen, through any hand
 * move, and the end of the last of them returns to it.
 */
export class BuildZoom {
    private turn: string | undefined
    private started = false
    private byHand = false
    /** Whether the view from before the first zoom of these turns is remembered, to return to. */
    private remembered = false
    private held: RailroadId | undefined
    /** The railroad the zoom narrows to; none for every lit hex. */
    private narrowedTo: RailroadId | undefined
    private litKey = ''

    /** Notes the offer now, and says how the view moves for it, if at all. */
    follow(offer: BuildOffer): BuildZoomMove | undefined {
        if (offer.turn !== this.turn) {
            this.turn = offer.turn
            this.started = false
            this.byHand = false
            this.narrowedTo = undefined
            this.litKey = ''
            // A turn that follows on the same screen keeps the view from before the first zoom.
            if (offer.turn === undefined && this.remembered) {
                this.remembered = false
                return { kind: 'restore' }
            }
        }
        if (offer.turn === undefined || offer.lit.length === 0) return undefined
        const litKey = offer.lit.map((hex) => hex.hexId).join(' ')
        if (!this.started) {
            this.started = true
            this.held = offer.held
            this.litKey = litKey
            this.narrowedTo = hasLit(offer.lit, offer.held) ? offer.held : undefined
            return this.fit(offer.lit)
        }
        if (offer.held !== this.held) {
            this.held = offer.held
            this.litKey = litKey
            const narrowTo = hasLit(offer.lit, offer.held) ? offer.held : undefined
            // Holding a railroad with nothing lit moves nothing; releasing one moves back.
            if (offer.held !== undefined && narrowTo === undefined) return undefined
            if (narrowTo === this.narrowedTo) return undefined
            this.narrowedTo = narrowTo
            this.byHand = false
            return this.fit(offer.lit)
        }
        if (litKey === this.litKey) return undefined
        this.litKey = litKey
        if (this.byHand) return undefined
        return { kind: 'keep-in-view', hexIds: this.target(offer.lit) }
    }

    /** The player moved the view: it stays there until the next turn or held spotlight change. */
    moveByHand() {
        this.byHand = true
    }

    private fit(lit: readonly BuildLitHex[]): BuildZoomMove {
        const remember = !this.remembered
        this.remembered = true
        return { kind: 'fit', hexIds: this.target(lit), remember }
    }

    /** The narrowed railroad's lit hexes, or every lit hex once it has none. */
    private target(lit: readonly BuildLitHex[]): HexId[] {
        const narrowed = this.narrowedTo
        const hexes = hasLit(lit, narrowed) ? lit.filter((hex) => litFor(hex, narrowed)) : lit
        return hexes.map((hex) => hex.hexId)
    }
}

function litFor(hex: BuildLitHex, railroadId: RailroadId | undefined): boolean {
    return hex.placements.some((placement) => placement.railroadId === railroadId)
}

function hasLit(lit: readonly BuildLitHex[], railroadId: RailroadId | undefined): boolean {
    return railroadId !== undefined && lit.some((hex) => litFor(hex, railroadId))
}

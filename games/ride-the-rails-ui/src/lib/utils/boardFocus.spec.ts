import { afterEach, describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    USA_CITIES,
    USA_HEXES,
    isEastCoastCity,
    type HexId,
    type RailroadId
} from '@tabletop/ride-the-rails'
import {
    BOARD_MAX_SCALE,
    BUILD_ZOOM_MAX_HEX_PX,
    BuildZoom,
    LitOffer,
    MIN_BUILD_ZOOM_GAIN,
    MIN_RESTING_HEX_PX,
    buildZoomKeepsView,
    buildZoomRequest,
    litRevealRect,
    middleThirdScale,
    restingRequest,
    restingScale,
    restsAtCover,
    shownBoardRect,
    type BuildLitHex,
    type FocusRequest
} from './boardFocus.js'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import { TABLE_FIXTURES, tableState } from '$lib/testing/tableFixtures.js'
import {
    BOARD_EXTENTS,
    BOARD_HEIGHT,
    BOARD_WIDTH,
    DESKTOP_BOARD_VIEW,
    HEX_WIDTH,
    MAP_EXTENTS,
    hexBox,
    hexCenter
} from './boardGeometry.js'

// A 375 × 812 phone: the game column is 90% of the width less its padding, and the board view is
// what the header, the action panel and the railroad strip leave.
const PHONE_VIEW = { width: 330, height: 493 }
// The tallest action panel on a phone (Take a share's two rows) leaves the board less.
const SHORT_PHONE_VIEW = { width: 330, height: 380 }
const DESKTOP_VIEW = DESKTOP_BOARD_VIEW

function containScale(view: { width: number; height: number }): number {
    return Math.min(view.width / BOARD_WIDTH, view.height / BOARD_HEIGHT)
}

function hexWidthOnScreen(viewScale: number): number {
    return HEX_WIDTH * viewScale
}

/** A third of the map's width (0 west, 1 middle, 2 east), at the board's full height. */
function third(index: number) {
    const width = MAP_EXTENTS.width / 3
    return { x: MAP_EXTENTS.x + index * width, y: 0, width, height: BOARD_HEIGHT }
}

describe('the phone board (contract, Phone layout)', () => {
    it('rests a phone view on the middle third rather than the whole map', () => {
        expect(restsAtCover(PHONE_VIEW)).toBe(true)
        const request = restingRequest(PHONE_VIEW)
        expect(request.maxScale).toBeCloseTo(restingScale(PHONE_VIEW))
        expect(centreOf(request.rect).x).toBeCloseTo(centreOf(third(1)).x)
        expect(centreOf(request.rect).y).toBeCloseTo(BOARD_HEIGHT / 2)
    })

    it('keeps the whole map where a desktop view fits it', () => {
        expect(restsAtCover(DESKTOP_VIEW)).toBe(false)
    })

    it('rests a 390 × 844 phone’s 280 × 566 view at 37 px a hex, panning both ways', () => {
        const view = { width: 280, height: 566 }
        const scale = restingScale(view)
        expect(hexWidthOnScreen(scale)).toBeCloseTo(37)
        // Taller than the view as well as wider, so it pans north–south as well as east–west.
        expect(BOARD_HEIGHT * scale).toBeGreaterThan(view.height)
        expect(BOARD_WIDTH * scale).toBeGreaterThan(view.width)
    })

    it('keeps the resting floor below the building zoom’s cap', () => {
        expect(MIN_RESTING_HEX_PX).toBe(37)
        expect(MIN_RESTING_HEX_PX).toBeLessThan(BUILD_ZOOM_MAX_HEX_PX)
    })

    it('draws every lit target, the whole hex, at least 37 px wide where a phone rests', () => {
        for (const view of [PHONE_VIEW, SHORT_PHONE_VIEW]) {
            const request = restingRequest(view)
            expect(hexWidthOnScreen(request.maxScale)).toBeGreaterThanOrEqual(MIN_RESTING_HEX_PX)
        }
    })

    it('would draw hexes under 12 px with the whole map fitted to a phone', () => {
        expect(hexWidthOnScreen(containScale(PHONE_VIEW))).toBeLessThan(12)
    })

    it('fills the view’s height when the middle third rests in a tall view', () => {
        const tall = { width: 375, height: 1400 }
        expect(middleThirdScale(tall) * BOARD_HEIGHT).toBeGreaterThanOrEqual(tall.height)
    })

    it('fits a third of the map when it is larger than a resting hex', () => {
        const wide = { width: 1600, height: 1200 }
        expect(middleThirdScale(wide)).toBeCloseTo(
            Math.min(wide.width / (MAP_EXTENTS.width / 3), wide.height / BOARD_HEIGHT)
        )
    })
})

describe('the part of the board a view shows', () => {
    it('reads the view through where the board is drawn', () => {
        const board = { left: -500, top: 100, width: BOARD_WIDTH / 2, height: BOARD_HEIGHT / 2 }
        const view = { left: 10, top: 120, width: 330, height: 500 }
        expect(shownBoardRect(board, view)).toEqual({
            x: 1020,
            y: 40,
            width: 660,
            height: 1000
        })
    })
})

type Box = { x: number; y: number; width: number; height: number }

function centreOf(box: Box) {
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** What a phone's view shows around a point, at a scale. */
function viewAround(centre: { x: number; y: number }, viewScale: number): Box {
    const width = PHONE_VIEW.width / viewScale
    const height = PHONE_VIEW.height / viewScale
    return { x: centre.x - width / 2, y: centre.y - height / 2, width, height }
}

function shows(view: Box, hexId: HexId): boolean {
    const box = hexBox(hexId)
    return (
        box.x >= view.x &&
        box.y >= view.y &&
        box.x + box.width <= view.x + view.width &&
        box.y + box.height <= view.y + view.height
    )
}

describe('bringing an offer lit out of view into it (contract, Phone layout)', () => {
    // The middle third where a phone rests, at its resting scale.
    const resting = viewAround(centreOf(third(1)), middleThirdScale(PHONE_VIEW))
    const eastCoast = USA_CITIES.filter(isEastCoastCity).map((city) => city.hexId)

    it('leaves the view alone with nothing lit', () => {
        expect(litRevealRect([], resting)).toBeUndefined()
    })

    it('leaves the view alone while a lit hex lies whole inside it', () => {
        const inside = USA_HEXES.map((hex) => hex.id).find((hexId) => shows(resting, hexId))
        assertExists(inside)
        expect(litRevealRect([...eastCoast, inside], resting)).toBeUndefined()
    })

    it('counts a hex the view’s edge cuts as out of view', () => {
        const box = hexBox(eastCoast[0])
        const cut = { ...resting, x: box.x + box.width / 2 - resting.width }
        expect(litRevealRect([eastCoast[0]], cut)).toBeDefined()
    })

    it('brings the East Coast into view from the middle third, keeping the view’s size', () => {
        expect(eastCoast.some((hexId) => shows(resting, hexId))).toBe(false)
        const target = litRevealRect(eastCoast, resting)
        assertExists(target)
        expect(target.width).toBeCloseTo(resting.width)
        expect(target.height).toBeCloseTo(resting.height)
        expect(eastCoast.some((hexId) => shows(target, hexId))).toBe(true)
    })

    it('centres the box of every lit hex when they all fit', () => {
        const target = litRevealRect(eastCoast, viewAround(centreOf(third(0)), 0.5))
        assertExists(target)
        const boxes = eastCoast.map(hexBox)
        const left = Math.min(...boxes.map((box) => box.x))
        const right = Math.max(...boxes.map((box) => box.x + box.width))
        const top = Math.min(...boxes.map((box) => box.y))
        const bottom = Math.max(...boxes.map((box) => box.y + box.height))
        expect(centreOf(target).x).toBeCloseTo((left + right) / 2)
        expect(centreOf(target).y).toBeCloseTo((top + bottom) / 2)
        expect(eastCoast.every((hexId) => shows(target, hexId))).toBe(true)
    })

    it('brings the hexes nearest the view’s centre when they do not all fit', () => {
        const west = USA_HEXES.map((hex) => hex.id).reduce((a, b) =>
            hexCenter(a).x < hexCenter(b).x ? a : b
        )
        const target = litRevealRect([west, ...eastCoast], resting)
        assertExists(target)
        expect(shows(target, west)).toBe(false)
        expect(eastCoast.some((hexId) => shows(target, hexId))).toBe(true)
    })

    it('breaks a tie of distance by map order', () => {
        const first = eastCoast[0]
        const last = eastCoast[eastCoast.length - 1]
        const a = hexCenter(first)
        const b = hexCenter(last)
        const { width, height } = hexBox(first)
        // A view one hex in size, halfway between two hexes: it holds one at a time.
        const between = { x: (a.x + b.x - width) / 2, y: (a.y + b.y - height) / 2, width, height }
        const firstWins = litRevealRect([first, last], between)
        const lastWins = litRevealRect([last, first], between)
        assertExists(firstWins)
        assertExists(lastWins)
        expect(centreOf(firstWins).x).toBeCloseTo(a.x)
        expect(centreOf(firstWins).y).toBeCloseTo(a.y)
        expect(centreOf(lastWins).x).toBeCloseTo(b.x)
        expect(centreOf(lastWins).y).toBeCloseTo(b.y)
    })
})

describe('the offer the board last lit', () => {
    const NEW_YORK: HexId = 'hex.usa.6-60'
    const PHILADELPHIA: HexId = 'hex.usa.7-57'

    it('owes a new set of lit hexes one look', () => {
        const offer = new LitOffer()
        offer.light([NEW_YORK, PHILADELPHIA])
        expect(offer.take()).toEqual([NEW_YORK, PHILADELPHIA])
        expect(offer.take()).toBeUndefined()
    })

    it('owes nothing for the same set again, nor for nothing lit', () => {
        const offer = new LitOffer()
        offer.light([NEW_YORK])
        offer.take()
        offer.light([NEW_YORK])
        expect(offer.take()).toBeUndefined()
        offer.light([])
        expect(offer.take()).toBeUndefined()
    })

    it('owes the same set again once nothing was lit in between', () => {
        const offer = new LitOffer()
        offer.light([NEW_YORK])
        offer.take()
        offer.light([])
        offer.light([NEW_YORK])
        expect(offer.take()).toEqual([NEW_YORK])
    })

    it('owes nothing once the view is moved by hand during the offer', () => {
        const offer = new LitOffer()
        offer.light([NEW_YORK])
        offer.moveByHand()
        expect(offer.take()).toBeUndefined()
        offer.light([PHILADELPHIA])
        expect(offer.take()).toEqual([PHILADELPHIA])
    })
})

/** The scale the wrapper shows a focus at: its rect contained in the view, up to its largest scale. */
function shownScale(request: FocusRequest, view: { width: number; height: number }): number {
    return Math.min(
        view.width / request.rect.width,
        view.height / request.rect.height,
        request.maxScale
    )
}

/** What a view of a size shows around a point, at a scale. */
function sizedViewAround(
    centre: { x: number; y: number },
    view: { width: number; height: number },
    viewScale: number
): Box {
    const width = view.width / viewScale
    const height = view.height / viewScale
    return { x: centre.x - width / 2, y: centre.y - height / 2, width, height }
}

function westmostHex(): HexId {
    return USA_HEXES.map((hex) => hex.id).reduce((a, b) =>
        hexCenter(a).x < hexCenter(b).x ? a : b
    )
}

function eastmostHex(): HexId {
    return USA_HEXES.map((hex) => hex.id).reduce((a, b) =>
        hexCenter(a).x > hexCenter(b).x ? a : b
    )
}

describe('the building zoom’s fit (contract, Build)', () => {
    const eastCoast = USA_CITIES.filter(isEastCoastCity).map((city) => city.hexId)
    // A few hexes about the map's middle, more than a hex width from every edge of the board.
    const middle = USA_HEXES.map((hex) => hex.id)
        .filter((hexId) => shows(viewAround(centreOf(MAP_EXTENTS), 1), hexId))
        .slice(0, 3)
    const restingPhone = sizedViewAround(centreOf(third(1)), PHONE_VIEW, restingScale(PHONE_VIEW))

    it('rests at the whole map where a view fits it, and on the middle third where it does not', () => {
        expect(restingScale(DESKTOP_VIEW)).toBeCloseTo(Math.min(1, containScale(DESKTOP_VIEW)))
        expect(restingScale(PHONE_VIEW)).toBeCloseTo(middleThirdScale(PHONE_VIEW))
    })

    it('fits the lit hexes’ box, a hex width wider on every side', () => {
        expect(middle.length).toBe(3)
        const boxes = middle.map(hexBox)
        const left = Math.min(...boxes.map((box) => box.x))
        const right = Math.max(...boxes.map((box) => box.x + box.width))
        const top = Math.min(...boxes.map((box) => box.y))
        const bottom = Math.max(...boxes.map((box) => box.y + box.height))
        const request = buildZoomRequest(middle, DESKTOP_VIEW, BOARD_EXTENTS)
        assertExists(request)
        expect(request.rect.x).toBeCloseTo(left - HEX_WIDTH)
        expect(request.rect.y).toBeCloseTo(top - HEX_WIDTH)
        expect(request.rect.width).toBeCloseTo(right - left + 2 * HEX_WIDTH)
        expect(request.rect.height).toBeCloseTo(bottom - top + 2 * HEX_WIDTH)
    })

    it('keeps the padded box inside the board at its edge', () => {
        const request = buildZoomRequest(eastCoast, DESKTOP_VIEW, BOARD_EXTENTS)
        assertExists(request)
        expect(request.rect.x + request.rect.width).toBeLessThanOrEqual(BOARD_WIDTH)
        expect(request.rect.y).toBeGreaterThanOrEqual(0)
        expect(eastCoast.every((hexId) => shows(request.rect, hexId))).toBe(true)
    })

    it('fits nothing with nothing lit', () => {
        expect(buildZoomRequest([], DESKTOP_VIEW, BOARD_EXTENTS)).toBeUndefined()
    })

    it('draws a single lit hex 64 px wide at most, and never past the board’s largest zoom', () => {
        for (const view of [DESKTOP_VIEW, PHONE_VIEW, SHORT_PHONE_VIEW]) {
            const request = buildZoomRequest([middle[0]], view, BOARD_EXTENTS)
            assertExists(request)
            const scale = shownScale(request, view)
            expect(hexWidthOnScreen(scale)).toBeCloseTo(BUILD_ZOOM_MAX_HEX_PX)
            expect(scale).toBeLessThanOrEqual(BOARD_MAX_SCALE)
        }
    })

    it('zooms the East Coast in from the whole map on desktop', () => {
        const request = buildZoomRequest(eastCoast, DESKTOP_VIEW, BOARD_EXTENTS)
        assertExists(request)
        expect(shownScale(request, DESKTOP_VIEW)).toBeGreaterThan(restingScale(DESKTOP_VIEW))
    })

    it('never zooms out below the whole map on desktop, with lit hexes coast to coast', () => {
        const coastToCoast = [westmostHex(), eastmostHex()]
        const request = buildZoomRequest(coastToCoast, DESKTOP_VIEW, BOARD_EXTENTS)
        assertExists(request)
        expect(shownScale(request, DESKTOP_VIEW)).toBeCloseTo(restingScale(DESKTOP_VIEW))
    })

    it('keeps a phone’s resting scale, a hex at least 37 px, with lit hexes coast to coast', () => {
        const coastToCoast = [westmostHex(), eastmostHex()]
        const request = buildZoomRequest(coastToCoast, PHONE_VIEW, restingPhone)
        assertExists(request)
        const scale = shownScale(request, PHONE_VIEW)
        expect(scale).toBeCloseTo(restingScale(PHONE_VIEW))
        expect(hexWidthOnScreen(scale)).toBeGreaterThanOrEqual(MIN_RESTING_HEX_PX)
    })

    it('centres the lit hexes nearest the view’s centre when they do not fit at the resting scale', () => {
        const floor = restingScale(PHONE_VIEW)
        const fromEast = sizedViewAround(centreOf(third(2)), PHONE_VIEW, floor)
        const west = westmostHex()
        const request = buildZoomRequest([west, ...eastCoast], PHONE_VIEW, fromEast)
        assertExists(request)
        const target = sizedViewAround(centreOf(request.rect), PHONE_VIEW, floor)
        expect(shows(target, west)).toBe(false)
        expect(eastCoast.some((hexId) => shows(target, hexId))).toBe(true)
    })

    it('stays while every lit hex is inside the view, and not once one has left it', () => {
        const request = buildZoomRequest(middle, DESKTOP_VIEW, BOARD_EXTENTS)
        assertExists(request)
        const shown = sizedViewAround(
            centreOf(request.rect),
            DESKTOP_VIEW,
            shownScale(request, DESKTOP_VIEW)
        )
        expect(buildZoomKeepsView(middle, DESKTOP_VIEW, shown)).toBe(true)
        expect(buildZoomKeepsView([...middle, eastCoast[0]], DESKTOP_VIEW, shown)).toBe(false)
    })

    it('stays on a phone while the lit hexes nearest its centre are in view, when not all can be', () => {
        const floor = restingScale(PHONE_VIEW)
        const lit = [westmostHex(), ...eastCoast]
        const request = buildZoomRequest(lit, PHONE_VIEW, restingPhone)
        assertExists(request)
        const shown = sizedViewAround(centreOf(request.rect), PHONE_VIEW, floor)
        expect(buildZoomKeepsView(lit, PHONE_VIEW, shown)).toBe(true)
        const elsewhere = sizedViewAround(centreOf(third(1)), PHONE_VIEW, floor)
        expect(buildZoomKeepsView(lit, PHONE_VIEW, elsewhere)).toBe(false)
    })
})

describe('the building zoom on a view that rests on the whole map (contract, Build)', () => {
    // The board's view at 1440 × 900 on a building turn.
    const WIDE_VIEW = { width: 1096, height: 576 }
    const eastCoast = USA_CITIES.filter(isEastCoastCity).map((city) => city.hexId)

    afterEach(disposeSessions)

    async function purpleArrivesLit(): Promise<HexId[]> {
        const fixture = TABLE_FIXTURES.find((candidate) => candidate.slug === 'purple-arrives')
        assertExists(fixture)
        const session = await openSessionOn(tableState(fixture.recipe))
        return session.boardOffer.lit.map((hex) => hex.hexId)
    }

    it('stays on the whole map when fitting the lit hexes would barely zoom in', async () => {
        const lit = await purpleArrivesLit()
        expect(lit.length).toBeGreaterThan(0)
        const request = buildZoomRequest(lit, WIDE_VIEW, BOARD_EXTENTS)
        assertExists(request)
        expect(request.rect).toEqual(BOARD_EXTENTS)
        expect(request.maxScale).toBeCloseTo(restingScale(WIDE_VIEW))
        expect(shownScale(request, WIDE_VIEW)).toBeCloseTo(restingScale(WIDE_VIEW))
    })

    it('keeps the whole map while every lit hex is on it', async () => {
        const lit = await purpleArrivesLit()
        expect(buildZoomKeepsView(lit, WIDE_VIEW, BOARD_EXTENTS)).toBe(true)
    })

    it('still fits the six East Coast cities, a zoom worth the move', () => {
        const request = buildZoomRequest(eastCoast, WIDE_VIEW, BOARD_EXTENTS)
        assertExists(request)
        expect(request.rect).not.toEqual(BOARD_EXTENTS)
        expect(eastCoast.every((hexId) => shows(request.rect, hexId))).toBe(true)
        expect(shownScale(request, WIDE_VIEW)).toBeGreaterThanOrEqual(
            restingScale(WIDE_VIEW) * MIN_BUILD_ZOOM_GAIN
        )
    })
})

describe('when the building zoom moves the view (contract, Build)', () => {
    const NEW_YORK: HexId = 'hex.usa.6-60'
    const PHILADELPHIA: HexId = 'hex.usa.7-57'
    const BALTIMORE: HexId = 'hex.usa.9-56'
    const RED: RailroadId = 'railroad.red'
    const BLUE: RailroadId = 'railroad.blue'
    const ORANGE: RailroadId = 'railroad.orange'

    const lit = (hexId: HexId, ...railroadIds: RailroadId[]): BuildLitHex => ({
        hexId,
        placements: railroadIds.map((railroadId) => ({ railroadId }))
    })
    // Red may go to New York and Philadelphia, Blue to Philadelphia and Baltimore.
    const offer = [lit(NEW_YORK, RED), lit(PHILADELPHIA, RED, BLUE), lit(BALTIMORE, BLUE)]
    const all = [NEW_YORK, PHILADELPHIA, BALTIMORE]

    function started(turn = 'ada') {
        const zoom = new BuildZoom()
        zoom.follow({ turn, lit: offer, held: undefined })
        return zoom
    }

    it('fits every lit hex when the turn first lights them, remembering the view before', () => {
        const zoom = new BuildZoom()
        expect(zoom.follow({ turn: 'ada', lit: [], held: undefined })).toBeUndefined()
        expect(zoom.follow({ turn: 'ada', lit: offer, held: undefined })).toEqual({
            kind: 'fit',
            hexIds: all,
            remember: true
        })
        expect(zoom.follow({ turn: 'ada', lit: offer, held: undefined })).toBeUndefined()
    })

    it('moves nothing outside the deciding seat’s building turn', () => {
        const zoom = new BuildZoom()
        expect(zoom.follow({ turn: undefined, lit: offer, held: undefined })).toBeUndefined()
        expect(zoom.follow({ turn: undefined, lit: [], held: RED })).toBeUndefined()
    })

    it('narrows to a held railroad’s lit hexes, and widens to all of them once released', () => {
        const zoom = started()
        expect(zoom.follow({ turn: 'ada', lit: offer, held: BLUE })).toEqual({
            kind: 'fit',
            hexIds: [PHILADELPHIA, BALTIMORE],
            remember: false
        })
        expect(zoom.follow({ turn: 'ada', lit: offer, held: RED })).toEqual({
            kind: 'fit',
            hexIds: [NEW_YORK, PHILADELPHIA],
            remember: false
        })
        expect(zoom.follow({ turn: 'ada', lit: offer, held: undefined })).toEqual({
            kind: 'fit',
            hexIds: all,
            remember: false
        })
    })

    it('narrows the turn’s first fit to a railroad already held', () => {
        const zoom = new BuildZoom()
        expect(zoom.follow({ turn: 'ada', lit: offer, held: RED })).toEqual({
            kind: 'fit',
            hexIds: [NEW_YORK, PHILADELPHIA],
            remember: true
        })
    })

    it('moves nothing for a held railroad with no lit hex this turn, nor on its release', () => {
        const zoom = started()
        expect(zoom.follow({ turn: 'ada', lit: offer, held: ORANGE })).toBeUndefined()
        expect(zoom.follow({ turn: 'ada', lit: offer, held: undefined })).toBeUndefined()
    })

    it('keeps the next lit hexes in view after a placement rather than fitting them again', () => {
        const zoom = started()
        const next = [lit(PHILADELPHIA, RED, BLUE), lit(BALTIMORE, BLUE)]
        // The offer is dark while the placement plays.
        expect(zoom.follow({ turn: 'ada', lit: [], held: undefined })).toBeUndefined()
        expect(zoom.follow({ turn: 'ada', lit: next, held: undefined })).toEqual({
            kind: 'keep-in-view',
            hexIds: [PHILADELPHIA, BALTIMORE]
        })
    })

    it('keeps a held railroad’s next lit hexes in view, or all of them once it has none', () => {
        const zoom = started()
        zoom.follow({ turn: 'ada', lit: offer, held: RED })
        const next = [lit(PHILADELPHIA, RED, BLUE), lit(BALTIMORE, BLUE)]
        expect(zoom.follow({ turn: 'ada', lit: next, held: RED })).toEqual({
            kind: 'keep-in-view',
            hexIds: [PHILADELPHIA]
        })
        const blueOnly = [lit(BALTIMORE, BLUE)]
        expect(zoom.follow({ turn: 'ada', lit: blueOnly, held: RED })).toEqual({
            kind: 'keep-in-view',
            hexIds: [BALTIMORE]
        })
    })

    it('lets the view go once it is moved by hand, until the next held spotlight change', () => {
        const zoom = started()
        zoom.moveByHand()
        const newYork = [lit(NEW_YORK, RED)]
        expect(zoom.follow({ turn: 'ada', lit: newYork, held: undefined })).toBeUndefined()
        // The view from before the turn's first zoom is still the one the turn's end returns to.
        expect(zoom.follow({ turn: 'ada', lit: newYork, held: RED })).toEqual({
            kind: 'fit',
            hexIds: [NEW_YORK],
            remember: false
        })
        expect(zoom.follow({ turn: 'ada', lit: offer, held: RED })).toEqual({
            kind: 'keep-in-view',
            hexIds: [NEW_YORK, PHILADELPHIA]
        })
    })

    it('returns to the view from before the zoom when the turn ends', () => {
        const zoom = started()
        zoom.follow({ turn: 'ada', lit: offer, held: BLUE })
        expect(zoom.follow({ turn: undefined, lit: [], held: BLUE })).toEqual({ kind: 'restore' })
        expect(zoom.follow({ turn: undefined, lit: [], held: undefined })).toBeUndefined()
    })

    it('returns to the view from before the zoom when the turn ends, even after a hand move', () => {
        const zoom = started()
        zoom.moveByHand()
        expect(zoom.follow({ turn: undefined, lit: [], held: undefined })).toEqual({
            kind: 'restore'
        })
        expect(zoom.follow({ turn: undefined, lit: [], held: undefined })).toBeUndefined()
    })

    it('keeps the view from before the first zoom across turns after a hand move in an earlier one', () => {
        const zoom = started('ada')
        zoom.moveByHand()
        expect(zoom.follow({ turn: 'ben', lit: offer, held: undefined })).toEqual({
            kind: 'fit',
            hexIds: all,
            remember: false
        })
        expect(zoom.follow({ turn: undefined, lit: [], held: undefined })).toEqual({
            kind: 'restore'
        })
    })

    it('returns to the view from before the first zoom when the last seat moved it by hand', () => {
        const zoom = started('ada')
        zoom.follow({ turn: 'ben', lit: offer, held: undefined })
        zoom.moveByHand()
        expect(zoom.follow({ turn: undefined, lit: [], held: undefined })).toEqual({
            kind: 'restore'
        })
    })

    it('starts again on the next turn, after a hand move in the last', () => {
        const zoom = started('ada')
        zoom.moveByHand()
        zoom.follow({ turn: undefined, lit: [], held: undefined })
        expect(zoom.follow({ turn: 'ada, round 2', lit: offer, held: undefined })).toEqual({
            kind: 'fit',
            hexIds: all,
            remember: true
        })
    })

    it('keeps the view from before the first zoom across turns that follow on one screen', () => {
        const zoom = started('ada')
        expect(zoom.follow({ turn: 'ben', lit: offer, held: undefined })).toEqual({
            kind: 'fit',
            hexIds: all,
            remember: false
        })
        expect(zoom.follow({ turn: undefined, lit: [], held: undefined })).toEqual({
            kind: 'restore'
        })
    })
})

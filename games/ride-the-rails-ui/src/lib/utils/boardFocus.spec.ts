import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { USA_CITIES, USA_HEXES, isEastCoastCity, type HexId } from '@tabletop/ride-the-rails'
import {
    BOARD_FOCUSES,
    FOCUS_CHOOSER_BELOW_HEX_PX,
    FOCUS_CHOOSER_INSET,
    LitOffer,
    MIN_RESTING_HEX_PX,
    focusRequest,
    hexWidthOnScreen,
    litRevealRect,
    regionRect,
    regionScale,
    restingFocus,
    restsAtCover,
    shownBoardRect,
    showsFocusChooser
} from './boardFocus.js'
import {
    BOARD_EXTENTS,
    BOARD_HEIGHT,
    BOARD_WIDTH,
    DESKTOP_BOARD_VIEW,
    FITTED_DESKTOP_SCALE,
    HEX_WIDTH,
    MAP_EXTENTS,
    drawsCityLabels,
    hexBox,
    hexCenter
} from './boardGeometry.js'

// A 375 × 812 phone: the game column is 90% of the width less its padding, and the board view is
// what the header, the action panel and the railroad strip leave, less the chooser's inset.
const PHONE_VIEW = { width: 330, height: 493 - FOCUS_CHOOSER_INSET }
// The tallest action panel on a phone (Take a share's two rows) leaves the board less.
const SHORT_PHONE_VIEW = { width: 330, height: 380 - FOCUS_CHOOSER_INSET }
const DESKTOP_VIEW = DESKTOP_BOARD_VIEW

function containScale(view: { width: number; height: number }): number {
    return Math.min(view.width / BOARD_WIDTH, view.height / BOARD_HEIGHT)
}

describe('the phone board (contract, Phone layout)', () => {
    it('rests a phone view on the middle third rather than the whole map', () => {
        expect(restsAtCover(PHONE_VIEW)).toBe(true)
        expect(restingFocus(PHONE_VIEW)).toBe('middle')
    })

    it('keeps the whole map where a desktop view fits it', () => {
        expect(restsAtCover(DESKTOP_VIEW)).toBe(false)
        expect(restingFocus(DESKTOP_VIEW)).toBeUndefined()
    })

    it('draws every lit target, the whole hex, at least 33 px wide where a phone rests', () => {
        for (const view of [PHONE_VIEW, SHORT_PHONE_VIEW]) {
            const request = focusRequest('middle', view)
            expect(hexWidthOnScreen(request.maxScale)).toBeGreaterThanOrEqual(MIN_RESTING_HEX_PX)
        }
    })

    it('would draw hexes under 28 px with the whole map fitted to a phone', () => {
        expect(hexWidthOnScreen(containScale(PHONE_VIEW))).toBeLessThan(12)
    })

    it('fills the view’s height when a region is shown in a tall view', () => {
        const tall = { width: 375, height: 1400 }
        expect(regionScale('west', tall) * BOARD_HEIGHT).toBeGreaterThanOrEqual(tall.height)
    })

    it('fits a third of the map when it is larger than a resting hex', () => {
        const wide = { width: 1600, height: 1200 }
        expect(regionScale('east', wide)).toBeCloseTo(
            Math.min(wide.width / (MAP_EXTENTS.width / 3), wide.height / BOARD_HEIGHT)
        )
    })
})

describe('the focus chooser (U-8)', () => {
    it('offers the whole map and the three regions, in that order', () => {
        expect(BOARD_FOCUSES.map(({ label }) => label)).toEqual([
            'Whole map',
            'West',
            'Middle',
            'East'
        ])
    })

    it('shows whenever a hex is under 28 px on screen, and only then', () => {
        const at28 = FOCUS_CHOOSER_BELOW_HEX_PX / HEX_WIDTH
        expect(showsFocusChooser(at28 - 0.001)).toBe(true)
        expect(showsFocusChooser(at28)).toBe(false)
        expect(showsFocusChooser(containScale(PHONE_VIEW))).toBe(true)
        expect(showsFocusChooser(focusRequest('middle', PHONE_VIEW).maxScale)).toBe(false)
    })

    it('shows on the whole map and hides once a region is chosen on a phone', () => {
        const whole = focusRequest('whole-map', PHONE_VIEW)
        expect(whole.rect).toEqual(BOARD_EXTENTS)
        expect(showsFocusChooser(Math.min(whole.maxScale, containScale(PHONE_VIEW)))).toBe(true)
        for (const region of ['west', 'middle', 'east'] as const) {
            expect(showsFocusChooser(focusRequest(region, PHONE_VIEW).maxScale)).toBe(false)
        }
    })

    it('splits the map into three regions that cover every hex centre', () => {
        const regions = (['west', 'middle', 'east'] as const).map(regionRect)
        for (const hex of USA_HEXES) {
            const { x } = hexCenter(hex.id)
            expect(regions.some((rect) => x >= rect.x && x <= rect.x + rect.width)).toBe(true)
        }
    })

    it('centres a region’s focus on its third', () => {
        const rect = regionRect('east')
        const request = focusRequest('east', PHONE_VIEW)
        expect(request.rect.x + request.rect.width / 2).toBeCloseTo(rect.x + rect.width / 2)
        expect(request.rect.y + request.rect.height / 2).toBeCloseTo(BOARD_HEIGHT / 2)
    })
})

describe('the part of the board a view shows', () => {
    it('reads the view below its inset through where the board is drawn', () => {
        const board = { left: -500, top: 100, width: BOARD_WIDTH / 2, height: BOARD_HEIGHT / 2 }
        const view = { left: 10, top: 120, width: 330, height: 500 }
        expect(shownBoardRect(board, view, 40)).toEqual({
            x: 1020,
            y: 120,
            width: 660,
            height: 920
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
    const resting = viewAround(centreOf(regionRect('middle')), regionScale('middle', PHONE_VIEW))
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
        const target = litRevealRect(eastCoast, viewAround(centreOf(regionRect('west')), 0.5))
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

describe('city names on a phone’s whole map', () => {
    it('are left off rather than drawn about 4 px high', () => {
        expect(drawsCityLabels(containScale(PHONE_VIEW))).toBe(false)
    })

    it('are drawn where a phone rests and at the fitted desktop scale', () => {
        expect(drawsCityLabels(focusRequest('middle', PHONE_VIEW).maxScale)).toBe(true)
        expect(drawsCityLabels(FITTED_DESKTOP_SCALE)).toBe(true)
    })
})

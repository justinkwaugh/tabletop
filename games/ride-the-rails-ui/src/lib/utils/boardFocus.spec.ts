import { describe, expect, it } from 'vitest'
import { USA_HEXES } from '@tabletop/ride-the-rails'
import {
    BOARD_FOCUSES,
    FOCUS_CHOOSER_BELOW_HEX_PX,
    FOCUS_CHOOSER_INSET,
    MIN_RESTING_HEX_PX,
    focusRequest,
    hexWidthOnScreen,
    regionRect,
    regionScale,
    restingFocus,
    restsAtCover,
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

describe('city names on a phone’s whole map', () => {
    it('are left off rather than drawn about 4 px high', () => {
        expect(drawsCityLabels(containScale(PHONE_VIEW))).toBe(false)
    })

    it('are drawn where a phone rests and at the fitted desktop scale', () => {
        expect(drawsCityLabels(focusRequest('middle', PHONE_VIEW).maxScale)).toBe(true)
        expect(drawsCityLabels(FITTED_DESKTOP_SCALE)).toBe(true)
    })
})

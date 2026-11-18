import { describe, expect, it } from 'vitest'
import {
    POPUP_GAP,
    clearPlace,
    detailClearOfChoice,
    placesFrom,
    rideSides,
    type Box,
    type Size
} from './popupPlacement.js'

const PHONE: Box = { left: 0, top: 0, width: 375, height: 812 }
const DESKTOP: Box = { left: 0, top: 0, width: 1280, height: 900 }
const CARD: Size = { width: 220, height: 180 }

function hexAt(left: number, top: number): Box {
    return { left, top, width: 30, height: 34 }
}

function boxOf(spot: { left: number; top: number }, size: Size): Box {
    return { ...spot, ...size }
}

function apart(a: Box, b: Box): boolean {
    return (
        a.left >= b.left + b.width ||
        b.left >= a.left + a.width ||
        a.top >= b.top + b.height ||
        b.top >= a.top + a.height
    )
}

function inside(box: Box, view: Box): boolean {
    return (
        box.left >= view.left &&
        box.top >= view.top &&
        box.left + box.width <= view.left + view.width &&
        box.top + box.height <= view.top + view.height
    )
}

describe('the hex detail beside the railroad popup', () => {
    it('opens above its hex on a phone when the railroad popup is below', () => {
        const hex = hexAt(200, 300)
        const choice: Box = { left: 100, top: 420, width: 260, height: 150 }
        const spot = detailClearOfChoice(hex, CARD, choice, PHONE, true)
        expect(spot.top).toBe(hex.top - POPUP_GAP - CARD.height)
        expect(apart(boxOf(spot, CARD), choice)).toBe(true)
        expect(inside(boxOf(spot, CARD), PHONE)).toBe(true)
    })

    it('opens below its hex on a phone when there is no room above', () => {
        const hex = hexAt(200, 60)
        const choice: Box = { left: 100, top: 500, width: 260, height: 150 }
        const spot = detailClearOfChoice(hex, CARD, choice, PHONE, true)
        expect(spot.top).toBe(hex.top + hex.height + POPUP_GAP)
        expect(apart(boxOf(spot, CARD), choice)).toBe(true)
    })

    it('takes a side of the railroad popup when neither side of its hex is clear', () => {
        // The railroad popup lies just below the hex and the hex is near the top of the view.
        const hex = hexAt(170, 40)
        const choice: Box = { left: 40, top: 90, width: 300, height: 400 }
        const spot = detailClearOfChoice(hex, CARD, choice, PHONE, true)
        expect(apart(boxOf(spot, CARD), choice)).toBe(true)
        expect(inside(boxOf(spot, CARD), PHONE)).toBe(true)
    })

    it('keeps clear of the railroad popup wherever the two hexes are on a phone', () => {
        for (let hexTop = 20; hexTop < 780; hexTop += 40) {
            for (let choiceTop = 20; choiceTop < 640; choiceTop += 40) {
                for (const hexLeft of [10, 170, 330]) {
                    const choice: Box = { left: 60, top: choiceTop, width: 280, height: 150 }
                    const hex = hexAt(hexLeft, hexTop)
                    const spot = detailClearOfChoice(hex, CARD, choice, PHONE, true)
                    expect(apart(boxOf(spot, CARD), choice)).toBe(true)
                }
            }
        }
    })

    it('opens on the side of its hex away from the railroad popup on wider screens', () => {
        const hex = hexAt(600, 400)
        const choice: Box = { left: 700, top: 380, width: 288, height: 150 }
        const spot = detailClearOfChoice(hex, CARD, choice, DESKTOP, false)
        expect(spot.left).toBe(hex.left - POPUP_GAP - CARD.width)
        expect(apart(boxOf(spot, CARD), choice)).toBe(true)
    })
})

describe('the map’s Ride button beside the route’s last city', () => {
    const PILL: Size = { width: 62, height: 32 }
    const GAP = 6
    // The last city as drawn on the whole map: a hex about 30 px wide.
    const city = hexAt(600, 400)
    const WIDE = placesFrom(rideSides('right', false))

    function spotFor(picks: readonly Box[], places = WIDE, view = DESKTOP) {
        return clearPlace(city, PILL, places, picks, view, GAP)
    }

    it('tries its own side, the side across, the other two sides, then the corners nearest its own side', () => {
        expect(placesFrom(rideSides('right', false))).toEqual([
            'right',
            'left',
            'below',
            'above',
            'below-right',
            'above-right',
            'below-left',
            'above-left'
        ])
        expect(placesFrom(rideSides('left', false))).toEqual([
            'left',
            'right',
            'below',
            'above',
            'below-left',
            'above-left',
            'below-right',
            'above-right'
        ])
        // A phone opens below first, then above, then the side away from the route.
        expect(placesFrom(rideSides('left', true))).toEqual([
            'below',
            'above',
            'left',
            'right',
            'below-left',
            'below-right',
            'above-left',
            'above-right'
        ])
    })

    it('stands on its own side, as before, when nothing is under it', () => {
        expect(spotFor([])).toEqual({ left: city.left + city.width + GAP, top: 401 })
    })

    it('moves to the side across when a lit hex lies under its own side', () => {
        const lit = hexAt(city.left + city.width + 20, city.top)
        const spot = spotFor([lit])
        expect(spot).toEqual({ left: city.left - GAP - PILL.width, top: 401 })
        expect(spot && apart(boxOf(spot, PILL), lit)).toBe(true)
    })

    it('takes the sides in order: below once both sides across are lit, then above', () => {
        const right = hexAt(city.left + city.width + 20, city.top)
        const left = hexAt(city.left - 50, city.top)
        expect(spotFor([right, left])).toEqual({
            left: city.left + city.width / 2 - PILL.width / 2,
            top: city.top + city.height + GAP
        })
        const below = hexAt(city.left, city.top + city.height + 10)
        expect(spotFor([right, left, below])).toEqual({
            left: city.left + city.width / 2 - PILL.width / 2,
            top: city.top - GAP - PILL.height
        })
    })

    it('takes a corner, the one below on its own side first, when all four sides are lit', () => {
        // Hexes against each side's middle, leaving the corners free.
        const sides = [
            { left: city.left + city.width + 1, top: city.top + 10, width: 80, height: 14 },
            { left: city.left - 81, top: city.top + 10, width: 80, height: 14 },
            { left: city.left + 5, top: city.top + city.height + 1, width: 20, height: 60 },
            { left: city.left + 5, top: city.top - 61, width: 20, height: 60 }
        ]
        expect(spotFor(sides)).toEqual({
            left: city.left + city.width + GAP,
            top: city.top + city.height + GAP
        })
        const belowRight = {
            left: city.left + city.width + 1,
            top: city.top + 40,
            width: 90,
            height: 60
        }
        expect(spotFor([...sides, belowRight])).toEqual({
            left: city.left + city.width + GAP,
            top: city.top - GAP - PILL.height
        })
    })

    it('finds no spot when every place is covered', () => {
        const around: Box = { left: city.left - 200, top: city.top - 200, width: 430, height: 434 }
        expect(spotFor([around])).toBeUndefined()
    })

    it('skips a place that leaves the view', () => {
        const nearRightEdge: Box = { ...DESKTOP, width: city.left + city.width + 40 }
        expect(spotFor([], WIDE, nearRightEdge)).toEqual({
            left: city.left - GAP - PILL.width,
            top: 401
        })
    })

    it('finds no spot while its city is out of view', () => {
        // The view ends just left of the city, where its side across would still fit.
        const away: Box = { left: 0, top: 0, width: city.left - 4, height: 900 }
        expect(spotFor([], WIDE, away)).toBeUndefined()
    })
})

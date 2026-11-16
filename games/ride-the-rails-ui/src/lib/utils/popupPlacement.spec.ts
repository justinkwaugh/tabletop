import { describe, expect, it } from 'vitest'
import { POPUP_GAP, detailClearOfChoice, type Box, type Size } from './popupPlacement.js'

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

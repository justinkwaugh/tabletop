import { describe, expect, it } from 'vitest'
import { STARTING_ARMIES, Side, UnitType } from '@tabletop/napoleons-triumph'
import { displaySlot, displayedFaces } from './armyDisplay.js'

describe('army display', () => {
    it('orders the faces as the display prints them', () => {
        const faces = displayedFaces(STARTING_ARMIES[Side.French])
        expect(faces[0]).toEqual({ type: UnitType.Infantry, strength: 3, guard: true })
        expect(faces[2]).toEqual({ type: UnitType.Infantry, strength: 3 })
        expect(faces[9]).toEqual({ type: UnitType.Infantry, strength: 2 })
        expect(faces[25]).toEqual({ type: UnitType.Cavalry, strength: 3 })
        expect(faces.at(-1)).toEqual({ type: UnitType.Artillery, strength: 1 })
    })

    it('fills the French display from its top right corner', () => {
        const first = displaySlot(Side.French, 0)
        const second = displaySlot(Side.French, 1)
        const fifth = displaySlot(Side.French, 4)
        expect(second.x).toBeLessThan(first.x)
        expect(second.y).toBe(first.y)
        expect(fifth.x).toBe(first.x)
        expect(fifth.y).toBeGreaterThan(first.y)
    })

    it('fills the Allied display from its bottom left corner', () => {
        const first = displaySlot(Side.Allied, 0)
        const second = displaySlot(Side.Allied, 1)
        const fifth = displaySlot(Side.Allied, 4)
        expect(second.x).toBeGreaterThan(first.x)
        expect(fifth.y).toBeLessThan(first.y)
    })
})

import { describe, expect, it } from 'vitest'
import { Region } from '@tabletop/oath'
import { menuPointer, pointsAt } from './menuPointer.svelte.js'

describe('a menu row points at what it names on the table (rule 3)', () => {
    it('points while hovered or focused, and lets go on leave, blur or unmount', () => {
        const row = new EventTarget()
        const target = { kind: 'site' as const, slotId: 'slot.cradle.1' }
        const detach = pointsAt(target)(row)
        row.dispatchEvent(new Event('pointerenter'))
        expect(menuPointer.is(target)).toBe(true)
        row.dispatchEvent(new Event('pointerleave'))
        expect(menuPointer.is(target)).toBe(false)
        row.dispatchEvent(new Event('focusin'))
        expect(menuPointer.is(target)).toBe(true)
        if (detach) detach()
        expect(menuPointer.is(target)).toBe(false)
    })

    it('a row left late does not clear the row pointed at since', () => {
        const pile = { kind: 'pile' as const, region: Region.Cradle }
        const deck = { kind: 'deck' as const }
        menuPointer.point(pile)
        menuPointer.point(deck)
        menuPointer.leave(pile)
        expect(menuPointer.is(deck)).toBe(true)
        menuPointer.leave(deck)
    })
})

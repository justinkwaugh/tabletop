import { describe, expect, it } from 'vitest'
import { popoverBeside } from './popoverPlacement.js'

const viewport = { width: 1000, height: 800 }
const popover = { width: 200, height: 100 }

describe('popoverBeside', () => {
    it('opens to the right of the anchor, centred on the pointer', () => {
        expect(
            popoverBeside({ x: 100, y: 100, width: 300, height: 400 }, 300, popover, viewport)
        ).toEqual({
            x: 408,
            y: 250
        })
    })

    it('opens to the left when the right side has no room', () => {
        expect(
            popoverBeside({ x: 600, y: 100, width: 300, height: 400 }, 300, popover, viewport)
        ).toEqual({
            x: 392,
            y: 250
        })
    })

    it('centres over the anchor when neither side has room, and stays on screen', () => {
        expect(
            popoverBeside({ x: 50, y: 0, width: 900, height: 800 }, 780, popover, viewport)
        ).toEqual({
            x: 400,
            y: 692
        })
    })
})

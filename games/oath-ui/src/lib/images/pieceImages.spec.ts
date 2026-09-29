import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { OathColors } from '@tabletop/oath'
import { banditWarbandImage, pawnImage, pawnImageKeys, warbandImage, warbandImageKeys } from './pieceImages.js'
import { OathGameColorizer } from '$lib/definitions/colorizer.js'

/** Every warband the game can put on the board has a figure, in each colour the engine seats. */
describe('warband figure coverage', () => {
    it('R-1.12, R-2.4 — every seat colour and the Imperial colour has a figure', () => {
        const needed = OathColors
        const missing = needed.filter((color) => !warbandImage(color))
        expect(missing).toEqual([])
        // Five seat colours plus Imperial, fixed by the physical components.
        expect(needed).toHaveLength(6)
    })

    it('no figure is orphaned — every file names a colour the platform knows', () => {
        const known = new Set<string>(Object.values(Color))
        expect(warbandImageKeys().filter((key) => !known.has(key))).toEqual([])
    })

    it('R-2.1.5 — every seat colour has its own Supply marker colour', () => {
        const seats = OathColors.map((color) => new OathGameColorizer().getUiColor(color))
        expect(new Set(seats).size).toBe(seats.length)
    })

    it('R-10.3 — the bandits have a figure, and it is not a colour', () => {
        expect(banditWarbandImage()).toBeDefined()
        expect(warbandImageKeys()).not.toContain('bandit')
    })

    it('an unused colour is a broken invariant, not a missing picture', () => {
        expect(() => warbandImage(Color.Green)).toThrow()
        expect(() => pawnImage(Color.Green)).toThrow()
    })

    it('every seat colour and the Imperial colour has a pawn', () => {
        const needed = OathColors
        expect(needed.filter((color) => !pawnImage(color))).toEqual([])
        const known = new Set<string>(Object.values(Color))
        expect(pawnImageKeys().filter((key) => !known.has(key))).toEqual([])
    })
})

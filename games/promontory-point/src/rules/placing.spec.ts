import { describe, expect, it } from 'vitest'
import { placingHasEnded } from './placing.js'

describe('Promontory Point placing', () => {
    it('R-3.3-H1: placing goes on while a placement is left and a turn piece remains', () => {
        expect(
            placingHasEnded({
                pieces: ['railroad.cp', 'railroad.up', 'railroad.kp'],
                tradesUsed: 0,
                placementsMade: 0,
                placementsLeft: 3
            })
        ).toBe(false)
        expect(
            placingHasEnded({
                pieces: ['railroad.sp'],
                tradesUsed: 2,
                placementsMade: 2,
                placementsLeft: 1
            })
        ).toBe(false)
    })

    it('R-3.3-H1: placing has ended when no placement is left', () => {
        expect(
            placingHasEnded({ pieces: [], tradesUsed: 0, placementsMade: 3, placementsLeft: 0 })
        ).toBe(true)
        expect(
            placingHasEnded({ pieces: [], tradesUsed: 0, placementsMade: 2, placementsLeft: 0 })
        ).toBe(true)
    })

    it('R-6.3-H2: a variant turn ends placing with a leftover piece once no placement is left', () => {
        expect(
            placingHasEnded({
                pieces: ['railroad.kp'],
                tradesUsed: 0,
                placementsMade: 3,
                placementsLeft: 0
            })
        ).toBe(true)
    })

    it('R-3.3-H1, R-6.3-H2: placing has ended when no turn piece is left, even with a placement left', () => {
        expect(
            placingHasEnded({ pieces: [], tradesUsed: 1, placementsMade: 2, placementsLeft: 1 })
        ).toBe(true)
    })
})

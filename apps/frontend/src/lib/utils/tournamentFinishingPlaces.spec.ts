import { describe, expect, it } from 'vitest'
import {
    finishingPlacesFromNumbers,
    placementCorrection,
    standingsPlaces
} from './tournamentFinishingPlaces'

describe('tournament finishing places', () => {
    it('numbers shared places the way a standings line does', () => {
        expect(standingsPlaces({ a: 1.5, b: 1.5, c: 3, d: 4 })).toEqual({ a: 1, b: 1, c: 3, d: 4 })
    })

    it('shares a place between equal numbers, whatever numbers are chosen', () => {
        expect(finishingPlacesFromNumbers({ c: 3, a: 1, d: 4, b: 1 })).toEqual({
            a: 1.5,
            b: 1.5,
            c: 3,
            d: 4
        })
        expect(finishingPlacesFromNumbers({ a: 2, b: 2, c: 1, d: 2 })).toEqual({
            c: 1,
            a: 3,
            b: 3,
            d: 3
        })
        expect(finishingPlacesFromNumbers(standingsPlaces({ d: 1, a: 2.5, c: 2.5, b: 4 }))).toEqual(
            { d: 1, a: 2.5, c: 2.5, b: 4 }
        )
    })

    it('credits everyone sharing the best place as winners', () => {
        expect(placementCorrection({ a: 2, b: 1, c: 1, d: 4 })).toEqual({
            winningUserIds: ['b', 'c'],
            finishingPlaces: { b: 1.5, c: 1.5, a: 3, d: 4 }
        })
    })
})

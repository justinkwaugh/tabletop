import { describe, expect, it } from 'vitest'
import { ALPHA, BETA, FLAT_FIXTURE_MAP, GAMMA } from '../testing/flatFixtureMap.js'
import { roundEndPassenger } from './endOfRound.js'

// R-8 (France, Paris Travels): at the end of a round the map's travelling city takes a passenger
// if it has none.
describe('a passenger placed at the end of the round (R-8)', () => {
    it('places one in the map’s city when it has none', () => {
        expect(roundEndPassenger(ALPHA, [BETA])).toBe(ALPHA)
        expect(roundEndPassenger(ALPHA, [])).toBe(ALPHA)
    })

    it('places none when the city still holds its passenger', () => {
        expect(roundEndPassenger(ALPHA, [ALPHA, BETA])).toBe(undefined)
    })

    it('places none on a map without such a city', () => {
        expect(roundEndPassenger(null, [])).toBe(undefined)
    })
})

// R-1.3.2, R-8: a passenger on every city at setup, but those the map leaves empty.
describe('the passengers at setup (R-1.3.2, R-8)', () => {
    it('stand on every city of the map but those it names', () => {
        expect(FLAT_FIXTURE_MAP.setupPassengerCityIds()).toEqual([ALPHA, BETA])
        expect(FLAT_FIXTURE_MAP.setupPassengerCityIds()).not.toContain(GAMMA)
    })
})

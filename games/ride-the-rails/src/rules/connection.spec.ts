import { describe, expect, it } from 'vitest'
import type { HexId } from '../data/hexes.js'
import type { RailroadId } from '../data/railroads.js'
import type { Track } from '../model/gameState.js'
import {
    ALPHA,
    ALPHA_HEX,
    BETA,
    BETA_HEX,
    FLAT_FIXTURE_MAP,
    GAMMA,
    GAMMA_HEX,
    LONG_DISTANCE_HEX,
    MOUNTAIN_HEX
} from '../testing/flatFixtureMap.js'
import { citiesConnected } from './connection.js'

function trackOf(...lines: (readonly [RailroadId, readonly HexId[]])[]): Track {
    const track: Track = {}
    for (const [railroadId, hexIds] of lines) {
        for (const hexId of hexIds) {
            track[hexId] = [...(track[hexId] ?? []), railroadId]
        }
    }
    return track
}

// Alpha to Beta on one railroad: Alpha, the mountain, 2-2, Beta.
const RED_ALPHA_TO_BETA = [
    'railroad.red',
    [ALPHA_HEX, MOUNTAIN_HEX, 'hex.usa.2-2', BETA_HEX]
] as const
// Beta and Gamma are neighbours, so a railroad in both makes a link of two city hexes.
const BLUE_BETA_TO_GAMMA = ['railroad.blue', [BETA_HEX, GAMMA_HEX]] as const

// R-8 (Intercolonial, Greater Germany): every named city reaches every other through complete
// links of any railroads, changing railroad only in cities.
describe('a connection of named cities (R-8)', () => {
    it('holds when one railroad links the cities', () => {
        expect(citiesConnected(FLAT_FIXTURE_MAP, trackOf(RED_ALPHA_TO_BETA), [ALPHA, BETA])).toBe(
            true
        )
    })

    it('holds when links of different railroads meet in a city', () => {
        const track = trackOf(RED_ALPHA_TO_BETA, BLUE_BETA_TO_GAMMA)
        expect(citiesConnected(FLAT_FIXTURE_MAP, track, [ALPHA, BETA, GAMMA])).toBe(true)
        expect(citiesConnected(FLAT_FIXTURE_MAP, track, [GAMMA, ALPHA])).toBe(true)
    })

    it('fails while one named city is left out', () => {
        expect(
            citiesConnected(FLAT_FIXTURE_MAP, trackOf(RED_ALPHA_TO_BETA), [ALPHA, BETA, GAMMA])
        ).toBe(false)
        expect(citiesConnected(FLAT_FIXTURE_MAP, {}, [ALPHA, BETA])).toBe(false)
    })

    it('fails when the railroads change outside a city, so no link is complete', () => {
        const track = trackOf(
            ['railroad.red', [ALPHA_HEX, MOUNTAIN_HEX, 'hex.usa.2-2']],
            ['railroad.blue', ['hex.usa.2-2', BETA_HEX]]
        )
        expect(citiesConnected(FLAT_FIXTURE_MAP, track, [ALPHA, BETA])).toBe(false)
    })

    it('fails across an impassable side', () => {
        const track = trackOf([
            'railroad.red',
            [ALPHA_HEX, 'hex.usa.0-4', LONG_DISTANCE_HEX, GAMMA_HEX]
        ])
        expect(citiesConnected(FLAT_FIXTURE_MAP, track, [ALPHA, GAMMA])).toBe(false)
    })

    it('reaches a two-cell city through either of its cells', () => {
        const track = trackOf([
            'railroad.red',
            [ALPHA_HEX, 'hex.usa.0-4', 'hex.usa.0-6', 'hex.usa.1-7', GAMMA_HEX]
        ])
        expect(citiesConnected(FLAT_FIXTURE_MAP, track, [ALPHA, GAMMA])).toBe(true)
    })
})

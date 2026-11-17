import { describe, expect, it } from 'vitest'
import type { CityId } from '../data/boardMap.js'
import { boardMap } from '../data/boardMaps.js'
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

describe('Canada (R-8.3)', () => {
    const map = boardMap('map.ca')
    const MONTREAL: CityId = 'city.ca.montreal'
    const SAINT_JEAN: CityId = 'city.ca.saint-jean-sur-richelieu'

    it('joins no cities across an impassable side', () => {
        const across: Track = {
            'hex.ca.24-10': ['railroad.red'],
            'hex.ca.24-12': ['railroad.red'],
            'hex.ca.25-13': ['railroad.red']
        }
        expect(citiesConnected(map, across, [MONTREAL, SAINT_JEAN])).toBe(false)
    })

    it('joins them round it', () => {
        const round: Track = {
            'hex.ca.24-10': ['railroad.red'],
            'hex.ca.25-11': ['railroad.red'],
            'hex.ca.25-13': ['railroad.red']
        }
        expect(citiesConnected(map, round, [MONTREAL, SAINT_JEAN])).toBe(true)
    })
})

describe('France (R-8.4)', () => {
    const map = boardMap('map.fr')
    const LE_HAVRE: CityId = 'city.fr.le-havre'
    const CAEN: CityId = 'city.fr.caen'

    it('joins no cities across an estuary', () => {
        const across: Track = {
            'hex.fr.8-6': ['railroad.orange'],
            'hex.fr.8-8': ['railroad.orange']
        }
        expect(citiesConnected(map, across, [LE_HAVRE, CAEN])).toBe(false)
    })

    it('joins them round it', () => {
        const round: Track = {
            'hex.fr.8-6': ['railroad.orange'],
            'hex.fr.9-7': ['railroad.orange'],
            'hex.fr.8-8': ['railroad.orange']
        }
        expect(citiesConnected(map, round, [LE_HAVRE, CAEN])).toBe(true)
    })
})

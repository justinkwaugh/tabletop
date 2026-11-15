import { describe, expect, it } from 'vitest'
import type { HexId } from '../data/hexes.js'
import type { RailroadId } from '../data/railroads.js'
import type { CityId } from '../data/usaMap.js'
import { PhaseName } from '../definition/phases.js'
import type { Track } from '../model/gameState.js'
import type { Shares } from '../model/playerState.js'
import { buildState } from '../testing/fixtures.js'
import {
    isLegalJourney,
    isLink,
    journeyCities,
    journeyExists,
    journeyPayments,
    journeyRefusal,
    type Link
} from './routes.js'

const KANSAS_CITY_TO_SAINT_LOUIS: readonly HexId[] = [
    'hex.usa.8-32',
    'hex.usa.8-34',
    'hex.usa.8-36',
    'hex.usa.8-38'
]
const SAINT_LOUIS_TO_CINCINNATI: readonly HexId[] = [
    'hex.usa.8-38',
    'hex.usa.8-40',
    'hex.usa.8-42',
    'hex.usa.8-44',
    'hex.usa.8-46'
]
const CINCINNATI_TO_PITTSBURGH: readonly HexId[] = [
    'hex.usa.8-46',
    'hex.usa.7-47',
    'hex.usa.7-49',
    'hex.usa.7-51'
]
const SAINT_LOUIS_TO_KANSAS_CITY_NORTH: readonly HexId[] = [
    'hex.usa.8-38',
    'hex.usa.7-37',
    'hex.usa.7-35',
    'hex.usa.7-33',
    'hex.usa.8-32'
]
const SAINT_LOUIS_TO_LITTLE_ROCK_CROSSING: readonly HexId[] = [
    'hex.usa.8-38',
    'hex.usa.8-36',
    'hex.usa.9-35',
    'hex.usa.10-36',
    'hex.usa.11-37'
]

const RED: RailroadId = 'railroad.red'
const BLUE: RailroadId = 'railroad.blue'

function link(railroadId: RailroadId, hexIds: readonly HexId[]): Link {
    return { railroadId, hexIds: [...hexIds] }
}

function trackOf(...paths: [RailroadId, readonly HexId[]][]): Track {
    const track: Track = {}
    for (const [railroadId, hexIds] of paths) {
        for (const hexId of hexIds) {
            const railroads = Object.hasOwn(track, hexId) ? track[hexId] : []
            if (!railroads.includes(railroadId)) {
                track[hexId] = [...railroads, railroadId]
            }
        }
    }
    return track
}

const NETWORK = trackOf(
    [RED, KANSAS_CITY_TO_SAINT_LOUIS],
    [RED, SAINT_LOUIS_TO_CINCINNATI],
    [BLUE, CINCINNATI_TO_PITTSBURGH],
    [BLUE, SAINT_LOUIS_TO_KANSAS_CITY_NORTH],
    [BLUE, SAINT_LOUIS_TO_LITTLE_ROCK_CROSSING]
)

function riding(track: Track = NETWORK, passengers?: CityId[], shares?: Record<string, Shares>) {
    return buildState({ playerCount: 3, phase: PhaseName.Ride, track, passengers, shares })
}

describe('a link (R-3.3.2)', () => {
    it('joins a city to another city through hexes all holding its railroad', () => {
        expect(isLink(NETWORK, link(RED, KANSAS_CITY_TO_SAINT_LOUIS))).toBe(true)
    })

    it('may be followed in either direction', () => {
        expect(isLink(NETWORK, link(RED, [...KANSAS_CITY_TO_SAINT_LOUIS].reverse()))).toBe(true)
    })

    it('is not a link of a railroad missing from one of its hexes', () => {
        const gap = trackOf([RED, KANSAS_CITY_TO_SAINT_LOUIS])
        gap['hex.usa.8-34'] = [BLUE]
        expect(isLink(gap, link(RED, KANSAS_CITY_TO_SAINT_LOUIS))).toBe(false)
    })

    it('is not a link when two hexes in a row are not adjacent', () => {
        const skipping: HexId[] = ['hex.usa.8-32', 'hex.usa.8-36', 'hex.usa.8-38']
        expect(isLink(NETWORK, link(RED, skipping))).toBe(false)
    })

    it('must start and end in a city', () => {
        expect(isLink(NETWORK, link(RED, KANSAS_CITY_TO_SAINT_LOUIS.slice(0, 3)))).toBe(false)
        expect(isLink(NETWORK, link(RED, KANSAS_CITY_TO_SAINT_LOUIS.slice(1)))).toBe(false)
    })

    it('needs at least two hexes and only hexes of the map', () => {
        expect(isLink(NETWORK, link(RED, ['hex.usa.8-32']))).toBe(false)
        expect(isLink(NETWORK, link(RED, ['hex.usa.8-32', 'hex.usa.99-99']))).toBe(false)
    })

    it('R-3.3.2: ends at the first city, so track through a city is two links', () => {
        const throughSaintLouis = [
            ...KANSAS_CITY_TO_SAINT_LOUIS,
            ...SAINT_LOUIS_TO_CINCINNATI.slice(1)
        ]
        expect(isLink(NETWORK, link(RED, throughSaintLouis))).toBe(false)
        expect(isLink(NETWORK, link(RED, KANSAS_CITY_TO_SAINT_LOUIS))).toBe(true)
        expect(isLink(NETWORK, link(RED, SAINT_LOUIS_TO_CINCINNATI))).toBe(true)
    })
})

describe('the journey test (R-3.3.1, R-3.3.2, R-3.3.3)', () => {
    const route = [
        link(RED, KANSAS_CITY_TO_SAINT_LOUIS),
        link(RED, SAINT_LOUIS_TO_CINCINNATI),
        link(BLUE, CINCINNATI_TO_PITTSBURGH)
    ]

    it('accepts links that meet in cities, the meeting city counted once', () => {
        expect(journeyRefusal(riding(), route)).toBeUndefined()
        expect(isLegalJourney(riding(), route)).toBe(true)
    })

    it('R-3.3.2: may use railroads the rider holds no share in', () => {
        const state = riding(NETWORK, undefined, { p1: {}, p2: { 'railroad.red': 1 } })
        expect(state.getPlayerState('p1').shares).toEqual({})
        expect(isLegalJourney(state, route)).toBe(true)
    })

    it('R-3.3.1: refuses a journey with no links', () => {
        expect(journeyRefusal(riding(), [])).toBe('no-links')
    })

    it('R-3.3.2: refuses a link not of its railroad', () => {
        expect(journeyRefusal(riding(), [link(BLUE, KANSAS_CITY_TO_SAINT_LOUIS)])).toBe(
            'not-a-link'
        )
    })

    it("R-3.3.2: refuses a railroad's track through a city sent as one link", () => {
        const throughSaintLouis = [
            ...KANSAS_CITY_TO_SAINT_LOUIS,
            ...SAINT_LOUIS_TO_CINCINNATI.slice(1)
        ]
        expect(journeyRefusal(riding(), [link(RED, throughSaintLouis)])).toBe('not-a-link')
    })

    it('R-3.3.2: refuses links that do not meet in a city', () => {
        const apart = [link(RED, KANSAS_CITY_TO_SAINT_LOUIS), link(BLUE, CINCINNATI_TO_PITTSBURGH)]
        expect(journeyRefusal(riding(), apart)).toBe('links-do-not-meet')
    })

    it('R-3.3.1: refuses a start without a passenger', () => {
        const state = riding(NETWORK, ['city.usa.saint-louis', 'city.usa.pittsburgh'])
        expect(journeyRefusal(state, route)).toBe('no-passenger')
    })

    it('R-3.3.3: refuses a hex visited twice', () => {
        const crossing = [
            link(RED, KANSAS_CITY_TO_SAINT_LOUIS),
            link(BLUE, SAINT_LOUIS_TO_LITTLE_ROCK_CROSSING)
        ]
        expect(journeyRefusal(riding(), crossing)).toBe('hex-visited-twice')
    })

    it('R-3.3.3: refuses a journey ending where it started', () => {
        const loop = [
            link(RED, KANSAS_CITY_TO_SAINT_LOUIS),
            link(BLUE, SAINT_LOUIS_TO_KANSAS_CITY_NORTH)
        ]
        expect(journeyRefusal(riding(), loop)).toBe('hex-visited-twice')
    })
})

describe('journey payments (R-3.3.4, R-3.3.5)', () => {
    const twoRedOneBlue = [
        link(RED, KANSAS_CITY_TO_SAINT_LOUIS),
        link(RED, SAINT_LOUIS_TO_CINCINNATI),
        link(BLUE, CINCINNATI_TO_PITTSBURGH)
    ]

    it("pays each Red shareholder $2 per Red share, each Blue shareholder $1 per Blue share, and the rider's fare", () => {
        const state = riding(NETWORK, undefined, {
            p1: { 'railroad.red': 1 },
            p2: { 'railroad.red': 2, 'railroad.blue': 1 },
            p3: { 'railroad.blue': 3, 'railroad.orange': 2 }
        })
        expect(journeyPayments(state.players, 'p1', twoRedOneBlue)).toEqual({
            linksPerRailroad: { 'railroad.red': 2, 'railroad.blue': 1 },
            payments: [
                { playerId: 'p1', dividends: 2, fare: 4 },
                { playerId: 'p2', dividends: 5, fare: 0 },
                { playerId: 'p3', dividends: 3, fare: 0 }
            ]
        })
    })

    it('R-3.3.5: the fare is the cities visited, start and end included', () => {
        expect(journeyCities(twoRedOneBlue)).toEqual([
            'city.usa.kansas-city',
            'city.usa.saint-louis',
            'city.usa.cincinnati',
            'city.usa.pittsburgh'
        ])
    })
})

describe('whether a journey exists (R-3.3.1)', () => {
    it('is false with no track', () => {
        expect(journeyExists(riding({}))).toBe(false)
    })

    it('is true when a passenger city has a link out', () => {
        const track = trackOf([RED, KANSAS_CITY_TO_SAINT_LOUIS])
        expect(journeyExists(riding(track, ['city.usa.kansas-city']))).toBe(true)
        expect(journeyExists(riding(track, ['city.usa.saint-louis']))).toBe(true)
    })

    it('is false when no passenger city has a link out', () => {
        const track = trackOf([RED, KANSAS_CITY_TO_SAINT_LOUIS])
        expect(journeyExists(riding(track, ['city.usa.chicago', 'city.usa.pittsburgh']))).toBe(
            false
        )
    })

    it('is false when track stops short of another city', () => {
        const spur = trackOf([RED, KANSAS_CITY_TO_SAINT_LOUIS.slice(0, 3)])
        expect(journeyExists(riding(spur))).toBe(false)
    })

    it('R-3.3.2: is false when only a change of railroad outside a city reaches another city', () => {
        const track = trackOf(
            [RED, KANSAS_CITY_TO_SAINT_LOUIS.slice(0, 2)],
            [BLUE, KANSAS_CITY_TO_SAINT_LOUIS.slice(2)]
        )
        expect(journeyExists(riding(track))).toBe(false)
    })
})

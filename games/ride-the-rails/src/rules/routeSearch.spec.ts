import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { doubledToAxial, hexCoordinates, type HexId } from '../data/hexes.js'
import { LOCOMOTIVES_PER_RAILROAD, RAILROAD_IDS, type RailroadId } from '../data/railroads.js'
import {
    adjacentHexIds,
    hexOrder,
    USA_CITIES,
    USA_HEXES,
    usaCity,
    usaHex,
    type CityId
} from '../data/usaMap.js'
import { PhaseName } from '../definition/phases.js'
import type { HydratedRideTheRailsGameState, Track } from '../model/gameState.js'
import type { Shares } from '../model/playerState.js'
import { buildState } from '../testing/fixtures.js'
import {
    BEST_JOURNEYS_EXPANSION_CAP,
    bestJourneys,
    firstLinkFrom,
    nextCities,
    realise,
    type RankedJourney
} from './routeSearch.js'
import { isLegalJourney, isLink, journeyCities, journeyRefusal, type Link } from './routes.js'
import { railroadsIn } from './track.js'

const RED: RailroadId = 'railroad.red'
const BLUE: RailroadId = 'railroad.blue'

const KANSAS_CITY: CityId = 'city.usa.kansas-city'
const SAINT_LOUIS: CityId = 'city.usa.saint-louis'
const CINCINNATI: CityId = 'city.usa.cincinnati'
const PITTSBURGH: CityId = 'city.usa.pittsburgh'
const LITTLE_ROCK: CityId = 'city.usa.little-rock'
const DES_MOINES: CityId = 'city.usa.des-moines'
const SEATTLE: CityId = 'city.usa.seattle'
const SPOKANE: CityId = 'city.usa.spokane'
const PORTLAND: CityId = 'city.usa.portland-or'
const OKLAHOMA_CITY: CityId = 'city.usa.oklahoma-city'

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
const KANSAS_CITY_TO_SAINT_LOUIS_NORTH: readonly HexId[] = [
    'hex.usa.8-32',
    'hex.usa.7-33',
    'hex.usa.7-35',
    'hex.usa.7-37',
    'hex.usa.8-38'
]
const KANSAS_CITY_TO_SAINT_LOUIS_SOUTH: readonly HexId[] = [
    'hex.usa.8-32',
    'hex.usa.9-33',
    'hex.usa.9-35',
    'hex.usa.9-37',
    'hex.usa.8-38'
]
const KANSAS_CITY_TO_SAINT_LOUIS_FAR_NORTH: readonly HexId[] = [
    'hex.usa.8-32',
    'hex.usa.7-33',
    'hex.usa.6-34',
    'hex.usa.6-36',
    'hex.usa.6-38',
    'hex.usa.7-39',
    'hex.usa.8-38'
]
const SAINT_LOUIS_TO_LITTLE_ROCK_CROSSING: readonly HexId[] = [
    'hex.usa.8-38',
    'hex.usa.8-36',
    'hex.usa.9-35',
    'hex.usa.10-36',
    'hex.usa.11-37'
]
const SAINT_LOUIS_TO_DES_MOINES: readonly HexId[] = [
    'hex.usa.8-38',
    'hex.usa.7-37',
    'hex.usa.6-36',
    'hex.usa.5-37'
]

function link(railroadId: RailroadId, hexIds: readonly HexId[]): Link {
    return { railroadId, hexIds: [...hexIds] }
}

function trackOf(...paths: [RailroadId, readonly HexId[]][]): Track {
    const track: Track = {}
    for (const [railroadId, hexIds] of paths) {
        for (const hexId of hexIds) {
            addTrack(track, hexId, railroadId)
        }
    }
    return track
}

function addTrack(track: Track, hexId: HexId, railroadId: RailroadId) {
    const railroads = railroadsIn(track, hexId)
    if (!railroads.includes(railroadId)) {
        track[hexId] = [...railroads, railroadId]
    }
}

function riding(track: Track, shares?: Record<string, Shares>, passengers?: CityId[]) {
    return buildState({
        playerCount: 3,
        round: 6,
        phase: PhaseName.Ride,
        track,
        shares,
        passengers
    })
}

const NETWORK = trackOf(
    [RED, KANSAS_CITY_TO_SAINT_LOUIS],
    [RED, SAINT_LOUIS_TO_CINCINNATI],
    [BLUE, CINCINNATI_TO_PITTSBURGH],
    [BLUE, KANSAS_CITY_TO_SAINT_LOUIS_FAR_NORTH],
    [BLUE, SAINT_LOUIS_TO_LITTLE_ROCK_CROSSING]
)

const BACKTRACK = trackOf(
    [RED, KANSAS_CITY_TO_SAINT_LOUIS_SOUTH],
    [RED, KANSAS_CITY_TO_SAINT_LOUIS_NORTH],
    [BLUE, SAINT_LOUIS_TO_DES_MOINES]
)

const PARALLEL = trackOf(
    [RED, KANSAS_CITY_TO_SAINT_LOUIS],
    [BLUE, KANSAS_CITY_TO_SAINT_LOUIS],
    [RED, SAINT_LOUIS_TO_CINCINNATI]
)

function distance(a: HexId, b: HexId): number {
    const from = doubledToAxial(hexCoordinates(a))
    const to = doubledToAxial(hexCoordinates(b))
    const dq = from.q - to.q
    const dr = from.r - to.r
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

function hasRoom(track: Track, hexId: HexId, railroadId: RailroadId): boolean {
    const railroads = railroadsIn(track, hexId)
    if (railroads.includes(railroadId)) {
        return true
    }
    const hex = usaHex(hexId)
    const capacity = hex.terrain === 'city' ? usaCity(hex.cityId).capacity : 2
    return capacity === 'unlimited' || railroads.length < capacity
}

function nearestCity(from: HexId, allowed: (hexId: HexId) => boolean): HexId {
    const [nearest] = USA_CITIES.map((city) => city.hexId)
        .filter(allowed)
        .sort((a, b) => distance(from, a) - distance(from, b))
    return nearest
}

// A full round-6 board: each railroad's 27 locomotives run as a chain from a central city to
// the nearest city not yet on its chain, stepping only into hexes with room (R-4.1).
function denseTrack(): Track {
    const track: Track = {}
    const firstCities: HexId[] = [
        'hex.usa.8-32',
        'hex.usa.8-38',
        'hex.usa.5-43',
        'hex.usa.8-46',
        'hex.usa.5-37',
        'hex.usa.10-42'
    ]
    RAILROAD_IDS.forEach((railroadId, index) => {
        let placed = 0
        const place = (hexId: HexId) => {
            if (!railroadsIn(track, hexId).includes(railroadId)) {
                addTrack(track, hexId, railroadId)
                placed += 1
            }
        }
        let current = nearestCity(firstCities[index], (hexId) => hasRoom(track, hexId, railroadId))
        place(current)
        const chained = new Set<HexId>([current])
        while (placed < 27) {
            const target = nearestCity(current, (hexId) => !chained.has(hexId))
            chained.add(target)
            while (current !== target && placed < 27) {
                const step = adjacentHexIds(current).find(
                    (next) =>
                        distance(next, target) < distance(current, target) &&
                        hasRoom(track, next, railroadId)
                )
                if (!step) {
                    break
                }
                place(step)
                current = step
            }
        }
    })
    return track
}

const DENSE = denseTrack()

const FIXTURES: [string, Track][] = [
    ['a network with a crossing', NETWORK],
    ['two realisations of one link', BACKTRACK],
    ['two railroads in the same hexes', PARALLEL],
    ['no track', {}],
    ['a dense round-6 board', DENSE]
]

function railroadsOf(links: readonly Link[]): RailroadId[] {
    return links.map((each) => each.railroadId)
}

function hexIdsOf(links: readonly Link[]): HexId[] {
    return links.flatMap((each, index) => (index === 0 ? each.hexIds : each.hexIds.slice(1)))
}

function isSubsequence(shorter: readonly RankedJourney[], longer: readonly RankedJourney[]) {
    const keys = longer.map((journey) => JSON.stringify(journey.links))
    let from = 0
    return shorter.every((journey) => {
        const found = keys.indexOf(JSON.stringify(journey.links), from)
        from = found + 1
        return found >= 0
    })
}

function startsWithPassengers(state: HydratedRideTheRailsGameState): CityId[] {
    return state.passengers.filter((cityId) => {
        const { hexId } = usaCity(cityId)
        return firstLinkFrom(state, hexId, [hexId]) !== undefined
    })
}

describe('every route a search helper returns passes the journey test (R-3.3.2, R-3.3.3, R-X.1)', () => {
    describe.each(FIXTURES)('on %s', (_name, track) => {
        const state = riding(track)
        const starts = startsWithPassengers(state)

        it('firstLinkFrom: the first link from each passenger city is a one-link journey', () => {
            for (const startCityId of starts) {
                const { hexId } = usaCity(startCityId)
                const found = firstLinkFrom(state, hexId, [hexId])
                assertExists(found, `No link from ${startCityId}`)
                expect(journeyRefusal(state, [found])).toBeUndefined()
            }
        })

        it('bestJourneys, realise and nextCities: every route is legal', () => {
            for (const startCityId of starts) {
                const { journeys } = bestJourneys(state, startCityId, 'p1', 1500)
                expect(journeys.length).toBeGreaterThan(0)
                for (const { links } of journeys) {
                    expect(journeyRefusal(state, links)).toBeUndefined()
                }
                for (const { links } of journeys.slice(0, 8)) {
                    const cities = journeyCities(links)
                    const realised = realise(state, cities, railroadsOf(links))
                    expect(realised).toBeDefined()
                    expect(isLegalJourney(state, realised ?? [])).toBe(true)
                    expect(journeyCities(realised ?? [])).toEqual(cities)
                    for (const next of nextCities(state, startCityId, links)) {
                        expect(cities).not.toContain(next.cityId)
                        for (const railroadId of next.railroadIds) {
                            const extended = realise(
                                state,
                                [...cities, next.cityId],
                                [...railroadsOf(links), railroadId]
                            )
                            expect(isLegalJourney(state, extended ?? [])).toBe(true)
                        }
                    }
                }
            }
        })
    })

    it('the dense board is one the placement rules allow (R-1.1, R-4.1)', () => {
        for (const railroadId of RAILROAD_IDS) {
            const count = Object.values(DENSE).filter((railroads) =>
                railroads.includes(railroadId)
            ).length
            expect(count).toBe(27)
        }
        const overCapacity = USA_HEXES.filter((hex) => {
            const capacity = hex.terrain === 'city' ? usaCity(hex.cityId).capacity : 2
            return capacity !== 'unlimited' && railroadsIn(DENSE, hex.id).length > capacity
        })
        expect(overCapacity.map((hex) => hex.id)).toEqual([])
    })
})

describe('firstLinkFrom (R-3.3.2, R-3.3.3)', () => {
    const state = riding(NETWORK)

    it('takes the first railroad of R-1.4 with a link, then its lowest link by hex id', () => {
        expect(firstLinkFrom(state, 'hex.usa.8-38', ['hex.usa.8-38'])).toEqual(
            link(RED, [...KANSAS_CITY_TO_SAINT_LOUIS].reverse())
        )
    })

    it('R-3.3.3: avoids the visited hexes', () => {
        const visited: HexId[] = ['hex.usa.8-38', 'hex.usa.8-36']
        expect(firstLinkFrom(state, 'hex.usa.8-38', visited)).toEqual(
            link(RED, SAINT_LOUIS_TO_CINCINNATI)
        )
    })

    it('takes the next railroad of R-1.4 once the visited hexes block every link of the first', () => {
        const visited: HexId[] = ['hex.usa.8-38', 'hex.usa.8-36', 'hex.usa.8-40']
        expect(firstLinkFrom(state, 'hex.usa.8-38', visited)).toEqual(
            link(BLUE, [...KANSAS_CITY_TO_SAINT_LOUIS_FAR_NORTH].reverse())
        )
    })

    it('is undefined when the visited hexes block every link', () => {
        const visited: HexId[] = ['hex.usa.8-38', 'hex.usa.8-36', 'hex.usa.8-40', 'hex.usa.7-39']
        expect(firstLinkFrom(state, 'hex.usa.8-38', visited)).toBeUndefined()
    })

    it('R-3.3.2: stops at the first city', () => {
        const found = firstLinkFrom(state, 'hex.usa.8-32', ['hex.usa.8-32'])
        assertExists(found, 'No link from Kansas City')
        expect(isLink(NETWORK, found)).toBe(true)
        expect(found.hexIds.at(-1)).toBe('hex.usa.8-38')
    })
})

describe('nextCities (R-3.3.2, R-3.3.3)', () => {
    const state = riding(NETWORK)

    it('offers each city one link reaches, with the railroads that make it', () => {
        expect(nextCities(state, KANSAS_CITY, [])).toEqual([
            { cityId: SAINT_LOUIS, railroadIds: [RED, BLUE] }
        ])
    })

    it('R-3.3.3: never offers a city on the route or one reachable only through a used hex', () => {
        const route = [link(RED, KANSAS_CITY_TO_SAINT_LOUIS)]
        expect(nextCities(state, KANSAS_CITY, route)).toEqual([
            { cityId: CINCINNATI, railroadIds: [RED] }
        ])
    })

    it('offers a city again once the route avoids the used hex', () => {
        const route = [link(BLUE, KANSAS_CITY_TO_SAINT_LOUIS_FAR_NORTH)]
        expect(nextCities(state, KANSAS_CITY, route)).toEqual([
            { cityId: CINCINNATI, railroadIds: [RED] },
            { cityId: LITTLE_ROCK, railroadIds: [BLUE] }
        ])
    })
})

describe('realise (R-3.3.2, R-3.3.3, R-X.1)', () => {
    const state = riding(BACKTRACK)

    it('returns the first realisation in the deterministic order', () => {
        expect(realise(state, [KANSAS_CITY, SAINT_LOUIS], [RED])).toEqual([
            link(RED, KANSAS_CITY_TO_SAINT_LOUIS_NORTH)
        ])
    })

    it('R-3.3.3: passes over a realisation that would reuse a hex later in the route', () => {
        expect(realise(state, [KANSAS_CITY, SAINT_LOUIS, DES_MOINES], [RED, BLUE])).toEqual([
            link(RED, KANSAS_CITY_TO_SAINT_LOUIS_SOUTH),
            link(BLUE, SAINT_LOUIS_TO_DES_MOINES)
        ])
    })

    it('returns none when no realisation is legal', () => {
        expect(realise(state, [KANSAS_CITY, SAINT_LOUIS, DES_MOINES], [RED, RED])).toBeUndefined()
        expect(realise(state, [KANSAS_CITY, SAINT_LOUIS, KANSAS_CITY], [RED, RED])).toBeUndefined()
        expect(realise(state, [KANSAS_CITY, DES_MOINES], [BLUE])).toBeUndefined()
    })

    it('R-3.3.1: returns none from a city without a passenger', () => {
        const noPassenger = riding(BACKTRACK, undefined, [SAINT_LOUIS])
        expect(realise(noPassenger, [KANSAS_CITY, SAINT_LOUIS], [RED])).toBeUndefined()
    })
})

describe('realise takes the shortest way for each link (R-3.3.2, R-3.3.3)', () => {
    const BALTIMORE: CityId = 'city.usa.baltimore'
    const WASHINGTON: CityId = 'city.usa.washington'
    // Red: Baltimore, the plain south-west of it, Washington. A longer Red way runs from that
    // plain through the plain west of Washington, which Red's line on to Cincinnati also uses.
    const SHORT_WAY: readonly HexId[] = ['hex.usa.9-55', 'hex.usa.10-54', 'hex.usa.11-55']
    const LONG_WAY: readonly HexId[] = [
        'hex.usa.9-55',
        'hex.usa.10-54',
        'hex.usa.11-53',
        'hex.usa.11-55'
    ]
    const WASHINGTON_TO_CINCINNATI: readonly HexId[] = [
        'hex.usa.11-55',
        'hex.usa.11-53',
        'hex.usa.10-52',
        'hex.usa.9-51',
        'hex.usa.9-49',
        'hex.usa.8-48',
        'hex.usa.8-46'
    ]
    const state = riding(trackOf([RED, LONG_WAY], [RED, WASHINGTON_TO_CINCINNATI]))

    it('draws one link the short way, not through the plain west of Washington', () => {
        expect(realise(state, [BALTIMORE, WASHINGTON], [RED])).toEqual([link(RED, SHORT_WAY)])
    })

    it('keeps the short way when a second link takes the plain west of Washington', () => {
        expect(realise(state, [BALTIMORE, WASHINGTON, CINCINNATI], [RED, RED])).toEqual([
            link(RED, SHORT_WAY),
            link(RED, WASHINGTON_TO_CINCINNATI)
        ])
    })

    // Red also runs Baltimore, the plain south-east of it, Washington: as short, later in hex
    // order. Red's line from Washington to Pittsburgh can only leave through the south-west plain.
    const OTHER_SHORT_WAY: readonly HexId[] = ['hex.usa.9-55', 'hex.usa.10-56', 'hex.usa.11-55']
    const WASHINGTON_TO_PITTSBURGH: readonly HexId[] = [
        'hex.usa.11-55',
        'hex.usa.10-54',
        'hex.usa.9-53',
        'hex.usa.8-52',
        'hex.usa.7-51'
    ]
    const shared = riding(
        trackOf([RED, SHORT_WAY], [RED, OTHER_SHORT_WAY], [RED, WASHINGTON_TO_PITTSBURGH])
    )

    it('breaks a tie between two shortest ways in hex order', () => {
        expect(realise(shared, [BALTIMORE, WASHINGTON], [RED])).toEqual([link(RED, SHORT_WAY)])
    })

    it('R-3.3.3: backs up to the other short way when a later link needs a hex of the first', () => {
        const route = realise(shared, [BALTIMORE, WASHINGTON, PITTSBURGH], [RED, RED])
        expect(route).toEqual([link(RED, OTHER_SHORT_WAY), link(RED, WASHINGTON_TO_PITTSBURGH)])
        expect(isLegalJourney(shared, route ?? [])).toBe(true)
    })
})

describe('bestJourneys (R-3.3.4, R-3.3.5)', () => {
    it("ranks the rider's fare plus their own dividends first", () => {
        const state = riding(NETWORK, { p1: { [BLUE]: 2 }, p2: { [RED]: 3 } })
        const { journeys, capped } = bestJourneys(state, KANSAS_CITY, 'p1')
        expect(capped).toBe(false)
        expect(journeys[0]).toEqual({
            links: [
                link(BLUE, KANSAS_CITY_TO_SAINT_LOUIS_FAR_NORTH),
                link(RED, SAINT_LOUIS_TO_CINCINNATI),
                link(BLUE, CINCINNATI_TO_PITTSBURGH)
            ],
            gain: 8
        })
        expect(journeyCities(journeys[0].links)).toEqual([
            KANSAS_CITY,
            SAINT_LOUIS,
            CINCINNATI,
            PITTSBURGH
        ])
        expect(journeys.map((journey) => journey.gain)).toEqual([8, 7, 6, 5, 4, 3, 2])
    })

    it('breaks a tie in gain toward more links', () => {
        const state = riding(NETWORK, { p1: { [BLUE]: 1 } })
        const { journeys } = bestJourneys(state, KANSAS_CITY, 'p1')
        const twoRed = journeys.findIndex(
            ({ links }) => links.length === 2 && railroadsOf(links).every((id) => id === RED)
        )
        const oneBlue = journeys.findIndex(
            ({ links }) => links.length === 1 && links[0].railroadId === BLUE
        )
        expect(journeys[twoRed].gain).toBe(journeys[oneBlue].gain)
        expect(twoRed).toBeLessThan(oneBlue)
    })

    it('then toward fewer hexes', () => {
        const { journeys } = bestJourneys(riding(NETWORK), KANSAS_CITY, 'p1')
        expect(journeys.filter(({ links }) => links.length === 1)).toEqual([
            { links: [link(RED, KANSAS_CITY_TO_SAINT_LOUIS)], gain: 2 },
            { links: [link(BLUE, KANSAS_CITY_TO_SAINT_LOUIS_FAR_NORTH)], gain: 2 }
        ])
    })

    it('then toward id order, railroads in the order of R-1.4', () => {
        const { journeys } = bestJourneys(riding(PARALLEL), KANSAS_CITY, 'p1')
        expect(journeys.map(({ links }) => railroadsOf(links))).toEqual([
            [RED, RED],
            [BLUE, RED],
            [RED],
            [BLUE]
        ])
    })

    it('R-3.3.1: lists nothing from a city without a passenger', () => {
        const state = riding(NETWORK, undefined, [SAINT_LOUIS])
        expect(bestJourneys(state, KANSAS_CITY, 'p1')).toEqual({
            journeys: [],
            expansions: 0,
            capped: false
        })
    })

    it('visits each hex of a listed journey once', () => {
        const { journeys } = bestJourneys(riding(NETWORK), SAINT_LOUIS, 'p1')
        for (const { links } of journeys) {
            const hexIds = hexIdsOf(links)
            expect(new Set(hexIds).size).toBe(hexIds.length)
        }
    })
})

describe('the expansion cap (R-X.1)', () => {
    const dense = riding(DENSE)

    it('bounds the search on a dense round-6 board', () => {
        const result = bestJourneys(dense, SAINT_LOUIS, 'p1')
        expect(result.capped).toBe(true)
        expect(result.expansions).toBe(BEST_JOURNEYS_EXPANSION_CAP)
        expect(bestJourneys(dense, SAINT_LOUIS, 'p1', 250).expansions).toBe(250)
    })

    it('can only shorten the list', () => {
        const short = bestJourneys(dense, SAINT_LOUIS, 'p1', 250).journeys
        const long = bestJourneys(dense, SAINT_LOUIS, 'p1', 2500).journeys
        expect(short.length).toBeLessThan(long.length)
        expect(isSubsequence(short, long)).toBe(true)
    })

    it('leaves a search that ends under the cap whole', () => {
        const state = riding(NETWORK)
        const whole = bestJourneys(state, KANSAS_CITY, 'p1', Number.POSITIVE_INFINITY)
        const capped = bestJourneys(state, KANSAS_CITY, 'p1', 6)
        expect(whole.capped).toBe(false)
        expect(bestJourneys(state, KANSAS_CITY, 'p1')).toEqual(whole)
        expect(capped.capped).toBe(true)
        expect(capped.journeys.length).toBeLessThan(whole.journeys.length)
        expect(isSubsequence(capped.journeys, whole.journeys)).toBe(true)
    })
})

// Red's whole railroad in one block: Spokane, Seattle and the non-city hexes nearest Spokane. The
// block holds millions of distinct paths between the two cities.
function spokaneBlock(): HexId[] {
    const spokane = usaCity(SPOKANE).hexId
    const block = USA_HEXES.filter((hex) => hex.terrain !== 'city')
        .map((hex) => hex.id)
        .sort((a, b) => distance(spokane, a) - distance(spokane, b) || hexOrder(a) - hexOrder(b))
        .slice(0, LOCOMOTIVES_PER_RAILROAD - 2)
    return [spokane, usaCity(SEATTLE).hexId, ...block]
}

describe('a block of track with millions of paths (R-3.3.2, R-3.3.3, R-X.1)', () => {
    const block = spokaneBlock()
    const track = trackOf([RED, block])
    const state = riding(track)
    const seattle = usaCity(SEATTLE).hexId

    it('is one railroad of 27 locomotives, Seattle next to the block', () => {
        expect(Object.keys(track)).toHaveLength(LOCOMOTIVES_PER_RAILROAD)
        expect(adjacentHexIds(seattle).filter((hexId) => track[hexId] !== undefined)).toEqual([
            'hex.usa.0-6',
            'hex.usa.1-5',
            'hex.usa.1-3'
        ])
    })

    it('offers the next city and realises the link without walking every path', () => {
        expect(nextCities(state, SPOKANE, [])).toEqual([{ cityId: SEATTLE, railroadIds: [RED] }])
        const realised = realise(state, [SPOKANE, SEATTLE], [RED])
        expect(realised).toEqual([
            link(RED, ['hex.usa.0-10', 'hex.usa.0-8', 'hex.usa.0-6', 'hex.usa.0-4'])
        ])
        expect(nextCities(state, SPOKANE, realised ?? [])).toEqual([])
        expect(realise(state, [SPOKANE, SEATTLE, SPOKANE], [RED, RED])).toBeUndefined()
    }, 2000)

    it('finds no realisation, quickly, when every way through the block meets a later link', () => {
        // Red reaches Seattle only through 0-6, which Blue's only link out of Seattle uses.
        const neck = block.filter((hexId) => hexId !== 'hex.usa.1-5' && hexId !== 'hex.usa.1-3')
        const blueLink: HexId[] = [
            seattle,
            'hex.usa.0-6',
            'hex.usa.1-7',
            'hex.usa.2-6',
            usaCity(PORTLAND).hexId
        ]
        const blocked = riding(trackOf([RED, neck], [BLUE, blueLink]))
        expect(realise(blocked, [SEATTLE, PORTLAND], [BLUE])).toEqual([link(BLUE, blueLink)])
        expect(realise(blocked, [SPOKANE, SEATTLE], [RED])).toBeDefined()
        expect(realise(blocked, [SPOKANE, SEATTLE, PORTLAND], [RED, BLUE])).toBeUndefined()
    }, 2000)
})

// The 25 non-city hexes nearest a city, a railroad's whole track with that city and one more.
function blockAround(cityId: CityId): HexId[] {
    const hexId = usaCity(cityId).hexId
    return USA_HEXES.filter((hex) => hex.terrain !== 'city')
        .map((hex) => hex.id)
        .sort((a, b) => distance(hexId, a) - distance(hexId, b) || hexOrder(a) - hexOrder(b))
        .slice(0, LOCOMOTIVES_PER_RAILROAD - 2)
}

describe('a route whose first link must leave room for a later one (R-3.3.2, R-3.3.3, R-X.1)', () => {
    // Red: Kansas City, Saint Louis and the block around Kansas City. Blue: Saint Louis round the
    // north and west of Kansas City to Oklahoma City, through 7-31, the first hex Red's search
    // takes out of Kansas City; every way Red has through 7-31 meets Blue's only link.
    const BLUE_AROUND: HexId[] = [
        usaCity(SAINT_LOUIS).hexId,
        'hex.usa.7-37',
        'hex.usa.6-36',
        'hex.usa.6-34',
        'hex.usa.6-32',
        'hex.usa.7-31',
        'hex.usa.8-30',
        'hex.usa.9-29',
        usaCity(OKLAHOMA_CITY).hexId
    ]
    const state = riding(
        trackOf(
            [RED, [usaCity(KANSAS_CITY).hexId, usaCity(SAINT_LOUIS).hexId]],
            [RED, blockAround(KANSAS_CITY)],
            [BLUE, BLUE_AROUND]
        )
    )

    it('lights the later city and realises the route round the hexes its link needs', () => {
        expect(nextCities(state, SAINT_LOUIS, [])).toContainEqual({
            cityId: OKLAHOMA_CITY,
            railroadIds: [BLUE]
        })
        const route = realise(state, [KANSAS_CITY, SAINT_LOUIS, OKLAHOMA_CITY], [RED, BLUE])
        expect(route).toBeDefined()
        expect(isLegalJourney(state, route ?? [])).toBe(true)
        expect(route?.[1]).toEqual(link(BLUE, BLUE_AROUND))
    }, 2000)

    it('realises every city nextCities offers after a route, keeping the route as it was', () => {
        const route = realise(state, [KANSAS_CITY, SAINT_LOUIS], [RED]) ?? []
        expect(route).toHaveLength(1)
        for (const next of nextCities(state, KANSAS_CITY, route)) {
            for (const railroadId of next.railroadIds) {
                const extended = realise(
                    state,
                    [KANSAS_CITY, SAINT_LOUIS, next.cityId],
                    [RED, railroadId]
                )
                expect(extended?.slice(0, 1)).toEqual(route)
            }
        }
    }, 2000)
})

describe('the realise cap (R-X.1)', () => {
    // Red enters Saint Louis only through 7-37 or 8-36. Blue's link on to Des Moines passes one
    // of them and its link from Des Moines to Little Rock the other, so no hex is one either must
    // have, yet whichever Red takes leaves the two Blue links one between them: the search backs
    // up over every way through Red's block until it spends its cap.
    const BLUE_GATES: [RailroadId, readonly HexId[]][] = [
        [BLUE, [usaCity(SAINT_LOUIS).hexId, 'hex.usa.7-37', 'hex.usa.8-36']],
        [BLUE, ['hex.usa.7-37', 'hex.usa.6-36', usaCity(DES_MOINES).hexId]],
        [BLUE, [usaCity(DES_MOINES).hexId, 'hex.usa.5-35', 'hex.usa.6-34', 'hex.usa.7-35']],
        [BLUE, ['hex.usa.7-35', 'hex.usa.8-36', 'hex.usa.9-37', 'hex.usa.10-36']],
        [BLUE, ['hex.usa.7-37', 'hex.usa.7-39', 'hex.usa.8-40', 'hex.usa.9-41', 'hex.usa.10-40']],
        [BLUE, ['hex.usa.10-40', 'hex.usa.11-39', usaCity(LITTLE_ROCK).hexId]],
        [BLUE, ['hex.usa.10-36', usaCity(LITTLE_ROCK).hexId]]
    ]
    const track = trackOf(
        [RED, [usaCity(KANSAS_CITY).hexId, usaCity(SAINT_LOUIS).hexId]],
        [RED, blockAround(KANSAS_CITY)],
        ...BLUE_GATES
    )
    const state = riding(track)
    const cities = [KANSAS_CITY, SAINT_LOUIS, DES_MOINES, LITTLE_ROCK]

    it('is a board the placement rules allow, each Blue link possible after some Red link', () => {
        const overCapacity = USA_HEXES.filter(
            (hex) => hex.terrain !== 'city' && railroadsIn(track, hex.id).length > 2
        )
        expect(overCapacity).toEqual([])
        expect(realise(state, cities.slice(0, 3), [RED, BLUE])).toBeDefined()
        expect(realise(state, [SAINT_LOUIS, DES_MOINES, LITTLE_ROCK], [BLUE, BLUE])).toBeDefined()
    })

    it('gives up, quickly, on a route whose later links contend for the hexes every way meets', () => {
        expect(realise(state, cities, [RED, BLUE, BLUE])).toBeUndefined()
    }, 2000)
})

describe('bestJourneys on track that leads to no other city (R-3.3.1, R-X.1)', () => {
    // Red: Spokane and the block around it, no second city. Blue: one link to Seattle.
    const SPOKANE_TO_SEATTLE: HexId[] = [
        usaCity(SPOKANE).hexId,
        'hex.usa.0-8',
        'hex.usa.0-6',
        usaCity(SEATTLE).hexId
    ]
    const state = riding(
        trackOf(
            [RED, [usaCity(SPOKANE).hexId, ...blockAround(SPOKANE)]],
            [BLUE, SPOKANE_TO_SEATTLE]
        )
    )

    it('spends nothing on it and still lists the journey there is', () => {
        const result = bestJourneys(state, SPOKANE, 'p1')
        expect(result.capped).toBe(false)
        expect(result.journeys).toEqual([{ links: [link(BLUE, SPOKANE_TO_SEATTLE)], gain: 2 }])
    }, 2000)
})

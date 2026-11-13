import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    USA_CITIES,
    adjacentHexIds,
    hasTrackIn,
    isEastCoastHex,
    isWestCoastCity,
    transcontinentalLine,
    usaCity,
    type HexId,
    type RailroadId,
    type Track
} from '@tabletop/ride-the-rails'
import { routeSegments, routeStationHexes, transcontinentalRoute } from './routePath.js'

const RED: RailroadId = 'railroad.red'
const PURPLE: RailroadId = 'railroad.purple'

const SEATTLE = usaCity('city.usa.seattle').hexId
const NEW_YORK = usaCity('city.usa.new-york').hexId

// The shortest walk across the map's hexes, by breadth-first search.
function shortestPath(from: HexId, to: HexId): HexId[] {
    const previous = new Map<HexId, HexId | undefined>([[from, undefined]])
    const queue = [from]
    for (let index = 0; index < queue.length; index++) {
        for (const next of adjacentHexIds(queue[index])) {
            if (!previous.has(next)) {
                previous.set(next, queue[index])
                queue.push(next)
            }
        }
    }
    const path: HexId[] = []
    for (let hexId: HexId | undefined = to; hexId; hexId = previous.get(hexId)) path.unshift(hexId)
    expect(path[0]).toBe(from)
    return path
}

const COAST_TO_COAST = shortestPath(SEATTLE, NEW_YORK)

function laid(paths: [RailroadId, readonly HexId[]][]): Track {
    const track: Track = {}
    for (const [railroadId, hexIds] of paths) {
        for (const hexId of hexIds) track[hexId] = [...(track[hexId] ?? []), railroadId]
    }
    return track
}

function expectALine(track: Track, route: HexId[] | undefined) {
    assertExists(route)
    const westCoast = USA_CITIES.filter(isWestCoastCity).map((city) => city.hexId)
    expect(westCoast).toContain(route[0])
    expect(isEastCoastHex(route[route.length - 1])).toBe(true)
    route.slice(1).forEach((hexId, index) => {
        expect(adjacentHexIds(route[index])).toContain(hexId)
    })
    for (const hexId of route) {
        expect(hasTrackIn(track, hexId, RED) || hasTrackIn(track, hexId, PURPLE)).toBe(true)
    }
}

describe('the claimed Transcontinental line (R-4.3.3, R-4.3.3-H1, R-4.3.3-H2)', () => {
    it('finds no line on an empty map, as the rules do', () => {
        expect(transcontinentalRoute({})).toBeUndefined()
        expect(transcontinentalLine({})).toBeUndefined()
    })

    it('finds no line one railroad carries alone, as the rules do', () => {
        const track = laid([[RED, COAST_TO_COAST]])
        expect(transcontinentalLine(track)).toBeUndefined()
        expect(transcontinentalRoute(track)).toBeUndefined()
    })

    it('walks the line two railroads carry from coast to coast, as the rules find it', () => {
        const split = Math.floor(COAST_TO_COAST.length / 2)
        const track = laid([
            [PURPLE, COAST_TO_COAST.slice(0, split + 1)],
            [RED, COAST_TO_COAST.slice(split)]
        ])
        expect(transcontinentalLine(track)).toBeDefined()
        const route = transcontinentalRoute(track)
        expectALine(track, route)
        expect(route).toEqual(COAST_TO_COAST)
    })
})

describe('route lines (R-3.3.2)', () => {
    it('draws a polyline per link and a station at the start and each link end', () => {
        const links = [
            { railroadId: RED, hexIds: COAST_TO_COAST.slice(0, 3) },
            { railroadId: PURPLE, hexIds: COAST_TO_COAST.slice(2, 5) }
        ]
        expect(routeSegments(links).map((segment) => segment.railroadId)).toEqual([RED, PURPLE])
        expect(routeSegments(links)[0].points.split(' ')).toHaveLength(3)
        expect(routeStationHexes(links, SEATTLE)).toEqual([
            SEATTLE,
            COAST_TO_COAST[2],
            COAST_TO_COAST[4]
        ])
        expect(routeStationHexes([], SEATTLE)).toEqual([SEATTLE])
    })
})

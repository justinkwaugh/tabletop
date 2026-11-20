import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    USA_CITIES,
    adjacentHexIds,
    hasTrackIn,
    railroadsIn,
    isEastCoastHex,
    isWestCoastCity,
    transcontinentalLine,
    cityById,
    type HexId,
    type RailroadId,
    type Track
} from '@tabletop/ride-the-rails'
import { pointText } from './boardGeometry.js'
import { routeCubeSegments, routeCubes } from './routePath.js'
import { trackSlot } from './trackLayout.js'

const RED: RailroadId = 'railroad.red'
const PURPLE: RailroadId = 'railroad.purple'

const SEATTLE = cityById('city.usa.seattle').hexId
const NEW_YORK = cityById('city.usa.new-york').hexId

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

describe('the claimed Transcontinental line (R-4.3.3)', () => {
    it('finds no line on an empty map, as the rules do', () => {
        expect(transcontinentalLine({})).toBeUndefined()
    })

    it('finds no line one railroad carries alone, as the rules do', () => {
        const track = laid([[RED, COAST_TO_COAST]])
        expect(transcontinentalLine(track)).toBeUndefined()
    })

    it('walks the line two railroads carry from coast to coast, as the rules find it', () => {
        const split = Math.floor(COAST_TO_COAST.length / 2)
        const track = laid([
            [PURPLE, COAST_TO_COAST.slice(0, split + 1)],
            [RED, COAST_TO_COAST.slice(split)]
        ])
        const route = transcontinentalLine(track)?.hexIds
        expectALine(track, route)
        expect(route).toEqual(COAST_TO_COAST)
    })
})

describe('route lines through the cubes (R-3.3.2)', () => {
    // Red rides the walk's first three hexes, then Purple the next three. The third hex, where
    // the links meet, holds Purple first and Red second; the fourth holds Red, then Purple.
    const links = [
        { railroadId: RED, hexIds: COAST_TO_COAST.slice(0, 3) },
        { railroadId: PURPLE, hexIds: COAST_TO_COAST.slice(2, 5) }
    ]
    const [first, second, third, fourth] = COAST_TO_COAST
    const track = laid([
        [RED, [first, second, fourth]],
        [PURPLE, COAST_TO_COAST.slice(2, 5)],
        [RED, [third]]
    ])
    // A cube's slot among the railroads its hex holds on this track.
    const slotOf = (hexId: HexId, index: number) =>
        trackSlot(hexId, index, railroadsIn(track, hexId).length)
    const centre = (hexId: HexId, index: number) => pointText(slotOf(hexId, index))

    it("draws a polyline per link through its railroad's cube in each hex", () => {
        const segments = routeCubeSegments(links, track)
        expect(segments.map((segment) => segment.railroadId)).toEqual([RED, PURPLE])
        expect(segments[0].points).toBe(
            [
                centre(COAST_TO_COAST[0], 0),
                centre(COAST_TO_COAST[1], 0),
                centre(COAST_TO_COAST[2], 1)
            ].join(' ')
        )
    })

    it("takes the link's railroad's slot where a hex holds two railroads", () => {
        const [, purple] = routeCubeSegments(links, track)
        expect(purple.points).toBe(
            [
                centre(COAST_TO_COAST[2], 0),
                centre(COAST_TO_COAST[3], 1),
                centre(COAST_TO_COAST[4], 0)
            ].join(' ')
        )
        expect(slotOf(COAST_TO_COAST[3], 1)).not.toEqual(slotOf(COAST_TO_COAST[3], 0))
    })

    it('redraws each cube the route uses once, in its slot', () => {
        expect(
            routeCubes(links, track).map(({ hexId, railroadId, slot }) => [hexId, railroadId, slot])
        ).toEqual([
            [COAST_TO_COAST[0], RED, slotOf(COAST_TO_COAST[0], 0)],
            [COAST_TO_COAST[1], RED, slotOf(COAST_TO_COAST[1], 0)],
            [COAST_TO_COAST[2], RED, slotOf(COAST_TO_COAST[2], 1)],
            [COAST_TO_COAST[2], PURPLE, slotOf(COAST_TO_COAST[2], 0)],
            [COAST_TO_COAST[3], PURPLE, slotOf(COAST_TO_COAST[3], 1)],
            [COAST_TO_COAST[4], PURPLE, slotOf(COAST_TO_COAST[4], 0)]
        ])
    })
})

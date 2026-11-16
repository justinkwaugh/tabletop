import { assert, type Point } from '@tabletop/common'
import {
    railroadsIn,
    type CityId,
    type HexId,
    type Link,
    type RailroadId,
    type Track
} from '@tabletop/ride-the-rails'
import { hexCenter, pointText } from './boardGeometry.js'
import { trackSlot, type TrackSlot } from './trackLayout.js'

export type RouteSegment = {
    key: string
    railroadId: RailroadId
    points: string
}

export function polylinePoints(hexIds: readonly HexId[]): string {
    return hexIds.map((hexId) => pointText(hexCenter(hexId))).join(' ')
}

// The slot of the railroad's cube in a hex its route rides through.
function routeSlot(track: Track, hexId: HexId, railroadId: RailroadId): TrackSlot {
    const index = railroadsIn(track, hexId).indexOf(railroadId)
    assert(index >= 0, `No ${railroadId} cube in ${hexId}`)
    return trackSlot(hexId, index)
}

/**
 * A route drawn through the cubes it rides, one polyline per link in its railroad's colour: in
 * each hex the centre of that railroad's cube, so the line bends where a hex holds two railroads.
 */
export function routeCubeSegments(links: readonly Link[], track: Track): RouteSegment[] {
    return links.map((link, index) => ({
        key: `${index}:${link.railroadId}:${link.hexIds[0]}`,
        railroadId: link.railroadId,
        points: link.hexIds
            .map((hexId) => pointText(routeSlot(track, hexId, link.railroadId)))
            .join(' ')
    }))
}

export type RouteCube = {
    key: string
    hexId: HexId
    railroadId: RailroadId
    slot: TrackSlot
}

/** Each cube a route rides, once, in route order: drawn again over the route's line. */
export function routeCubes(links: readonly Link[], track: Track): RouteCube[] {
    const cubes = new Map<string, RouteCube>()
    for (const link of links) {
        for (const hexId of link.hexIds) {
            const key = `${hexId}:${link.railroadId}`
            if (!cubes.has(key)) {
                cubes.set(key, {
                    key,
                    hexId,
                    railroadId: link.railroadId,
                    slot: routeSlot(track, hexId, link.railroadId)
                })
            }
        }
    }
    return [...cubes.values()]
}

/**
 * A station at each city the route visits, on the cube the route rides there: the start on the
 * first link's cube, each link's end on that link's. A start with no link yet, before a railroad
 * is chosen, has its station at the hex's centre.
 */
export function routeStations(
    links: readonly Link[],
    track: Track,
    startHexId: HexId | undefined
): Point[] {
    const cubeCentre = (hexId: HexId, railroadId: RailroadId): Point => {
        const { x, y } = routeSlot(track, hexId, railroadId)
        return { x, y }
    }
    const [first] = links
    const start = first
        ? [cubeCentre(first.hexIds[0], first.railroadId)]
        : startHexId
          ? [hexCenter(startHexId)]
          : []
    const ends = links.flatMap((link) => {
        const end = link.hexIds.at(-1)
        return end ? [cubeCentre(end, link.railroadId)] : []
    })
    return [...start, ...ends]
}

/** The journey draft as the staged route layer draws it: the session's draft, or no route. */
export type StagedRoute = {
    startCityId: CityId | undefined
    links: readonly Link[]
}

export const EMPTY_STAGED_ROUTE: StagedRoute = { startCityId: undefined, links: [] }

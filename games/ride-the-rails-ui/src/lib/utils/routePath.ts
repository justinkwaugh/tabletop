import {
    USA_CITIES,
    adjacentHexIds,
    hasTrackIn,
    isEastCoastHex,
    isWestCoastCity,
    railroadsIn,
    usaHex,
    type CityId,
    type HexId,
    type Link,
    type RailroadId,
    type Track
} from '@tabletop/ride-the-rails'
import { hexCenter } from './boardGeometry.js'

export type RouteSegment = {
    key: string
    railroadId: RailroadId
    points: string
}

export function polylinePoints(hexIds: readonly HexId[]): string {
    return hexIds
        .map((hexId) => {
            const center = hexCenter(hexId)
            return `${center.x.toFixed(1)},${center.y.toFixed(1)}`
        })
        .join(' ')
}

/** A route drawn through its hex centres, one polyline per link in its railroad's colour. */
export function routeSegments(links: readonly Link[]): RouteSegment[] {
    return links.map((link, index) => ({
        key: `${index}:${link.railroadId}:${link.hexIds[0]}`,
        railroadId: link.railroadId,
        points: polylinePoints(link.hexIds)
    }))
}

/** The cities a route visits, as the hexes of its station dots: the start, then each link's end. */
export function routeStationHexes(links: readonly Link[], startHexId: HexId | undefined): HexId[] {
    const ends = links.flatMap((link) => link.hexIds.slice(-1))
    const start = startHexId ?? links[0]?.hexIds[0]
    return start ? [start, ...ends] : ends
}

/** The journey draft as the staged route layer draws it: the session's draft, or no route. */
export type StagedRoute = {
    startCityId: CityId | undefined
    links: readonly Link[]
}

export const EMPTY_STAGED_ROUTE: StagedRoute = { startCityId: undefined, links: [] }

// R-4.3.3-H1: the railroad the walk is on, and which railroads have carried it a step.
type Walk = {
    hexId: HexId
    railroadId: RailroadId
    firstCarrier: RailroadId | undefined
    twoCarriers: boolean
    changedRailroadOutsideCity: boolean
    previous: Walk | undefined
}

function walkKey(walk: Walk): string {
    return [
        walk.hexId,
        walk.railroadId,
        walk.firstCarrier ?? '',
        walk.twoCarriers,
        walk.changedRailroadOutsideCity
    ].join('|')
}

function carried(walk: Walk, railroadId: RailroadId): Pick<Walk, 'firstCarrier' | 'twoCarriers'> {
    if (walk.twoCarriers) return { firstCarrier: undefined, twoCarriers: true }
    if (walk.firstCarrier === undefined || walk.firstCarrier === railroadId) {
        return { firstCarrier: railroadId, twoCarriers: false }
    }
    return { firstCarrier: undefined, twoCarriers: true }
}

function nextWalks(track: Track, walk: Walk): Walk[] {
    const steps = adjacentHexIds(walk.hexId)
        .filter((hexId) => hasTrackIn(track, hexId, walk.railroadId))
        .map((hexId) => ({ ...walk, ...carried(walk, walk.railroadId), hexId, previous: walk }))
    const changedRailroadOutsideCity =
        walk.changedRailroadOutsideCity || usaHex(walk.hexId).terrain !== 'city'
    const changes = railroadsIn(track, walk.hexId)
        .filter((railroadId) => railroadId !== walk.railroadId)
        .map((railroadId) => ({ ...walk, railroadId, changedRailroadOutsideCity, previous: walk }))
    return [...steps, ...changes]
}

function hexesOf(walk: Walk): HexId[] {
    const hexIds: HexId[] = []
    for (let step: Walk | undefined = walk; step; step = step.previous) {
        if (hexIds[0] !== step.hexId) hexIds.unshift(step.hexId)
    }
    return hexIds
}

/**
 * R-4.3.3, R-4.3.3-H1, R-4.3.3-H2: the hexes of a Transcontinental line on the track, for the
 * claimed line the map keeps drawn. It walks the same steps as the logic package's
 * `transcontinentalLine` and prefers, as it does, a line that changes railroad only in cities.
 */
export function transcontinentalRoute(track: Track): HexId[] | undefined {
    const queue: Walk[] = USA_CITIES.filter(isWestCoastCity).flatMap((city) =>
        railroadsIn(track, city.hexId).map((railroadId) => ({
            hexId: city.hexId,
            railroadId,
            firstCarrier: undefined,
            twoCarriers: false,
            changedRailroadOutsideCity: false,
            previous: undefined
        }))
    )
    const seen = new Set(queue.map(walkKey))
    let found: Walk | undefined
    for (let index = 0; index < queue.length; index++) {
        const walk = queue[index]
        if (walk.twoCarriers && isEastCoastHex(walk.hexId)) {
            if (!walk.changedRailroadOutsideCity) return hexesOf(walk)
            found ??= walk
        }
        for (const next of nextWalks(track, walk)) {
            const key = walkKey(next)
            if (!seen.has(key)) {
                seen.add(key)
                queue.push(next)
            }
        }
    }
    return found ? hexesOf(found) : undefined
}

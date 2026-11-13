import type { CityId, HexId, Link, RailroadId } from '@tabletop/ride-the-rails'
import { hexCenter, pointText } from './boardGeometry.js'

export type RouteSegment = {
    key: string
    railroadId: RailroadId
    points: string
}

export function polylinePoints(hexIds: readonly HexId[]): string {
    return hexIds.map((hexId) => pointText(hexCenter(hexId))).join(' ')
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

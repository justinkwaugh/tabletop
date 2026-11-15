import { distanceAxial } from '@tabletop/common'
import {
    ConnectedTrack,
    RailwayMapState,
    StationPlacement,
    companyStationCenters,
    filledStationSpaces,
    sameCenter,
    usesStationAt,
    getCompany,
    type MapStateData,
    type RevenueCenter,
    type TileInventory,
    type FormationState,
    type StartHome,
    type StationPlacementState,
    type StationRules,
    type TileNode
} from '@tabletop/18xx'
import { StationCostPerHex1861 } from './companies.js'
import { Map1861 } from './map.js'
import { TileSet1861 } from './tiles.js'

type StationState = StationPlacementState

/** The hexes between two map locations, without regard to track (§10.5). */
export function hexDistance1861(fromLocationId: string, toLocationId: string): number {
    return distanceAxial(
        Map1861.location(fromLocationId).coordinates,
        Map1861.location(toLocationId).coordinates
    )
}

/**
 * A public company's second station costs R20 a hex from its first, its third R40 a hex from the
 * nearer of the two; the one placed as the company forms is free (§10.5).
 */
function placementCost(state: StationState, stationId: string, locationId?: string): number {
    const station = state.stations.find((entry) => entry.id === stationId)
    if (!station) return 0
    const placed = companyStationCenters(state, station.companyId)
    if (!locationId) return markerRate(state, station, placed.length)
    const perHex = StationCostPerHex1861[placed.length] ?? 0
    if (!perHex) return 0
    return (
        perHex * Math.min(...placed.map((center) => hexDistance1861(center.locationId, locationId)))
    )
}

/**
 * The rate a public company's unplaced station is charged at, as its charter prints it: the free
 * one first, then R20 and R40 a hex, in the order they are placed. The state railway's and the
 * minors' stations cost nothing.
 */
function markerRate(
    state: StationState,
    station: StationState['stations'][number],
    placedCount: number
): number {
    if (station.status !== 'available' || getCompany(state, station.companyId).kind !== 'major')
        return 0
    const waiting = state.stations.filter(
        (entry) => entry.companyId === station.companyId && entry.status === 'available'
    )
    return StationCostPerHex1861[placedCount + waiting.indexOf(station)] ?? 0
}

export const StationRules1861: StationRules = {
    map: Map1861,
    tileSet: TileSet1861,
    placementCost: (state, stationId, context) =>
        placementCost(state, stationId, context?.position.locationId),
    // Only public companies place stations as they operate, one each round (§10.5).
    placementLimit: (state, companyId) => (getCompany(state, companyId).kind === 'major' ? 1 : 0),
    pendingHomes: () => []
}

/**
 * Where a new public company may put its first station: any city space that is neither reserved
 * nor in a city with a station already, and from which no legal route reaches another city
 * (§9.3).
 */
export function majorStartHomes1861(
    state: FormationState & MapStateData,
    companyId: string
): StartHome[] {
    const mapState = new RailwayMapState(Map1861, TileSet1861, state.tileInventory)
    const placement = new StationPlacement(state, StationRules1861)
    const stops = Map1861.definition.locations.flatMap((location) =>
        mapState.tile(location.id).face.nodes.flatMap((node) => {
            if (node.kind === 'junction') return []
            const center = { locationId: location.id, nodeId: node.id }
            const open =
                node.kind === 'city' &&
                !state.stations.some(
                    (station) => station.status === 'placed' && sameCenter(station.position, center)
                ) &&
                !state.stationReservations.some((reservation) => sameCenter(reservation, center))
            return [{ center, open }]
        })
    )
    const reaching = citiesReachingAnotherStop(state.tileInventory, mapState, stops)
    return stops.flatMap(({ center, open }): StartHome[] => {
        if (!open || reaching.has(centerKey(center))) return []
        const [slot] = placement.openSlots(companyId, center.locationId, center.nodeId)
        return slot === undefined ? [] : [{ ...center, slot, cost: 0 }]
    })
}

type Stop = { center: RevenueCenter; open: boolean }

const centerKey = ({ locationId, nodeId }: RevenueCenter) => `${locationId} ${nodeId}`

/**
 * The last answer, for its tiles and open cities: every company at every start price asks the
 * same question of one position.
 */
let lastReach: { key: string; reaching: ReadonlySet<string> } | undefined

/**
 * Which open cities have track to another stop. That track is a route on its own, and no full
 * city blocks a route that ends there, so a search from every other stop finds each open city it
 * leads to, and a search from each open city left finds one whose track leads only to another.
 */
function citiesReachingAnotherStop(
    inventory: TileInventory,
    mapState: RailwayMapState,
    stops: readonly Stop[]
): ReadonlySet<string> {
    const open = stops.filter((stop) => stop.open).map((stop) => stop.center)
    const key = JSON.stringify([inventory.variantId, inventory.placements, open.map(centerKey)])
    if (lastReach?.key !== key) lastReach = { key, reaching: searchReach(mapState, stops) }
    return lastReach.reaching
}

function searchReach(mapState: RailwayMapState, stops: readonly Stop[]): Set<string> {
    const tracked = stops.flatMap(({ center, open }) =>
        open &&
        mapState
            .tile(center.locationId)
            .face.paths.some((path) =>
                path.endpoints.some((end) => end.kind === 'node' && end.nodeId === center.nodeId)
            )
            ? [center]
            : []
    )
    if (!tracked.length) return new Set()
    const reached = (origins: readonly RevenueCenter[], targets: readonly RevenueCenter[]) => {
        const track = new ConnectedTrack(mapState, origins)
        return targets.filter((target) =>
            track.reaches(target.locationId, { kind: 'node', nodeId: target.nodeId })
        )
    }
    const others = stops.filter((stop) => !stop.open).map((stop) => stop.center)
    const reaching = new Set(reached(others, tracked).map(centerKey))
    for (const city of tracked) {
        if (reaching.has(centerKey(city))) continue
        const rest = tracked.filter((other) => !sameCenter(other, city))
        if (reached([city], rest).length) reaching.add(centerKey(city))
    }
    return reaching
}

/** A city full of stations none of which belongs to these companies, which no route passes (§10.1). */
export function blockedFor1861(
    state: Pick<FormationState, 'stations' | 'stationReservations'>,
    companyIds: readonly string[],
    locationId: string,
    node: TileNode
): boolean {
    if (node.kind !== 'city' || node.stationSlots === 0) return false
    return (
        filledStationSpaces(state, locationId, node) >= node.stationSlots &&
        !companyIds.some((companyId) => usesStationAt(state, companyId, locationId, node.id))
    )
}

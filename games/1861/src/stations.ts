import { distanceAxial } from '@tabletop/common'
import {
    ConnectedTrack,
    RailwayMapState,
    StationPlacement,
    companyStationCenters,
    filledStationSpaces,
    usesStationAt,
    getCompany,
    type MapStateData,
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
function placementCost(state: StationState, companyId: string, locationId?: string): number {
    const placed = companyStationCenters(state, companyId)
    const perHex = StationCostPerHex1861[placed.length] ?? 0
    if (!locationId || !perHex) return perHex
    return (
        perHex * Math.min(...placed.map((center) => hexDistance1861(center.locationId, locationId)))
    )
}

export const StationRules1861: StationRules = {
    map: Map1861,
    tileSet: TileSet1861,
    placementCost(state, stationId, context) {
        const station = state.stations.find((entry) => entry.id === stationId)
        if (!station) return 0
        return placementCost(state, station.companyId, context?.position.locationId)
    },
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
    return Map1861.definition.locations.flatMap((location) => {
        const face = mapState.tile(location.id).face
        return face.nodes.flatMap((node): StartHome[] => {
            if (node.kind !== 'city') return []
            const occupied = state.stations.some(
                (station) =>
                    station.status === 'placed' &&
                    station.position.locationId === location.id &&
                    station.position.nodeId === node.id
            )
            const reserved = state.stationReservations.some(
                (reservation) =>
                    reservation.locationId === location.id && reservation.nodeId === node.id
            )
            if (occupied || reserved) return []
            const [slot] = placement.openSlots(companyId, location.id, node.id)
            if (slot === undefined) return []
            if (reachesAnotherCity(state, mapState, location.id, node.id)) return []
            return [{ locationId: location.id, nodeId: node.id, slot, cost: 0 }]
        })
    })
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

function reachesAnotherCity(
    state: FormationState & MapStateData,
    mapState: RailwayMapState,
    locationId: string,
    nodeId: string
): boolean {
    const track = new ConnectedTrack(mapState, [{ locationId, nodeId }], (location, node) =>
        blockedFor1861(state, [], location, node)
    )
    return Map1861.definition.locations.some((location) =>
        mapState
            .tile(location.id)
            .face.nodes.some(
                (node) =>
                    node.kind !== 'junction' &&
                    !(location.id === locationId && node.id === nodeId) &&
                    track.reaches(location.id, { kind: 'node', nodeId: node.id })
            )
    )
}

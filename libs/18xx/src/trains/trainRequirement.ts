import { TrackNetwork } from '../construction/trackNetwork.js'
import type { RailwayMap } from '../map/map.js'
import { RailwayMapState, type MapStateData } from '../map/mapState.js'
import type { TileSet } from '../tiles/inventory.js'
import { companyStationCenters, type StationState } from '../map/station.js'
import type { RevenueCenter } from '../routes/route.js'
import type { AccessRightState } from '../rights/accessRights.js'

/** A stop the company's routes may not use, such as London without a ferry marker. */
export type ClosedStop = (locationId: string, nodeId: string) => boolean

export function hasStationRoute(
    mapState: RailwayMapState,
    state: StationState,
    companyId: string,
    closedStop: ClosedStop = () => false
): boolean {
    return companyStationCenters(state, companyId).some((origin) => {
        const network = new TrackNetwork(mapState, state, companyId, undefined, origin, closedStop)
        return mapState.map.definition.locations.some((location) =>
            mapState
                .tile(location.id)
                .face.nodes.some(
                    (node) =>
                        node.kind !== 'junction' &&
                        (location.id !== origin.locationId || node.id !== origin.nodeId) &&
                        !closedStop(location.id, node.id) &&
                        network.reaches(location.id, { kind: 'node', nodeId: node.id })
                )
        )
    })
}

/**
 * Whether a company must own a train: it has a route from a station to another revenue
 * center, through stops its routes may use.
 */
export function requiresStationRoute<State extends MapStateData = MapStateData & AccessRightState>(
    map: RailwayMap,
    tileSet: TileSet,
    stopAllowed?: (state: State, companyId: string, center: RevenueCenter) => boolean
): (state: State, companyId: string) => boolean {
    return (state, companyId) =>
        hasStationRoute(
            new RailwayMapState(map, tileSet, state.tileInventory),
            state,
            companyId,
            stopAllowed
                ? (locationId, nodeId) => !stopAllowed(state, companyId, { locationId, nodeId })
                : undefined
        )
}

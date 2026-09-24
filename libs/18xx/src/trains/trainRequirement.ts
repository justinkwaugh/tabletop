import { TrackNetwork } from '../construction/trackNetwork.js'
import type { RailwayMap } from '../map/map.js'
import { RailwayMapState, type MapStateData } from '../map/mapState.js'
import type { TileSet } from '../tiles/inventory.js'
import type { StationState } from '../map/station.js'

export function hasStationRoute(
    mapState: RailwayMapState,
    state: StationState,
    companyId: string
): boolean {
    return state.stations.some((station) => {
        if (station.status !== 'placed' || station.companyId !== companyId) return false
        const origin = station.position
        const network = new TrackNetwork(mapState, state, companyId, undefined, origin)
        return mapState.map.definition.locations.some((location) =>
            mapState
                .tile(location.id)
                .face.nodes.some(
                    (node) =>
                        node.kind !== 'junction' &&
                        (location.id !== origin.locationId || node.id !== origin.nodeId) &&
                        network.reaches(location.id, { kind: 'node', nodeId: node.id })
                )
        )
    })
}

export function requiresStationRoute(
    map: RailwayMap,
    tileSet: TileSet
): (state: MapStateData, companyId: string) => boolean {
    return (state, companyId) =>
        hasStationRoute(new RailwayMapState(map, tileSet, state.tileInventory), state, companyId)
}

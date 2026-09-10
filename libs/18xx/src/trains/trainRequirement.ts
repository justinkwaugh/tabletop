import { TrackNetwork } from '../construction/trackNetwork.js'
import type { RailwayMapState } from '../map/mapState.js'
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

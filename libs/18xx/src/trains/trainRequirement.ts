import { assert } from '@tabletop/common'
import { TrackNetwork } from '../construction/trackNetwork.js'
import type { RailwayMap } from '../map/map.js'
import { RailwayMapState, type MapStateData } from '../map/mapState.js'
import type { RevenueCenter } from '../routes/route.js'
import type { TileSet } from '../tiles/inventory.js'
import { companyStationCenters, type StationState } from '../map/station.js'

export function hasStationRoute(
    mapState: RailwayMapState,
    state: StationState,
    companyId: string,
    stopAllowed: (center: RevenueCenter) => boolean = () => true,
    citiesAndTownsOnly = false
): boolean {
    const closedStop = (locationId: string, nodeId: string) => !stopAllowed({ locationId, nodeId })
    return companyStationCenters(state, companyId).some((origin) => {
        const network = new TrackNetwork(mapState, state, companyId, undefined, origin, closedStop)
        return mapState.map.definition.locations.some((location) =>
            mapState
                .tile(location.id)
                .face.nodes.some(
                    (node) =>
                        node.kind !== 'junction' &&
                        !(citiesAndTownsOnly && node.kind === 'offboard') &&
                        (location.id !== origin.locationId || node.id !== origin.nodeId) &&
                        !closedStop(location.id, node.id) &&
                        network.reaches(location.id, { kind: 'node', nodeId: node.id })
                )
        )
    })
}

/**
 * With ``stopAllowed``, a stop closed to the company gives it no route, as a route would not run
 * there. With ``minimumCitiesAndTowns`` as the title's routes declare it, offboards do not make a
 * route, as a run from a city to a port alone is none in 1849 (§10.5.1); the station's city is one
 * stop, so a minimum of up to two is supported.
 */
export function requiresStationRoute<State extends MapStateData = MapStateData>(
    map: RailwayMap,
    tileSet: TileSet,
    stopAllowed?: (state: State, companyId: string, center: RevenueCenter) => boolean,
    { minimumCitiesAndTowns = 0 }: { minimumCitiesAndTowns?: number } = {}
): (state: State, companyId: string) => boolean {
    assert(minimumCitiesAndTowns <= 2, 'A route requirement counts at most two cities and towns')
    return (state, companyId) =>
        hasStationRoute(
            new RailwayMapState(map, tileSet, state.tileInventory),
            state,
            companyId,
            stopAllowed && ((center) => stopAllowed(state, companyId, center)),
            minimumCitiesAndTowns === 2
        )
}

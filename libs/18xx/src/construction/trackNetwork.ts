import type { RevenueCenter } from '../routes/route.js'
import type { RailwayMapState } from '../map/mapState.js'
import { cityIsBlocked, type StationState } from '../map/station.js'
import type { TileFace } from '../tiles/tile.js'
import { ConnectedTrack } from './connectedTrack.js'

export class TrackNetwork extends ConnectedTrack {
    constructor(
        mapState: RailwayMapState,
        state: StationState,
        companyId: string,
        replacement?: { locationId: string; face: TileFace },
        origin?: RevenueCenter,
        closedStop: (locationId: string, nodeId: string) => boolean = () => false
    ) {
        const origins = state.stations.flatMap((station) =>
            station.status === 'placed' &&
            station.companyId === companyId &&
            (!origin ||
                (origin.locationId === station.position.locationId &&
                    origin.nodeId === station.position.nodeId))
                ? [{ locationId: station.position.locationId, nodeId: station.position.nodeId }]
                : []
        )
        super(
            mapState,
            origins,
            (locationId, node) =>
                cityIsBlocked(state, companyId, locationId, node) || closedStop(locationId, node.id),
            replacement
        )
    }
}

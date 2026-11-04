import type { RevenueCenter } from '../routes/route.js'
import type { RailwayMapState } from '../map/mapState.js'
import { cityIsBlocked, companyStationCenters, type StationState } from '../map/station.js'
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
        const origins = companyStationCenters(state, companyId).filter(
            (center) =>
                !origin ||
                (origin.locationId === center.locationId && origin.nodeId === center.nodeId)
        )
        super(
            mapState,
            origins,
            (locationId, node) =>
                cityIsBlocked(state, companyId, locationId, node) ||
                closedStop(locationId, node.id),
            replacement
        )
    }
}

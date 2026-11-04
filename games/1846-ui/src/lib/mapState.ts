import { pendingBlockingStations, type HydratedEighteenFortySixState } from '@tabletop/1846'
import { placedRevenueMarkers, revenueMarkerKind } from './revenueTokens.js'

export function mapState1846<
    State extends Pick<HydratedEighteenFortySixState, 'revenueMarkers' | 'steamboat'> &
        Parameters<typeof pendingBlockingStations>[0]
>(state: State) {
    return {
        ...state,
        locationMarkers: [
            ...placedRevenueMarkers(state).map((marker) => ({
                locationId: marker.locationId,
                kind: revenueMarkerKind(marker.companyId, marker.privateCompanyId)
            })),
            ...pendingBlockingStations(state).map((station) => ({
                locationId: station.locationId,
                kind: station.stationId
            }))
        ]
    }
}

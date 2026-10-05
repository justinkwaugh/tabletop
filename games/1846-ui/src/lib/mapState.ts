import { pendingBlockingStations, type HydratedEighteenFortySixState } from '@tabletop/1846'

export function mapState1846<
    State extends Pick<HydratedEighteenFortySixState, 'revenueMarkers' | 'steamboat'> &
        Parameters<typeof pendingBlockingStations>[0]
>(state: State) {
    const revenueMarkers = [
        ...state.revenueMarkers,
        ...(state.steamboat ? [{ ...state.steamboat, privateCompanyId: 'SC' }] : [])
    ]
    return {
        ...state,
        locationMarkers: [
            ...revenueMarkers.map((marker) => ({
                locationId: marker.locationId,
                kind: `${marker.companyId}:${marker.privateCompanyId}`
            })),
            ...pendingBlockingStations(state).map((station) => ({
                locationId: station.locationId,
                kind: station.stationId
            }))
        ]
    }
}

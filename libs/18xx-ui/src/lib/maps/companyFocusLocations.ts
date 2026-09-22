import { TrackNetwork, type RailwayMapState, type StationState } from '@tabletop/18xx'

export function companyFocusLocations(state: StationState, companyId: string): string[] {
    const placed = state.stations
        .filter((station) => station.status === 'placed')
        .filter((station) => station.companyId === companyId)
        .map((station) => station.position.locationId)
    return [
        ...new Set(
            placed.length
                ? placed
                : state.stationReservations
                      .filter((reservation) => reservation.companyId === companyId)
                      .map((reservation) => reservation.locationId)
        )
    ]
}

export function companyNetworkFocusLocations(
    map: RailwayMapState,
    state: StationState,
    companyId: string
): string[] {
    const network = new TrackNetwork(map, state, companyId)
    const locations = map.map.definition.locations
        .filter(({ id }) => map.tile(id).face.paths.some((path) => network.usesPath(id, path.id)))
        .map(({ id }) => id)
    return [...new Set([...companyFocusLocations(state, companyId), ...locations])]
}

import type { StationState } from '@tabletop/18xx'

export function companyFocusLocations(state: StationState, companyId: string): string[] {
    const placed = state.stations
        .filter((station) => station.status === 'placed')
        .filter((station) => station.companyId === companyId)
        .map((station) => station.position.locationId)
    return [...new Set(placed.length ? placed : state.stationReservations
        .filter((reservation) => reservation.companyId === companyId)
        .map((reservation) => reservation.locationId))]
}

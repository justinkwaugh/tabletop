import { neutralStation, type PlacedStation, type Station, type StationState } from '@tabletop/18xx'
import { CnId } from './ids.js'
import { Map1882 } from './map.js'
import { NeutralStations1882, neutralStationId } from './neutralStationDefinitions.js'

export { neutralStationId }

/** The neutral station pieces, all the Canadian National's to run from (§10.4). */
export function createNeutralStations(): Station[] {
    return NeutralStations1882.map(({ stationId }) => ({
        id: stationId,
        companyId: CnId,
        status: 'available' as const
    }))
}

/** The neutral stations standing on the board. */
export function placedNeutralStations(state: Pick<StationState, 'stations'>): PlacedStation[] {
    return state.stations.flatMap((station) =>
        station.status === 'placed' && neutralStation(Map1882, station.id) ? [station] : []
    )
}

/** Whether a neutral station stands on the board, which the CN's start needs (§10.4). */
export function neutralStationOnBoard(state: Pick<StationState, 'stations'>): boolean {
    return placedNeutralStations(state).length > 0
}

/** The supply's neutral station, while it is still there (§7.1.3). */
export function supplyNeutralStation(state: Pick<StationState, 'stations'>): Station | undefined {
    return state.stations.find(
        (station) => station.id === neutralStationId() && station.status === 'available'
    )
}

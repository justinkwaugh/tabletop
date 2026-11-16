import {
    neutralStation,
    type NeutralStation,
    type PlacedStation,
    type Station,
    type StationState
} from '@tabletop/18xx'
import { CnId, NeutralHolders1882 } from './companies.js'

/** The neutral stations: one on each holder's charter and one in the supply (§2, §10.4). */
export function neutralStationId(holderId?: string): string {
    return `${CnId}:neutral:${holderId ?? 'supply'}`
}

/** The neutral station pieces, all the Canadian National's to run from (§10.4). */
export function createNeutralStations(): {
    stations: Station[]
    neutralStations: NeutralStation[]
} {
    const holders = [...NeutralHolders1882, undefined]
    return {
        stations: holders.map((holderId) => ({
            id: neutralStationId(holderId),
            companyId: CnId,
            status: 'available' as const
        })),
        neutralStations: holders.map((holderId) => ({
            stationId: neutralStationId(holderId),
            ...(holderId ? { heldBy: holderId } : {})
        }))
    }
}

/** The neutral stations standing on the board. */
export function placedNeutralStations(
    state: Pick<StationState, 'stations' | 'neutralStations'>
): PlacedStation[] {
    return state.stations.flatMap((station) =>
        station.status === 'placed' && neutralStation(state, station.id) ? [station] : []
    )
}

/** Whether a neutral station stands on the board, which the CN's start needs (§10.4). */
export function neutralStationOnBoard(
    state: Pick<StationState, 'stations' | 'neutralStations'>
): boolean {
    return placedNeutralStations(state).length > 0
}

/** The supply's neutral station, while it is still there (§7.1.3). */
export function supplyNeutralStation(state: Pick<StationState, 'stations'>): Station | undefined {
    return state.stations.find(
        (station) => station.id === neutralStationId() && station.status === 'available'
    )
}

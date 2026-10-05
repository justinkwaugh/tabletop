import { assertExists } from '@tabletop/common'
import { AdditionalReservations, EighteenFortySixMap } from './map.js'
import { EighteenFortySixTileSet } from './tiles.js'
import {
    StationPlacement,
    type StationRules,
    type StationPlacementState,
    type StationState,
    type ConstructionState,
    type StationReservation
} from '@tabletop/18xx'

const RemoteStations: Readonly<Record<string, { locationId: string; cost: number }>> = {
    'B&O': { locationId: 'H12', cost: 100 },
    PRR: { locationId: 'E11', cost: 60 }
}
export const StationRules1846: StationRules = {
    map: EighteenFortySixMap,
    tileSet: EighteenFortySixTileSet,
    pendingHomes: () => [],
    placementLimit: () => 1,
    allowsDisconnected: (_state, request) =>
        RemoteStations[request.companyId]?.locationId === request.position.locationId,
    placementCost(_state, _stationId, context) {
        if (!context) return 80
        const { companyId, position, connected } = context
        const remote = RemoteStations[companyId]
        if (!connected && remote?.locationId === position.locationId) return remote.cost
        return AdditionalReservations.some(
            (reservation) =>
                reservation.companyId === companyId &&
                reservation.locationId === position.locationId
        )
            ? 40
            : 80
    }
}
export function stationChoices1846(state: StationPlacementState) {
    const station = state.stations.find(
        (station) =>
            station.companyId === state.stationStep?.companyId && station.status === 'available'
    )
    return station ? new StationPlacement(state, StationRules1846).choices(station.id) : []
}

export function releasePrivateReservations(
    state: Pick<StationState, 'stationReservations'>,
    privateCompanyIds: readonly string[]
): StationReservation[] {
    return releaseStationReservations(state, (reservation) =>
        privateCompanyIds.includes(reservation.companyId)
    )
}

export function releaseStationReservations(
    state: Pick<StationState, 'stationReservations'>,
    matches: (reservation: StationReservation) => boolean
): StationReservation[] {
    const removed = state.stationReservations.filter(matches)
    state.stationReservations = state.stationReservations.filter(
        (reservation) => !removed.includes(reservation)
    )
    return removed
}

export const BlockingStationLocations: Readonly<Record<string, string>> = {
    'B&O': 'H12',
    'C&O': 'H12',
    ERIE: 'D20',
    GT: 'D14',
    IC: 'G7',
    NYC: 'E17',
    PRR: 'E11'
}

export function pendingBlockingStations(state: StationState) {
    return state.stations.flatMap((station) => {
        if (station.status !== 'available' || station.id !== `${station.companyId}:blocking`)
            return []
        const locationId = BlockingStationLocations[station.companyId]
        assertExists(locationId, 'A blocking station requires its printed city')
        return [{ stationId: station.id, companyId: station.companyId, locationId }]
    })
}

export function placeBlockingStations(state: ConstructionState, locationId: string): void {
    const pending = pendingBlockingStations(state).filter(
        (station) => station.locationId === locationId
    )
    for (const station of pending) {
        const slot = new StationPlacement(state, StationRules1846).openSlots(
            station.companyId,
            locationId,
            'city'
        )[0]
        assertExists(slot, 'A green upgrade must leave room for its blocking station')
        const index = state.stations.findIndex((candidate) => candidate.id === station.stationId)
        state.stations[index] = {
            id: station.stationId,
            companyId: station.companyId,
            status: 'placed',
            position: { locationId, nodeId: 'city', slot }
        }
    }
}

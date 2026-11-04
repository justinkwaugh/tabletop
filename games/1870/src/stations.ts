import { assertExists } from '@tabletop/common'
import {
    destinationStationId,
    getCompany,
    homeStationId,
    nextOperatingCompany,
    type StationPlacementState,
    type StationRules
} from '@tabletop/18xx'
import { company1870 } from './companies.js'
import { Map1870 } from './map.js'
import { TileSet1870 } from './tiles.js'

const DestinationStationCost = 100

/**
 * A company's stations cost what its charter says; a destination station left on the charter costs
 * $100, once the company has made its connection run (pp. 15, 22).
 */
function placementCost(state: StationPlacementState, stationId: string): number {
    const station = state.stations.find((entry) => entry.id === stationId)
    assertExists(station, 'A station placement requires a known station')
    const destination = destinationStationId(station.companyId)
    if (stationId === destination) return DestinationStationCost
    const used = state.stations.filter(
        (entry) =>
            entry.companyId === station.companyId &&
            entry.id !== destination &&
            entry.status !== 'available'
    ).length
    const cost = company1870(station.companyId)?.stationCosts[used]
    assertExists(cost, 'The charter prices each of its stations')
    return cost
}

export const StationRules1870: StationRules = {
    map: Map1870,
    tileSet: TileSet1870,
    placementCost,
    placementLimit: () => 1,
    // A company places its free home station as it first operates (p. 19).
    pendingHomes(state) {
        const companyId = nextOperatingCompany(state)
        if (!companyId) return []
        const company = getCompany(state, companyId)
        const station = state.stations.find((entry) => entry.id === homeStationId(companyId))
        if (!company.floated || company.closed || station?.status !== 'available') return []
        const reservation = state.stationReservations.find((entry) => entry.companyId === companyId)
        assertExists(reservation, 'An unplaced home station keeps its reservation')
        return [
            {
                stationId: station.id,
                locationId: reservation.locationId,
                nodeId: reservation.nodeId
            }
        ]
    }
}

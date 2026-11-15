import { assertExists } from '@tabletop/common'
import {
    getCompany,
    homeStationId,
    nextOperatingCompany,
    type StationPlacementState,
    type StationRules
} from '@tabletop/18xx'
import { company1850 } from './companies.js'
import { edgeTokenChoice } from './edgeTokens.js'
import { Map1850 } from './map.js'
import { MesabiAccess } from './mesabiAccess.js'
import { requireState1850 } from './state.js'
import { TileSet1850 } from './tiles.js'

/** A company's stations cost what its charter says, cheapest first (§7.5, §15.3). */
function placementCost(state: StationPlacementState, stationId: string): number {
    const station = state.stations.find((entry) => entry.id === stationId)
    assertExists(station, 'A station placement requires a known station')
    const used = state.stations.filter(
        (entry) => entry.companyId === station.companyId && entry.status !== 'available'
    ).length
    const cost = company1850(station.companyId)?.stationCosts[used]
    assertExists(cost, 'The charter prices each of its stations')
    return cost
}

export const StationRules1850: StationRules = {
    map: Map1850,
    tileSet: TileSet1850,
    placementCost,
    stopAllowed: MesabiAccess.open,
    // An edge token counts as the turn's token placement (§7.2, §7.4).
    placementLimit: (state) => (requireState1850(state).edgeTokenPlaced ? 0 : 1),
    holdsStationStep: (state) => !!edgeTokenChoice(requireState1850(state)),
    // A company places its free home station as it first operates (§7.1).
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

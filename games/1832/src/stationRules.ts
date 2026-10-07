import { assertExists } from '@tabletop/common'
import {
    charterStationCost,
    charterStationCounts,
    getCompany,
    homeStationId,
    nextOperatingCompany,
    type StationRules
} from '@tabletop/18xx'
import { EighteenThirtyTwoMap } from './map.js'
import { EighteenThirtyTwoTileSet } from './tiles.js'

// Token costs from each charter, the free home token first (§7.4, §16.3).
export const EighteenThirtyTwoStationCosts: Readonly<Record<string, readonly number[]>> = {
    ACL: [0, 40, 100],
    AWP: [0, 40],
    CG: [0, 40, 100],
    FEC: [0, 40],
    GRR: [0, 40],
    GMO: [0, 40, 100],
    LN: [0, 40, 100],
    NW: [0, 40, 100],
    SAL: [0, 40, 100],
    SOU: [0, 40, 100]
}
export const EighteenThirtyTwoStationCounts = charterStationCounts(EighteenThirtyTwoStationCosts)

export const EighteenThirtyTwoStationRules: StationRules = {
    map: EighteenThirtyTwoMap,
    tileSet: EighteenThirtyTwoTileSet,
    placementCost: (state, stationId) =>
        charterStationCost(state, stationId, EighteenThirtyTwoStationCosts),
    placementLimit: () => 1,
    // A company places its free home token as its first operating turn begins (§7.1).
    pendingHomes(state) {
        const companyId = nextOperatingCompany(state)
        if (!companyId) return []
        const company = getCompany(state, companyId)
        const station = state.stations.find((station) => station.id === homeStationId(companyId))
        if (!company.floated || company.closed || station?.status !== 'available') return []
        const reservation = state.stationReservations.find(
            (reservation) => reservation.companyId === companyId
        )
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

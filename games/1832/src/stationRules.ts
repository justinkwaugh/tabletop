import { assertExists } from '@tabletop/common'
import { getCompany, homeStationId, nextOperatingCompany, type StationRules } from '@tabletop/18xx'
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
export const EighteenThirtyTwoStationCounts: Readonly<Record<string, number>> = Object.fromEntries(
    Object.entries(EighteenThirtyTwoStationCosts).map(([companyId, costs]) => [
        companyId,
        costs.length
    ])
)

export const EighteenThirtyTwoStationRules: StationRules = {
    map: EighteenThirtyTwoMap,
    tileSet: EighteenThirtyTwoTileSet,
    placementCost(state, stationId) {
        const station = state.stations.find((station) => station.id === stationId)
        assertExists(station, 'A station placement requires a known station')
        const used = state.stations.filter(
            (entry) => entry.companyId === station.companyId && entry.status !== 'available'
        ).length
        const cost = EighteenThirtyTwoStationCosts[station.companyId]?.[used]
        assertExists(cost, 'Every 1832 station has a cost')
        return cost
    },
    placementLimit: () => 1,
    // A company places its free home token as its first operating turn begins (§7.1).
    pendingHomes(state) {
        const companyId = nextOperatingCompany(state)
        if (!companyId) return []
        const company = getCompany(state, companyId)
        const station = state.stations.find((station) => station.id === homeStationId(companyId))
        const reservation = state.stationReservations.find(
            (reservation) => reservation.companyId === companyId
        )
        if (!company.floated || company.closed || station?.status !== 'available' || !reservation)
            return []
        return [
            {
                stationId: station.id,
                locationId: reservation.locationId,
                nodeId: reservation.nodeId
            }
        ]
    }
}

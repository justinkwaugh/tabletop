import { assertExists } from '@tabletop/common'
import { homeStationId, nextOperatingCompany, type StationRules } from '@tabletop/18xx'
import { EighteenThirtyMap } from './map.js'
import { EighteenThirtyTileSet } from './tiles.js'

export const EighteenThirtyStationCosts: Readonly<Record<string, readonly number[]>> = {
    PRR: [0, 40, 100, 100],
    NYC: [0, 40, 100, 100],
    CPR: [0, 40, 100, 100],
    BO: [0, 40, 100],
    CO: [0, 40, 100],
    ERIE: [0, 40, 100],
    NYNH: [0, 40],
    BM: [0, 40]
}
export const EighteenThirtyStationCounts: Readonly<Record<string, number>> = Object.fromEntries(
    Object.entries(EighteenThirtyStationCosts).map(([companyId, costs]) => [
        companyId,
        costs.length
    ])
)

export const EighteenThirtyStationRules: StationRules = {
    map: EighteenThirtyMap,
    tileSet: EighteenThirtyTileSet,
    placementCost(state, stationId) {
        const station = state.stations.find((station) => station.id === stationId)
        assertExists(station, 'A station placement requires a known station')
        const used = state.stations.filter(
            (entry) => entry.companyId === station.companyId && entry.status !== 'available'
        ).length
        const cost = EighteenThirtyStationCosts[station.companyId]?.[used]
        assertExists(cost, 'Every 1830 station has a cost')
        return cost
    },
    placementLimit: () => 1,
    // A floated company places its home station as it begins its first operating turn.
    pendingHomes(state) {
        const operating = nextOperatingCompany(state)
        return state.stationReservations.flatMap((reservation) => {
            if (reservation.companyId !== operating) return []
            const company = state.companies.find((company) => company.id === reservation.companyId)
            const station = state.stations.find(
                (station) => station.id === homeStationId(reservation.companyId)
            )
            return company?.floated && !company.closed && station?.status === 'available'
                ? [
                      {
                          stationId: station.id,
                          locationId: reservation.locationId,
                          nodeId: reservation.nodeId
                      }
                  ]
                : []
        })
    }
}

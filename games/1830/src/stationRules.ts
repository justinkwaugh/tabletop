import { assert, assertExists } from '@tabletop/common'
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
    // A floated company places its home station as it begins its first operating turn; its
    // president chooses the city when the company reserves more than one.
    pendingHomes(state) {
        const home = operatingCompanyHome(state)
        return home?.nodeIds.length === 1
            ? [{ stationId: home.stationId, locationId: home.locationId, nodeId: home.nodeIds[0] }]
            : []
    },
    homeChoice(state) {
        const home = operatingCompanyHome(state)
        return home && home.nodeIds.length > 1
            ? {
                  companyId: home.companyId,
                  stationId: home.stationId,
                  positions: home.nodeIds.map((nodeId) => ({
                      locationId: home.locationId,
                      nodeId
                  }))
              }
            : undefined
    }
}

function operatingCompanyHome(state: Parameters<StationRules['pendingHomes']>[0]) {
    const companyId = nextOperatingCompany(state)
    if (!companyId) return undefined
    const company = state.companies.find((company) => company.id === companyId)
    const station = state.stations.find((station) => station.id === homeStationId(companyId))
    if (!company?.floated || company.closed || station?.status !== 'available') return undefined
    const reservations = state.stationReservations.filter(
        (reservation) => reservation.companyId === companyId
    )
    if (!reservations.length) return undefined
    const locationIds = new Set(reservations.map((reservation) => reservation.locationId))
    assert(locationIds.size === 1, 'An 1830 company reserves one home hex')
    return {
        companyId,
        stationId: station.id,
        locationId: reservations[0].locationId,
        nodeIds: reservations.map((reservation) => reservation.nodeId)
    }
}

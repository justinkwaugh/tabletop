import { assert } from '@tabletop/common'
import {
    RailwayMapState,
    charterStationCost,
    charterStationCounts,
    getCompany,
    homeStationId,
    nextOperatingCompany,
    type OperatingStationState,
    type StationRules
} from '@tabletop/18xx'
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
export const EighteenThirtyStationCounts = charterStationCounts(EighteenThirtyStationCosts)

export const EighteenThirtyStationRules: StationRules = {
    map: EighteenThirtyMap,
    tileSet: EighteenThirtyTileSet,
    placementCost: (state, stationId) =>
        charterStationCost(state, stationId, EighteenThirtyStationCosts),
    placementLimit: () => 1,
    // A floated company places its home station as it begins its first operating turn. With
    // several reserved cities, the first is used while its hex has no track; once track gives
    // the cities different connections, the president chooses.
    pendingHomes(state) {
        const home = operatingCompanyHome(state)
        return home && (home.nodeIds.length === 1 || !home.tracked)
            ? [{ stationId: home.stationId, locationId: home.locationId, nodeId: home.nodeIds[0] }]
            : []
    },
    homeChoice(state) {
        const home = operatingCompanyHome(state)
        return home && home.nodeIds.length > 1 && home.tracked
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

function operatingCompanyHome(state: OperatingStationState) {
    const companyId = nextOperatingCompany(state)
    if (!companyId) return undefined
    const company = getCompany(state, companyId)
    const station = state.stations.find((station) => station.id === homeStationId(companyId))
    if (!company.floated || company.closed || station?.status !== 'available') return undefined
    const reservations = state.stationReservations.filter(
        (reservation) => reservation.companyId === companyId
    )
    if (!reservations.length) return undefined
    const locationIds = new Set(reservations.map((reservation) => reservation.locationId))
    assert(locationIds.size === 1, 'An 1830 company reserves one home hex')
    const locationId = reservations[0].locationId
    const face = new RailwayMapState(
        EighteenThirtyMap,
        EighteenThirtyTileSet,
        state.tileInventory
    ).tile(locationId).face
    return {
        companyId,
        stationId: station.id,
        locationId,
        nodeIds: face.nodes
            .filter((node) => reservations.some((reservation) => reservation.nodeId === node.id))
            .map((node) => node.id),
        tracked: face.paths.length > 0
    }
}

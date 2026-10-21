import {
    RailwayMapState,
    charterStationCost,
    charterStationCounts,
    getCompany,
    homeStationId,
    nextOperatingCompany,
    type HomeStation,
    type OperatingStationState,
    type StationRules
} from '@tabletop/18xx'
import { EighteenNinetyFourMap } from './map.js'
import { EighteenNinetyFourTileSet } from './tiles.js'

// §11.3.2.1, §11.3.3.1: companies with two homes place both free.
export const EighteenNinetyFourStationCosts: Readonly<Record<string, readonly number[]>> = {
    PLM: [0, 40, 100, 100, 100],
    CFOR: [0, 0, 100, 100, 100],
    Nord: [0, 0, 100, 100],
    Ouest: [0, 0, 100, 100, 100],
    Est: [0, 40, 100, 100, 100],
    AG: [0, 40, 100, 100, 100],
    Belge: [0, 40, 100],
    LF: [0, 40, 100],
    LB: [0, 40, 100]
}
export const EighteenNinetyFourStationCounts = charterStationCounts(EighteenNinetyFourStationCosts)

/** Stations in the order a company places them: its home first, then its second home. */
function stationId(companyId: string, index: number): string {
    return index ? `${companyId}:station:${index}` : homeStationId(companyId)
}

/**
 * The homes a floated company places as it first operates, one station on each home hex in
 * its reserved city (§7.3.1). The PLM's reservation names Paris's marked city.
 */
export function pendingHomes1894(state: OperatingStationState): HomeStation[] {
    const companyId = nextOperatingCompany(state)
    if (!companyId) return []
    const company = getCompany(state, companyId)
    const home = state.stations.find((station) => station.id === homeStationId(companyId))
    if (!company.floated || company.closed || home?.status !== 'available') return []
    const mapState = new RailwayMapState(
        EighteenNinetyFourMap,
        EighteenNinetyFourTileSet,
        state.tileInventory
    )
    const locationIds = [
        ...new Set(
            state.stationReservations
                .filter((reservation) => reservation.companyId === companyId)
                .map((reservation) => reservation.locationId)
        )
    ]
    return locationIds.flatMap((locationId, index): HomeStation[] => {
        const reservation = state.stationReservations.find(
            (entry) => entry.companyId === companyId && entry.locationId === locationId
        )
        const node = mapState
            .tile(locationId)
            .face.nodes.find((node) => node.kind === 'city' && node.id === reservation?.nodeId)
        return node ? [{ stationId: stationId(companyId, index), locationId, nodeId: node.id }] : []
    })
}

export const EighteenNinetyFourStationRules: StationRules = {
    map: EighteenNinetyFourMap,
    tileSet: EighteenNinetyFourTileSet,
    placementCost: (state, stationId) =>
        charterStationCost(state, stationId, EighteenNinetyFourStationCosts),
    placementLimit: () => 1,
    pendingHomes: pendingHomes1894
}

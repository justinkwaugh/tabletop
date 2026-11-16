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
import { MajorsChesapeake } from './companies.js'
import { MapChesapeake } from './map.js'
import { TileSetChesapeake } from './tiles.js'

export const StationCostsChesapeake: Readonly<Record<string, readonly number[]>> =
    Object.fromEntries(MajorsChesapeake.map((company) => [company.id, company.stationCosts]))
export const StationCountsChesapeake = charterStationCounts(StationCostsChesapeake)

export const StationRulesChesapeake: StationRules = {
    map: MapChesapeake,
    tileSet: TileSetChesapeake,
    placementCost: (state, stationId) =>
        charterStationCost(state, stationId, StationCostsChesapeake),
    placementLimit: () => 1,
    // A floated company places its home station as it begins its first operating turn.
    pendingHomes(state) {
        const home = operatingCompanyHome(state)
        return home
            ? [{ stationId: home.stationId, locationId: home.locationId, nodeId: home.nodeId }]
            : []
    }
}

function operatingCompanyHome(state: OperatingStationState) {
    const companyId = nextOperatingCompany(state)
    if (!companyId) return undefined
    const company = getCompany(state, companyId)
    const station = state.stations.find((entry) => entry.id === homeStationId(companyId))
    if (!company.floated || company.closed || station?.status !== 'available') return undefined
    const reservation = state.stationReservations.find((entry) => entry.companyId === companyId)
    if (!reservation) return undefined
    const face = new RailwayMapState(MapChesapeake, TileSetChesapeake, state.tileInventory).tile(
        reservation.locationId
    ).face
    assert(
        face.nodes.some((node) => node.id === reservation.nodeId),
        'A home reservation names a city of its tile'
    )
    return {
        companyId,
        stationId: station.id,
        locationId: reservation.locationId,
        nodeId: reservation.nodeId
    }
}

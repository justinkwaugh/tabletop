import { assertExists } from '@tabletop/common'
import {
    charterScheduleCost,
    getCompany,
    homeStationId,
    nextOperatingCompany,
    type StationRules
} from '@tabletop/18xx'
import { MapMex, homeLocationMex } from './map.js'
import { requireStateMex } from './state.js'
import { TileSetMex } from './tiles.js'

/**
 * Each major's charter: its free home station, then $40, $60 and $80 for the rest (4.3.2). The
 * NdM's unused merger exchange tokens cost $80 each.
 */
export const StationCostsMex: Readonly<Record<string, readonly number[]>> = {
    CHI: [0, 40, 60, 80],
    NdM: [0, 40, 60, 80, 80, 80],
    MC: [0, 40],
    PAC: [0, 40, 60, 80],
    TM: [0, 40],
    MEX: [0, 40, 60],
    SPM: [0, 40, 60],
    UdY: [0, 40]
}

/** The NdM's two exchange tokens, which the merger adds to its charter (5.3(f)). */
export const HomeExchangeStationId = 'NdM:exchange:1'
export const OtherExchangeStationId = 'NdM:exchange:2'
export const ExchangeStationIds: readonly string[] = [HomeExchangeStationId, OtherExchangeStationId]

export const StationRulesMex: StationRules = {
    map: MapMex,
    tileSet: TileSetMex,
    placementCost(state, stationId, context) {
        const station = state.stations.find((entry) => entry.id === stationId)
        assertExists(station, `Station ${stationId} exists`)
        const schedule = StationCostsMex[station.companyId]
        assertExists(schedule, `The ${station.companyId} charter prices every station`)
        const placedByMerger = requireStateMex(state).mergerStationIds ?? []
        return charterScheduleCost(
            state.stations.filter(
                (entry) =>
                    entry.companyId === station.companyId && !placedByMerger.includes(entry.id)
            ),
            stationId,
            schedule,
            context
        )
    },
    placementLimit: () => 1,
    // A major places its home station as it begins its first operating turn (4.3(a)).
    pendingHomes(state) {
        const companyId = nextOperatingCompany(state)
        if (!companyId) return []
        const company = getCompany(state, companyId)
        const station = state.stations.find((entry) => entry.id === homeStationId(companyId))
        if (!company.floated || company.closed || station?.status !== 'available') return []
        const reservation = state.stationReservations.find((entry) => entry.companyId === companyId)
        const locationId = reservation?.locationId ?? homeLocationMex(companyId)
        return [{ stationId: station.id, locationId, nodeId: reservation?.nodeId ?? 'city' }]
    }
}

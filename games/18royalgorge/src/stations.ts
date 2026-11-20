import { assertExists } from '@tabletop/common'
import { charterScheduleCost, getCompany, type StationRules } from '@tabletop/18xx'
import { RailroadsRoyalGorge } from './companies.js'
import { GorgeStationIds } from './debt.js'
import { GorgeLocationIds, MapRoyalGorge } from './map.js'
import { TileSetRoyalGorge } from './tiles.js'

export const StationCostsRoyalGorge: Readonly<Record<string, readonly number[]>> =
    Object.fromEntries(RailroadsRoyalGorge.map((rail) => [rail.id, rail.stationCosts]))

export const StationRulesRoyalGorge: StationRules = {
    map: MapRoyalGorge,
    tileSet: TileSetRoyalGorge,
    // Stations are paid from the charter in order; Rio Grande's gorge stations are not on it.
    placementCost(state, stationId, context) {
        const station = state.stations.find((entry) => entry.id === stationId)
        assertExists(station, `Station ${stationId} exists`)
        const schedule = StationCostsRoyalGorge[station.companyId]
        assertExists(schedule, `The ${station.companyId} charter prices every station`)
        return charterScheduleCost(
            state.stations.filter(
                (entry) =>
                    entry.companyId === station.companyId && !GorgeStationIds.includes(entry.id)
            ),
            stationId,
            schedule,
            context
        )
    },
    // A railroad places no station in its first turn, its home already placed (Build a Station).
    placementLimit: (state, companyId) => (getCompany(state, companyId).operated ? 1 : 0),
    // Homes are placed as each railroad starts (SC-4).
    pendingHomes: () => [],
    // Only the Treaty of Boston places stations in the gorge (DB-2).
    cityClosed: (_state, locationId) => GorgeLocationIds.includes(locationId)
}

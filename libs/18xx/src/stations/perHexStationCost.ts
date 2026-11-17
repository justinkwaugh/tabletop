import { assertExists, distanceAxial } from '@tabletop/common'
import { getCompany } from '../finance/finance.js'
import type { RailwayMap } from '../map/map.js'
import { companyStationCenters, waitingStationIndex } from '../map/station.js'
import type { StationPlacementState, StationRules } from './stationPlacement.js'

/** The hexes between two map locations, without regard to track. */
export function hexDistance(map: RailwayMap, fromLocationId: string, toLocationId: string): number {
    return distanceAxial(
        map.location(fromLocationId).coordinates,
        map.location(toLocationId).coordinates
    )
}

/**
 * Stations priced by the hex from the company's nearest station on the map, measured without
 * regard to track, at a rate for each station in the order they are placed: a major's free
 * first, then $20 and $40 a hex (1861 §10.5, 1867 GTG §8.7). Only major companies pay.
 */
export function perHexStationCost(
    map: RailwayMap,
    ratesPerHex: readonly number[]
): StationRules['placementCost'] {
    /** The rate an unplaced station is charged at, as the charter prints it. */
    const markerRate = (
        state: StationPlacementState,
        station: StationPlacementState['stations'][number],
        placedCount: number
    ) => {
        if (station.status !== 'available' || getCompany(state, station.companyId).kind !== 'major')
            return 0
        return ratesPerHex[placedCount + waitingStationIndex(state.stations, station)] ?? 0
    }
    return (state, stationId, context) => {
        const station = state.stations.find((entry) => entry.id === stationId)
        assertExists(station, `Station ${stationId} exists`)
        const placed = companyStationCenters(state, station.companyId)
        const locationId = context?.position.locationId
        if (!locationId) return markerRate(state, station, placed.length)
        const perHex = ratesPerHex[placed.length] ?? 0
        if (!perHex) return 0
        return (
            perHex *
            Math.min(...placed.map((center) => hexDistance(map, center.locationId, locationId)))
        )
    }
}

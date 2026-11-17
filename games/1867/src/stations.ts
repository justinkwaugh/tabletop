import {
    UnconnectedCityHomes,
    getCompany,
    hexDistance,
    perHexStationCost,
    sameCenter,
    type StationRules
} from '@tabletop/18xx'
import { StationCostPerHex1867 } from './companies.js'
import { GreenCitySpots1867, GreenCitySpotsOpenPhaseId, Map1867 } from './map.js'
import { TileSet1867 } from './tiles.js'
import { Phases1867 } from './trains.js'

/** The hexes between two map locations, without regard to track (GTG §8.7). */
export function hexDistance1867(fromLocationId: string, toLocationId: string): number {
    return hexDistance(Map1867, fromLocationId, toLocationId)
}

/** Whether a city space printed green, which takes no station before phase 3 (GTG §7.2.1). */
export function greenCityClosed(
    state: { phaseId: string },
    locationId: string,
    nodeId: string
): boolean {
    return (
        !Phases1867.isAtLeast(state.phaseId, GreenCitySpotsOpenPhaseId) &&
        GreenCitySpots1867.some((spot) => sameCenter(spot, { locationId, nodeId }))
    )
}

export const StationRules1867: StationRules = {
    map: Map1867,
    tileSet: TileSet1867,
    // A major's second station costs $20 a hex from its nearest, its third $40 a hex; the one
    // placed as the company forms is free (GTG §8.7).
    placementCost: perHexStationCost(Map1867, StationCostPerHex1867),
    // Only majors place stations as they operate, one each round (GTG §8.7).
    placementLimit: (state, companyId) => (getCompany(state, companyId).kind === 'major' ? 1 : 0),
    pendingHomes: () => [],
    cityClosed: greenCityClosed
}

/**
 * Where a major started in a stock round puts its first station: a city in a hex with no station
 * from which no legal route reaches another city, or where there is none, any city in a hex with
 * no station; Toronto, holding the CN's, never takes one (GTG §7.4, designer's ruling).
 */
export const StartHomes1867 = new UnconnectedCityHomes({
    map: Map1867,
    tileSet: TileSet1867,
    stationRules: StationRules1867,
    connectedWhereNone: true,
    wholeHex: true,
    available: (state, center) => !greenCityClosed(state, center.locationId, center.nodeId)
})

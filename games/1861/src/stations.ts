import {
    UnconnectedCityHomes,
    getCompany,
    hexDistance,
    perHexStationCost,
    type FormationState,
    type MapStateData,
    type StartHome,
    type StationRules
} from '@tabletop/18xx'
import { StationCostPerHex1861 } from './companies.js'
import { Map1861 } from './map.js'
import { TileSet1861 } from './tiles.js'

/** The hexes between two map locations, without regard to track (§10.5). */
export function hexDistance1861(fromLocationId: string, toLocationId: string): number {
    return hexDistance(Map1861, fromLocationId, toLocationId)
}

export const StationRules1861: StationRules = {
    map: Map1861,
    tileSet: TileSet1861,
    // A public company's second station costs R20 a hex from its first, its third R40 a hex from
    // the nearer of the two; the one placed as the company forms is free (§10.5).
    placementCost: perHexStationCost(Map1861, StationCostPerHex1861),
    // Only public companies place stations as they operate, one each round (§10.5).
    placementLimit: (state, companyId) => (getCompany(state, companyId).kind === 'major' ? 1 : 0),
    pendingHomes: () => []
}

const StartHomes1861 = new UnconnectedCityHomes({
    map: Map1861,
    tileSet: TileSet1861,
    stationRules: StationRules1861,
    connectedWhereNone: false
})

/**
 * Where a new public company may put its first station: any city space that is neither reserved
 * nor in a city with a station already, and from which no legal route reaches another city
 * (§9.3).
 */
export function majorStartHomes1861(
    state: FormationState & MapStateData,
    companyId: string
): StartHome[] {
    return StartHomes1861.homes(state, companyId)
}

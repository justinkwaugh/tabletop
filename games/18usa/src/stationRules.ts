import type { StationRules } from '@tabletop/18xx'
import { EighteenUSAMap } from './map.js'
import { EighteenUSATileSet, isCompanyTown } from './tiles.js'

// Stations are bought when a company forms, so placing one costs nothing (§12.3); no station
// but its own ever goes on a Company Town (BGG ruling PR-27).
export const EighteenUSAStationRules: StationRules = {
    map: EighteenUSAMap,
    tileSet: EighteenUSATileSet,
    cityClosed: (state, locationId) => isCompanyTown(state.tileInventory, locationId),
    placementCost: () => 0,
    placementLimit: () => 1,
    pendingHomes: () => []
}

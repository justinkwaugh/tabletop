import type { StationRules } from '@tabletop/18xx'
import { EighteenUSAMap } from './map.js'
import { EighteenUSATileSet, isCompanyTown } from './tiles.js'

// Stations are bought when a company forms, so placing one costs nothing (§12.3); no station
// but its own ever goes on a Company Town (BGG ruling PR-27).
export const EighteenUSAStationRules: StationRules = {
    map: EighteenUSAMap,
    tileSet: EighteenUSATileSet,
    cityClosed: (state, locationId) => isCompanyTown(state.tileInventory, locationId),
    // Nor does it block another company's way to a city beyond it (BGG ruling PR-27).
    passesStations: (state, _companyId, center) =>
        isCompanyTown(state.tileInventory, center.locationId),
    placementCost: () => 0,
    placementLimit: () => 1,
    pendingHomes: () => []
}

import type { StationRules } from '@tabletop/18xx'
import { EighteenSeventeenMap } from './map.js'
import { EighteenSeventeenTileSet } from './tiles.js'

// Stations are bought when a company forms, so placing one costs nothing; the home is placed
// when the company's auction is settled.
export const EighteenSeventeenStationRules: StationRules = {
    map: EighteenSeventeenMap,
    tileSet: EighteenSeventeenTileSet,
    placementCost: () => 0,
    placementLimit: () => 1,
    pendingHomes: () => []
}

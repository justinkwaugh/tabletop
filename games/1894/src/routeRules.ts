import type { RouteRules } from '@tabletop/18xx'
import { EighteenNinetyFourMap } from './map.js'
import { EighteenNinetyFourTileSet } from './tiles.js'
import { EighteenNinetyFourPhases, EighteenNinetyFourTrainDepot } from './trains.js'

export const EighteenNinetyFourRouteRules: RouteRules = {
    map: EighteenNinetyFourMap,
    tileSet: EighteenNinetyFourTileSet,
    depot: EighteenNinetyFourTrainDepot,
    // Yellow values apply until the brown phase (§15).
    revenueStage: (state) => EighteenNinetyFourPhases.phase(state.phaseId).tileColors,
    requiresCity: () => false
}

import type { RouteRules } from '@tabletop/18xx'
import { EighteenThirtyMap } from './map.js'
import { EighteenThirtyTileSet } from './tiles.js'
import { EighteenThirtyPhases, EighteenThirtyTrainDepot } from './trains.js'
export const EighteenThirtyRouteRules: RouteRules = {
    map: EighteenThirtyMap,
    tileSet: EighteenThirtyTileSet,
    depot: EighteenThirtyTrainDepot,
    revenueStage: (state) => EighteenThirtyPhases.phase(state.phaseId).tileColors,
    requiresCity: () => false
}

import type { RouteRules } from '@tabletop/18xx'
import { EighteenSeventeenMap } from './map.js'
import { EighteenSeventeenTileSet } from './tiles.js'
import { EighteenSeventeenPhases, EighteenSeventeenTrainDepot } from './trains.js'
export const EighteenSeventeenRouteRules: RouteRules = {
    map: EighteenSeventeenMap,
    tileSet: EighteenSeventeenTileSet,
    depot: EighteenSeventeenTrainDepot,
    revenueStage: (state) => EighteenSeventeenPhases.phase(state.phaseId).tileColors,
    requiresCity: () => false,
    oneStopPerHex: true
}

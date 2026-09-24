import type { RouteRules } from '@tabletop/18xx'
import { TheOldPrinceMap } from './map.js'
import { TheOldPrinceTileSet } from './tiles.js'
import { TheOldPrincePhases, TheOldPrinceTrainDepot } from './trains.js'
export const TheOldPrinceRouteRules: RouteRules = {
    map: TheOldPrinceMap,
    tileSet: TheOldPrinceTileSet,
    depot: TheOldPrinceTrainDepot,
    revenueStage(state, _train) {
        return TheOldPrincePhases.phase(state.phaseId).tileColors
    },
    requiresCity: (train) => train.distance.measure === 'cities-and-offboards'
}

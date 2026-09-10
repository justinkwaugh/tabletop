import { assertExists } from '@tabletop/common'
import type { RouteRules } from '@tabletop/18xx'
import { TheOldPrinceMap } from './map.js'
import { TheOldPrinceTileSet } from './tiles.js'
import { TheOldPrinceTrainDepot } from './trains.js'
import { TheOldPrinceTrackColors } from './trackRules.js'
export const TheOldPrinceRouteRules: RouteRules = {
    map: TheOldPrinceMap,
    tileSet: TheOldPrinceTileSet,
    depot: TheOldPrinceTrainDepot,
    revenueStage(state, train) {
        const colors = TheOldPrinceTrackColors[state.phaseId]
        assertExists(colors, 'Unknown phase')
        return colors
    },
    requiresCity: (train) => train.distance.measure === 'cities-and-offboards'
}

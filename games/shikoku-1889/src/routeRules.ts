import type { RouteRules } from '@tabletop/18xx'
import { Shikoku1889Map } from './map.js'
import { Shikoku1889TileSet } from './tiles.js'
import { Shikoku1889Phases, Shikoku1889TrainDepot } from './trains.js'
export const Shikoku1889RouteRules: RouteRules = {
    map: Shikoku1889Map,
    tileSet: Shikoku1889TileSet,
    depot: Shikoku1889TrainDepot,
    revenueStage(state, train) {
        const colors = Shikoku1889Phases.phase(state.phaseId).tileColors
        return train.id === 'D' ? [...colors, 'diesel'] : colors
    },
    requiresCity: (_train) => false
}

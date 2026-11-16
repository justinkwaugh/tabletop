import type { RouteRules } from '@tabletop/18xx'
import { MapChesapeake } from './map.js'
import { TileSetChesapeake } from './tiles.js'
import { PhasesChesapeake, TrainDepotChesapeake } from './trains.js'

/** Red areas pay the value of the newest tile colour on sale. */
export function revenueStageChesapeake(phaseId: string): readonly string[] {
    return PhasesChesapeake.phase(phaseId).tileColors
}

export const RouteRulesChesapeake: RouteRules = {
    map: MapChesapeake,
    tileSet: TileSetChesapeake,
    depot: TrainDepotChesapeake,
    revenueStage: (state) => revenueStageChesapeake(state.phaseId),
    requiresCity: () => false
}

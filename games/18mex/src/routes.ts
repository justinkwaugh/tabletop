import type { RouteRules } from '@tabletop/18xx'
import { MapMex } from './map.js'
import { TileSetMex, mapStateMex } from './tiles.js'
import { PhasesMex, TrainDepotMex, revenueMultiplier } from './trains.js'

export const RouteRulesMex: RouteRules = {
    map: MapMex,
    tileSet: TileSetMex,
    depot: TrainDepotMex,
    // Red areas and the three gray cities pay their higher value from the first 5-train, as
    // brown tiles come (4.4.2.1).
    revenueStage: (state) => PhasesMex.phase(state.phaseId).tileColors,
    requiresCity: () => false,
    // A 4D-train doubles its cities and red areas, not its towns (4.4.2.1; Appendix 1).
    stopRevenue(state, _companyId, center, printed, train) {
        const multiplier = revenueMultiplier(train.id)
        if (multiplier === 1) return printed
        const node = mapStateMex(state)
            .tile(center.locationId)
            .face.nodes.find((entry) => entry.id === center.nodeId)
        return node?.kind === 'town' ? printed : printed * multiplier
    }
}

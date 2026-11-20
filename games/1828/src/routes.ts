import { RailwayMapState, type RouteRules } from '@tabletop/18xx'
import { CoalAccess } from './coal.js'
import { Map1828 } from './map.js'
import { TileSet1828 } from './tiles.js'
import { DoubleTrainId, ExpressTrainId, TrainDepot1828, revenueStage1828 } from './trains.js'

export const RouteRules1828: RouteRules = {
    map: Map1828,
    tileSet: TileSet1828,
    depot: TrainDepot1828,
    revenueStage: (state) => revenueStage1828(state.phaseId),
    requiresCity: () => false,
    // Only a company holding a coal marker runs to or through the Virginia Coalfields (§15.2).
    stopAllowed: (state, companyId, center) => CoalAccess.open(state, companyId, center),
    // A 3+D doubles everything it visits; an 8E's towns pay nothing (§15.3.2, §15.3.3).
    stopRevenue(state, _companyId, center, printed, train) {
        if (train.id === DoubleTrainId) return printed * 2
        if (train.id !== ExpressTrainId) return printed
        const face = new RailwayMapState(Map1828, TileSet1828, state.tileInventory).tile(
            center.locationId
        ).face
        const node = face.nodes.find((entry) => entry.id === center.nodeId)
        return node?.kind === 'town' ? 0 : printed
    }
}

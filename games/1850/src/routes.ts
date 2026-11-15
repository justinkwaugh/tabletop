import type { RouteRules } from '@tabletop/18xx'
import { edgeBonus } from './edgeTokens.js'
import { Map1850 } from './map.js'
import { MesabiAccess } from './mesabiAccess.js'
import { TileSet1850 } from './tiles.js'
import { TrainDepot1850, revenueStages } from './trains.js'

export const RouteRules1850: RouteRules = {
    map: Map1850,
    tileSet: TileSet1850,
    depot: TrainDepot1850,
    revenueStage: (state) => revenueStages(state.phaseId),
    requiresCity: () => false,
    stopAllowed: MesabiAccess.open,
    stopBonus: (state, _train, companyId, center) => edgeBonus(state, companyId, center),
    stopBonusSourceIds: (state, _train, companyId, center) =>
        edgeBonus(state, companyId, center) ? ['edge'] : []
}

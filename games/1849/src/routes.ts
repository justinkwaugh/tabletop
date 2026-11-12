import type { RouteRules } from '@tabletop/18xx'
import { Map1849 } from './map.js'
import { requireState1849 } from './state.js'
import { TileSet1849 } from './tiles.js'
import { TrainDepot1849, revenueStages1849 } from './trains.js'

export const PortBonus1849 = 20

/** The +L. 20 a port pays the corporation that put the token there (§7.1). */
function portBonus(state: object, companyId: string, locationId: string): number {
    const bonus = requireState1849(state).portBonus
    return bonus?.companyId === companyId && bonus.locationId === locationId ? PortBonus1849 : 0
}

// Grey values follow the phase; a route needs a city with the company's station (§10.1,
// §10.5.1, §10.5.2).
export const RouteRules1849: RouteRules = {
    map: Map1849,
    tileSet: TileSet1849,
    depot: TrainDepot1849,
    revenueStage: (state) => revenueStages1849(state.phaseId),
    requiresCity: () => true,
    stopBonus: (state, _train, companyId, center) => portBonus(state, companyId, center.locationId),
    stopBonusSourceIds: (state, _train, companyId, center) =>
        portBonus(state, companyId, center.locationId) ? ['port'] : []
}

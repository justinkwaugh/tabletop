import type { RouteRevenuePolicy, RouteRules, TrainDefinition } from '@tabletop/18xx'
import { HudsonBay, HudsonBayBonus, Map1882, WesternExits } from './map.js'
import { HudsonBayBonusId } from './names.js'
import { TileSet1882 } from './tiles.js'
import { Phases1882, TrainDepot1882 } from './trains.js'

/** Red off-board areas pay their first value until phase 5 and their second after (§8). */
export function revenueStage1882(phaseId: string): readonly string[] {
    return Phases1882.phase(phaseId).tileColors
}

/** A route joining Hudson Bay to Northern Alberta or Western Canada earns $100 more (§11.5). */
function revenuePolicy(_train: TrainDefinition): RouteRevenuePolicy {
    return {
        connectionBonuses: [
            {
                from: { [HudsonBay]: 0 },
                to: Object.fromEntries(WesternExits.map((id) => [id, HudsonBayBonus])),
                sourceId: HudsonBayBonusId
            }
        ]
    }
}

export const RouteRules1882: RouteRules = {
    map: Map1882,
    tileSet: TileSet1882,
    depot: TrainDepot1882,
    revenueStage: (state) => revenueStage1882(state.phaseId),
    requiresCity: () => false,
    revenuePolicy
}
